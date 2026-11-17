import { useState } from 'react';
import {
  CalendarCheck,
  Download,
  FileText,
  Users,
  WalletCards,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { listAcademicCampuses } from '../academics/academics-api.js';
import { Button } from '../components/ui/Button.js';
import { Dialog } from '../components/ui/Dialog.js';
import { WorkspacePageHeading } from '../components/ui/WorkspacePrimitives.js';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PermissionDeniedState,
} from '../components/ui/States.js';
import { apiMessage, useOrganizationAccess } from '../staff/StaffPageShared.js';
import { useToast } from '../components/ui/ToastProvider.js';
import type { ReportFormat, ReportRow, ReportType } from './reporting-api.js';
import {
  getReportRows,
  useExportReport,
  useTransferHistory,
} from './reporting-api.js';
import './reporting.css';

const dateFilterableReportTypes = new Set<ReportType>([
  'students',
  'staff',
  'attendance',
  'finance',
  'payments',
  'expenses',
  'payroll',
  'advances',
  'exams',
  'results',
  'admissions',
  'admission-inquiries',
  'audit',
]);
const reportOptions: { value: ReportType; label: string; group: string }[] = [
  { value: 'students', label: 'Student register', group: 'Students' },
  { value: 'staff', label: 'Staff directory', group: 'Staff' },
  { value: 'attendance', label: 'Attendance records', group: 'Attendance' },
  { value: 'finance', label: 'Fee invoices & balances', group: 'Finance' },
  { value: 'payments', label: 'Fee collection & payments', group: 'Finance' },
  { value: 'expenses', label: 'Expense report', group: 'Finance' },
  { value: 'payroll', label: 'Monthly payroll', group: 'Payroll' },
  { value: 'advances', label: 'Salary advances', group: 'Payroll' },
  { value: 'classes', label: 'Class register', group: 'Academics' },
  { value: 'sections', label: 'Section register', group: 'Academics' },
  { value: 'subjects', label: 'Subject register', group: 'Academics' },
  { value: 'exams', label: 'Examination schedule', group: 'Examinations' },
  {
    value: 'results',
    label: 'Student results & grades',
    group: 'Examinations',
  },
  { value: 'admissions', label: 'Admission applications', group: 'Admissions' },
  {
    value: 'admission-inquiries',
    label: 'Admission inquiries',
    group: 'Admissions',
  },
  {
    value: 'organization',
    label: 'Campus & organization summary',
    group: 'Organization',
  },
  { value: 'audit', label: 'Audit activity', group: 'Organization' },
];

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Date unavailable'
    : new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(date);
}

export function ReportsDashboard() {
  const { organizationId = '' } = useParams();
  const access = useOrganizationAccess(organizationId);
  const canReadReports =
    access.data?.permissions.includes('reporting.read') ?? false;
  const campusRestricted =
    access.data?.role === 'campus_admin' ||
    Boolean(access.data?.campusIds.length);
  const campuses = useQuery({
    queryKey: ['reporting', organizationId, 'campuses'],
    queryFn: () => listAcademicCampuses(organizationId),
    enabled: Boolean(
      access.data &&
      canReadReports &&
      access.data.permissions.includes('campus.read'),
    ),
    retry: false,
  });
  const [campusFilter, setCampusFilter] = useState('');
  const [reportType, setReportType] = useState<ReportType>('students');
  const [reportFormat, setReportFormat] = useState<ReportFormat>('xlsx');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [previewType, setPreviewType] = useState<ReportType | null>(null);
  const getFiltersForReport = (type: ReportType) => ({
    ...(campusFilter ? { campusId: campusFilter } : {}),
    ...(dateFilterableReportTypes.has(type) && dateFrom ? { dateFrom } : {}),
    ...(dateFilterableReportTypes.has(type) && dateTo ? { dateTo } : {}),
  });
  const previewFilters = getFiltersForReport(previewType ?? reportType);
  const preview = useQuery({
    queryKey: [
      'reporting',
      organizationId,
      'preview',
      previewType ?? 'none',
      previewFilters,
    ],
    queryFn: () => {
      if (!previewType) throw new Error('Choose a report type to preview.');
      return getReportRows(organizationId, previewType, previewFilters);
    },
    enabled: Boolean(access.data && canReadReports && previewType),
    retry: false,
  });
  const transferHistory = useTransferHistory(organizationId, canReadReports);
  const exportMutation = useExportReport(organizationId);
  const toast = useToast();

  const campusList = campuses.data?.campuses ?? [];
  const availableCampuses = campusRestricted
    ? campusList.filter((campus) => access.data?.campusIds.includes(campus.id))
    : campusList;
  const reportPermissionByType: Record<ReportType, string> = {
    students: 'student.read',
    staff: 'staff.read',
    attendance: 'attendance.read',
    finance: 'finance.read',
    payments: 'finance.read',
    expenses: 'finance.read',
    payroll: 'finance.read',
    advances: 'finance.read',
    classes: 'academics.read',
    sections: 'academics.read',
    subjects: 'academics.read',
    exams: 'academics.read',
    results: 'academics.read',
    admissions: 'admission.read',
    'admission-inquiries': 'admission.read',
    organization: 'organization.read',
    audit: 'audit.read',
  };
  const availableReportOptions = reportOptions.filter((option) =>
    access.data?.permissions.includes(reportPermissionByType[option.value]),
  );
  const activeReportType = availableReportOptions.some(
    (option) => option.value === reportType,
  )
    ? reportType
    : (availableReportOptions[0]?.value ?? 'students');
  const shortcutCards = [
    {
      id: 'students-report',
      title: 'Student report',
      description: 'Student register and profiles.',
      icon: Users,
      type: 'students' as const,
    },
    {
      id: 'attendance-report',
      title: 'Attendance report',
      description: 'Daily attendance and class records.',
      icon: CalendarCheck,
      type: 'attendance' as const,
    },
    ...(access.data?.permissions.includes('finance.read')
      ? [
          {
            id: 'finance-report',
            title: 'Fee collection report',
            description: 'Collected fees and payment records.',
            icon: WalletCards,
            type: 'payments' as const,
          },
        ]
      : []),
  ].filter((card) =>
    availableReportOptions.some((option) => option.value === card.type),
  );

  if (access.isPending) {
    return <LoadingState message="Checking reporting access..." />;
  }
  if (access.error || !access.data) {
    return (
      <ErrorState
        title="Organization unavailable"
        description={
          access.error
            ? apiMessage(access.error)
            : 'Reporting access could not be verified for this organization.'
        }
        onRetry={() => void access.refetch()}
      />
    );
  }
  if (!canReadReports) {
    return (
      <PermissionDeniedState title="Reports are not available to your role" />
    );
  }

  async function downloadReport(type: ReportType = activeReportType) {
    if (!availableReportOptions.some((option) => option.value === type)) return;
    if (
      dateFilterableReportTypes.has(type) &&
      dateFrom &&
      dateTo &&
      dateFrom > dateTo
    ) {
      toast.showToast(
        'Start date must be before or equal to end date.',
        'info',
      );
      return;
    }
    try {
      const historyRecorded = await exportMutation.mutateAsync({
        type,
        format: reportFormat,
        filters: getFiltersForReport(type),
      });
      const label =
        reportOptions.find((option) => option.value === type)?.label ??
        'Report';
      if (!historyRecorded) {
        toast.showToast(
          label + ' report downloaded, but its history could not be saved.',
          'info',
        );
        return;
      }
      await transferHistory.refetch();
      toast.showToast(label + ' report downloaded.');
    } catch (error) {
      toast.showToast(apiMessage(error), 'info');
    }
  }

  return (
    <div className="reporting-page reference-live-module">
      <WorkspacePageHeading
        className="reporting-header"
        eyebrow="Organization"
        title="Import & Export"
        description="Import records and export reports."
      />

      {campuses.error && (
        <ErrorState
          title="Campus filter unavailable"
          description={apiMessage(campuses.error)}
          onRetry={() => void campuses.refetch()}
        />
      )}

      <section
        aria-label="Quick export reports"
        className="reporting-shortcuts-section"
      >
        <div className="reporting-section-heading">
          <h2>Export reports</h2>
        </div>
        <div className="reporting-shortcuts-grid">
          {shortcutCards.map((card) => {
            const Icon = card.icon;
            return (
              <article
                className="reporting-shortcut-card reporting-report-card"
                key={card.id}
              >
                <span className="reporting-shortcut-icon" aria-hidden="true">
                  <Icon size={17} />
                </span>
                <span className="reporting-shortcut-copy">
                  <strong>{card.title}</strong>
                  <small>{card.description}</small>
                </span>
                <div className="reporting-report-actions">
                  <Button
                    onClick={() => setPreviewType(card.type)}
                    type="button"
                    variant="secondary"
                  >
                    Preview
                  </Button>
                  <Button
                    disabled={exportMutation.isPending}
                    onClick={() => void downloadReport(card.type)}
                    type="button"
                    variant="primary"
                  >
                    {exportMutation.isPending ? 'Exporting…' : 'Download'}
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section
        className="reporting-builder"
        aria-labelledby="report-builder-title"
      >
        <div className="reporting-builder-heading">
          <div>
            <p className="section-kicker">Advanced options</p>
            <h2 id="report-builder-title">Custom Export</h2>
            <p>Select a report, format and date range.</p>
          </div>
          <span className="reporting-builder-count">
            {availableReportOptions.length} available reports
          </span>
        </div>
        <div className="reporting-builder-filters">
          <label className="reporting-field" htmlFor="report-campus">
            Campus
            <select
              id="report-campus"
              value={campusFilter}
              onChange={(event) => setCampusFilter(event.target.value)}
            >
              <option value="">
                {campusRestricted ? 'All assigned campuses' : 'All campuses'}
              </option>
              {availableCampuses.map((campus) => (
                <option key={campus.id} value={campus.id}>
                  {campus.name}
                </option>
              ))}
            </select>
          </label>
          <label className="reporting-field" htmlFor="report-type">
            Report
            <select
              id="report-type"
              value={activeReportType}
              disabled={availableReportOptions.length === 0}
              onChange={(event) =>
                setReportType(event.target.value as ReportType)
              }
            >
              {[
                'Students',
                'Staff',
                'Attendance',
                'Finance',
                'Payroll',
                'Academics',
                'Examinations',
                'Admissions',
                'Organization',
              ].map((group) => (
                <optgroup key={group} label={group}>
                  {availableReportOptions
                    .filter((option) => option.group === group)
                    .map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          </label>
          <label className="reporting-field" htmlFor="report-format">
            Format
            <select
              id="report-format"
              value={reportFormat}
              onChange={(event) =>
                setReportFormat(event.target.value as ReportFormat)
              }
            >
              <option value="xlsx">Excel (.xlsx)</option>
              <option value="csv">CSV (.csv)</option>
              <option value="pdf">PDF / Print</option>
              <option value="json">JSON</option>
            </select>
          </label>
          {dateFilterableReportTypes.has(activeReportType) ? (
            <>
              <label className="reporting-field" htmlFor="report-date-from">
                Date from
                <input
                  id="report-date-from"
                  type="date"
                  value={dateFrom}
                  max={dateTo || undefined}
                  onChange={(event) => setDateFrom(event.target.value)}
                />
              </label>
              <label className="reporting-field" htmlFor="report-date-to">
                Date to
                <input
                  id="report-date-to"
                  type="date"
                  value={dateTo}
                  min={dateFrom || undefined}
                  onChange={(event) => setDateTo(event.target.value)}
                />
              </label>
            </>
          ) : (
            <p className="reporting-filter-note">
              Date filters are not available for this report.
            </p>
          )}
          <div className="reporting-builder-actions">
            <Button
              onClick={() => {
                setDateFrom('');
                setDateTo('');
                setCampusFilter('');
              }}
              type="button"
              variant="secondary"
            >
              Clear filters
            </Button>
            <Button
              disabled={availableReportOptions.length === 0}
              onClick={() => setPreviewType(activeReportType)}
              type="button"
              variant="secondary"
            >
              Preview report
            </Button>
            <Button
              disabled={
                exportMutation.isPending || availableReportOptions.length === 0
              }
              onClick={() => void downloadReport(activeReportType)}
              type="button"
              variant="primary"
            >
              <Download size={15} aria-hidden="true" />
              {exportMutation.isPending ? 'Exporting…' : 'Export report'}
            </Button>
          </div>
        </div>
      </section>

      <section
        className="reporting-import-section"
        aria-labelledby="report-import-title"
      >
        <div className="reporting-section-heading">
          <div>
            <h2 id="report-import-title">Import</h2>
          </div>
          <span className="reporting-scope-label">CSV / Excel templates</span>
        </div>
        <div className="reporting-import-grid">
          {access.data.permissions.includes('student.create') && (
            <article className="reporting-import-card">
              <div className="reporting-shortcut-icon">
                <Users size={17} />
              </div>
              <div>
                <strong>Student register</strong>
                <small>Validate columns and import student profiles.</small>
              </div>
              <Link
                className="button button-secondary"
                to={`/admin/organizations/${encodeURIComponent(organizationId)}/students/import`}
              >
                Import students
              </Link>
            </article>
          )}
          {access.data.permissions.includes('staff.create') && (
            <article className="reporting-import-card">
              <div className="reporting-shortcut-icon">
                <FileText size={17} />
              </div>
              <div>
                <strong>Staff directory</strong>
                <small>Import staff profiles and employee details.</small>
              </div>
              <Link
                className="button button-secondary"
                to={`/admin/organizations/${encodeURIComponent(organizationId)}/staff/import`}
              >
                Import staff
              </Link>
            </article>
          )}
          {access.data.permissions.includes('academics.write') &&
            access.data.permissions.includes('academics.read') &&
            access.data.permissions.includes('campus.read') && (
              <article className="reporting-import-card">
                <div className="reporting-shortcut-icon">
                  <CalendarCheck size={17} />
                </div>
                <div>
                  <strong>Academic setup</strong>
                  <small>Import classes, sections and subjects.</small>
                </div>
                <Link
                  className="button button-secondary"
                  to={`/admin/organizations/${encodeURIComponent(organizationId)}/academics/import`}
                >
                  Import academics
                </Link>
              </article>
            )}
        </div>
      </section>

      <section
        className="reporting-history"
        aria-labelledby="reporting-history-title"
      >
        <div className="reporting-section-heading">
          <div>
            <h2 id="reporting-history-title">Import & Export History</h2>
          </div>
          <Button
            variant="secondary"
            onClick={() => void transferHistory.refetch()}
            disabled={transferHistory.isFetching}
          >
            {transferHistory.isFetching ? 'Refreshing…' : 'Refresh history'}
          </Button>
        </div>
        {transferHistory.isPending ? (
          <LoadingState message="Loading transfer history…" />
        ) : transferHistory.isError ? (
          <ErrorState
            title="History unavailable"
            description={apiMessage(transferHistory.error)}
            onRetry={() => void transferHistory.refetch()}
          />
        ) : transferHistory.data.items.length === 0 ? (
          <EmptyState
            title="No import or export history yet"
            description="Review imported and exported files and their results."
          />
        ) : (
          <div className="table-container reporting-history-table">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Transfer</th>
                  <th>File</th>
                  <th>Format</th>
                  <th>Records</th>
                  <th>Outcome</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {transferHistory.data.items.map((item) => (
                  <tr key={item.id}>
                    <td data-label="Transfer">
                      <div className="reporting-history-transfer">
                        <span
                          className={
                            'reporting-direction reporting-direction-' +
                            item.direction
                          }
                        >
                          {item.direction}
                        </span>
                        <strong>{item.dataType}</strong>
                      </div>
                    </td>
                    <td data-label="File">{item.fileName}</td>
                    <td data-label="Format">{item.format.toUpperCase()}</td>
                    <td data-label="Records">{item.totalRows}</td>
                    <td data-label="Outcome">
                      <div className="reporting-history-outcome">
                        <span
                          className={
                            'reporting-history-status reporting-history-status-' +
                            item.status
                          }
                        >
                          {item.status}
                        </span>
                        <small>
                          {item.createdRows} successful / {item.skippedRows}{' '}
                          skipped / {item.failedRows} failed
                        </small>
                      </div>
                    </td>
                    <td data-label="Date">{formatDate(item.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Dialog
        open={previewType !== null}
        onOpenChange={(open) => {
          if (!open) setPreviewType(null);
        }}
        title={`${reportOptions.find((option) => option.value === previewType)?.label ?? 'Report'} preview`}
        description="Preview uses the actual report records returned by the organization API."
      >
        {preview.isPending ? (
          <LoadingState message="Loading report preview…" />
        ) : preview.error ? (
          <ErrorState
            title="Report preview unavailable"
            description={apiMessage(preview.error)}
            onRetry={() => void preview.refetch()}
          />
        ) : preview.data && preview.data.length > 0 ? (
          <div className="reference-table-wrap reporting-preview-table">
            <table className="reference-table">
              <thead>
                <tr>
                  {Object.keys(preview.data[0] as ReportRow).map((column) => (
                    <th key={column}>{column.replaceAll('_', ' ')}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.data.slice(0, 20).map((row, index) => (
                  <tr key={index}>
                    {Object.keys(preview.data?.[0] as ReportRow).map(
                      (column) => (
                        <td key={column}>{String(row[column] ?? '—')}</td>
                      ),
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No report rows available"
            description="There are no records to preview for this report yet."
          />
        )}
        <div className="reporting-preview-actions">
          <Button
            onClick={() => setPreviewType(null)}
            type="button"
            variant="secondary"
          >
            Close
          </Button>
          {previewType && (
            <Button
              disabled={exportMutation.isPending}
              onClick={() => void downloadReport(previewType)}
              type="button"
              variant="primary"
            >
              <Download size={14} aria-hidden="true" />
              Export {reportFormat.toUpperCase()}
            </Button>
          )}
        </div>
      </Dialog>
    </div>
  );
}
