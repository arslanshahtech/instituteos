import mongoose from 'mongoose';
import { AppError } from '../../errors/app-error.js';
import type {
  AuditLogQuery,
  OrganizationSummary,
  ReportDataRow,
  ReportingRepository,
  ReportType,
} from './reporting.types.js';

const reportTypes: readonly ReportType[] = [
  'finance',
  'attendance',
  'students',
];

function validateOrganizationId(organizationId: string): void {
  if (!mongoose.isValidObjectId(organizationId)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Select a valid organization.');
  }
}

function validDate(value: string, field: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new AppError(400, 'VALIDATION_ERROR', `Enter a valid ${field}.`);
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  ) {
    throw new AppError(400, 'VALIDATION_ERROR', `Enter a valid ${field}.`);
  }
  return value;
}

function normalizedAuditQuery(query: AuditLogQuery): AuditLogQuery {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;
  if (!Number.isInteger(page) || page < 1) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'Page must be a positive integer.',
    );
  }
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'Page size must be between 1 and 100.',
    );
  }
  for (const [value, field] of [
    [query.action, 'action'],
    [query.entityType, 'entity type'],
  ] as const) {
    if (value !== undefined && (!value.trim() || value.length > 100)) {
      throw new AppError(400, 'VALIDATION_ERROR', `Enter a valid ${field}.`);
    }
  }
  if (query.campusId && !mongoose.isValidObjectId(query.campusId)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Select a valid campus.');
  }
  const dateFrom = query.dateFrom
    ? validDate(query.dateFrom, 'start date')
    : undefined;
  const dateTo = query.dateTo ? validDate(query.dateTo, 'end date') : undefined;
  if (dateFrom && dateTo && dateFrom > dateTo) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'Start date must not be after end date.',
    );
  }
  return { ...query, page, pageSize, dateFrom, dateTo };
}

function authorizedCampuses(
  campusIds: string[] | undefined,
  requestedCampusId: string | undefined,
): string[] | undefined {
  if (!requestedCampusId) return campusIds;
  if (!campusIds) return [requestedCampusId];
  if (!campusIds.includes(requestedCampusId)) {
    throw new AppError(
      403,
      'CAMPUS_FORBIDDEN',
      'You are not authorized for this campus.',
    );
  }
  return [requestedCampusId];
}

export class ReportingService {
  constructor(private readonly repository: ReportingRepository) {}

  async getOrganizationSummary(
    organizationId: string,
    campusIds?: string[],
  ): Promise<OrganizationSummary> {
    validateOrganizationId(organizationId);
    const [
      activeStudentCount,
      activeStaffCount,
      activeClassCount,
      finance,
      attendance,
    ] = await Promise.all([
      this.repository.countActiveStudents(organizationId, campusIds),
      this.repository.countActiveStaff(organizationId, campusIds),
      this.repository.countActiveClasses(organizationId, campusIds),
      this.repository.getFinanceOverview(organizationId, campusIds),
      this.repository.getTodayAttendanceStats(organizationId, campusIds),
    ]);
    return {
      activeStudentCount,
      activeStaffCount,
      activeClassCount,
      finance,
      attendance: {
        todayAttendanceRate:
          attendance.total > 0
            ? Number(
                ((attendance.attended / attendance.total) * 100).toFixed(2),
              )
            : 0,
        recordsCount: attendance.total,
      },
    };
  }

  async listAuditLogs(organizationId: string, query: AuditLogQuery) {
    validateOrganizationId(organizationId);
    const normalized = normalizedAuditQuery(query);
    const campusIds = authorizedCampuses(query.campusIds, normalized.campusId);
    return this.repository.listAuditLogs(organizationId, normalized, campusIds);
  }

  async exportReportData(
    organizationId: string,
    reportType: ReportType,
    campusIds?: string[],
    campusId?: string,
  ): Promise<ReportDataRow[]> {
    validateOrganizationId(organizationId);
    if (!reportTypes.includes(reportType)) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Select a valid report type.',
      );
    }
    return this.repository.exportReportData(
      organizationId,
      reportType,
      authorizedCampuses(campusIds, campusId),
    );
  }
}
