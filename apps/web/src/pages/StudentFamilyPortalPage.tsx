import {
  ArrowDownToLine,
  ArrowUpRight,
  BookOpenText,
  CalendarCheck,
  CheckCircle2,
  Clock3,
  CircleAlert,
  GraduationCap,
  MessageCircle,
  ReceiptText,
  WalletCards,
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

type PortalSection = 'home' | 'fees' | 'attendance' | 'results' | 'messages';
type PortalMode = 'parent_guardian' | 'student';

const sections: Array<{
  key: Exclude<PortalSection, 'home'>;
  label: string;
  icon: typeof WalletCards;
}> = [
  { key: 'fees', label: 'Fees & receipts', icon: WalletCards },
  { key: 'attendance', label: 'Attendance', icon: CalendarCheck },
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

function StudentFamilyPortalPage({ mode }: { mode: PortalMode }) {
  const { organizationId = '', section = 'home' } = useParams();
  const { user } = useAuth();
  const activeSection: PortalSection = [
    'fees',
    'attendance',
    'results',
    'messages',
  ].includes(section)
    ? (section as PortalSection)
    : 'home';
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const access = useQuery({
    queryKey: ['organization-context', organizationId],
    queryFn: () => getOrganizationAccessContext(organizationId),
    enabled: Boolean(organizationId),
    retry: false,
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
  const attendanceWeekDates = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
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
            (dayRecords.filter((record) => record.status === 'present').length /
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
        : 'Your child’s college life'
      : sections.find((item) => item.key === activeSection)?.label;

  return (
    <div
      className={`page-stack parent-portal${activeSection === 'home' ? ' reference-dashboard-preview live-role-dashboard' : ''}`}
    >
      <section
        className={`parent-portal-heading${activeSection === 'home' ? ' reference-dashboard-heading' : ''}`}
      >
        <div>
          <p className="eyebrow">
            {mode === 'student' ? 'Student workspace' : 'Family workspace'}
          </p>
          <h1>{heading}</h1>
          <p className="page-description">
            {mode === 'student'
              ? 'Your current college information, fees, and attendance.'
              : 'College information connected to your verified guardian account.'}
          </p>
        </div>
        {students.length > 1 && (
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
          {selectedStudent && (
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

          <nav className="parent-portal-tabs" aria-label="Student information">
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

          {selectedStudent && activeSection === 'home' && (
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
                <Link className="reference-quick-action" to={`${root}/results`}>
                  <GraduationCap size={13} aria-hidden="true" /> Results
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
                  <span className="reference-metric-label">PRESENT DAYS</span>
                  <strong>{selectedStudent.attendance.present}</strong>
                  <small>Saved attendance records</small>
                </article>
                <article className="reference-metric-card">
                  <div className="reference-metric-icon">
                    <CircleAlert size={15} aria-hidden="true" />
                  </div>
                  <span className="reference-metric-label">ABSENT DAYS</span>
                  <strong>{selectedStudent.attendance.absent}</strong>
                  <small>Saved attendance records</small>
                </article>
                <article className="reference-metric-card">
                  <div className="reference-metric-icon">
                    <Clock3 size={15} aria-hidden="true" />
                  </div>
                  <span className="reference-metric-label">LEAVE DAYS</span>
                  <strong>{selectedStudent.attendance.leave}</strong>
                  <small>Approved or recorded leave</small>
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
                      {selectedStudent.fees.invoices.slice(0, 4).map((fee) => (
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
                      No saved attendance records were found for the last seven
                      days.
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
              <div className="live-parent-legacy">
                <section className="parent-overview-grid">
                  <article className="parent-balance-card">
                    <div className="parent-metric-heading">
                      <span>Outstanding fees</span>
                      <span className="parent-metric-icon">
                        <WalletCards size={18} aria-hidden="true" />
                      </span>
                    </div>
                    <strong>
                      {money(selectedStudent.fees.totalOutstanding)}
                    </strong>
                    <p>Based on available fee invoices</p>
                    <Link to={`${root}/fees`} className="parent-inline-link">
                      View fee details{' '}
                      <ArrowUpRight size={15} aria-hidden="true" />
                    </Link>
                  </article>
                  <article className="parent-summary-card panel">
                    <div className="parent-metric-heading">
                      <span>Attendance this month</span>
                      <span className="parent-metric-icon">
                        <CalendarCheck size={18} aria-hidden="true" />
                      </span>
                    </div>
                    <strong>
                      {selectedStudent.attendance.percentage === null
                        ? '—'
                        : `${selectedStudent.attendance.percentage}%`}
                    </strong>
                    <p>
                      {selectedStudent.attendance.totalMarked} marked days this
                      month
                    </p>
                    <Link
                      to={`${root}/attendance`}
                      className="parent-inline-link"
                    >
                      View attendance{' '}
                      <ArrowUpRight size={15} aria-hidden="true" />
                    </Link>
                  </article>
                  <article className="parent-summary-card panel">
                    <div className="parent-metric-heading">
                      <span>Published results</span>
                      <span className="parent-metric-icon">
                        <GraduationCap size={18} aria-hidden="true" />
                      </span>
                    </div>
                    <strong>
                      {selectedStudent.resultsAvailable
                        ? selectedStudent.results.length
                        : '—'}
                    </strong>
                    <p>Results appear after the college publishes them</p>
                    <Link to={`${root}/results`} className="parent-inline-link">
                      View results <ArrowUpRight size={15} aria-hidden="true" />
                    </Link>
                  </article>
                </section>

                <section className="panel parent-content-panel">
                  <div className="parent-section-heading">
                    <div>
                      <h2>Recent fee invoices</h2>
                      <p>Live invoices from the college records</p>
                    </div>
                    <Link to={`${root}/fees`} className="parent-inline-link">
                      All fees <ArrowUpRight size={15} aria-hidden="true" />
                    </Link>
                  </div>
                  {selectedStudent.fees.invoices.length === 0 ? (
                    <p className="parent-explainer">
                      No fee invoices were found for this student.
                    </p>
                  ) : (
                    <div className="parent-fee-list">
                      {selectedStudent.fees.invoices.slice(0, 3).map((fee) => (
                        <div className="parent-fee-row" key={fee.id}>
                          <span className="parent-fee-icon">
                            <ReceiptText size={18} aria-hidden="true" />
                          </span>
                          <div className="parent-fee-copy">
                            <strong>{fee.billingCycle}</strong>
                            <span>
                              Invoice {fee.invoiceNumber} · Due{' '}
                              {dateLabel(fee.dueDate)}
                            </span>
                          </div>
                          <div className="parent-fee-amount">
                            <strong>{money(fee.outstandingAmount)}</strong>
                            <span className="parent-status">{fee.status}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
                <section className="parent-shortcuts-grid">
                  <Link
                    to={`${root}/attendance`}
                    className="parent-shortcut-card panel"
                  >
                    <CalendarCheck size={20} aria-hidden="true" />
                    <strong>Attendance</strong>
                    <span>Review recorded attendance days.</span>
                    <ArrowUpRight size={15} aria-hidden="true" />
                  </Link>
                  <Link
                    to={`${root}/results`}
                    className="parent-shortcut-card panel"
                  >
                    <GraduationCap size={20} aria-hidden="true" />
                    <strong>Results</strong>
                    <span>Review results when published.</span>
                    <ArrowUpRight size={15} aria-hidden="true" />
                  </Link>
                  <Link
                    to={`${root}/messages`}
                    className="parent-shortcut-card panel"
                  >
                    <MessageCircle size={20} aria-hidden="true" />
                    <strong>College messages</strong>
                    <span>Open the messages section.</span>
                    <ArrowUpRight size={15} aria-hidden="true" />
                  </Link>
                </section>
              </div>
            </>
          )}

          {selectedStudent && activeSection === 'fees' && (
            <section className="panel parent-content-panel">
              <div className="parent-section-heading">
                <div>
                  <h2>Fee details</h2>
                  <p>Live invoice records from the college</p>
                </div>
              </div>
              <div className="parent-fee-total">
                <span>Outstanding balance</span>
                <strong>{money(selectedStudent.fees.totalOutstanding)}</strong>
                <small>Calculated from available invoices and payments</small>
              </div>
              {selectedStudent.fees.invoices.length === 0 ? (
                <EmptyState
                  title="No fee invoices"
                  description="No fee invoices are available for this student."
                />
              ) : (
                <div className="parent-fee-list">
                  {selectedStudent.fees.invoices.map((fee) => (
                    <div className="parent-fee-row" key={fee.id}>
                      <span className="parent-fee-icon">
                        <ReceiptText size={18} aria-hidden="true" />
                      </span>
                      <div className="parent-fee-copy">
                        <strong>{fee.billingCycle}</strong>
                        <span>
                          Invoice {fee.invoiceNumber} · Due{' '}
                          {dateLabel(fee.dueDate)}
                        </span>
                        <span>
                          Total {money(fee.totalAmount)} · Paid{' '}
                          {money(fee.paidAmount)}
                        </span>
                      </div>
                      <div className="parent-fee-amount">
                        <strong>{money(fee.outstandingAmount)}</strong>
                        <span className="parent-status">{fee.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <p className="parent-explainer">
                <ArrowDownToLine size={15} aria-hidden="true" /> Receipt
                download is not exposed by the parent portal yet.
              </p>
            </section>
          )}

          {selectedStudent && activeSection === 'attendance' && (
            <section className="parent-overview-grid">
              <article className="parent-summary-card panel">
                <div className="parent-metric-heading">
                  <span>Attendance this month</span>
                  <CalendarCheck size={18} aria-hidden="true" />
                </div>
                <strong>
                  {selectedStudent.attendance.percentage === null
                    ? '—'
                    : `${selectedStudent.attendance.percentage}%`}
                </strong>
                <p>Based on recorded attendance</p>
              </article>
              <article className="parent-summary-card panel">
                <div className="parent-metric-heading">
                  <span>Present</span>
                  <CheckCircle2 size={18} aria-hidden="true" />
                </div>
                <strong>{selectedStudent.attendance.present}</strong>
                <p>Marked present</p>
              </article>
              <article className="parent-summary-card panel">
                <div className="parent-metric-heading">
                  <span>Absent / Leave</span>
                  <Clock3 size={18} aria-hidden="true" />
                </div>
                <strong>
                  {selectedStudent.attendance.absent} /{' '}
                  {selectedStudent.attendance.leave}
                </strong>
                <p>Recorded this month</p>
              </article>
              <section className="panel parent-content-panel parent-full-width">
                <h2>Attendance history</h2>
                {selectedStudent.attendance.records.length === 0 ? (
                  <p>
                    No attendance records are available for the current month.
                  </p>
                ) : (
                  <div className="parent-fee-list">
                    {selectedStudent.attendance.records.map((record, index) => (
                      <div
                        className="parent-fee-row"
                        key={`${record.date}-${record.status}-${index}`}
                      >
                        <span className="parent-fee-icon">
                          <CalendarCheck size={18} aria-hidden="true" />
                        </span>
                        <div className="parent-fee-copy">
                          <strong>{dateLabel(record.date)}</strong>
                          <span>{record.remarks || 'No remarks'}</span>
                        </div>
                        <span className="parent-status">{record.status}</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </section>
          )}

          {selectedStudent && activeSection === 'results' && (
            <section className="panel parent-content-panel">
              <div className="parent-section-heading">
                <div>
                  <h2>Published results</h2>
                  <p>
                    Only results explicitly published by the college should
                    appear here.
                  </p>
                </div>
              </div>
              {selectedStudent.resultsAvailable &&
              selectedStudent.results.length > 0 ? (
                <div className="parent-fee-list">
                  {selectedStudent.results.map((result) => (
                    <div className="parent-fee-row" key={result.id}>
                      <span className="parent-fee-icon">
                        <GraduationCap size={18} aria-hidden="true" />
                      </span>
                      <div className="parent-fee-copy">
                        <strong>
                          {result.examName} · {result.subjectName}
                        </strong>
                        <span>
                          {dateLabel(result.date)} ·{' '}
                          {result.isAbsent
                            ? 'Absent'
                            : `${result.marksObtained ?? '—'} / ${result.totalMarks} marks`}
                        </span>
                      </div>
                      <span className="parent-status">
                        {result.isAbsent
                          ? 'Absent'
                          : (result.grade ??
                            (result.percentage === null
                              ? 'Published'
                              : `${result.percentage}%`))}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="No published results available"
                  description="Your school will show your results here after it has reviewed and published them."
                />
              )}
            </section>
          )}

          {selectedStudent && activeSection === 'messages' && (
            <section className="parent-content-panel">
              <div className="parent-section-heading">
                <div>
                  <h2>College messages</h2>
                  <p>
                    {mode === 'parent_guardian'
                      ? 'Private messages with teachers assigned to your linked children.'
                      : 'Student-to-teacher messaging is not enabled for this account yet.'}
                  </p>
                </div>
              </div>
              {mode === 'parent_guardian' ? (
                <ParentTeacherInbox
                  organizationId={organizationId}
                  currentUserId={user?.id ?? ''}
                  userRole={mode}
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
