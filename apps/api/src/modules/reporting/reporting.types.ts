import type { AuditLogRecord } from '../audit/audit.types.js';

export type ReportType =
  | 'students'
  | 'staff'
  | 'attendance'
  | 'finance'
  | 'payments'
  | 'expenses'
  | 'payroll'
  | 'advances'
  | 'classes'
  | 'sections'
  | 'subjects'
  | 'exams'
  | 'results'
  | 'admissions'
  | 'admission-inquiries'
  | 'organization'
  | 'audit';

export interface ReportFilters {
  campusId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface OrganizationSummary {
  activeStudentCount: number;
  activeStaffCount: number;
  activeClassCount: number;
  finance: {
    totalInvoiced: string;
    totalCollected: string;
    totalPending: string;
    totalOverdue: string;
  };
  attendance: {
    todayAttendanceRate: number;
    recordsCount: number;
  };
}

export interface AttendanceStats {
  total: number;
  attended: number;
}

export interface AuditLogQuery {
  page?: number;
  pageSize?: number;
  action?: string;
  entityType?: string;
  dateFrom?: string;
  dateTo?: string;
  campusId?: string;
  campusIds?: string[];
}

export interface AuditLogPage {
  items: AuditLogRecord[];
  total: number;
}

export type ReportDataRow = Record<string, string | number | boolean | null>;

export interface ReportingRepository {
  countActiveStudents(
    organizationId: string,
    campusIds?: string[],
  ): Promise<number>;
  countActiveStaff(
    organizationId: string,
    campusIds?: string[],
  ): Promise<number>;
  countActiveClasses(
    organizationId: string,
    campusIds?: string[],
  ): Promise<number>;
  getFinanceOverview(
    organizationId: string,
    campusIds?: string[],
  ): Promise<OrganizationSummary['finance']>;
  getTodayAttendanceStats(
    organizationId: string,
    campusIds?: string[],
  ): Promise<AttendanceStats>;
  listAuditLogs(
    organizationId: string,
    query: AuditLogQuery,
    campusIds?: string[],
  ): Promise<AuditLogPage>;
  exportReportData(
    organizationId: string,
    reportType: ReportType,
    campusIds?: string[],
    filters?: ReportFilters,
  ): Promise<ReportDataRow[]>;
}
