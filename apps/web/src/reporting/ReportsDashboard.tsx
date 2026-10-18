import { useMemo, useState } from 'react';
import {
  ArrowUpRight,
  BarChart3,
  CalendarCheck,
  ClipboardList,
  Download,
  FileText,
  GraduationCap,
  Users,
  WalletCards,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Link, useLocation, useParams } from 'react-router-dom';
import { listAcademicCampuses } from '../academics/academics-api.js';
import { Button } from '../components/ui/Button.js';
import { DataTable } from '../components/ui/DataTable.js';
import { Pagination } from '../components/ui/Pagination.js';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PermissionDeniedState,
} from '../components/ui/States.js';
import { apiMessage, useOrganizationAccess } from '../staff/StaffPageShared.js';
import { useToast } from '../components/ui/ToastProvider.js';
import type { AuditLog, AuditLogFilters, ReportType } from './reporting-api.js';
import {
  useAuditLogs,
  useExportReport,
  useOrganizationSummary,
} from './reporting-api.js';
import './reporting.css';

const pageSize = 20;
const reportOptions: { value: ReportType; label: string }[] = [
  { value: 'students', label: 'Students' },
  { value: 'finance', label: 'Finance' },
  { value: 'attendance', label: 'Attendance' },
];

function shortId(value: string) {
  return value.length > 14 ? `${value.slice(0, 8)}…${value.slice(-4)}` : value;
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Date unavailable'
    : new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(date);
}

function currency(value: string) {
  const amount = Number(value);
  return Number.isFinite(amount)
    ? new Intl.NumberFormat(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(amount)
    : value;
}

function auditMetadata(log: AuditLog) {
  const count = Object.keys(log.metadata ?? {}).length;
  return count ? `${count} ${count === 1 ? 'field' : 'fields'}` : 'No metadata';
}

export function ReportsDashboard() {
  const { organizationId = '' } = useParams();
  const location = useLocation();
  const access = useOrganizationAccess(organizationId);
  const canReadReports =
    access.data?.permissions.includes('reporting.read') ?? false;
  const canReadAudit = access.data?.permissions.includes('audit.read') ?? false;
  const canReadFinance =
    access.data?.permissions.includes('finance.read') ?? false;
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
  const [filters, setFilters] = useState<AuditLogFilters>({
    page: 1,
    pageSize,
  });
  const [campusFilter, setCampusFilter] = useState('');
  const [reportType, setReportType] = useState<ReportType>('students');
  const summary = useOrganizationSummary(
    organizationId,
    campusFilter || undefined,
    Boolean(access.data && canReadReports),
  );
  const logs = useAuditLogs(
    organizationId,
    {
      ...filters,
      ...(campusFilter ? { campusId: campusFilter } : {}),
    },
    Boolean(access.data && canReadAudit),
  );
  const exportMutation = useExportReport(organizationId);
  const toast = useToast();

  const campusList = campuses.data?.campuses ?? [];
  const availableCampuses = campusRestricted
    ? campusList.filter((campus) => access.data?.campusIds.includes(campus.id))
    : campusList;
  const financeOptions = canReadFinance
    ? reportOptions
    : reportOptions.filter((option) => option.value !== 'finance');
  const summaryData = summary.data?.summary;
  const auditRows = logs.data?.items ?? [];
  const roleBase = location.pathname.startsWith('/accountant')
    ? '/accountant'
    : '/admin';
  const organizationPath = `${roleBase}/organizations/${encodeURIComponent(organizationId)}`;
  const shortcutCards = [
    {
      id: 'students-report',
      title: 'Student report',
      description: 'Export the organization’s current student records.',
      icon: Users,
      type: 'students' as const,
      to: undefined,
    },
    {
      id: 'attendance-report',
      title: 'Attendance report',
      description: 'Export recorded attendance for reporting and review.',
      icon: CalendarCheck,
      type: 'attendance' as const,
      to: undefined,
    },
    ...(canReadFinance
      ? [
          {
            id: 'finance-report',
            title: 'Finance report',
            description:
              'Export fee and invoice records available to your role.',
            icon: WalletCards,
            type: 'finance' as const,
            to: undefined,
          },
        ]
      : [
          {
            id: 'overview-report',
            title: 'Organization summary',
            description: 'Review current organization performance metrics.',
            icon: BarChart3,
            type: undefined,
            to: '#report-summary-title',
          },
        ]),
    ...(roleBase === '/accountant'
      ? [
          {
            id: 'finance-workspace',
            title: 'Fee invoices',
            description: 'Open actual invoices, payments and fee ledgers.',
            icon: WalletCards,
            type: undefined,
            to: `${organizationPath}/finance`,
          },
          {
            id: 'concessions-workspace',
            title: 'Fee concessions',
            description: 'Review and manage recorded concessions.',
            icon: GraduationCap,
            type: undefined,
            to: `${organizationPath}/concessions`,
          },
        ]
      : [
          {
            id: 'student-directory',
            title: 'Student directory',
            description: 'Open actual student records and profiles.',
            icon: GraduationCap,
            type: undefined,
            to: `${organizationPath}/students`,
          },
          {
            id: 'admissions-workspace',
            title: 'Admissions',
            description: 'Open applicant inquiries and application reviews.',
            icon: ClipboardList,
            type: undefined,
            to: `${organizationPath}/admissions`,
          },
        ]),
    {
      id: 'audit-workspace',
      title: canReadAudit ? 'Audit activity' : 'Organization summary',
      description: canReadAudit
        ? 'Review recorded changes, actions and timestamps.'
        : 'Review the latest organization summary metrics.',
      icon: FileText,
      type: undefined,
      to: canReadAudit ? '#audit-title' : '#report-summary-title',
    },
  ];
  const auditColumns = useMemo(
    () => [
      {
        header: 'Actor',
        render: (log: AuditLog) => (
          <span className="reporting-mono" title={log.actorId}>
            {shortId(log.actorId)}
          </span>
        ),
      },
      {
        header: 'Action',
        render: (log: AuditLog) => (
          <span className="reporting-action">
            {log.action.replaceAll('_', ' ')}
          </span>
        ),
      },
      {
        header: 'Entity',
        render: (log: AuditLog) => (
          <span>
            {log.entityType}
            {log.entityId ? ` · ${shortId(log.entityId)}` : ''}
          </span>
        ),
      },
      {
        header: 'Timestamp',
        render: (log: AuditLog) => formatDate(log.createdAt),
      },
      {
        header: 'Metadata',
        render: (log: AuditLog) => (
          <span className="reporting-metadata-badge">{auditMetadata(log)}</span>
        ),
      },
    ],
    [],
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

  async function downloadReport(type: ReportType = reportType) {
    try {
      await exportMutation.mutateAsync({ type });
      toast.showToast(
        `${reportOptions.find((option) => option.value === type)?.label} report downloaded.`,
      );
    } catch (error) {
      toast.showToast(apiMessage(error), 'info');
    }
  }

  return (
    <div className="reporting-page reference-live-module">
      <header className="reporting-header">
        <div className="reporting-title">
          <span className="reporting-icon" aria-hidden="true">
            <BarChart3 size={20} />
          </span>
          <div>
            <p className="eyebrow">Organization workspace</p>
            <h1>Reports &amp; Audit</h1>
            <p className="page-description">
              Organization performance, finance, attendance, and activity
              history.
            </p>
          </div>
        </div>
        <div className="reporting-toolbar">
          <label className="reporting-field" htmlFor="report-campus">
            Campus
            <select
              id="report-campus"
              value={campusFilter}
              onChange={(event) => {
                const val = event.target.value;
                setCampusFilter(val);
                setFilters((prev) => ({ ...prev, page: 1 }));
              }}
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
            Export
            <select
              id="report-type"
              value={reportType}
              onChange={(event) => {
                const val = event.target.value as ReportType;
                setReportType(val);
              }}
            >
              {financeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <Button
            className="reporting-export-button"
            disabled={exportMutation.isPending}
            onClick={() => void downloadReport()}
            type="button"
            variant="primary"
          >
            <Download size={16} aria-hidden="true" />
            {exportMutation.isPending ? 'Exporting…' : 'Export report'}
          </Button>
        </div>
      </header>

      {campuses.error && (
        <ErrorState
          title="Campus filter unavailable"
          description={apiMessage(campuses.error)}
          onRetry={() => void campuses.refetch()}
        />
      )}

      <section
        aria-label="Report and workspace shortcuts"
        className="reporting-shortcuts-grid"
      >
        {shortcutCards.map((card) => {
          const Icon = card.icon;
          const content = (
            <>
              <span className="reporting-shortcut-icon" aria-hidden="true">
                <Icon size={17} />
              </span>
              <span className="reporting-shortcut-copy">
                <strong>{card.title}</strong>
                <small>{card.description}</small>
              </span>
              <span className="reporting-shortcut-arrow" aria-hidden="true">
                {card.type ? (
                  <Download size={15} />
                ) : (
                  <ArrowUpRight size={15} />
                )}
              </span>
            </>
          );
          return card.type ? (
            <button
              className="reporting-shortcut-card"
              disabled={exportMutation.isPending}
              key={card.id}
              onClick={() => void downloadReport(card.type)}
              type="button"
            >
              {content}
            </button>
          ) : (
            <Link
              className="reporting-shortcut-card"
              key={card.id}
              to={card.to!}
            >
              {content}
            </Link>
          );
        })}
      </section>

      <section
        aria-labelledby="report-summary-title"
        className="reporting-section"
      >
        <div className="reporting-section-heading">
          <div>
            <p className="section-kicker">At a glance</p>
            <h2 id="report-summary-title">Organization summary</h2>
          </div>
          {campusFilter && (
            <span className="reporting-scope-label">
              {campusList.find((campus) => campus.id === campusFilter)?.name ??
                'Selected campus'}
            </span>
          )}
        </div>
        {summary.isPending ? (
          <LoadingState message="Loading organization summary…" />
        ) : summary.error ? (
          <ErrorState
            description={apiMessage(summary.error)}
            onRetry={() => void summary.refetch()}
          />
        ) : summaryData ? (
          <>
            <div className="reporting-kpi-grid">
              <article className="reporting-kpi">
                <span>Active students</span>
                <strong>
                  {summaryData.activeStudentCount.toLocaleString()}
                </strong>
                <small>Currently enrolled</small>
              </article>
              <article className="reporting-kpi">
                <span>Active staff</span>
                <strong>{summaryData.activeStaffCount.toLocaleString()}</strong>
                <small>Current staff members</small>
              </article>
              <article className="reporting-kpi">
                <span>Classes</span>
                <strong>{summaryData.activeClassCount.toLocaleString()}</strong>
                <small>Academic classes</small>
              </article>
              <article className="reporting-kpi reporting-kpi-attendance">
                <span>Attendance today</span>
                <strong>{summaryData.attendance.todayAttendanceRate}%</strong>
                <small>
                  {summaryData.attendance.recordsCount.toLocaleString()} records
                </small>
              </article>
            </div>
            <div className="reporting-finance-grid">
              <article className="reporting-finance-card">
                <span>Total invoiced</span>
                <strong>{currency(summaryData.finance.totalInvoiced)}</strong>
              </article>
              <article className="reporting-finance-card">
                <span>Total collected</span>
                <strong>{currency(summaryData.finance.totalCollected)}</strong>
              </article>
              <article className="reporting-finance-card">
                <span>Pending balance</span>
                <strong>{currency(summaryData.finance.totalPending)}</strong>
              </article>
              <article className="reporting-finance-card reporting-finance-overdue">
                <span>Overdue balance</span>
                <strong>{currency(summaryData.finance.totalOverdue)}</strong>
              </article>
            </div>
          </>
        ) : (
          <EmptyState title="No summary data" />
        )}
      </section>

      <section aria-labelledby="audit-title" className="reporting-section">
        <div className="reporting-section-heading">
          <div className="reporting-audit-title">
            <span
              className="reporting-icon reporting-icon-muted"
              aria-hidden="true"
            >
              <FileText size={18} />
            </span>
            <div>
              <p className="section-kicker">Organization activity</p>
              <h2 id="audit-title">Audit log</h2>
            </div>
          </div>
        </div>
        {!canReadAudit ? (
          <PermissionDeniedState
            title="Audit logs are not available to your role"
            description="Your organization administrator can grant audit-log access."
          />
        ) : (
          <>
            <div className="reporting-filters">
              <label className="reporting-field" htmlFor="audit-action">
                Action
                <input
                  id="audit-action"
                  maxLength={100}
                  placeholder="e.g. PAYMENT_RECORDED"
                  value={filters.action ?? ''}
                  onChange={(event) => {
                    const val = event.target.value;
                    setFilters((prev) => ({ ...prev, action: val, page: 1 }));
                  }}
                />
              </label>
              <label className="reporting-field" htmlFor="audit-entity">
                Entity type
                <input
                  id="audit-entity"
                  maxLength={100}
                  placeholder="e.g. payment"
                  value={filters.entityType ?? ''}
                  onChange={(event) => {
                    const val = event.target.value;
                    setFilters((prev) => ({
                      ...prev,
                      entityType: val,
                      page: 1,
                    }));
                  }}
                />
              </label>
              <label className="reporting-field" htmlFor="audit-date-from">
                From
                <input
                  id="audit-date-from"
                  type="date"
                  value={filters.dateFrom ?? ''}
                  onChange={(event) => {
                    const val = event.target.value;
                    setFilters((prev) => ({ ...prev, dateFrom: val, page: 1 }));
                  }}
                />
              </label>
              <label className="reporting-field" htmlFor="audit-date-to">
                To
                <input
                  id="audit-date-to"
                  type="date"
                  value={filters.dateTo ?? ''}
                  onChange={(event) => {
                    const val = event.target.value;
                    setFilters((prev) => ({ ...prev, dateTo: val, page: 1 }));
                  }}
                />
              </label>
            </div>
            {logs.isPending ? (
              <LoadingState message="Loading audit activity…" />
            ) : logs.error ? (
              <ErrorState
                description={apiMessage(logs.error)}
                onRetry={() => void logs.refetch()}
              />
            ) : (
              <>
                <DataTable
                  caption="Organization audit log"
                  columns={auditColumns}
                  rows={auditRows}
                  rowKey={(log) => log.id}
                  emptyTitle="No audit activity found"
                  emptyDescription="Try changing the current filters."
                />
                {logs.data && logs.data.pagination.total > 0 && (
                  <Pagination
                    currentPage={filters.page}
                    pageSize={pageSize}
                    totalItems={logs.data.pagination.total}
                    onPageChange={(page) =>
                      setFilters((prev) => ({ ...prev, page }))
                    }
                  />
                )}
              </>
            )}
          </>
        )}
      </section>
    </div>
  );
}
