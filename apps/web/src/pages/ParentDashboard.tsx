import {
  Bell,
  BookOpenText,
  CalendarCheck,
  ChevronRight,
  GraduationCap,
  WalletCards,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { listSchoolEvents } from '../events-holidays/events-holidays-api.js';
import { useParentAnnouncements } from '../communications/communications-api.js';
import type { StudentPortalRecord } from './portal-api.js';

function money(value: number) {
  return new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    maximumFractionDigits: 0,
  }).format(value);
}

function dateKey(date: Date) {
  return (
    date.getFullYear() +
    '-' +
    String(date.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(date.getDate()).padStart(2, '0')
  );
}

function formatDate(value: string | null) {
  if (!value) return 'Date not available';
  const parsed = new Date(value.slice(0, 10) + 'T00:00:00');
  return Number.isNaN(parsed.getTime())
    ? 'Date not available'
    : new Intl.DateTimeFormat('en-PK', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }).format(parsed);
}

function ParentDashboard({
  student,
  organizationId,
}: {
  student: StudentPortalRecord;
  organizationId: string;
}) {
  const root = '/parent/organizations/' + encodeURIComponent(organizationId);
  const announcementsQuery = useParentAnnouncements(
    organizationId,
    Boolean(organizationId),
  );
  const recentAnnouncements = [...(announcementsQuery.data?.items ?? [])]
    .sort((a, b) => (b.publishDate ?? '').localeCompare(a.publishDate ?? ''))
    .slice(0, 2);

  const today = new Date();
  const todayKey = dateKey(today);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const monthStartKey = dateKey(monthStart);
  const monthEndKey = dateKey(monthEnd);
  const schoolEventsQuery = useQuery({
    queryKey: ['school-events', organizationId],
    queryFn: () => listSchoolEvents(organizationId),
    enabled: Boolean(organizationId),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  const holidays = (schoolEventsQuery.data?.items ?? []).filter(
    (event) => event.type === 'holiday' && event.noClasses,
  );
  const attendanceByDate = new Map(
    student.attendance.records
      .filter(
        (record) =>
          record.date &&
          record.date.slice(0, 10) >= monthStartKey &&
          record.date.slice(0, 10) <= todayKey,
      )
      .map((record) => [record.date!.slice(0, 10), record]),
  );
  const calendarDays = Array.from(
    { length: monthEnd.getDate() },
    (_, index) => {
      const date = new Date(today.getFullYear(), today.getMonth(), index + 1);
      const key = dateKey(date);
      const record = attendanceByDate.get(key);
      const holiday = holidays.find(
        (event) => event.startDate <= key && event.endDate >= key,
      );
      const status = record?.status?.toLowerCase() ?? 'neutral';
      return {
        key,
        day: date.getDate(),
        status: ['present', 'absent', 'late', 'leave'].includes(status)
          ? status
          : 'neutral',
        label: new Intl.DateTimeFormat('en-PK', {
          day: 'numeric',
          month: 'short',
        }).format(date),
        remarks: record?.remarks ?? '',
        holidayTitle: holiday?.title ?? '',
      };
    },
  );
  const firstWeekday = (monthStart.getDay() + 6) % 7;
  const monthAttendance = calendarDays.reduce(
    (summary, day) => {
      if (day.status in summary) {
        summary[day.status as keyof typeof summary] += 1;
      }
      return summary;
    },
    { present: 0, absent: 0, late: 0, leave: 0 },
  );
  const recordedDays =
    monthAttendance.present +
    monthAttendance.absent +
    monthAttendance.late +
    monthAttendance.leave;
  const attendanceRate = recordedDays
    ? Math.round(
        ((monthAttendance.present + monthAttendance.late) / recordedDays) * 100,
      )
    : null;

  const subjectProgress = Array.from(
    student.results.reduce((subjects, result) => {
      const current = subjects.get(result.subjectName) ?? [];
      current.push(result);
      subjects.set(result.subjectName, current);
      return subjects;
    }, new Map<string, typeof student.results>()),
  )
    .map(([subject, results]) => {
      const latest = [...results].sort((a, b) =>
        (b.date ?? '').localeCompare(a.date ?? ''),
      )[0];
      const percentage =
        latest.percentage ??
        (latest.marksObtained !== null && latest.totalMarks > 0
          ? Math.round((latest.marksObtained / latest.totalMarks) * 100)
          : null);
      return { subject, latest, percentage };
    })
    .filter((item) => item.percentage !== null)
    .sort((a, b) => (b.latest.date ?? '').localeCompare(a.latest.date ?? ''))
    .slice(0, 5);

  const gradedResults = student.results.filter(
    (result) => result.percentage !== null,
  );
  const overallAverage = gradedResults.length
    ? Math.round(
        gradedResults.reduce(
          (total, result) => total + (result.percentage ?? 0),
          0,
        ) / gradedResults.length,
      )
    : null;
  const recentFees = [...student.fees.invoices]
    .sort((a, b) => (b.dueDate ?? '').localeCompare(a.dueDate ?? ''))
    .slice(0, 3);
  const recentResults = [...student.results]
    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
    .slice(0, 3);
  return (
    <div className="parent-dashboard">
      <section
        className="parent-dashboard-metrics"
        aria-label="Student summary"
      >
        <article className="parent-dashboard-metric">
          <span className="parent-dashboard-metric-icon">
            <CalendarCheck size={17} />
          </span>
          <span className="parent-dashboard-metric-label">ATTENDANCE RATE</span>
          <strong>
            {student.attendance.percentage === null
              ? '—'
              : student.attendance.percentage + '%'}
          </strong>
          <small>
            {student.attendance.totalMarked} recorded attendance days
          </small>
        </article>
        <article className="parent-dashboard-metric">
          <span className="parent-dashboard-metric-icon">
            <WalletCards size={17} />
          </span>
          <span className="parent-dashboard-metric-label">
            FEES OUTSTANDING
          </span>
          <strong>{money(student.fees.totalOutstanding)}</strong>
          <small>Current invoice balance</small>
        </article>
        <article className="parent-dashboard-metric">
          <span className="parent-dashboard-metric-icon">
            <GraduationCap size={17} />
          </span>
          <span className="parent-dashboard-metric-label">OVERALL AVERAGE</span>
          <strong>
            {overallAverage === null ? '—' : overallAverage + '%'}
          </strong>
          <small>{gradedResults.length} published subject results</small>
        </article>
        <article className="parent-dashboard-metric">
          <span className="parent-dashboard-metric-icon">
            <BookOpenText size={17} />
          </span>
          <span className="parent-dashboard-metric-label">DAILY DIARY</span>
          <strong>{student.homework.length}</strong>
          <small>Published assignments</small>
        </article>
      </section>

      <section className="parent-dashboard-academic-grid">
        <article className="parent-dashboard-panel parent-dashboard-attendance">
          <div className="parent-dashboard-panel-heading">
            <div>
              <h2>Attendance Calendar</h2>
              <p>
                {new Intl.DateTimeFormat('en-PK', {
                  month: 'long',
                  year: 'numeric',
                }).format(monthStart)}{' '}
                | {formatDate(monthStartKey)} - {formatDate(monthEndKey)}
              </p>
            </div>
            <Link to={root + '/attendance'}>
              Full history <ChevronRight size={14} />
            </Link>
          </div>
          <div className="parent-calendar-weekdays" aria-hidden="true">
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, index) => (
              <span key={day + index}>{day}</span>
            ))}
          </div>
          <div
            className="parent-calendar-grid"
            aria-label="Attendance calendar for the current month"
          >
            {Array.from({ length: firstWeekday }, (_, index) => (
              <span className="parent-calendar-empty" key={'empty-' + index} />
            ))}
            {calendarDays.map((day) => (
              <span
                aria-label={
                  day.label +
                  (day.status === 'neutral' ? '' : ': ' + day.status) +
                  (day.holidayTitle ? ', Holiday: ' + day.holidayTitle : '') +
                  (day.remarks ? ', ' + day.remarks : '')
                }
                className={
                  'parent-calendar-day is-' +
                  day.status +
                  (day.holidayTitle ? ' has-holiday' : '')
                }
                key={day.key}
                title={
                  day.label +
                  (day.status === 'neutral' ? '' : ' - ' + day.status) +
                  (day.holidayTitle ? ' - Holiday: ' + day.holidayTitle : '')
                }
              >
                {day.day}
              </span>
            ))}
          </div>
          <div className="parent-calendar-legend">
            <span>
              <i className="is-present" /> Present
            </span>
            <span>
              <i className="is-absent" /> Absent
            </span>
            <span>
              <i className="is-late" /> Late
            </span>
            <span>
              <i className="is-leave" /> Leave
            </span>
          </div>
          <div className="parent-attendance-summary">
            <span>
              <strong>{monthAttendance.present}</strong> Present
            </span>
            <span>
              <strong>{monthAttendance.absent}</strong> Absent
            </span>
            <span>
              <strong>{monthAttendance.late}</strong> Late
            </span>
            <span>
              <strong>{monthAttendance.leave}</strong> Leave
            </span>
            <span>
              <strong>
                {attendanceRate === null ? '—' : attendanceRate + '%'}
              </strong>{' '}
              Rate
            </span>
          </div>
        </article>

        <article className="parent-dashboard-panel parent-dashboard-progress">
          <div className="parent-dashboard-panel-heading">
            <div>
              <h2>Progress by Subject</h2>
              <p>Latest published result for each subject</p>
            </div>
            <Link to={root + '/results'}>
              All results <ChevronRight size={14} />
            </Link>
          </div>
          {subjectProgress.length === 0 ? (
            <p className="parent-dashboard-empty">
              Subject progress will appear when the college publishes results.
            </p>
          ) : (
            <div className="parent-subject-list">
              {subjectProgress.map((item) => (
                <div className="parent-subject-row" key={item.subject}>
                  <div className="parent-subject-heading">
                    <strong>{item.subject}</strong>
                    <span>
                      {item.percentage}%
                      {item.latest.grade ? ' · ' + item.latest.grade : ''}
                    </span>
                  </div>
                  <div
                    aria-label={item.subject + ': ' + item.percentage + '%'}
                    className="parent-subject-track"
                    role="img"
                  >
                    <span
                      style={{
                        width:
                          Math.max(0, Math.min(100, item.percentage ?? 0)) +
                          '%',
                      }}
                    />
                  </div>
                  <small>{item.latest.examName}</small>
                </div>
              ))}
            </div>
          )}
        </article>
      </section>

      <section className="parent-dashboard-lower-grid">
        <article className="parent-dashboard-panel">
          <div className="parent-dashboard-panel-heading">
            <div>
              <h2>Fees History</h2>
              <p>Recent invoices and payment status</p>
            </div>
            <Link to={root + '/fees'}>
              View all <ChevronRight size={14} />
            </Link>
          </div>
          {recentFees.length === 0 ? (
            <p className="parent-dashboard-empty">
              No fee invoices are available for this student.
            </p>
          ) : (
            <div className="parent-dashboard-record-list">
              {recentFees.map((fee) => (
                <div className="parent-dashboard-record" key={fee.id}>
                  <span className="parent-dashboard-record-icon">
                    <WalletCards size={16} />
                  </span>
                  <div>
                    <strong>{fee.billingCycle}</strong>
                    <small>
                      {fee.invoiceNumber} · Due {formatDate(fee.dueDate)}
                    </small>
                    <small>
                      Total {money(fee.totalAmount)} · Paid{' '}
                      {money(fee.paidAmount)}
                    </small>
                  </div>
                  <span className={'parent-dashboard-status is-' + fee.status}>
                    {fee.status.replaceAll('_', ' ')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="parent-dashboard-panel">
          <div className="parent-dashboard-panel-heading">
            <div>
              <h2>Recent Results</h2>
              <p>Latest published academic results</p>
            </div>
            <Link to={root + '/results'}>
              View all <ChevronRight size={14} />
            </Link>
          </div>
          {recentResults.length === 0 ? (
            <p className="parent-dashboard-empty">
              No published results are available yet.
            </p>
          ) : (
            <div className="parent-dashboard-record-list">
              {recentResults.map((result) => (
                <div className="parent-dashboard-record" key={result.id}>
                  <span className="parent-dashboard-record-icon">
                    <GraduationCap size={16} />
                  </span>
                  <div>
                    <strong>{result.subjectName}</strong>
                    <small>
                      {result.examName} · {formatDate(result.date)}
                    </small>
                    <small>
                      {result.isAbsent
                        ? 'Absent'
                        : result.marksObtained === null
                          ? 'Marks not available'
                          : result.marksObtained +
                            ' / ' +
                            result.totalMarks +
                            ' marks'}
                    </small>
                  </div>
                  <span className="parent-dashboard-result-grade">
                    {result.grade ??
                      (result.percentage === null
                        ? '—'
                        : result.percentage + '%')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="parent-dashboard-panel parent-dashboard-announcements">
          <div className="parent-dashboard-panel-heading">
            <div>
              <h2>School Announcements</h2>
              <p>Latest updates from the school</p>
            </div>
          </div>
          {announcementsQuery.isPending ? (
            <p className="parent-dashboard-empty">Loading announcements...</p>
          ) : announcementsQuery.isError ? (
            <p className="parent-dashboard-empty">
              Announcements are temporarily unavailable.
            </p>
          ) : recentAnnouncements.length === 0 ? (
            <p className="parent-dashboard-empty">
              There are no new announcements.
            </p>
          ) : (
            <div className="parent-dashboard-announcement-list">
              {recentAnnouncements.map((announcement) => (
                <article
                  className="parent-dashboard-announcement"
                  key={announcement.id}
                >
                  <div className="parent-dashboard-announcement-icon">
                    <Bell size={15} />
                  </div>
                  <div className="parent-dashboard-announcement-copy">
                    <div className="parent-dashboard-announcement-title">
                      <strong>{announcement.title}</strong>
                      {announcement.isPinned && <span>Pinned</span>}
                    </div>
                    <p>{announcement.content}</p>
                    <small>{formatDate(announcement.publishDate)}</small>
                  </div>
                </article>
              ))}
            </div>
          )}
        </article>
      </section>
    </div>
  );
}

export { ParentDashboard };
