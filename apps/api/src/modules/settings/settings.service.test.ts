import { describe, expect, it, vi } from 'vitest';
import { SettingsService } from './settings.service.js';
import type {
  OrganizationSettingsInput,
  OrganizationSettingsRecord,
  SettingsRepository,
} from './settings.types.js';

const organizationId = '650000000000000000000001';
const userId = '650000000000000000000002';

function settingsRecord(
  overrides: Partial<OrganizationSettingsRecord> = {},
): OrganizationSettingsRecord {
  const timestamp = '2026-01-01T00:00:00.000Z';
  return {
    organizationId,
    branding: { primaryColor: '#0f766e' },
    contact: {},
    localization: {
      timezone: 'Asia/Karachi',
      currency: 'PKR',
      dateFormat: 'YYYY-MM-DD',
    },
    notifications: {
      emailAlerts: true,
      smsAlerts: false,
      autoAttendanceAlerts: false,
    },
    staffSetup: { departments: [], designations: [], employmentTypes: [], workShifts: [], qualifications: [], documentTypes: [] },
    teacherSelfAttendance: {
      viewOwnAttendance: true,
      selfMarkingEnabled: false,
      allowedStatuses: ['present'],
    },
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  };
}

function repository(overrides: Partial<SettingsRepository> = {}) {
  return {
    findSettings: vi.fn().mockResolvedValue(null),
    updateSettings: vi
      .fn()
      .mockImplementation(
        async (
          _id: string,
          input: OrganizationSettingsInput,
        ): Promise<OrganizationSettingsRecord> => {
          const current = settingsRecord();
          return {
            ...current,
            branding: { ...current.branding, ...input.branding },
            contact: { ...current.contact, ...input.contact },
            localization: { ...current.localization, ...input.localization },
            notifications: {
              ...current.notifications,
              ...input.notifications,
            },
            teacherSelfAttendance: {
              ...current.teacherSelfAttendance,
              ...input.teacherSelfAttendance,
            },
            staffSetup: { ...current.staffSetup, ...input.staffSetup },
          };
        },
      ),
    createSettingsAuditLog: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as SettingsRepository;
}

describe('SettingsService', () => {
  it('returns default settings when the organization has not configured them', async () => {
    const service = new SettingsService(
      repository(),
      () => new Date('2026-01-01T00:00:00.000Z'),
    );

    await expect(service.getSettings(organizationId)).resolves.toEqual(
      settingsRecord(),
    );
  });

  it('persists updates and writes an audit log for changed settings', async () => {
    const repo = repository();
    const service = new SettingsService(repo);

    const result = await service.updateSettings(
      organizationId,
      { branding: { tagLine: 'Learning together' } },
      { userId, role: 'organization_owner' },
    );

    expect(repo.updateSettings).toHaveBeenCalledWith(organizationId, {
      branding: { tagLine: 'Learning together' },
    });
    expect(repo.createSettingsAuditLog).toHaveBeenCalledWith(
      organizationId,
      userId,
    );
    expect(result.branding.tagLine).toBe('Learning together');
  });

  it('does not write an audit log when settings did not change', async () => {
    const repo = repository({
      findSettings: vi.fn().mockResolvedValue(settingsRecord()),
    });
    const service = new SettingsService(repo);

    await service.updateSettings(
      organizationId,
      { localization: { currency: 'PKR' } },
      { userId, role: 'organization_admin' },
    );

    expect(repo.createSettingsAuditLog).not.toHaveBeenCalled();
  });

  it('persists and audits teacher self-attendance policy changes', async () => {
    const repo = repository();
    const service = new SettingsService(repo);
    const policy = {
      viewOwnAttendance: true,
      selfMarkingEnabled: true,
      allowedStatuses: ['present', 'half-day'] as Array<
        'present' | 'absent' | 'half-day' | 'on-leave'
      >,
    };

    await service.updateSettings(
      organizationId,
      { teacherSelfAttendance: policy },
      { userId, role: 'organization_owner' },
    );

    expect(repo.updateSettings).toHaveBeenCalledWith(organizationId, {
      teacherSelfAttendance: policy,
    });
    expect(repo.createSettingsAuditLog).toHaveBeenCalledWith(
      organizationId,
      userId,
    );
  });


  it('persists organization-specific staff setup lists', async () => {
    const repo = repository();
    const service = new SettingsService(repo, () => new Date('2026-01-01T00:00:00.000Z'));
    const staffSetup = {
      departments: [{ id: 'dept-1', name: 'Academics', isActive: true }],
      designations: [], employmentTypes: [], workShifts: [], qualifications: [], documentTypes: [],
    };
    await service.updateSettings(organizationId, { staffSetup }, { userId, role: 'organization_owner' });
    expect(repo.updateSettings).toHaveBeenCalledWith(organizationId, { staffSetup });
    expect(repo.createSettingsAuditLog).toHaveBeenCalledWith(organizationId, userId);
  });

  it('rejects an empty or unsupported self-attendance status list', async () => {
    const service = new SettingsService(repository());
    await expect(
      service.updateSettings(
        organizationId,
        { teacherSelfAttendance: { allowedStatuses: [] } },
        { userId, role: 'organization_owner' },
      ),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await expect(
      service.updateSettings(
        organizationId,
        {
          teacherSelfAttendance: { allowedStatuses: ['unknown' as 'present'] },
        },
        { userId, role: 'organization_owner' },
      ),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('rejects settings updates from non-manager roles', async () => {
    const repo = repository();
    const service = new SettingsService(repo);

    await expect(
      service.updateSettings(
        organizationId,
        { branding: { tagLine: 'No access' } },
        { userId, role: 'campus_admin' },
      ),
    ).rejects.toMatchObject({ statusCode: 403, code: 'ROLE_REQUIRED' });

    expect(repo.updateSettings).not.toHaveBeenCalled();
  });
});
