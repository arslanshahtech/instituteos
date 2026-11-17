import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest } from '../api/client.js';

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
export type ReportFormat = 'xlsx' | 'csv' | 'pdf' | 'json';

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
  attendance: { todayAttendanceRate: number; recordsCount: number };
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
export type ReportRow = Record<string, string | number | boolean | null>;

export interface TransferHistoryItem {
  id: string;
  direction: 'import' | 'export';
  dataType: ReportType;
  format: ReportFormat;
  fileName: string;
  status: 'completed' | 'partial' | 'failed';
  totalRows: number;
  createdRows: number;
  skippedRows: number;
  failedRows: number;
  campusId?: string;
  createdAt: string;
}

export function useTransferHistory(organizationId: string, enabled = true) {
  return useQuery({
    queryKey: ['reporting', organizationId, 'transfer-history'],
    queryFn: () =>
      apiRequest<{ items: TransferHistoryItem[] }>(
        reportingPath(organizationId) + '/reports/transfer-history',
      ),
    enabled: Boolean(organizationId) && enabled,
    retry: false,
  });
}

export function recordTransferHistory(
  organizationId: string,
  input: {
    direction: 'import' | 'export';
    dataType: ReportType;
    format: ReportFormat;
    fileName: string;
    totalRows: number;
    createdRows: number;
    skippedRows?: number;
    failedRows?: number;
    campusId?: string;
  },
) {
  return apiRequest<{ item: TransferHistoryItem }>(
    reportingPath(organizationId) + '/reports/transfer-history',
    { method: 'POST', body: JSON.stringify(input) },
  );
}

const reportingPath = (organizationId: string) =>
  `/organizations/${encodeURIComponent(organizationId)}`;

function filterQuery(filters: ReportFilters) {
  const query = new URLSearchParams();
  if (filters.campusId) query.set('campusId', filters.campusId);
  if (filters.dateFrom) query.set('dateFrom', filters.dateFrom);
  if (filters.dateTo) query.set('dateTo', filters.dateTo);
  return query;
}

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
export function getAuditLogs(organizationId: string, filters: AuditLogFilters) {
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
function csvCell(value: unknown): string {
  let text = value === null || value === undefined ? '' : String(value);
  if (/^[\t\r ]*[=+@-]/.test(text)) text = "'" + text;
  return `"${text.replaceAll('"', '""')}"`;
}
function rowsToCsv(rows: ReportRow[]): string {
  if (!rows.length) return 'No records';
  const headers = Object.keys(rows[0]!);
  return [
    headers.map(csvCell).join(','),
    ...rows.map((row) =>
      headers.map((header) => csvCell(row[header])).join(','),
    ),
  ].join('\r\n');
}
export async function getReportRows(
  organizationId: string,
  type: ReportType,
  filters: ReportFilters = {},
): Promise<ReportRow[]> {
  const query = filterQuery(filters);
  const result = await apiRequest<{
    reportType: ReportType;
    rows: ReportRow[];
  }>(
    `${reportingPath(organizationId)}/reports/${type}/export${query.size ? `?${query}` : ''}`,
  );
  return result.rows;
}
function downloadBlob(content: BlobPart, mime: string, filename: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function escapeHtml(value: unknown) {
  return String(value ?? '').replace(
    /[&<>"]/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
      })[character] ?? character,
  );
}
export async function exportReport(
  organizationId: string,
  type: ReportType,
  format: ReportFormat = 'xlsx',
  filters: ReportFilters = {},
): Promise<boolean> {
  // Open the print window during the original click gesture so browsers do not
  // block it after the asynchronous report request completes.
  const printWindow = format === 'pdf' ? window.open('', '_blank') : null;
  if (format === 'pdf' && !printWindow) {
    throw new Error('Allow pop-ups to create the PDF report.');
  }

  let rows: ReportRow[];
  try {
    rows = await getReportRows(organizationId, type, filters);
  } catch (error) {
    printWindow?.close();
    throw error;
  }
  const date = new Date().toISOString().slice(0, 10);
  const filename = `${type}-report-${date}`;
  if (format === 'json') {
    downloadBlob(
      JSON.stringify(rows, null, 2),
      'application/json;charset=utf-8',
      `${filename}.json`,
    );
  } else if (format === 'csv') {
    downloadBlob(
      '\uFEFF' + rowsToCsv(rows),
      'text/csv;charset=utf-8',
      `${filename}.csv`,
    );
  } else if (format === 'xlsx') {
    const ExcelJS = (await import('exceljs')).default;
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'InstituteOS';
    workbook.created = new Date();
    const worksheet = workbook.addWorksheet('Report', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });
    const headers = Object.keys(rows[0] ?? {});
    worksheet.columns = headers.length
      ? headers.map((key) => ({
          header: key.replaceAll('_', ' '),
          key,
          width: Math.min(36, Math.max(14, key.length + 4)),
        }))
      : [{ header: 'Message', key: 'message', width: 42 }];
    if (rows.length) {
      worksheet.addRows(rows);
    } else {
      worksheet.addRow({
        message: 'No records found for the selected filters.',
      });
    }
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF243746' },
    };
    worksheet.autoFilter = headers.length
      ? { from: 'A1', to: { row: 1, column: headers.length } }
      : undefined;
    const buffer = await workbook.xlsx.writeBuffer();
    downloadBlob(
      buffer as unknown as BlobPart,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      filename + '.xlsx',
    );
  } else {
    const headers = Object.keys(rows[0] ?? {});
    const table = rows.length
      ? `<table><thead><tr>${headers.map((header) => `<th>${escapeHtml(header.replaceAll('_', ' '))}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${headers.map((header) => `<td>${escapeHtml(row[header])}</td>`).join('')}</tr>`).join('')}</tbody></table>`
      : '<p>No records found for the selected filters.</p>';
    if (!printWindow) throw new Error('PDF report window is unavailable.');
    printWindow.addEventListener('load', () => printWindow.print(), {
      once: true,
    });
    printWindow.document.write(
      `<!doctype html><html><head><title>${escapeHtml(type)} report</title><style>body{font:12px Arial,sans-serif;color:#17212b;padding:28px}h1{font-size:22px;margin:0 0 8px;text-transform:capitalize}p{color:#65717d}table{width:100%;border-collapse:collapse;margin-top:22px}th,td{border:1px solid #dce2e7;padding:8px;text-align:left;word-break:break-word}th{background:#f1f4f6;text-transform:capitalize}@media print{body{padding:0}}</style></head><body><h1>${escapeHtml(type)} report</h1><p>Generated ${date} · ${rows.length} records</p>${table}</body></html>`,
    );
    printWindow.document.close();
  }
  try {
    await recordTransferHistory(organizationId, {
      direction: 'export',
      dataType: type,
      format,
      fileName: filename + '.' + format,
      totalRows: rows.length,
      createdRows: rows.length,
      ...(filters.campusId ? { campusId: filters.campusId } : {}),
    });
    return true;
  } catch {
    // The file is already prepared/downloaded; history failure must not report
    // the export itself as failed. The caller can show a separate warning.
    return false;
  }
}
export function useExportReport(organizationId: string) {
  return useMutation({
    mutationFn: (input: {
      type: ReportType;
      format?: ReportFormat;
      filters?: ReportFilters;
    }) => exportReport(organizationId, input.type, input.format, input.filters),
  });
}
