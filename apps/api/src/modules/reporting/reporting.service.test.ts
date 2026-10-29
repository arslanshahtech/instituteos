import { describe, expect, it, vi } from 'vitest';
import { ReportingService } from './reporting.service.js';
import type { ReportingRepository } from './reporting.types.js';

const organizationId = '650000000000000000000001';
const campusOne = '650000000000000000000002';
const campusTwo = '650000000000000000000003';

function makeRepository(overrides: Partial<ReportingRepository> = {}) {
  return {
    countActiveStudents: vi.fn().mockResolvedValue(24),
    countActiveStaff: vi.fn().mockResolvedValue(6),
    countActiveClasses: vi.fn().mockResolvedValue(4),
    getFinanceOverview: vi.fn().mockResolvedValue({
      totalInvoiced: '1250.00',
      totalCollected: '900.00',
      totalPending: '350.00',
      totalOverdue: '100.00',
    }),
    getTodayAttendanceStats: vi.fn().mockResolvedValue({
      total: 20,
      attended: 17,
    }),
    listAuditLogs: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    exportReportData: vi.fn().mockResolvedValue([]),
    ...overrides,
  } as unknown as ReportingRepository;
}

describe('ReportingService', () => {
  it('aggregates the organization summary over the authorized campuses', async () => {
    const repository = makeRepository();
    const service = new ReportingService(repository);

    await expect(
      service.getOrganizationSummary(organizationId, [campusOne, campusTwo]),
    ).resolves.toEqual({
      activeStudentCount: 24,
      activeStaffCount: 6,
      activeClassCount: 4,
      finance: {
        totalInvoiced: '1250.00',
        totalCollected: '900.00',
        totalPending: '350.00',
        totalOverdue: '100.00',
      },
      attendance: { todayAttendanceRate: 85, recordsCount: 20 },
    });
    expect(repository.countActiveStudents).toHaveBeenCalledWith(
      organizationId,
      [campusOne, campusTwo],
    );
    expect(repository.getFinanceOverview).toHaveBeenCalledWith(organizationId, [
      campusOne,
      campusTwo,
    ]);
  });

  it('returns a zero attendance rate when no attendance records exist', async () => {
    const repository = makeRepository({
      getTodayAttendanceStats: vi
        .fn()
        .mockResolvedValue({ total: 0, attended: 0 }),
    });

    const summary = await new ReportingService(
      repository,
    ).getOrganizationSummary(organizationId);

    expect(summary.attendance).toEqual({
      todayAttendanceRate: 0,
      recordsCount: 0,
    });
  });

  it('applies audit filters, pagination, and an authorized campus selection', async () => {
    const repository = makeRepository();
    const service = new ReportingService(repository);
    const query = {
      action: 'PAYMENT_RECORDED',
      entityType: 'payment',
      dateFrom: '2026-10-01',
      dateTo: '2026-10-12',
      page: 2,
      pageSize: 10,
      campusId: campusOne,
      campusIds: [campusOne, campusTwo],
    };

    await service.listAuditLogs(organizationId, query);

    expect(repository.listAuditLogs).toHaveBeenCalledWith(
      organizationId,
      expect.objectContaining({
        action: 'PAYMENT_RECORDED',
        entityType: 'payment',
        dateFrom: '2026-10-01',
        dateTo: '2026-10-12',
        page: 2,
        pageSize: 10,
      }),
      [campusOne],
    );
  });

  it('rejects audit and export requests outside the assigned campus boundary', async () => {
    const repository = makeRepository();
    const service = new ReportingService(repository);

    await expect(
      service.listAuditLogs(organizationId, {
        campusId: campusTwo,
        campusIds: [campusOne],
      }),
    ).rejects.toMatchObject({ statusCode: 403, code: 'CAMPUS_FORBIDDEN' });
    await expect(
      service.exportReportData(
        organizationId,
        'students',
        [campusOne],
        campusTwo,
      ),
    ).rejects.toMatchObject({ statusCode: 403, code: 'CAMPUS_FORBIDDEN' });
    expect(repository.listAuditLogs).not.toHaveBeenCalled();
    expect(repository.exportReportData).not.toHaveBeenCalled();
  });

  it('preserves an empty campus assignment as an empty scope', async () => {
    const repository = makeRepository();
    const service = new ReportingService(repository);

    await service.getOrganizationSummary(organizationId, []);
    await service.listAuditLogs(organizationId, { campusIds: [] });

    expect(repository.countActiveStudents).toHaveBeenCalledWith(
      organizationId,
      [],
    );
    expect(repository.listAuditLogs).toHaveBeenCalledWith(
      organizationId,
      expect.any(Object),
      [],
    );
  });
});
