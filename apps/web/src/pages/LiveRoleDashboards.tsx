import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import {
  BookOpenText,
  CalendarCheck,
  ClipboardList,
  GraduationCap,
  ReceiptText,
  Users,
  WalletCards,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  getStudentRoster,
  listStudentAttendance,
  listTeacherAttendanceAssignments,
} from '../attendance/attendance-api.js';
import type {
  StudentAttendanceRecord,
  TeacherAttendanceAssignment,
} from '../attendance/attendance-api.js';
import { listDailyCollections, listInvoices } from '../finance/finance-api.js';
import type { StudentInvoice } from '../finance/finance-api.js';

function localDate(date = new Date()) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 10);
}

function lastSevenDays() {
  const today = new Date();
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (6 - index));
    return localDate(date);
  });
}

function formatPKR(value: number) {
  return new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDay(value: string) {
  return new Intl.DateTimeFormat('en-PK', { weekday: 'short' }).format(
    new Date(value + 'T00:00:00'),
  );
}

function teacherAttendanceQuery(
  organizationId: string,
  assignments: TeacherAttendanceAssignment[],
  dateFrom: string,
  dateTo: string,
) {
  const uniqueSections = [
    ...new Map(assignments.map((item) => [item.sectionId, item])).values(),
  ];
  return Promise.all(
    uniqueSections.map((assignment) =>
      listStudentAttendance(organizationId, {
        sectionId: assignment.sectionId,
        dateFrom,
        dateTo,
      }),
    ),
  ).then((responses) => responses.flatMap((response) => response.items));
}

function dayStatistics(records: StudentAttendanceRecord[], days: string[]) {
  return days.map((date) => {
    const items = records.filter((record) => record.date === date);
    return {
      date,
      label: formatDay(date),
      count: items.length,
      percentage: items.length
        ? Math.round(
            (items.filter((record) => record.status === 'present').length /
              items.length) *
              100,
          )
        : 0,
    };
  });
}

function MetricCard({
  label,
  value,
  note,
  icon,
}: {
  label: string;
  value: string;
  note: string;
  icon: typeof Users;
}) {
  const Icon = icon;
  return (
    <article className="reference-metric-card">
      <div className="reference-metric-icon">
        <Icon size={15} aria-hidden="true" />
      </div>
      <span className="reference-metric-label">{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </article>
  );
}

function QuickAction({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link className="reference-quick-action" to={to}>
      {children}
    </Link>
  );
}

export function TeacherLiveDashboard({
  organizationId,
  userName,
}: {
  organizationId: string;
  userName?: string;
}) {
  const today = localDate();
  const days = useMemo(lastSevenDays, []);
  const dateFrom = days[0]!;
  const assignmentsQuery = useQuery({
    queryKey: ['attendance', organizationId, 'teacher-assignments'],
    queryFn: () => listTeacherAttendanceAssignments(organizationId),
    retry: false,
  });
  const assignments = assignmentsQuery.data?.items ?? [];
  const rosterQuery = useQuery({
    queryKey: [
      'teacher-live-dashboard-rosters',
      organizationId,
      today,
      assignments.map((item) => item.id).join('|'),
    ],
    queryFn: () =>
      Promise.all(
        assignments.map((assignment) =>
          getStudentRoster(organizationId, {
            campusId: assignment.campusId,
            academicYearId: assignment.academicYearId,
            classId: assignment.classId,
            sectionId: assignment.sectionId,
            date: today,
          }),
        ),
      ).then((responses) => responses.flatMap((response) => response.items)),
    enabled: assignmentsQuery.isSuccess && assignments.length > 0,
    retry: false,
  });
  const attendanceQuery = useQuery({
    queryKey: [
      'teacher-live-dashboard-attendance',
      organizationId,
      dateFrom,
      today,
      assignments.map((item) => item.sectionId).join('|'),
    ],
    queryFn: () =>
      teacherAttendanceQuery(organizationId, assignments, dateFrom, today),
    enabled: assignmentsQuery.isSuccess && assignments.length > 0,
    retry: false,
  });
  const roster = rosterQuery.data ?? [];
  const records = attendanceQuery.data ?? [];
  const weeks = useMemo(() => dayStatistics(records, days), [records, days]);
  const markedToday = roster.filter((item) => Boolean(item.status)).length;
  const presentToday = roster.filter(
    (item) => item.status === 'present',
  ).length;
  const distinctCampuses = new Set(assignments.map((item) => item.campusId))
    .size;
  const distinctYears = new Set(assignments.map((item) => item.academicYearId))
    .size;
  const students = new Set(roster.map((item) => item.id)).size;

  return (
    <main className="page-stack role-dashboard reference-dashboard-preview live-role-dashboard">
      <section className="page-heading reference-dashboard-heading">
        <div>
          <p className="eyebrow">Teacher workspace</p>
          <h1>Teaching overview</h1>
          <p className="page-description">
            Your assigned classes, student records and daily attendance.
          </p>
          {userName && (
            <p className="reference-dashboard-greeting">
              Welcome back, {userName}
            </p>
          )}
        </div>
      </section>
      <nav
        aria-label="Teacher quick actions"
        className="reference-quick-actions"
      >
        <QuickAction
          to={`/teacher/organizations/${encodeURIComponent(organizationId)}/students`}
        >
          <Users size={13} aria-hidden="true" /> My classes &amp; students
        </QuickAction>
        <QuickAction
          to={`/teacher/organizations/${encodeURIComponent(organizationId)}/attendance`}
        >
          <CalendarCheck size={13} aria-hidden="true" /> Mark attendance
        </QuickAction>
        <QuickAction
          to={`/teacher/organizations/${encodeURIComponent(organizationId)}/homework-tests`}
        >
          <BookOpenText size={13} aria-hidden="true" /> Homework &amp; tests
        </QuickAction>
        <QuickAction
          to={`/teacher/organizations/${encodeURIComponent(organizationId)}/communications`}
        >
          <ClipboardList size={13} aria-hidden="true" /> Messages
        </QuickAction>
      </nav>
      {assignmentsQuery.isError ? (
        <section className="reference-dashboard-panel">
          <h2>Assigned classes unavailable</h2>
          <p className="page-description">
            We could not load your assigned teaching sections. Open My classes
            &amp; students and retry.
          </p>
          <QuickAction
            to={`/teacher/organizations/${encodeURIComponent(organizationId)}/students`}
          >
            Open assigned classes
          </QuickAction>
        </section>
      ) : (
        <>
          <section
            aria-label="Live teaching metrics"
            className="reference-metrics-grid"
          >
            <MetricCard
              label="Assigned sections"
              value={String(assignments.length)}
              note="Active teaching assignments"
              icon={GraduationCap}
            />
            <MetricCard
              label="Students in roster"
              value={rosterQuery.isSuccess ? String(students) : '—'}
              note={
                rosterQuery.isError
                  ? 'Roster unavailable'
                  : 'Current assigned sections'
              }
              icon={Users}
            />
            <MetricCard
              label="Attendance marked"
              value={rosterQuery.isSuccess ? String(markedToday) : '—'}
              note="For today’s selected date"
              icon={CalendarCheck}
            />
            <MetricCard
              label="Present today"
              value={rosterQuery.isSuccess ? String(presentToday) : '—'}
              note="Saved attendance records"
              icon={ClipboardList}
            />
            <MetricCard
              label="Campuses"
              value={String(distinctCampuses)}
              note="In your assignments"
              icon={GraduationCap}
            />
            <MetricCard
              label="Academic years"
              value={String(distinctYears)}
              note="Included in assignments"
              icon={BookOpenText}
            />
          </section>
          <section className="reference-dashboard-bottom">
            <section className="reference-dashboard-panel">
              <div className="reference-panel-heading">
                <h2>My assigned classes</h2>
                <Link
                  className="reference-view-all"
                  to={`/teacher/organizations/${encodeURIComponent(organizationId)}/students`}
                >
                  View students ↗
                </Link>
              </div>
              {assignmentsQuery.isPending ? (
                <p className="reference-scope-note">
                  Loading assigned sections…
                </p>
              ) : assignments.length === 0 ? (
                <p className="reference-scope-note">
                  No active class assignments are linked to this account yet.
                </p>
              ) : (
                <div className="reference-activity-list">
                  {assignments.map((item) => (
                    <Link
                      className="reference-activity-row live-assignment-row"
                      key={item.id}
                      to={`/teacher/organizations/${encodeURIComponent(organizationId)}/students?assignmentId=${encodeURIComponent(item.id)}`}
                    >
                      <span
                        className="reference-activity-dot"
                        aria-hidden="true"
                      />
                      <span className="reference-activity-copy">
                        <strong>
                          {item.className} · {item.sectionName}
                        </strong>
                        <small>
                          {item.campusName} · {item.academicYearName}
                        </small>
                      </span>
                      <span className="reference-status reference-status-info">
                        Open roster
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </section>
            <section className="reference-dashboard-panel">
              <div className="reference-panel-heading">
                <h2>Attendance · This week</h2>
                <span>{records.length} records</span>
              </div>
              {attendanceQuery.isPending ? (
                <p className="reference-scope-note">
                  Loading attendance history…
                </p>
              ) : attendanceQuery.isError ? (
                <p className="reference-scope-note">
                  Attendance history is unavailable. The weekly chart is not
                  shown until it can be loaded.
                </p>
              ) : records.length === 0 ? (
                <p className="reference-scope-note">
                  No saved attendance records were found for the last seven
                  days.
                </p>
              ) : (
                <>
                  <div className="reference-chart-bars">
                    {weeks.map((item) => (
                      <div
                        className="reference-chart-day"
                        key={item.date}
                        title={`${item.date}: ${item.count} records, ${item.percentage}% present`}
                      >
                        <div className="reference-chart-track">
                          <span
                            className="reference-chart-fill"
                            style={{
                              height: `${item.count ? Math.max(6, item.percentage) : 0}%`,
                            }}
                          />
                        </div>
                        <small>{item.label}</small>
                      </div>
                    ))}
                  </div>
                  <div className="reference-chart-summary">
                    <span
                      className="reference-chart-status-dot"
                      aria-hidden="true"
                    />
                    Actual saved attendance ·{' '}
                    {Math.round(
                      (records.filter((item) => item.status === 'present')
                        .length /
                        records.length) *
                        100,
                    )}
                    % present across {records.length} marked records
                  </div>
                </>
              )}
            </section>
          </section>
        </>
      )}
    </main>
  );
}

export function AccountantLiveDashboard({
  organizationId,
  userName,
}: {
  organizationId: string;
  userName?: string;
}) {
  const days = useMemo(lastSevenDays, []);
  const invoicesQuery = useQuery({
    queryKey: ['finance', organizationId, 'live-role-dashboard-invoices'],
    queryFn: () => listInvoices(organizationId),
    retry: false,
  });
  const collectionsQuery = useQuery({
    queryKey: [
      'finance',
      organizationId,
      'live-daily-collections',
      days[0],
      days[6],
    ],
    queryFn: () =>
      listDailyCollections(organizationId, {
        dateFrom: days[0]!,
        dateTo: days[6]!,
      }),
    retry: false,
  });
  const invoices: StudentInvoice[] = invoicesQuery.data?.items ?? [];
  const collectionItems = collectionsQuery.data?.items ?? [];
  const dailyCollections = days.map((date) => {
    const item = collectionItems.find((record) => record.date === date);
    return {
      date,
      label: formatDay(date),
      amountCollected: item?.amountCollected ?? 0,
      paymentCount: item?.paymentCount ?? 0,
    };
  });
  const maxDailyCollection = Math.max(
    1,
    ...dailyCollections.map((item) => item.amountCollected),
  );
  const weekCollected = dailyCollections.reduce(
    (sum, item) => sum + item.amountCollected,
    0,
  );
  const weekPaymentCount = dailyCollections.reduce(
    (sum, item) => sum + item.paymentCount,
    0,
  );
  const totals = useMemo(() => {
    const outstanding = (invoice: StudentInvoice) =>
      Math.max(0, invoice.totalAmount - invoice.paidAmount);
    return {
      billed: invoices.reduce((sum, item) => sum + item.totalAmount, 0),
      collected: invoices.reduce((sum, item) => sum + item.paidAmount, 0),
      outstanding: invoices.reduce((sum, item) => sum + outstanding(item), 0),
      overdue: invoices
        .filter((item) => item.status === 'overdue')
        .reduce((sum, item) => sum + outstanding(item), 0),
      paid: invoices.filter((item) => item.status === 'paid').length,
      open: invoices.filter((item) => item.status !== 'paid').length,
    };
  }, [invoices]);
  const recent = [...invoices]
    .sort((a, b) =>
      (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt),
    )
    .slice(0, 4);

  return (
    <main className="page-stack role-dashboard reference-dashboard-preview live-role-dashboard">
      <section className="page-heading reference-dashboard-heading">
        <div>
          <p className="eyebrow">Accountant workspace</p>
          <h1>Finance overview</h1>
          <p className="page-description">
            Monitor real fee invoices, collected amounts and outstanding
            balances.
          </p>
          {userName && (
            <p className="reference-dashboard-greeting">
              Welcome back, {userName}
            </p>
          )}
        </div>
      </section>
      <nav
        aria-label="Finance quick actions"
        className="reference-quick-actions"
      >
        <QuickAction
          to={`/accountant/organizations/${encodeURIComponent(organizationId)}/finance`}
        >
          <WalletCards size={13} aria-hidden="true" /> Collect fee
        </QuickAction>
        <QuickAction
          to={`/accountant/organizations/${encodeURIComponent(organizationId)}/concessions`}
        >
          <ReceiptText size={13} aria-hidden="true" /> Concessions
        </QuickAction>
        <QuickAction
          to={`/accountant/organizations/${encodeURIComponent(organizationId)}/reports`}
        >
          <ClipboardList size={13} aria-hidden="true" /> Generate report
        </QuickAction>
      </nav>
      {invoicesQuery.isError ? (
        <section className="reference-dashboard-panel">
          <h2>Finance records unavailable</h2>
          <p className="page-description">
            We could not load fee invoices for this organization. Open Finance
            and retry.
          </p>
          <QuickAction
            to={`/accountant/organizations/${encodeURIComponent(organizationId)}/finance`}
          >
            Open finance
          </QuickAction>
        </section>
      ) : (
        <>
          <section
            aria-label="Live finance metrics"
            className="reference-metrics-grid"
          >
            <MetricCard
              label="Total invoiced"
              value={invoicesQuery.isPending ? '—' : formatPKR(totals.billed)}
              note="Returned invoice records"
              icon={ReceiptText}
            />
            <MetricCard
              label="Collected"
              value={
                invoicesQuery.isPending ? '—' : formatPKR(totals.collected)
              }
              note="Paid amount across invoices"
              icon={WalletCards}
            />
            <MetricCard
              label="Outstanding"
              value={
                invoicesQuery.isPending ? '—' : formatPKR(totals.outstanding)
              }
              note="Unpaid invoice balance"
              icon={ReceiptText}
            />
            <MetricCard
              label="Overdue"
              value={invoicesQuery.isPending ? '—' : formatPKR(totals.overdue)}
              note="Balance on overdue invoices"
              icon={CalendarCheck}
            />
            <MetricCard
              label="Paid invoices"
              value={invoicesQuery.isPending ? '—' : String(totals.paid)}
              note="Status: paid"
              icon={ClipboardList}
            />
            <MetricCard
              label="Open invoices"
              value={invoicesQuery.isPending ? '—' : String(totals.open)}
              note="Unpaid, partial or overdue"
              icon={Users}
            />
          </section>
          <section className="reference-dashboard-bottom">
            <section className="reference-dashboard-panel">
              <div className="reference-panel-heading">
                <h2>Recent invoice activity</h2>
                <Link
                  className="reference-view-all"
                  to={`/accountant/organizations/${encodeURIComponent(organizationId)}/finance`}
                >
                  View all ↗
                </Link>
              </div>
              {invoicesQuery.isPending ? (
                <p className="reference-scope-note">Loading invoices…</p>
              ) : recent.length === 0 ? (
                <p className="reference-scope-note">
                  No invoice records are available yet.
                </p>
              ) : (
                <div className="reference-activity-list">
                  {recent.map((item) => (
                    <article className="reference-activity-row" key={item.id}>
                      <span
                        className="reference-activity-dot"
                        aria-hidden="true"
                      />
                      <span className="reference-activity-copy">
                        <strong>
                          {item.studentName} · {item.invoiceNumber}
                        </strong>
                        <small>
                          {item.billingCycle} · Updated{' '}
                          {item.updatedAt.slice(0, 10)}
                        </small>
                      </span>
                      <span
                        className={`reference-status ${item.status === 'paid' ? 'reference-status-paid' : item.status === 'overdue' ? 'reference-status-pending' : 'reference-status-info'}`}
                      >
                        {item.status}
                      </span>
                    </article>
                  ))}
                </div>
              )}
            </section>
            <section className="reference-dashboard-panel live-invoice-status-panel">
              <div className="reference-panel-heading">
                <h2>Daily collection · This week</h2>
                <span>{weekPaymentCount} payments</span>
              </div>
              {collectionsQuery.isPending ? (
                <p className="reference-scope-note">
                  Loading saved payment receipts…
                </p>
              ) : collectionsQuery.isError ? (
                <p className="reference-scope-note">
                  Daily collections could not be loaded. Check finance access
                  and retry.
                </p>
              ) : weekPaymentCount === 0 ? (
                <p className="reference-scope-note">
                  No payment receipts were recorded in the last seven days.
                </p>
              ) : (
                <>
                  <div className="reference-chart-bars live-invoice-status-chart">
                    {dailyCollections.map((item) => (
                      <div
                        className="reference-chart-day"
                        key={item.date}
                        title={`${item.date}: ${formatPKR(item.amountCollected)} collected from ${item.paymentCount} payments`}
                      >
                        <div className="reference-chart-track">
                          <span
                            className="reference-chart-fill"
                            style={{
                              height: `${item.amountCollected ? Math.max(4, (item.amountCollected / maxDailyCollection) * 100) : 0}%`,
                            }}
                          />
                        </div>
                        <small>{item.label}</small>
                      </div>
                    ))}
                  </div>
                  <div className="reference-chart-summary">
                    <span
                      className="reference-chart-status-dot"
                      aria-hidden="true"
                    />
                    {formatPKR(weekCollected)} collected from {weekPaymentCount}{' '}
                    recorded payments over the last seven days.
                  </div>
                </>
              )}
            </section>
          </section>
        </>
      )}
    </main>
  );
}
