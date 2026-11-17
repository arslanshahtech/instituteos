import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
  Bell,
  BookOpen,
  CalendarCheck,
  BarChart3,
  ClipboardList,
  ReceiptText,
  Users,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { LoadingState } from '../../components/ui/States.js';
import { listApplications } from '../../admissions/admissions-api.js';
import {
  listAcademicYears,
  listSectionTimetables,
} from '../../academics/academics-api.js';
import { listStudentAttendance } from '../../attendance/attendance-api.js';
import {
  listDailyCollections,
  listInvoices,
} from '../../finance/finance-api.js';
import { listAnnouncements } from '../../communications/communications-api.js';
import { listExams } from '../../examinations/examinations-api.js';
import { listStaff } from '../../staff/staff-api.js';
import { listStudents } from '../../students/students-api.js';
import { useOrganizationSummary } from '../../reporting/reporting-api.js';
import './admin-dashboard-overview.css';

type Props = { organizationId: string; permissions: string[] };
type TrendMode = 'Monthly' | 'Weekly';
type AdmissionFilter = 'All' | 'Pending' | 'In review' | 'Approved';

function dateKey(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function formatPKR(value: number | string | undefined) {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount)
    ? `Rs. ${new Intl.NumberFormat('en-PK', { maximumFractionDigits: 0 }).format(amount)}`
    : '—';
}

function shortDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Date unavailable'
    : date.toLocaleDateString('en-PK', { day: 'numeric', month: 'short' });
}

function startOfWeek(date: Date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  result.setDate(result.getDate() - result.getDay());
  return result;
}

function smoothChartPath(points: Array<{ x: number; y: number }>) {
  if (!points.length) return '';
  return points.reduce((path, point, index) => {
    if (index === 0) return `M ${point.x} ${point.y}`;
    const previous = points[index - 1];
    const midpoint = (previous.x + point.x) / 2;
    return `${path} C ${midpoint} ${previous.y}, ${midpoint} ${point.y}, ${point.x} ${point.y}`;
  }, '');
}

export function AdminDashboardOverview({ organizationId, permissions }: Props) {
  const can = (permission: string) => permissions.includes(permission);
  const [trendMode, setTrendMode] = useState<TrendMode>('Monthly');
  const [admissionFilter, setAdmissionFilter] =
    useState<AdmissionFilter>('All');
  const today = useMemo(() => new Date(), []);
  const todayKey = dateKey(today);
  const trendStart = dateKey(
    new Date(today.getFullYear(), today.getMonth() - 5, 1),
  );
  const attendanceStart = dateKey(
    new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6),
  );
  const todayName = today
    .toLocaleDateString('en-US', { weekday: 'long' })
    .toLowerCase();

  const summary = useOrganizationSummary(
    organizationId,
    undefined,
    can('reporting.read'),
  );
  const students = useQuery({
    queryKey: ['admin-dashboard', organizationId, 'student-count'],
    queryFn: () => listStudents(organizationId, { page: 1, pageSize: 1 }),
    enabled: can('student.read'),
    retry: false,
  });
  const collections = useQuery({
    queryKey: [
      'admin-dashboard',
      organizationId,
      'collections',
      trendStart,
      todayKey,
    ],
    queryFn: () =>
      listDailyCollections(organizationId, {
        dateFrom: trendStart,
        dateTo: todayKey,
      }),
    enabled: can('finance.read'),
    retry: false,
  });
  const attendance = useQuery({
    queryKey: [
      'admin-dashboard',
      organizationId,
      'attendance',
      attendanceStart,
      todayKey,
    ],
    queryFn: () =>
      listStudentAttendance(organizationId, {
        dateFrom: attendanceStart,
        dateTo: todayKey,
      }),
    enabled: can('attendance.read'),
    retry: false,
  });
  const admissions = useQuery({
    queryKey: ['admin-dashboard', organizationId, 'admissions'],
    queryFn: () =>
      listApplications(organizationId, { search: '', page: 1, pageSize: 20 }),
    enabled: can('admission.read'),
    retry: false,
  });
  const defaulters = useQuery({
    queryKey: ['admin-dashboard', organizationId, 'defaulters'],
    queryFn: () => listInvoices(organizationId, { status: 'overdue' }),
    enabled: can('finance.read'),
    retry: false,
  });
  const staffOnLeave = useQuery({
    queryKey: ['admin-dashboard', organizationId, 'staff-on-leave'],
    queryFn: () =>
      listStaff(organizationId, { status: 'on_leave', page: 1, pageSize: 5 }),
    enabled: can('staff.read'),
    retry: false,
  });
  const exams = useQuery({
    queryKey: ['admin-dashboard', organizationId, 'upcoming-exams'],
    queryFn: () => listExams(organizationId),
    enabled: can('examination.read'),
    retry: false,
  });
  const announcements = useQuery({
    queryKey: ['admin-dashboard', organizationId, 'announcements'],
    queryFn: () => listAnnouncements(organizationId, { status: 'published' }),
    enabled: can('communication.read'),
    retry: false,
  });
  const timetable = useQuery({
    queryKey: ['admin-dashboard', organizationId, 'timetable'],
    queryFn: async () => {
      const years = await listAcademicYears(organizationId);
      const activeYear = years.items.find((year) => year.status === 'active');
      if (!activeYear) return { academicYear: null, items: [] };
      const result = await listSectionTimetables(organizationId, activeYear.id);
      return { academicYear: activeYear.name, items: result.items };
    },
    enabled: can('academics.read'),
    retry: false,
  });

  const collectionItems = collections.data?.items ?? [];
  const attendanceRecords = attendance.data?.items ?? [];
  const todaysAttendance = attendanceRecords.filter(
    (record) => record.date.slice(0, 10) === todayKey,
  );
  const presentToday = todaysAttendance.filter(
    (record) => record.status === 'present' || record.status === 'late',
  ).length;
  const absentToday = todaysAttendance.filter(
    (record) => record.status === 'absent',
  ).length;
  const leaveToday = todaysAttendance.filter(
    (record) => record.status === 'leave',
  ).length;
  const attendanceDenominator = todaysAttendance.filter((record) =>
    ['present', 'late', 'absent'].includes(record.status),
  ).length;
  const attendanceRate = attendanceDenominator
    ? Math.round((presentToday / attendanceDenominator) * 100)
    : summary.data?.summary.attendance.todayAttendanceRate;

  const overdueInvoices = (defaulters.data?.items ?? [])
    .filter((invoice) => invoice.totalAmount > invoice.paidAmount)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 5);
  const overdueTotal = overdueInvoices.reduce(
    (total, invoice) =>
      total + Math.max(0, invoice.totalAmount - invoice.paidAmount),
    0,
  );
  const applications = admissions.data?.items ?? [];
  const filteredApplications = applications
    .filter((item) => {
      if (admissionFilter === 'Pending')
        return item.status === 'draft' || item.status === 'submitted';
      if (admissionFilter === 'In review') return item.status === 'in_review';
      if (admissionFilter === 'Approved')
        return item.status === 'approved' || item.status === 'admitted';
      return true;
    })
    .slice(0, 5);
  const pendingApplicationCount = applications.filter(
    (item) => item.status === 'draft' || item.status === 'submitted',
  ).length;
  const upcomingExams = (exams.data?.items ?? [])
    .filter((exam) => exam.endDate.slice(0, 10) >= todayKey)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
    .slice(0, 4);
  const publishedAnnouncements = (announcements.data?.items ?? [])
    .filter((item) => item.publishDate.slice(0, 10) <= todayKey)
    .sort(
      (a, b) =>
        Number(b.isPinned) - Number(a.isPinned) ||
        b.publishDate.localeCompare(a.publishDate),
    )
    .slice(0, 4);
  const todayPeriods = (timetable.data?.items ?? [])
    .flatMap((section) =>
      section.entries
        .filter((entry) => entry.dayOfWeek === todayName)
        .map((entry) => ({ ...entry, sectionId: section.sectionId })),
    )
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
  const timetableSectionCount = new Set(
    todayPeriods.map((entry) => entry.sectionId),
  ).size;

  const trendBuckets = useMemo(() => {
    const records = collectionItems;
    if (trendMode === 'Monthly') {
      return Array.from({ length: 6 }, (_, index) => {
        const date = new Date(
          today.getFullYear(),
          today.getMonth() - 5 + index,
          1,
        );
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        return {
          key,
          label: date.toLocaleDateString('en-PK', { month: 'short' }),
          amount: records
            .filter((item) => item.date.slice(0, 7) === key)
            .reduce((sum, item) => sum + item.amountCollected, 0),
        };
      });
    }
    const currentWeek = startOfWeek(today);
    return Array.from({ length: 6 }, (_, index) => {
      const from = new Date(currentWeek);
      from.setDate(from.getDate() - (5 - index) * 7);
      const to = new Date(from);
      to.setDate(to.getDate() + 7);
      const fromKey = dateKey(from);
      const toKey = dateKey(to);
      return {
        key: fromKey,
        label: index === 5 ? 'This week' : `W${index + 1}`,
        amount: records
          .filter((item) => item.date >= fromKey && item.date < toKey)
          .reduce((sum, item) => sum + item.amountCollected, 0),
      };
    });
  }, [collectionItems, trendMode, today]);
  const trendMax = Math.max(...trendBuckets.map((item) => item.amount), 1);
  const trendTotal = trendBuckets.reduce((sum, item) => sum + item.amount, 0);
  const totals = summary.data?.summary;
  const billedAmount = Number(totals?.finance.totalInvoiced ?? 0);
  const collectedAmount = Number(totals?.finance.totalCollected ?? 0);
  const duesAmount = Number(totals?.finance.totalPending ?? 0);
  const hasFinanceSummary =
    Boolean(totals && can('finance.read')) && !summary.isError;
  const collectedShare =
    billedAmount > 0 ? Math.round((collectedAmount / billedAmount) * 100) : 0;
  const duesShare =
    billedAmount > 0 ? Math.round((duesAmount / billedAmount) * 100) : 0;

  return (
    <section
      className="admin-dashboard-overview"
      aria-label="Institute dashboard overview"
    >
      <div className="admin-dashboard-kpis">
        <article className="admin-dashboard-kpi">
          <div className="admin-dashboard-kpi-top">
            <span className="admin-dashboard-icon">
              <Users size={20} />
            </span>
            <span className="admin-dashboard-kpi-caption">Enrollment</span>
          </div>
          <p className="admin-dashboard-kpi-label">Total Students</p>
          <strong>
            {students.data ? students.data.total.toLocaleString('en-PK') : '—'}
          </strong>
          <span className="admin-dashboard-kpi-detail">
            All student records
          </span>
        </article>
        <article className="admin-dashboard-kpi">
          <div className="admin-dashboard-kpi-top">
            <span className="admin-dashboard-icon">
              <Users size={20} />
            </span>
            <span className="admin-dashboard-kpi-caption">Organization</span>
          </div>
          <p className="admin-dashboard-kpi-label">Active Staff</p>
          <strong>
            {can('staff.read') && totals
              ? totals.activeStaffCount.toLocaleString('en-PK')
              : '—'}
          </strong>
          <span className="admin-dashboard-kpi-detail">
            Current staff records
          </span>
        </article>
        <article className="admin-dashboard-kpi">
          <div className="admin-dashboard-kpi-top">
            <span className="admin-dashboard-icon">
              <CalendarCheck size={20} />
            </span>
            <span className="admin-dashboard-kpi-caption">Today</span>
          </div>
          <p className="admin-dashboard-kpi-label">Attendance Rate</p>
          <strong>
            {can('attendance.read') && attendanceRate !== undefined
              ? `${attendanceRate}%`
              : '—'}
          </strong>
          <span className="admin-dashboard-kpi-detail">
            {todaysAttendance.length.toLocaleString('en-PK')} records marked
            today
          </span>
        </article>
        <article className="admin-dashboard-kpi admin-dashboard-kpi-alert">
          <div className="admin-dashboard-kpi-top">
            <span className="admin-dashboard-icon">
              <AlertCircle size={20} />
            </span>
            <span className="admin-dashboard-kpi-caption">Outstanding</span>
          </div>
          <p className="admin-dashboard-kpi-label">Pending Dues</p>
          <strong>
            {can('finance.read') && totals && !summary.isError
              ? formatPKR(duesAmount)
              : '—'}
          </strong>
          <span className="admin-dashboard-kpi-detail">
            {can('finance.read') && totals && !summary.isError
              ? `Overdue: ${formatPKR(totals.finance.totalOverdue)}`
              : 'Finance information unavailable'}
          </span>
        </article>
      </div>

      <div className="admin-dashboard-analytics">
        <section className="admin-dashboard-panel admin-dashboard-collection-panel">
          <div className="admin-dashboard-panel-heading">
            <div>
              <h2>Fee Collection Trend</h2>
              <p>Actual payments recorded by day, grouped by period</p>
            </div>
            <div className="admin-dashboard-heading-actions">
              <div
                className="admin-dashboard-segmented"
                role="group"
                aria-label="Collection trend period"
              >
                {(['Monthly', 'Weekly'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    className={trendMode === mode ? 'is-active' : ''}
                    aria-pressed={trendMode === mode}
                    onClick={() => setTrendMode(mode)}
                  >
                    {mode}
                  </button>
                ))}
              </div>
              {can('finance.read') && (
                <Link
                  to={`/admin/organizations/${encodeURIComponent(organizationId)}/finance`}
                  className="admin-dashboard-text-link"
                >
                  Finance <ArrowUpRight size={14} />
                </Link>
              )}
            </div>
          </div>
          {!can('finance.read') ? (
            <p className="admin-dashboard-muted">
              Collection trend is unavailable for your current access.
            </p>
          ) : collections.isPending ? (
            <LoadingState message="Loading fee collections…" />
          ) : collections.isError ? (
            <p className="admin-dashboard-muted">
              Collection trend is unavailable for your current access.
            </p>
          ) : (
            <>
              {trendTotal === 0 ? (
                <p className="admin-dashboard-muted">
                  No fee collections recorded in this period.
                </p>
              ) : (
                <div className="admin-dashboard-line-chart-wrap">
                  <svg
                    key={trendMode}
                    className="admin-dashboard-line-chart"
                    viewBox="0 0 640 190"
                    role="img"
                    aria-label={`${trendMode} fee collection trend`}
                  >
                    <defs>
                      <linearGradient
                        id="collection-area-fill"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="var(--color-accent)"
                          stopOpacity="0.24"
                        />
                        <stop
                          offset="100%"
                          stopColor="var(--color-accent)"
                          stopOpacity="0.015"
                        />
                      </linearGradient>
                    </defs>
                    {[40, 85, 130, 175].map((y) => (
                      <line
                        key={y}
                        x1="18"
                        x2="622"
                        y1={y}
                        y2={y}
                        className="admin-dashboard-chart-gridline"
                      />
                    ))}
                    {(() => {
                      const points = trendBuckets.map((item, index) => ({
                        x: 32 + index * 115,
                        y: 154 - (item.amount / trendMax) * 112,
                      }));
                      const linePath = smoothChartPath(points);
                      const first = points[0];
                      const last = points[points.length - 1];
                      const areaPath = `${linePath} L ${last.x} 175 L ${first.x} 175 Z`;
                      return (
                        <>
                          <path
                            d={areaPath}
                            className="admin-dashboard-chart-area"
                          />
                          <path
                            d={linePath}
                            className="admin-dashboard-chart-line"
                          />
                          {points.map((point, index) => (
                            <circle
                              key={trendBuckets[index].key}
                              cx={point.x}
                              cy={point.y}
                              r="4.5"
                              className="admin-dashboard-chart-point"
                            >
                              <title>
                                {trendBuckets[index].label}:{' '}
                                {formatPKR(trendBuckets[index].amount)}
                              </title>
                            </circle>
                          ))}
                        </>
                      );
                    })()}
                  </svg>
                  <div className="admin-dashboard-line-chart-labels">
                    {trendBuckets.map((item) => (
                      <div key={item.key}>
                        <strong>{item.label}</strong>
                        <span>
                          {trendTotal
                            ? Math.round((item.amount / trendTotal) * 100)
                            : 0}
                          %
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div
                className="admin-dashboard-finance-cards"
                aria-label="Organization fee summary"
              >
                <article className="admin-dashboard-finance-card">
                  <span className="admin-dashboard-finance-card-label">
                    Total Billed
                  </span>
                  <strong>
                    {hasFinanceSummary ? formatPKR(billedAmount) : '—'}
                  </strong>
                  <small>
                    {hasFinanceSummary
                      ? '100% of billed fees'
                      : 'Finance summary unavailable'}
                  </small>
                </article>
                <article className="admin-dashboard-finance-card admin-dashboard-finance-card-collected">
                  <span className="admin-dashboard-finance-card-label">
                    Collected
                  </span>
                  <strong>
                    {hasFinanceSummary ? formatPKR(collectedAmount) : '—'}
                  </strong>
                  <small>
                    {hasFinanceSummary
                      ? collectedShare + '% of billed fees'
                      : 'Finance summary unavailable'}
                  </small>
                </article>
                <article className="admin-dashboard-finance-card admin-dashboard-finance-card-due">
                  <span className="admin-dashboard-finance-card-label">
                    Dues
                  </span>
                  <strong>
                    {hasFinanceSummary ? formatPKR(duesAmount) : '—'}
                  </strong>
                  <small>
                    {hasFinanceSummary
                      ? duesShare + '% of billed fees outstanding'
                      : 'Finance summary unavailable'}
                  </small>
                </article>
              </div>
            </>
          )}
        </section>

        <section className="admin-dashboard-panel admin-dashboard-attendance-panel">
          <div className="admin-dashboard-panel-heading">
            <div>
              <h2>Attendance Overview</h2>
              <p>Student attendance recorded today</p>
            </div>
            {can('attendance.read') && (
              <Link
                to={`/admin/organizations/${encodeURIComponent(organizationId)}/attendance`}
                className="admin-dashboard-text-link"
              >
                Attendance <ArrowUpRight size={14} />
              </Link>
            )}
          </div>
          {!can('attendance.read') ? (
            <p className="admin-dashboard-muted">
              Attendance information is unavailable for your current access.
            </p>
          ) : attendance.isPending ? (
            <LoadingState message="Loading today's attendance…" />
          ) : attendance.isError ? (
            <p className="admin-dashboard-muted">
              Today's attendance could not be loaded.
            </p>
          ) : (
            <>
              <div className="admin-dashboard-attendance-visual">
                <div
                  className="admin-dashboard-donut"
                  style={{
                    background: `conic-gradient(var(--color-accent) 0 ${attendanceRate ?? 0}%, var(--color-border) ${attendanceRate ?? 0}% 100%)`,
                  }}
                >
                  <div>
                    <strong>
                      {attendanceRate !== undefined
                        ? `${attendanceRate}%`
                        : '—'}
                    </strong>
                    <span>Present</span>
                  </div>
                </div>
                <div className="admin-dashboard-attendance-legend">
                  <span>
                    <i className="is-present" /> Present / Late{' '}
                    <b>{presentToday.toLocaleString('en-PK')}</b>
                  </span>
                  <span>
                    <i className="is-absent" /> Absent{' '}
                    <b>{absentToday.toLocaleString('en-PK')}</b>
                  </span>
                  <span>
                    <i className="is-leave" /> Leave{' '}
                    <b>{leaveToday.toLocaleString('en-PK')}</b>
                  </span>
                </div>
              </div>
              <p className="admin-dashboard-attendance-footnote">
                {todaysAttendance.length.toLocaleString('en-PK')} attendance
                records marked today
              </p>
            </>
          )}
        </section>
      </div>

      <div className="admin-dashboard-operations">
        <section className="admin-dashboard-panel admin-dashboard-operation-card">
          <div className="admin-dashboard-panel-heading">
            <div>
              <h3>Recent Admissions</h3>
              <p>Latest applications received</p>
            </div>
            {can('admission.read') && (
              <Link
                to={`/admin/organizations/${encodeURIComponent(organizationId)}/admissions/enroll`}
                className="admin-dashboard-text-link"
              >
                View all <ArrowUpRight size={14} />
              </Link>
            )}
          </div>
          {can('admission.read') && (
            <div
              className="admin-dashboard-filter-tabs"
              role="group"
              aria-label="Filter admissions"
            >
              {(['All', 'Pending', 'In review', 'Approved'] as const).map(
                (filter) => (
                  <button
                    key={filter}
                    type="button"
                    className={admissionFilter === filter ? 'is-active' : ''}
                    aria-pressed={admissionFilter === filter}
                    onClick={() => setAdmissionFilter(filter)}
                  >
                    {filter}
                  </button>
                ),
              )}
            </div>
          )}
          {!can('admission.read') ? (
            <p className="admin-dashboard-muted">
              Admission activity is unavailable.
            </p>
          ) : admissions.isPending ? (
            <LoadingState message="Loading admissions…" />
          ) : admissions.isError ? (
            <p className="admin-dashboard-muted">
              Admission activity is unavailable.
            </p>
          ) : filteredApplications.length === 0 ? (
            <p className="admin-dashboard-muted">
              No applications in this filter.
            </p>
          ) : (
            <div className="admin-dashboard-list">
              {filteredApplications.map((item) => (
                <Link
                  to={`/admin/organizations/${encodeURIComponent(organizationId)}/admissions/enroll`}
                  className="admin-dashboard-list-row admin-dashboard-list-link"
                  key={item.id}
                >
                  <span className="admin-dashboard-avatar">
                    {item.firstName.slice(0, 1)}
                    {item.lastName.slice(0, 1)}
                  </span>
                  <span className="admin-dashboard-list-copy">
                    <strong>
                      {item.firstName} {item.lastName}
                    </strong>
                    <small>
                      {item.program || 'Application'} ·{' '}
                      {shortDate(item.createdAt)}
                    </small>
                  </span>
                  <span
                    className={`admin-dashboard-status status-${item.status}`}
                  >
                    {item.status.replaceAll('_', ' ')}
                  </span>
                </Link>
              ))}
            </div>
          )}
          {can('admission.read') && (
            <div className="admin-dashboard-card-footer">
              <span>
                {applications.length.toLocaleString('en-PK')} loaded
                applications
              </span>
              <span>
                {pendingApplicationCount.toLocaleString('en-PK')} pending
              </span>
            </div>
          )}
        </section>

        <section className="admin-dashboard-panel admin-dashboard-operation-card">
          <div className="admin-dashboard-panel-heading">
            <div>
              <h3>Fee Defaulters</h3>
              <p>Invoices with overdue balances</p>
            </div>
            {can('finance.read') && (
              <Link
                to={`/admin/organizations/${encodeURIComponent(organizationId)}/finance`}
                className="admin-dashboard-text-link"
              >
                View finance <ArrowUpRight size={14} />
              </Link>
            )}
          </div>
          {!can('finance.read') ? (
            <p className="admin-dashboard-muted">
              Overdue invoices are unavailable.
            </p>
          ) : defaulters.isPending ? (
            <LoadingState message="Loading overdue invoices…" />
          ) : defaulters.isError ? (
            <p className="admin-dashboard-muted">
              Overdue invoices are unavailable.
            </p>
          ) : overdueInvoices.length === 0 ? (
            <p className="admin-dashboard-muted">
              No overdue invoices. Great work!
            </p>
          ) : (
            <div className="admin-dashboard-list">
              {overdueInvoices.map((invoice) => (
                <div className="admin-dashboard-list-row" key={invoice.id}>
                  <span className="admin-dashboard-avatar is-alert">
                    <ReceiptText size={16} />
                  </span>
                  <span className="admin-dashboard-list-copy">
                    <strong>{invoice.studentName}</strong>
                    <small>
                      {invoice.invoiceNumber} · Due {shortDate(invoice.dueDate)}
                    </small>
                  </span>
                  <span className="admin-dashboard-amount">
                    {formatPKR(invoice.totalAmount - invoice.paidAmount)}
                  </span>
                  {invoice.guardianPhone && (
                    <a
                      className="admin-dashboard-call-link"
                      href={`tel:${invoice.guardianPhone}`}
                      aria-label={`Call guardian for ${invoice.studentName}`}
                    >
                      Call
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
          {can('finance.read') && (
            <div className="admin-dashboard-card-footer">
              <span>{overdueInvoices.length} shown</span>
              <strong>{formatPKR(overdueTotal)}</strong>
            </div>
          )}
        </section>

        <section className="admin-dashboard-panel admin-dashboard-operation-card">
          <div className="admin-dashboard-panel-heading">
            <div>
              <h3>Staff on Leave</h3>
              <p>Staff members currently marked on leave</p>
            </div>
            {can('staff.read') && (
              <Link
                to={`/admin/organizations/${encodeURIComponent(organizationId)}/staff`}
                className="admin-dashboard-text-link"
              >
                View staff <ArrowUpRight size={14} />
              </Link>
            )}
          </div>
          {!can('staff.read') ? (
            <p className="admin-dashboard-muted">
              Staff leave information is unavailable.
            </p>
          ) : staffOnLeave.isPending ? (
            <LoadingState message="Loading staff leave…" />
          ) : staffOnLeave.isError ? (
            <p className="admin-dashboard-muted">
              Staff leave information is unavailable.
            </p>
          ) : (staffOnLeave.data?.items.length ?? 0) === 0 ? (
            <p className="admin-dashboard-muted">
              No staff currently marked on leave.
            </p>
          ) : (
            <div className="admin-dashboard-list">
              {staffOnLeave.data!.items.slice(0, 5).map((person) => (
                <Link
                  to={`/admin/organizations/${encodeURIComponent(organizationId)}/staff`}
                  className="admin-dashboard-list-row admin-dashboard-list-link"
                  key={person.id}
                >
                  <span className="admin-dashboard-avatar">
                    {person.firstName.slice(0, 1)}
                    {person.lastName.slice(0, 1)}
                  </span>
                  <span className="admin-dashboard-list-copy">
                    <strong>
                      {person.firstName} {person.lastName}
                    </strong>
                    <small>
                      {person.designation ||
                        person.department ||
                        'Staff member'}
                    </small>
                  </span>
                  <span className="admin-dashboard-status status-on_leave">
                    On leave
                  </span>
                </Link>
              ))}
            </div>
          )}
          {can('staff.read') && (
            <div className="admin-dashboard-card-footer">
              <span>Current leave records</span>
              <strong>
                {staffOnLeave.data?.total ??
                  staffOnLeave.data?.items.length ??
                  '—'}
              </strong>
            </div>
          )}
        </section>
      </div>

      <div className="admin-dashboard-middle">
        <section className="admin-dashboard-panel admin-dashboard-timetable-panel">
          <div className="admin-dashboard-panel-heading">
            <div>
              <h2>Today's Timetable</h2>
              <p>Periods scheduled across active sections</p>
            </div>
            {can('academics.read') && (
              <Link
                to={`/admin/organizations/${encodeURIComponent(organizationId)}/academics`}
                className="admin-dashboard-text-link"
              >
                Academics <ArrowUpRight size={14} />
              </Link>
            )}
          </div>
          {!can('academics.read') ? (
            <p className="admin-dashboard-muted">
              Timetable information is unavailable.
            </p>
          ) : timetable.isPending ? (
            <LoadingState message="Loading today's timetable…" />
          ) : timetable.isError ? (
            <p className="admin-dashboard-muted">
              Timetable information is unavailable.
            </p>
          ) : !timetable.data?.academicYear ? (
            <p className="admin-dashboard-muted">
              No active academic year is configured.
            </p>
          ) : todayPeriods.length === 0 ? (
            <p className="admin-dashboard-muted">
              No timetable periods are scheduled for today.
            </p>
          ) : (
            <>
              <div className="admin-dashboard-timetable-summary">
                <strong>{todayPeriods.length}</strong>
                <span>periods across {timetableSectionCount} sections</span>
              </div>
              <div className="admin-dashboard-timetable-list">
                {todayPeriods.slice(0, 6).map((period, index) => (
                  <div
                    className="admin-dashboard-timetable-row"
                    key={
                      period.id ||
                      `${period.sectionId}-${period.startTime}-${index}`
                    }
                  >
                    <span className="admin-dashboard-period-number">
                      {index + 1}
                    </span>
                    <strong>
                      {period.startTime}–{period.endTime}
                    </strong>
                    <span className="admin-dashboard-period-name">
                      {period.name ||
                        (period.type === 'class'
                          ? 'Class period'
                          : period.type)}
                    </span>
                    <span className="admin-dashboard-status">
                      {period.type}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>

        <section className="admin-dashboard-panel admin-dashboard-notices-panel">
          <div className="admin-dashboard-panel-heading">
            <div>
              <h2>Important Notices & Tasks</h2>
              <p>Published notices and items needing attention</p>
            </div>
            {can('communication.read') && (
              <Link
                to={`/admin/organizations/${encodeURIComponent(organizationId)}/communications/announcements`}
                className="admin-dashboard-text-link"
              >
                Notices <ArrowUpRight size={14} />
              </Link>
            )}
          </div>
          {!can('communication.read') ? (
            <p className="admin-dashboard-muted">
              Published notices are unavailable.
            </p>
          ) : announcements.isPending ? (
            <LoadingState message="Loading notices…" />
          ) : announcements.isError ? (
            <p className="admin-dashboard-muted">
              Published notices are unavailable.
            </p>
          ) : publishedAnnouncements.length === 0 ? (
            <p className="admin-dashboard-muted">No published notices.</p>
          ) : (
            <div className="admin-dashboard-notice-list">
              {publishedAnnouncements.map((notice) => (
                <Link
                  to={`/admin/organizations/${encodeURIComponent(organizationId)}/communications/announcements`}
                  className="admin-dashboard-notice-row"
                  key={notice.id}
                >
                  <span className="admin-dashboard-notice-icon">
                    <Bell size={15} />
                  </span>
                  <span className="admin-dashboard-list-copy">
                    <strong>{notice.title}</strong>
                    <small>
                      {notice.targetAudience} · {shortDate(notice.publishDate)}
                    </small>
                  </span>
                  {notice.isPinned && (
                    <span className="admin-dashboard-status status-pinned">
                      Pinned
                    </span>
                  )}
                </Link>
              ))}
            </div>
          )}
          {(can('admission.read') ||
            can('finance.read') ||
            can('staff.read')) && (
            <div className="admin-dashboard-action-queue">
              <div className="admin-dashboard-action-queue-heading">
                <ClipboardList size={16} />
                <strong>Action Queue</strong>
                <span>Recent activity</span>
              </div>
              {can('admission.read') && (
                <Link
                  to={`/admin/organizations/${encodeURIComponent(organizationId)}/admissions/enroll`}
                >
                  <span>Review pending admissions</span>
                  <b>{pendingApplicationCount}</b>
                  <ArrowRight size={14} />
                </Link>
              )}
              {can('finance.read') && (
                <Link
                  to={`/admin/organizations/${encodeURIComponent(organizationId)}/finance`}
                >
                  <span>Follow up overdue invoices</span>
                  <b>{defaulters.data?.items.length ?? '—'}</b>
                  <ArrowRight size={14} />
                </Link>
              )}
              {can('staff.read') && (
                <Link
                  to={`/admin/organizations/${encodeURIComponent(organizationId)}/staff`}
                >
                  <span>Review staff leave</span>
                  <b>
                    {staffOnLeave.data?.total ??
                      staffOnLeave.data?.items.length ??
                      '—'}
                  </b>
                  <ArrowRight size={14} />
                </Link>
              )}
            </div>
          )}
        </section>
      </div>

      <div className="admin-dashboard-bottom">
        <section className="admin-dashboard-panel admin-dashboard-bottom-card">
          <div className="admin-dashboard-panel-heading">
            <div>
              <h3>Upcoming Exams</h3>
              <p>Scheduled examinations and tests</p>
            </div>
            {can('examination.read') && (
              <Link
                to={`/admin/organizations/${encodeURIComponent(organizationId)}/examinations`}
                className="admin-dashboard-text-link"
              >
                View exams <ArrowUpRight size={14} />
              </Link>
            )}
          </div>
          {!can('examination.read') ? (
            <p className="admin-dashboard-muted">
              Upcoming exams are unavailable.
            </p>
          ) : exams.isPending ? (
            <LoadingState message="Loading exams…" />
          ) : exams.isError ? (
            <p className="admin-dashboard-muted">
              Upcoming exams are unavailable.
            </p>
          ) : upcomingExams.length === 0 ? (
            <p className="admin-dashboard-muted">
              No upcoming exams scheduled.
            </p>
          ) : (
            <div className="admin-dashboard-list">
              {upcomingExams.map((exam) => (
                <Link
                  to={`/admin/organizations/${encodeURIComponent(organizationId)}/examinations`}
                  className="admin-dashboard-list-row admin-dashboard-list-link"
                  key={exam.id}
                >
                  <span className="admin-dashboard-avatar">
                    <BookOpen size={16} />
                  </span>
                  <span className="admin-dashboard-list-copy">
                    <strong>{exam.name}</strong>
                    <small>
                      {exam.type.replaceAll('_', ' ')} ·{' '}
                      {shortDate(exam.startDate)}
                    </small>
                  </span>
                  <span className="admin-dashboard-date">
                    {shortDate(exam.endDate)}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>
        <section className="admin-dashboard-panel admin-dashboard-bottom-card admin-dashboard-reports-card">
          <div className="admin-dashboard-panel-heading">
            <div>
              <h3>Reports &amp; Export</h3>
              <p>Organization reports and data exports</p>
            </div>
            <span className="admin-dashboard-status status-positive">
              {can('reporting.read') ? 'Available' : 'Access required'}
            </span>
          </div>
          <div className="admin-dashboard-reports-content">
            <span className="admin-dashboard-feature-icon">
              <BarChart3 size={20} />
            </span>
            <div>
              <strong>Review and export real records</strong>
              <p>
                Generate reports for students, staff, attendance, finance,
                admissions, examinations, and organization activity.
              </p>
            </div>
          </div>
          {can('reporting.read') ? (
            <Link
              to={
                '/admin/organizations/' +
                encodeURIComponent(organizationId) +
                '/reports'
              }
              className="admin-dashboard-report-link"
            >
              Open Reports &amp; Export <ArrowUpRight size={14} />
            </Link>
          ) : (
            <span className="admin-dashboard-report-link" aria-disabled="true">
              Reports permission required
            </span>
          )}
        </section>
      </div>

      {(summary.isError || collections.isError || attendance.isError) && (
        <p className="admin-dashboard-muted" role="status">
          Some dashboard information could not be loaded. No sample figures are
          displayed.
        </p>
      )}
    </section>
  );
}
