import {
  BookOpenText,
  CalendarClock,
  CreditCard,
  CalendarCheck,
  CheckCircle2,
  Clock3,
  GraduationCap,
  MessageCircle,
  Printer,
  ReceiptText,
  WalletCards,
  XCircle,
} from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useAuth } from '../auth/AuthProvider.js';
import { ParentTeacherInbox } from '../communications/ParentTeacherInbox.js';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PermissionDeniedState,
} from '../components/ui/States.js';
import { getOrganizationAccessContext } from '../tenancy/tenancy-api.js';
import { getPortalMe, type StudentPortalRecord } from './portal-api.js';
import { ParentDashboard } from './ParentDashboard.js';

type PortalSection =
  'home' | 'fees' | 'attendance' | 'results' | 'homework' | 'messages';
type PortalMode = 'parent_guardian' | 'student';

const sections: Array<{
  key: Exclude<PortalSection, 'home'>;
  label: string;
  icon: typeof WalletCards;
}> = [
  { key: 'attendance', label: 'Attendance', icon: CalendarCheck },
  { key: 'fees', label: 'Fees & receipts', icon: WalletCards },
  { key: 'homework', label: 'Daily Diary', icon: BookOpenText },
  { key: 'results', label: 'Results', icon: GraduationCap },
  { key: 'messages', label: 'Messages', icon: MessageCircle },
];

function money(value: number) {
  return new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    maximumFractionDigits: 0,
  }).format(value);
}

function dateLabel(value: string | null) {
  if (!value) return 'Not available';
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime())
    ? 'Not available'
    : new Intl.DateTimeFormat('en-PK', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }).format(parsed);
}

function escapeReceiptText(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return entities[character] ?? character;
  });
}

function printParentReceipt(
  receipt: StudentPortalRecord['fees']['receipts'][number],
  studentName: string,
) {
  const preview = window.open('', '_blank');
  if (!preview) {
    window.alert('Allow pop-ups to print or save this receipt.');
    return;
  }
  const method = receipt.paymentMethod.replaceAll('_', ' ');
  const html = [
    '<!doctype html><html lang="en"><head><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<title>Receipt ',
    escapeReceiptText(receipt.receiptNumber),
    '</title>',
    '<style>*{box-sizing:border-box}body{margin:0;padding:28px;background:#f5f6f7;color:#172033;font:14px Arial,sans-serif}.receipt{max-width:720px;margin:auto;padding:34px;background:#fff;border:1px solid #e5e7eb;border-radius:12px}.top{display:flex;justify-content:space-between;gap:18px;border-bottom:1px solid #e5e7eb;padding-bottom:18px}.muted,.label{color:#64748b;font-size:11px}.eyebrow,.label{display:block;text-transform:uppercase;letter-spacing:.07em;font-size:10px}.number{font-size:20px;font-weight:700;margin-top:5px}.amount{margin:24px 0;padding:20px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px}.amount strong{display:block;font-size:30px;margin-top:6px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:20px 26px}.value{font-weight:650;overflow-wrap:anywhere}.label{margin-bottom:5px}.footer{margin-top:30px;padding-top:15px;border-top:1px solid #e5e7eb;color:#64748b;font-size:11px;text-align:center}.toolbar{max-width:720px;margin:0 auto 14px;text-align:right}.toolbar button{border:0;border-radius:8px;background:#172033;color:white;padding:11px 16px;font-weight:700}@media(max-width:560px){body{padding:12px}.receipt{padding:20px}.grid{gap:16px}.number{font-size:17px}}@media print{body{padding:0;background:#fff}.receipt{max-width:none;border:0;padding:0}.toolbar{display:none}@page{size:A4;margin:18mm}}</style>',
    '</head><body><div class="toolbar"><button onclick="window.print()">Print / Save as PDF</button></div>',
    '<main class="receipt"><header class="top"><div><strong>InstituteOS</strong><div class="muted">Official payment receipt</div></div>',
    '<div style="text-align:right"><span class="eyebrow">Receipt number</span><div class="number">',
    escapeReceiptText(receipt.receiptNumber),
    '</div></div></header>',
    '<section class="amount"><span class="eyebrow">Payment received</span><strong>',
    money(receipt.amountPaid),
    '</strong></section>',
    '<section class="grid"><div><span class="label">Student</span><div class="value">',
    escapeReceiptText(studentName),
    '</div></div>',
    '<div><span class="label">Payment date</span><div class="value">',
    dateLabel(receipt.paymentDate),
    '</div></div>',
    '<div><span class="label">Invoice</span><div class="value">',
    escapeReceiptText(receipt.invoiceNumber),
    '</div></div>',
    '<div><span class="label">Fee period</span><div class="value">',
    escapeReceiptText(receipt.billingCycle),
    '</div></div>',
    '<div><span class="label">Payment method</span><div class="value" style="text-transform:capitalize">',
    escapeReceiptText(method),
    '</div></div>',
    '<div><span class="label">Transaction reference</span><div class="value">',
    escapeReceiptText(receipt.transactionReference || '?'),
    '</div></div></section>',
    '<footer class="footer">Computer-generated receipt ? Keep this document for your records</footer></main></body></html>',
  ].join('');
  preview.document.open();
  preview.document.write(html);
  preview.document.close();
  preview.focus();
}

function invoiceStatusLabel(status: string) {
  const labels: Record<string, string> = {
    paid: 'Paid',
    partial: 'Partially paid',
    overdue: 'Overdue',
    unpaid: 'Unpaid',
  };
  return labels[status.toLowerCase()] ?? status.replaceAll('_', ' ');
}

function attendanceStatusTone(status: string) {
  const normalized = status.toLowerCase();
  return ['present', 'absent', 'late', 'leave'].includes(normalized)
    ? normalized
    : 'neutral';
}

function attendanceStatusLabel(status: string) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function localDateKey(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

type PortalResult = StudentPortalRecord['results'][number];

function resultPercentage(result: PortalResult): number | null {
  if (result.isAbsent) return null;
  if (result.percentage !== null) return result.percentage;
  if (result.marksObtained === null || result.totalMarks <= 0) return null;
  return (result.marksObtained / result.totalMarks) * 100;
}

function groupResultsByExam(results: PortalResult[]) {
  const groups = new Map<string, PortalResult[]>();

  results.forEach((result) => {
    const examResults = groups.get(result.examName) ?? [];
    examResults.push(result);
    groups.set(result.examName, examResults);
  });

  return Array.from(groups, ([examName, examResults]) => ({
    examName,
    results: [...examResults].sort((a, b) =>
      a.subjectName.localeCompare(b.subjectName),
    ),
    latestDate:
      examResults
        .map((result) => result.date)
        .filter((date): date is string => Boolean(date))
        .sort((a, b) => b.localeCompare(a))[0] ?? null,
  }));
}

function attendanceSummary(
  records: StudentPortalRecord['attendance']['records'],
  dateFrom: string,
  dateTo: string,
) {
  const counts = { present: 0, absent: 0, late: 0, leave: 0 };
  records.forEach((record) => {
    const recordDate = record.date?.slice(0, 10);
    if (!recordDate || recordDate < dateFrom || recordDate > dateTo) return;
    if (record.status in counts) {
      counts[record.status as keyof typeof counts] += 1;
    }
  });
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  return {
    ...counts,
    total,
    percentage: total
      ? Math.round(((counts.present + counts.late) / total) * 100)
      : null,
  };
}

function StudentFamilyPortalPage({ mode }: { mode: PortalMode }) {
  const { organizationId = '', section = 'home' } = useParams();
  const { user } = useAuth();
  const activeSection: PortalSection = [
    'attendance',
    'fees',
    'homework',
    'results',
    'messages',
  ].includes(section)
    ? (section as PortalSection)
    : 'home';
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [attendancePeriod, setAttendancePeriod] = useState<
    'all' | 'week' | 'month'
  >('all');
  const [diaryQuery, setDiaryQuery] = useState('');
  const [diaryType, setDiaryType] = useState<
    'all' | 'homework' | 'class_test' | 'test'
  >('all');
  const access = useQuery({
    queryKey: ['organization-context', organizationId],
    queryFn: () => getOrganizationAccessContext(organizationId),
    enabled: Boolean(organizationId),
    retry: false,
    staleTime: 30_000,
  });
  const portal = useQuery({
    queryKey: ['portal-me', organizationId],
    queryFn: () => getPortalMe(organizationId),
    enabled: Boolean(access.data && access.data.role === mode),
    retry: false,
  });

  if (access.isPending)
    return <LoadingState message="Opening your family workspace…" />;
  if (access.isError || !access.data) {
    return (
      <ErrorState
        title="Family workspace unavailable"
        description="We could not confirm access to this college. Please sign in again or contact the college office."
        onRetry={() => void access.refetch()}
      />
    );
  }
  if (access.data.role !== mode) return <PermissionDeniedState />;
  if (portal.isPending)
    return <LoadingState message="Loading your linked student records…" />;
  if (portal.isError || !portal.data) {
    return (
      <ErrorState
        title="Student record not linked"
        description="Your signed-in account could not be matched to one active student record or an explicitly linked guardian record. Ask the college office to verify the account email and family relationship."
        onRetry={() => void portal.refetch()}
      />
    );
  }

  const students = portal.data.students;
  const selectedStudent =
    students.find((student) => student.id === selectedStudentId) ?? students[0];
  const portalToday = new Date();
  const portalTodayKey = localDateKey(portalToday);
  const weekStartDate = new Date(
    portalToday.getFullYear(),
    portalToday.getMonth(),
    portalToday.getDate() - ((portalToday.getDay() + 6) % 7),
  );
  const weekStartKey = localDateKey(weekStartDate);
  const monthStartKey = localDateKey(
    new Date(portalToday.getFullYear(), portalToday.getMonth(), 1),
  );
  const selectedAttendanceRecords = selectedStudent?.attendance.records ?? [];
  const selectedAttendanceSummary =
    attendancePeriod === 'week'
      ? attendanceSummary(
          selectedAttendanceRecords,
          weekStartKey,
          portalTodayKey,
        )
      : attendancePeriod === 'month'
        ? attendanceSummary(
            selectedAttendanceRecords,
            monthStartKey,
            portalTodayKey,
          )
        : attendanceSummary(
            selectedAttendanceRecords,
            '0000-01-01',
            '9999-12-31',
          );
  const attendancePeriodLabel =
    attendancePeriod === 'week'
      ? 'This week'
      : attendancePeriod === 'month'
        ? 'This month'
        : 'All time';
  const attendanceStats = [
    {
      key: 'present' as const,
      label: 'Present',
      description: 'Marked present',
      icon: CheckCircle2,
    },
    {
      key: 'absent' as const,
      label: 'Absent',
      description: 'Days marked absent',
      icon: XCircle,
    },
    {
      key: 'late' as const,
      label: 'Late',
      description: 'Late arrivals',
      icon: Clock3,
    },
    {
      key: 'leave' as const,
      label: 'Leave',
      description: 'Approved leave days',
      icon: CalendarCheck,
    },
  ];
  const sortedAttendanceRecords = [...selectedAttendanceRecords].sort((a, b) =>
    (b.date ?? '').localeCompare(a.date ?? ''),
  );
  const diaryItems = [...(selectedStudent?.homework ?? [])]
    .filter((item) => diaryType === 'all' || item.type === diaryType)
    .filter((item) =>
      [item.title, item.subjectName, item.instructions, item.teacherName ?? '']
        .join(' ')
        .toLowerCase()
        .includes(diaryQuery.trim().toLowerCase()),
    )
    .sort((a, b) => (b.assignedDate ?? '').localeCompare(a.assignedDate ?? ''));
  const resultRecords = selectedStudent?.results ?? [];
  const scoredResults = resultRecords.filter(
    (result) => resultPercentage(result) !== null,
  );
  const resultAverage = scoredResults.length
    ? Math.round(
        scoredResults.reduce(
          (total, result) => total + (resultPercentage(result) ?? 0),
          0,
        ) / scoredResults.length,
      )
    : null;
  const resultSubjects = new Set(
    resultRecords.map((result) => result.subjectName),
  );
  const resultExamGroups = groupResultsByExam(resultRecords);
  const attendanceWeekDates = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStartDate);
    date.setDate(weekStartDate.getDate() + index);
    return localDateKey(date);
  });
  const weeklyAttendance = attendanceWeekDates.map((date) => {
    const dayRecords = (selectedStudent?.attendance.records ?? []).filter(
      (record) => record.date?.slice(0, 10) === date,
    );
    return {
      date,
      label: new Intl.DateTimeFormat('en-PK', { weekday: 'short' }).format(
        new Date(`${date}T00:00:00`),
      ),
      count: dayRecords.length,
      percentage: dayRecords.length
        ? Math.round(
            (dayRecords.filter(
              (record) =>
                record.status === 'present' || record.status === 'late',
            ).length /
              dayRecords.length) *
              100,
          )
        : 0,
    };
  });
  const root = `/${mode === 'student' ? 'student' : 'parent'}/organizations/${encodeURIComponent(organizationId)}`;
  const heading =
    activeSection === 'home'
      ? mode === 'student'
        ? 'Your college workspace'
        : "Your Child's Progress"
      : sections.find((item) => item.key === activeSection)?.label;

  return (
    <div
      className={`page-stack parent-portal${activeSection === 'home' ? ' reference-dashboard-preview live-role-dashboard' : ''}`}
    >
      <section
        className={`parent-portal-heading${activeSection === 'home' ? ' reference-dashboard-heading' : ''}${mode === 'parent_guardian' ? ' parent-portal-heading-with-picker' : ''}${activeSection === 'messages' ? ' parent-portal-messages-heading' : ''}`}
      >
        <div>
          {mode === 'student' && <p className="eyebrow">Student workspace</p>}
          <h1>{heading}</h1>
          {activeSection !== 'messages' && (
            <p className="page-description">
              {mode === 'student'
                ? 'Your current college information, fees, and attendance.'
                : activeSection === 'homework'
                  ? "View your child's homework, class tests and teacher instructions."
                  : activeSection === 'results'
                    ? 'Published exam marks and grades.'
                    : 'Attendance, fees and college updates.'}
            </p>
          )}
        </div>
        {mode === 'parent_guardian' &&
          selectedStudent &&
          (students.length > 1 ? (
            <label
              className={`portal-student-picker parent-student-picker parent-portal-student-picker${activeSection === 'messages' ? ' parent-messages-student-picker' : ''}`}
            >
              <select
                aria-label="Select linked student"
                onChange={(event) => setSelectedStudentId(event.target.value)}
                value={selectedStudent.id}
              >
                {students.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.displayName}
                  </option>
                ))}
              </select>
            </label>
          ) : activeSection === 'messages' ? (
            <label className="portal-student-picker parent-student-picker parent-portal-student-picker parent-messages-student-picker">
              <select
                aria-label="Select linked student"
                value={selectedStudent.id}
                disabled
              >
                <option value={selectedStudent.id}>
                  {selectedStudent.displayName}
                </option>
              </select>
            </label>
          ) : (
            <label className="portal-student-picker parent-student-picker parent-portal-student-picker">
              <select
                aria-label="Select linked student"
                value={selectedStudent.id}
                disabled
              >
                <option value={selectedStudent.id}>
                  {selectedStudent.displayName}
                </option>
              </select>
            </label>
          ))}
        {mode === 'student' && students.length > 1 && (
          <label className="portal-student-picker">
            <span>Linked student</span>
            <select
              aria-label="Select linked student"
              onChange={(event) => setSelectedStudentId(event.target.value)}
              value={selectedStudent?.id ?? ''}
            >
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.displayName}
                </option>
              ))}
            </select>
          </label>
        )}
      </section>

      {students.length === 0 ? (
        <EmptyState
          title={
            mode === 'student'
              ? 'No active student record found'
              : 'No linked children found'
          }
          description="The account is authenticated, but the college has not linked an active student record to it yet."
        />
      ) : (
        <>
          {selectedStudent && mode === 'student' && (
            <section className="parent-student-card panel">
              <div className="parent-student-avatar" aria-hidden="true">
                {selectedStudent.firstName.slice(0, 1).toUpperCase()}
              </div>
              <div className="parent-student-details">
                <span className="parent-card-kicker">
                  {mode === 'student' ? 'Your record' : 'Linked student'}
                </span>
                <h2>{selectedStudent.displayName}</h2>
                <p>
                  {selectedStudent.className} · {selectedStudent.sectionName}
                </p>
                <p>{selectedStudent.campusName}</p>
              </div>
              <span className="parent-student-status">
                <CheckCircle2 size={14} aria-hidden="true" />{' '}
                {selectedStudent.status}
              </span>
            </section>
          )}

          {mode === 'student' && (
            <nav
              className="parent-portal-tabs"
              aria-label="Student information"
            >
              <Link
                className={
                  activeSection === 'home'
                    ? 'parent-portal-tab is-active'
                    : 'parent-portal-tab'
                }
                to={root}
              >
                <BookOpenText size={17} aria-hidden="true" /> Overview
              </Link>
              {sections.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    className={
                      activeSection === item.key
                        ? 'parent-portal-tab is-active'
                        : 'parent-portal-tab'
                    }
                    key={item.key}
                    to={`${root}/${item.key}`}
                  >
                    <Icon size={17} aria-hidden="true" /> {item.label}
                  </Link>
                );
              })}
            </nav>
          )}

          {selectedStudent &&
            activeSection === 'home' &&
            mode === 'parent_guardian' && (
              <ParentDashboard
                student={selectedStudent}
                organizationId={organizationId}
              />
            )}

          {selectedStudent &&
            activeSection === 'home' &&
            mode === 'student' && (
              <>
                <nav
                  aria-label="Portal quick actions"
                  className="reference-quick-actions"
                >
                  <Link className="reference-quick-action" to={`${root}/fees`}>
                    <WalletCards size={13} aria-hidden="true" /> Fees &amp;
                    receipts
                  </Link>
                  <Link
                    className="reference-quick-action"
                    to={`${root}/attendance`}
                  >
                    <CalendarCheck size={13} aria-hidden="true" /> Attendance
                  </Link>
                  <Link
                    className="reference-quick-action"
                    to={`${root}/results`}
                  >
                    <GraduationCap size={13} aria-hidden="true" /> Results
                  </Link>
                  <Link
                    className="reference-quick-action"
                    to={`${root}/homework`}
                  >
                    <BookOpenText size={13} aria-hidden="true" /> Homework &amp;
                    tests
                  </Link>
                  <Link
                    className="reference-quick-action"
                    to={`${root}/messages`}
                  >
                    <MessageCircle size={13} aria-hidden="true" /> Messages
                  </Link>
                </nav>
                <section
                  aria-label="Live student and family metrics"
                  className="reference-metrics-grid"
                >
                  <article className="reference-metric-card">
                    <div className="reference-metric-icon">
                      <CalendarCheck size={15} aria-hidden="true" />
                    </div>
                    <span className="reference-metric-label">
                      ATTENDANCE RATE
                    </span>
                    <strong>
                      {selectedStudent.attendance.percentage === null
                        ? '—'
                        : `${selectedStudent.attendance.percentage}%`}
                    </strong>
                    <small>Based on recorded attendance</small>
                  </article>
                  <article className="reference-metric-card">
                    <div className="reference-metric-icon">
                      <CheckCircle2 size={15} aria-hidden="true" />
                    </div>
                    <span className="reference-metric-label">
                      ATTENDANCE DAYS
                    </span>
                    <strong>
                      {selectedStudent.attendance.present} /{' '}
                      {selectedStudent.attendance.totalMarked}
                    </strong>
                    <small>
                      {selectedStudent.attendance.absent} absent ·{' '}
                      {selectedStudent.attendance.late} late ·{' '}
                      {selectedStudent.attendance.leave} leave
                    </small>
                  </article>
                  <article className="reference-metric-card">
                    <div className="reference-metric-icon">
                      <WalletCards size={15} aria-hidden="true" />
                    </div>
                    <span className="reference-metric-label">
                      FEES OUTSTANDING
                    </span>
                    <strong>
                      {money(selectedStudent.fees.totalOutstanding)}
                    </strong>
                    <small>Calculated from live invoices</small>
                  </article>
                  <article className="reference-metric-card">
                    <div className="reference-metric-icon">
                      <GraduationCap size={15} aria-hidden="true" />
                    </div>
                    <span className="reference-metric-label">
                      PUBLISHED RESULTS
                    </span>
                    <strong>
                      {selectedStudent.resultsAvailable
                        ? selectedStudent.results.length
                        : '—'}
                    </strong>
                    <small>Results released by the college</small>
                  </article>
                </section>
                <section className="reference-dashboard-bottom">
                  <section className="reference-dashboard-panel">
                    <div className="reference-panel-heading">
                      <h2>Recent fee invoices</h2>
                      <Link className="reference-view-all" to={`${root}/fees`}>
                        View all ↗
                      </Link>
                    </div>
                    {selectedStudent.fees.invoices.length === 0 ? (
                      <p className="reference-scope-note">
                        No fee invoices were found for this linked student.
                      </p>
                    ) : (
                      <div className="reference-activity-list">
                        {selectedStudent.fees.invoices
                          .slice(0, 4)
                          .map((fee) => (
                            <article
                              className="reference-activity-row"
                              key={fee.id}
                            >
                              <span
                                className="reference-activity-dot"
                                aria-hidden="true"
                              />
                              <span className="reference-activity-copy">
                                <strong>
                                  {fee.billingCycle} · {fee.invoiceNumber}
                                </strong>
                                <small>
                                  Due {dateLabel(fee.dueDate)} ·{' '}
                                  {money(fee.outstandingAmount)} outstanding
                                </small>
                              </span>
                              <span
                                className={`reference-status ${fee.status === 'paid' ? 'reference-status-paid' : fee.status === 'overdue' ? 'reference-status-pending' : 'reference-status-info'}`}
                              >
                                {fee.status}
                              </span>
                            </article>
                          ))}
                      </div>
                    )}
                  </section>
                  <section className="reference-dashboard-panel">
                    <div className="reference-panel-heading">
                      <h2>Attendance · This week</h2>
                      <span>
                        {weeklyAttendance.reduce(
                          (total, day) => total + day.count,
                          0,
                        )}{' '}
                        records
                      </span>
                    </div>
                    {weeklyAttendance.every((day) => day.count === 0) ? (
                      <p className="reference-scope-note">
                        No saved attendance records were found for the last
                        seven days.
                      </p>
                    ) : (
                      <>
                        <div className="reference-chart-bars">
                          {weeklyAttendance.map((day) => (
                            <div
                              className="reference-chart-day"
                              key={day.date}
                              title={`${day.date}: ${day.count} records, ${day.percentage}% present`}
                            >
                              <div className="reference-chart-track">
                                <span
                                  className="reference-chart-fill"
                                  style={{
                                    height: `${day.count ? Math.max(6, day.percentage) : 0}%`,
                                  }}
                                />
                              </div>
                              <small>{day.label}</small>
                            </div>
                          ))}
                        </div>
                        <div className="reference-chart-summary">
                          <span
                            className="reference-chart-status-dot"
                            aria-hidden="true"
                          />
                          Actual attendance records linked to this student; no
                          demo values included.
                        </div>
                      </>
                    )}
                  </section>
                </section>
              </>
            )}

          {selectedStudent && activeSection === 'fees' && (
            <section
              className="parent-fees-page"
              aria-label="Fees and receipts"
            >
              <div className="parent-fees-heading">
                <div>
                  <h2>Fee overview</h2>
                  <p>
                    Track invoices, payments and receipts for{' '}
                    {selectedStudent.displayName}.
                  </p>
                </div>
                <span className="parent-fees-updated">
                  Live college records
                </span>
              </div>

              <div className="parent-fees-summary">
                <article className="parent-fees-summary-card is-balance">
                  <span>Outstanding balance</span>
                  <strong>
                    {money(selectedStudent.fees.totalOutstanding)}
                  </strong>
                  <small>Remaining across all invoices</small>
                </article>
                <article className="parent-fees-summary-card">
                  <span>Total paid</span>
                  <strong>{money(selectedStudent.fees.totalPaid)}</strong>
                  <small>Payments recorded by the college</small>
                </article>
                <article className="parent-fees-summary-card">
                  <span>Total invoiced</span>
                  <strong>{money(selectedStudent.fees.totalInvoiced)}</strong>
                  <small>Including previous arrears</small>
                </article>
              </div>

              <section className="parent-fees-section">
                <div className="parent-fees-section-heading">
                  <div>
                    <h3>Fee invoices</h3>
                    <p>
                      {selectedStudent.fees.invoices.length} invoice
                      {selectedStudent.fees.invoices.length === 1 ? '' : 's'} on
                      record
                    </p>
                  </div>
                </div>
                {selectedStudent.fees.invoices.length === 0 ? (
                  <EmptyState
                    title="No fee invoices"
                    description="No fee invoices are available for this student yet."
                  />
                ) : (
                  <div className="parent-fees-invoice-list">
                    {selectedStudent.fees.invoices.map((fee) => {
                      const progress =
                        fee.totalAmount > 0
                          ? Math.min(
                              100,
                              Math.round(
                                (fee.paidAmount / fee.totalAmount) * 100,
                              ),
                            )
                          : 0;
                      const isOverdue = fee.status === 'overdue';
                      return (
                        <article className="parent-fees-invoice" key={fee.id}>
                          <div className="parent-fees-invoice-top">
                            <span className="parent-fees-invoice-icon">
                              <ReceiptText size={18} aria-hidden="true" />
                            </span>
                            <div className="parent-fees-invoice-title">
                              <strong>{fee.billingCycle}</strong>
                              <span>
                                {fee.invoiceNumber} ? Issued{' '}
                                {dateLabel(fee.issueDate)}
                              </span>
                            </div>
                            <span
                              className={'parent-fees-status is-' + fee.status}
                            >
                              {invoiceStatusLabel(fee.status)}
                            </span>
                          </div>
                          <div className="parent-fees-invoice-meta">
                            <div>
                              <span>Due date</span>
                              <strong className={isOverdue ? 'is-overdue' : ''}>
                                {dateLabel(fee.dueDate)}
                              </strong>
                            </div>
                            <div>
                              <span>Invoice total</span>
                              <strong>
                                {money(fee.totalAmount + fee.arrearsAmount)}
                              </strong>
                            </div>
                            <div>
                              <span>Paid</span>
                              <strong>{money(fee.paidAmount)}</strong>
                            </div>
                            <div>
                              <span>Remaining</span>
                              <strong>{money(fee.outstandingAmount)}</strong>
                            </div>
                          </div>
                          <div
                            className="parent-fees-progress"
                            role="progressbar"
                            aria-label={fee.invoiceNumber + ' payment progress'}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={progress}
                          >
                            <span style={{ width: progress + '%' }} />
                          </div>
                          {(fee.discountAmount > 0 ||
                            fee.arrearsAmount > 0) && (
                            <div className="parent-fees-adjustments">
                              {fee.discountAmount > 0 && (
                                <span>
                                  Discount: {money(fee.discountAmount)}
                                </span>
                              )}
                              {fee.arrearsAmount > 0 && (
                                <span>
                                  Previous arrears: {money(fee.arrearsAmount)}
                                </span>
                              )}
                            </div>
                          )}
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>

              <section className="parent-fees-section">
                <div className="parent-fees-section-heading">
                  <div>
                    <h3>Payment receipts</h3>
                    <p>Verified payments recorded by the college</p>
                  </div>
                  <span className="parent-fees-count">
                    {selectedStudent.fees.receipts.length}
                  </span>
                </div>
                {selectedStudent.fees.receipts.length === 0 ? (
                  <EmptyState
                    title="No payment receipts yet"
                    description="Receipts will appear here after the college records a payment."
                  />
                ) : (
                  <div className="parent-fees-receipt-list">
                    {selectedStudent.fees.receipts.map((receipt) => (
                      <article className="parent-fees-receipt" key={receipt.id}>
                        <span className="parent-fees-receipt-icon">
                          <CreditCard size={17} aria-hidden="true" />
                        </span>
                        <div className="parent-fees-receipt-copy">
                          <strong>{receipt.receiptNumber}</strong>
                          <span>
                            {receipt.invoiceNumber} ? {receipt.billingCycle}
                          </span>
                          <small>
                            {dateLabel(receipt.paymentDate)} ?{' '}
                            {receipt.paymentMethod.replaceAll('_', ' ')}
                          </small>
                        </div>
                        <div className="parent-fees-receipt-action">
                          <strong>{money(receipt.amountPaid)}</strong>
                          <button
                            type="button"
                            onClick={() =>
                              printParentReceipt(
                                receipt,
                                selectedStudent.displayName,
                              )
                            }
                          >
                            <Printer size={14} aria-hidden="true" />
                            <span>Print / save</span>
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
              <p className="parent-fees-note">
                <CalendarClock size={15} aria-hidden="true" /> For fee
                corrections, payment confirmation or payment options, please
                contact the college accounts office.
              </p>
            </section>
          )}

          {selectedStudent && activeSection === 'attendance' && (
            <section className="parent-attendance-page">
              <div className="parent-attendance-toolbar">
                <div>
                  <h2>Attendance overview</h2>
                  <p>
                    Review attendance status and your child&apos;s recorded
                    days.
                  </p>
                </div>
                <label className="parent-attendance-period">
                  <span>Summary period</span>
                  <select
                    aria-label="Attendance period"
                    onChange={(event) =>
                      setAttendancePeriod(
                        event.target.value as 'all' | 'week' | 'month',
                      )
                    }
                    value={attendancePeriod}
                  >
                    <option value="all">All time</option>
                    <option value="month">This month</option>
                    <option value="week">This week</option>
                  </select>
                </label>
              </div>
              <div className="parent-attendance-rate-row">
                <div className="parent-attendance-rate-copy">
                  <span>Attendance rate</span>
                  <strong>
                    {selectedAttendanceSummary.percentage === null
                      ? '�'
                      : selectedAttendanceSummary.percentage + '%'}
                  </strong>
                </div>
                <div
                  className="parent-attendance-rate-track"
                  role="progressbar"
                  aria-label={attendancePeriodLabel + ' attendance rate'}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={selectedAttendanceSummary.percentage ?? 0}
                >
                  <span
                    style={{
                      width: (selectedAttendanceSummary.percentage ?? 0) + '%',
                    }}
                  />
                </div>
                <span className="parent-attendance-recorded">
                  {selectedAttendanceSummary.total} recorded days
                </span>
              </div>
              <div
                className="parent-attendance-stats"
                aria-label={
                  attendancePeriodLabel + ' attendance status summary'
                }
              >
                {attendanceStats.map((item) => {
                  const Icon = item.icon;
                  const count = selectedAttendanceSummary[item.key];
                  const percentage = selectedAttendanceSummary.total
                    ? Math.round(
                        (count / selectedAttendanceSummary.total) * 100,
                      )
                    : 0;
                  return (
                    <article
                      className={'parent-attendance-stat is-' + item.key}
                      key={item.key}
                    >
                      <div className="parent-attendance-stat-heading">
                        <span>{item.label}</span>
                        <Icon size={18} aria-hidden="true" />
                      </div>
                      <strong>{count}</strong>
                      <p>{item.description}</p>
                      <span className="parent-attendance-stat-share">
                        {percentage}% of recorded days
                      </span>
                    </article>
                  );
                })}
              </div>
              <section className="panel parent-content-panel parent-attendance-history">
                <div className="parent-attendance-history-heading">
                  <div>
                    <h2>Attendance history</h2>
                    <p>
                      Latest attendance records, with remarks where provided.
                    </p>
                  </div>
                  <span>{sortedAttendanceRecords.length} records</span>
                </div>
                {sortedAttendanceRecords.length === 0 ? (
                  <EmptyState
                    title="No attendance records yet"
                    description="Attendance updates will appear here after the college records attendance."
                  />
                ) : (
                  <div className="parent-fee-list">
                    {sortedAttendanceRecords.map((record, index) => (
                      <div
                        className="parent-fee-row parent-attendance-history-row"
                        key={
                          (record.date ?? '') +
                          '-' +
                          record.status +
                          '-' +
                          index
                        }
                      >
                        <span className="parent-fee-icon">
                          <CalendarCheck size={18} aria-hidden="true" />
                        </span>
                        <div className="parent-fee-copy">
                          <strong>{dateLabel(record.date)}</strong>
                          {record.remarks && <span>{record.remarks}</span>}
                        </div>
                        <span
                          className={
                            'parent-status parent-status-' +
                            attendanceStatusTone(record.status)
                          }
                        >
                          {attendanceStatusLabel(record.status)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </section>
          )}
          {selectedStudent && activeSection === 'homework' && (
            <section className="parent-diary-page" aria-label="Daily diary">
              <div
                className="parent-diary-summary"
                aria-label="Published work summary"
              >
                <article>
                  <span>Total published</span>
                  <strong>{selectedStudent.homework.length}</strong>
                </article>
                <article>
                  <span>Homework</span>
                  <strong>
                    {
                      selectedStudent.homework.filter(
                        (item) => item.type === 'homework',
                      ).length
                    }
                  </strong>
                </article>
                <article>
                  <span>Class tests</span>
                  <strong>
                    {
                      selectedStudent.homework.filter(
                        (item) => item.type === 'class_test',
                      ).length
                    }
                  </strong>
                </article>
                <article>
                  <span>Formal tests</span>
                  <strong>
                    {
                      selectedStudent.homework.filter(
                        (item) => item.type === 'test',
                      ).length
                    }
                  </strong>
                </article>
              </div>
              <div className="parent-diary-toolbar">
                <label className="parent-diary-search">
                  <span>Search diary</span>
                  <input
                    type="search"
                    value={diaryQuery}
                    onChange={(event) => setDiaryQuery(event.target.value)}
                    placeholder="Search title, subject or instructions"
                  />
                </label>
                <label className="parent-diary-filter">
                  <span>Work type</span>
                  <select
                    value={diaryType}
                    onChange={(event) =>
                      setDiaryType(event.target.value as typeof diaryType)
                    }
                  >
                    <option value="all">All published work</option>
                    <option value="homework">Homework</option>
                    <option value="class_test">Class tests</option>
                    <option value="test">Formal tests</option>
                  </select>
                </label>
              </div>
              {diaryItems.length ? (
                <div className="parent-diary-list">
                  {diaryItems.map((item) => {
                    const typeLabel =
                      item.type === 'class_test'
                        ? 'Class test'
                        : item.type === 'test'
                          ? 'Formal test'
                          : 'Homework';
                    const dueDate = item.dueDate
                      ? dateLabel(item.dueDate)
                      : 'Not specified';
                    return (
                      <article className="parent-diary-entry" key={item.id}>
                        <div className="parent-diary-entry-top">
                          <span className="parent-diary-type">{typeLabel}</span>
                          {item.type === 'test' && item.totalMarks !== null && (
                            <span className="parent-diary-marks">
                              {item.totalMarks} marks
                            </span>
                          )}
                        </div>
                        <h3>{item.title}</h3>
                        <div className="parent-diary-meta">
                          <span>
                            <strong>Subject</strong>
                            {item.subjectName}
                          </span>
                          <span>
                            <strong>Due date</strong>
                            {dueDate}
                          </span>
                          <span>
                            <strong>Shared by</strong>
                            {item.teacherName ?? 'School administration'}
                          </span>
                          {item.assignedDate && (
                            <span>
                              <strong>Published</strong>
                              {dateLabel(item.assignedDate)}
                            </span>
                          )}
                        </div>
                        {item.instructions ? (
                          <div className="parent-diary-instructions">
                            <strong>Teacher instructions</strong>
                            <p>{item.instructions}</p>
                          </div>
                        ) : (
                          <p className="parent-diary-no-instructions">
                            No additional instructions were provided.
                          </p>
                        )}
                      </article>
                    );
                  })}
                </div>
              ) : (
                <EmptyState
                  title={
                    selectedStudent.homework.length
                      ? 'No matching diary entries'
                      : 'No published work yet'
                  }
                  description={
                    selectedStudent.homework.length
                      ? 'Try another search term or select a different work type.'
                      : 'Homework and tests will appear here after a teacher publishes them for your child?s class.'
                  }
                />
              )}
              <p className="parent-diary-note">
                This page is read-only for parents. Please contact the class
                teacher if an assignment needs clarification.
              </p>
            </section>
          )}

          {selectedStudent && activeSection === 'results' && (
            <section
              className="parent-results-page"
              aria-label="Academic results"
            >
              {selectedStudent.resultsAvailable && resultRecords.length > 0 ? (
                <>
                  <div className="parent-results-summary">
                    <article className="parent-results-stat">
                      <span>Published results</span>
                      <strong>{resultRecords.length}</strong>
                    </article>
                    <article className="parent-results-stat">
                      <span>Subjects assessed</span>
                      <strong>{resultSubjects.size}</strong>
                    </article>
                    <article className="parent-results-stat">
                      <span>Average score</span>
                      <strong>
                        {resultAverage === null ? '?' : `${resultAverage}%`}
                      </strong>
                    </article>
                  </div>

                  <div className="parent-results-section-heading">
                    <h2>Exam results</h2>
                  </div>

                  <div className="parent-results-exams">
                    {resultExamGroups.map((exam) => (
                      <article
                        className="parent-results-exam"
                        key={exam.examName}
                      >
                        <header className="parent-results-exam-heading">
                          <div>
                            <h3>{exam.examName}</h3>
                            {exam.latestDate && (
                              <p>{dateLabel(exam.latestDate)}</p>
                            )}
                          </div>
                          <span className="parent-results-exam-count">
                            {exam.results.length}{' '}
                            {exam.results.length === 1 ? 'subject' : 'subjects'}
                          </span>
                        </header>

                        <div className="parent-results-subjects">
                          {exam.results.map((result) => {
                            const score = resultPercentage(result);
                            const progress =
                              score === null
                                ? 0
                                : Math.max(0, Math.min(100, score));
                            const scoreLabel = result.isAbsent
                              ? 'Absent'
                              : result.marksObtained === null
                                ? 'Marks unavailable'
                                : `${result.marksObtained} / ${result.totalMarks} marks`;

                            return (
                              <div
                                className="parent-results-subject"
                                key={result.id}
                              >
                                <div className="parent-results-subject-main">
                                  <span className="parent-results-subject-icon">
                                    <GraduationCap
                                      size={17}
                                      aria-hidden="true"
                                    />
                                  </span>
                                  <div className="parent-results-subject-copy">
                                    <strong>{result.subjectName}</strong>
                                    <span>{dateLabel(result.date)}</span>
                                  </div>
                                  <div
                                    className={`parent-results-score${result.isAbsent ? ' is-absent' : ''}`}
                                  >
                                    <strong>
                                      {result.isAbsent
                                        ? 'Absent'
                                        : (result.grade ??
                                          (score === null
                                            ? 'Published'
                                            : `${Math.round(score)}%`))}
                                    </strong>
                                    <span>{scoreLabel}</span>
                                  </div>
                                </div>
                                {score !== null && (
                                  <div
                                    className="parent-results-progress"
                                    role="progressbar"
                                    aria-label={`${result.subjectName} score`}
                                    aria-valuemin={0}
                                    aria-valuemax={100}
                                    aria-valuenow={Math.round(progress)}
                                  >
                                    <span style={{ width: `${progress}%` }} />
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </article>
                    ))}
                  </div>
                </>
              ) : (
                <div className="parent-results-empty">
                  <div className="parent-results-empty-icon">
                    <GraduationCap size={23} aria-hidden="true" />
                  </div>
                  <EmptyState
                    title="No published results"
                    description="Results will appear here when published."
                  />
                </div>
              )}
            </section>
          )}
          {selectedStudent && activeSection === 'messages' && (
            <section className="parent-content-panel parent-messages-workspace">
              {mode === 'parent_guardian' ? (
                <ParentTeacherInbox
                  organizationId={organizationId}
                  currentUserId={user?.id ?? ''}
                  userRole={mode}
                  studentFilterId={selectedStudent.id}
                />
              ) : (
                <div className="panel">
                  <EmptyState
                    title="Student messaging is not available yet"
                    description="You can view your fees and attendance here. Private messaging is currently limited to verified guardians and their assigned teachers."
                  />
                </div>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}

export function ParentPortalPage() {
  return <StudentFamilyPortalPage mode="parent_guardian" />;
}

export function StudentPortalPage() {
  return <StudentFamilyPortalPage mode="student" />;
}

export type { StudentPortalRecord };
