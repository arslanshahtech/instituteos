import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest } from '../api/client.js';

export type ReportType = 'finance' | 'attendance' | 'students';

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

export interface AuditLog {
  id: string;
  organizationId: string;
  campusId?: string;
  actorId: string;
  action: string;
  entityType: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  createdAt: string;
}

export interface AuditLogFilters {
  action?: string;
  entityType?: string;
  dateFrom?: string;
  dateTo?: string;
  campusId?: string;
  page: number;
  pageSize: number;
}

export interface AuditLogPage {
  items: AuditLog[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export type ReportRow = Record<string, string | number | null>;

const reportingPath = (organizationId: string) =>
  `/organizations/${encodeURIComponent(organizationId)}`;

export function getOrganizationSummary(
  organizationId: string,
  campusId?: string,
) {
  const query = new URLSearchParams();
  if (campusId) query.set('campusId', campusId);
  return apiRequest<{ summary: OrganizationSummary }>(
    `${reportingPath(organizationId)}/reports/summary${query.size ? `?${query}` : ''}`,
  );
}

export function useOrganizationSummary(
  organizationId: string,
  campusId?: string,
  enabled = true,
) {
  return useQuery({
    queryKey: ['reporting', organizationId, 'summary', campusId ?? 'all'],
    queryFn: () => getOrganizationSummary(organizationId, campusId),
    enabled: Boolean(organizationId) && enabled,
    retry: false,
  });
}

export function getAuditLogs(
  organizationId: string,
  filters: AuditLogFilters,
) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== '') query.set(key, String(value));
  }
  return apiRequest<AuditLogPage>(
    `${reportingPath(organizationId)}/audit-logs?${query}`,
  );
}

export function useAuditLogs(
  organizationId: string,
  filters: AuditLogFilters,
  enabled = true,
) {
  return useQuery({
    queryKey: ['reporting', organizationId, 'audit-logs', filters],
    queryFn: () => getAuditLogs(organizationId, filters),
    enabled: Boolean(organizationId) && enabled,
    retry: false,
    placeholderData: (previousData) => previousData,
  });
}

function csvCell(value: string | number | null): string {
  let text = value === null ? '' : String(value);
  if (/^[\t\r ]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

function rowsToCsv(rows: ReportRow[]): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]!);
  return [
    headers.map(csvCell).join(','),
    ...rows.map((row) => headers.map((header) => csvCell(row[header] ?? null)).join(',')),
  ].join('\r\n');
}

export async function exportReport(
  organizationId: string,
  type: ReportType,
  format: 'csv' | 'json' = 'csv',
): Promise<void> {
  const result = await apiRequest<{ reportType: ReportType; rows: ReportRow[] }>(
    `${reportingPath(organizationId)}/reports/${type}/export`,
  );
  const content =
    format === 'json'
      ? JSON.stringify(result.rows, null, 2)
      : rowsToCsv(result.rows);
  const mimeType = format === 'json' ? 'application/json' : 'text/csv';
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = `${type}-report-${new Date().toISOString().slice(0, 10)}.${format}`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
}

export function useExportReport(organizationId: string) {
  return useMutation({
    mutationFn: (input: { type: ReportType; format?: 'csv' | 'json' }) =>
      exportReport(organizationId, input.type, input.format),
  });
}
