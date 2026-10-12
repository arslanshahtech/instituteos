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
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  };
}

function repository(overrides: Partial<SettingsRepository> = {}) {
  return {
    findSettings: vi.fn().mockResolvedValue(null),
    updateSettings: vi.fn().mockImplementation(
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
      };
      },
    ),
    createSettingsAuditLog: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as SettingsRepository;
}

describe('SettingsService', () => {
  it('returns default settings when the organization has not configured them', async () => {
    const service = new SettingsService(repository(), () =>
      new Date('2026-01-01T00:00:00.000Z'),
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
