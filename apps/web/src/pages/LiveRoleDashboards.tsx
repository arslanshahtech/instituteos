import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import {
  CalendarCheck,
  CalendarDays,
  ClipboardList,
  FileText,
  BookOpen,
  ArrowUpRight,
  ReceiptText,
  Users,
  WalletCards,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  getStudentRoster,
  getTeacherProfile,
  getTeacherSelfAttendance,
  listStudentAttendance,
  listTeacherAttendanceAssignments,
  saveTeacherSelfAttendance,
} from '../attendance/attendance-api.js';
import type {
  StaffAttendanceStatus,
  TeacherAttendanceAssignment,
} from '../attendance/attendance-api.js';
import { listDailyCollections, listInvoices } from '../finance/finance-api.js';
import type { StudentInvoice } from '../finance/finance-api.js';
import { listTeacherTimetable } from '../staff/teacher-timetable-api.js';
import { listHomeworkTests } from '../homework/homework-api.js';
import { useTeacherAnnouncements } from '../communications/communications-api.js';
import {
  listExams,
  listExamSchedules,
} from '../examinations/examinations-api.js';

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
  const queryClient = useQueryClient();
  const [selfAttendanceStatus, setSelfAttendanceStatus] =
    useState<StaffAttendanceStatus>('present');
  const [selfAttendanceRemarks, setSelfAttendanceRemarks] = useState('');
  const days = useMemo(lastSevenDays, []);
  const dateFrom = days[0]!;
  const teacherProfileQuery = useQuery({
    queryKey: ['teacher-profile', organizationId],
    queryFn: () => getTeacherProfile(organizationId),
    retry: false,
  });
  const teacherDisplayName =
    teacherProfileQuery.data?.profile?.displayName || userName;
  const teacherAnnouncementsQuery = useTeacherAnnouncements(
    organizationId,
    Boolean(organizationId),
  );
  const teacherNotices = (teacherAnnouncementsQuery.data?.items ?? [])
    .slice()
    .sort(
      (a, b) =>
        Number(b.isPinned) - Number(a.isPinned) ||
        b.publishDate.localeCompare(a.publishDate),
    )
    .slice(0, 4);
  const teacherStaffId = teacherProfileQuery.data?.profile?.staffId;
  const assignmentsQuery = useQuery({
    queryKey: ['attendance', organizationId, 'teacher-assignments'],
    queryFn: () => listTeacherAttendanceAssignments(organizationId),
    retry: false,
  });
  const assignments = assignmentsQuery.data?.items ?? [];
  const timetableQuery = useQuery({
    queryKey: ['teacher-timetable', organizationId, teacherStaffId],
    queryFn: () => listTeacherTimetable(organizationId, teacherStaffId!),
    enabled: Boolean(teacherStaffId),
    retry: false,
  });
  const diaryQuery = useQuery({
    queryKey: ['homework-tests', organizationId, 'teacher-dashboard'],
    queryFn: () => listHomeworkTests(organizationId),
    enabled: assignmentsQuery.isSuccess,
    retry: false,
  });
  const examsQuery = useQuery({
    queryKey: ['examinations', organizationId, 'teacher-dashboard'],
    queryFn: () => listExams(organizationId),
    enabled: assignmentsQuery.isSuccess,
    retry: false,
  });
  const exams = examsQuery.data?.items ?? [];
  const examSchedulesQuery = useQuery({
    queryKey: [
      'teacher-dashboard-exam-schedules',
      organizationId,
      exams.map((exam) => exam.id).join('|'),
    ],
    queryFn: () =>
      Promise.all(
        exams.map(async (exam) => {
          const response = await listExamSchedules(organizationId, exam.id);
          return response.items.map((schedule) => ({
            ...schedule,
            examName: exam.name,
            academicYearId: exam.academicYearId,
          }));
        }),
      ).then((items) => items.flat()),
    enabled: examsQuery.isSuccess && exams.length > 0,
    retry: false,
  });
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
      assignments
        .map((item) => `${item.sectionId}:${item.academicYearId}`)
        .join('|'),
    ],
    queryFn: () =>
      teacherAttendanceQuery(organizationId, assignments, dateFrom, today),
    enabled: assignmentsQuery.isSuccess && assignments.length > 0,
    retry: false,
  });
  const selfAttendanceQuery = useQuery({
    queryKey: ['attendance', organizationId, 'teacher-self', today],
    queryFn: () =>
      getTeacherSelfAttendance(organizationId, {
        dateFrom,
        dateTo: today,
      }),
    retry: false,
  });
  const selfAttendanceMutation = useMutation({
    mutationFn: () =>
      saveTeacherSelfAttendance(organizationId, {
        date: today,
        status: selfAttendanceStatus,
        ...(selfAttendanceRemarks.trim()
          ? { remarks: selfAttendanceRemarks.trim() }
          : {}),
      }),
    onSuccess: () => {
      setSelfAttendanceRemarks('');
      void queryClient.invalidateQueries({
        queryKey: ['attendance', organizationId, 'teacher-self'],
      });
    },
  });
  const roster = rosterQuery.data ?? [];
  const records = attendanceQuery.data ?? [];
  const markedToday = roster.filter((item) => Boolean(item.status)).length;
  const presentToday = roster.filter(
    (item) => item.status === 'present',
  ).length;
  const students = new Set(roster.map((item) => item.id)).size;
  const selfAttendanceItems = selfAttendanceQuery.data?.items ?? [];
  const todaySelfAttendance = selfAttendanceItems.find(
    (item) => item.date === today,
  );
  const recentSelfAttendance = selfAttendanceItems
    .filter((item) => item.date !== today)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);
  const hasMarkedOwnAttendance = Boolean(todaySelfAttendance);
  const weekdayOrder = [
    'sunday',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
  ];
  const todayIndex = new Date().getDay();
  const todayName = weekdayOrder[todayIndex]!;
  const currentTime = new Date().toTimeString().slice(0, 5);
  const timetableItems = timetableQuery.data?.items ?? [];
  const todayPeriods = timetableItems
    .filter((item) => item.dayOfWeek === todayName)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
  const nextDayOffset = todayPeriods.length
    ? 0
    : Array.from({ length: 7 }, (_, index) => index + 1).find((offset) =>
        timetableItems.some(
          (item) => item.dayOfWeek === weekdayOrder[(todayIndex + offset) % 7],
        ),
      );
  const displayDayOffset = nextDayOffset ?? 0;
  const displayDayName = weekdayOrder[(todayIndex + displayDayOffset) % 7]!;
  const displayPeriods = (
    todayPeriods.length
      ? todayPeriods
      : timetableItems.filter((item) => item.dayOfWeek === displayDayName)
  ).sort((a, b) => a.startTime.localeCompare(b.startTime));
  const displayDate = new Date();
  displayDate.setDate(displayDate.getDate() + displayDayOffset);
  const currentPeriod = todayPeriods.find(
    (item) => item.startTime <= currentTime && item.endTime > currentTime,
  );
  const nextPeriod = todayPeriods.length
    ? todayPeriods.find((item) => item.startTime > currentTime)
    : displayPeriods[0];
  const upcomingDiary = (diaryQuery.data?.items ?? [])
    .filter(
      (item) =>
        item.status === 'published' &&
        item.dueDate >= today &&
        assignments.some(
          (assignment) =>
            assignment.classId === item.classId &&
            assignment.sectionId === item.sectionId &&
            assignment.academicYearId === item.academicYearId,
        ),
    )
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 3);
  const assignedClassGroups = Array.from(
    new Map(
      assignments.map((item) => {
        const key = item.classId + ':' + item.sectionId;
        const subjects = assignments
          .filter(
            (entry) =>
              entry.classId === item.classId &&
              entry.sectionId === item.sectionId,
          )
          .map((entry) => entry.subjectName)
          .filter((name): name is string => Boolean(name));
        return [
          key,
          { ...item, assignedSubjects: [...new Set(subjects)] },
        ] as const;
      }),
    ).values(),
  );
  const upcomingExams = (examSchedulesQuery.data ?? [])
    .filter(
      (item) =>
        item.date >= today &&
        assignments.some(
          (assignment) =>
            assignment.classId === item.classId &&
            assignment.sectionId === item.sectionId &&
            assignment.academicYearId === item.academicYearId,
        ),
    )
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime),
    )
    .slice(0, 3);
  const classPerformance = assignedClassGroups.map((group) => {
    const classRecords = records.filter(
      (record) =>
        record.classId === group.classId &&
        record.sectionId === group.sectionId,
    );
    const present = classRecords.filter(
      (record) => record.status === 'present' || record.status === 'late',
    ).length;
    const absent = classRecords.filter(
      (record) => record.status === 'absent',
    ).length;
    const eligible = present + absent;
    return {
      ...group,
      attendanceRate: eligible ? Math.round((present / eligible) * 100) : null,
      studentCount: new Set(classRecords.map((record) => record.studentId))
        .size,
      recordCount: classRecords.length,
    };
  });
  const performancePresent = records.filter(
    (record) => record.status === 'present' || record.status === 'late',
  ).length;
  const performanceAbsent = records.filter(
    (record) => record.status === 'absent',
  ).length;
  const performanceDenominator = performancePresent + performanceAbsent;
  const overallClassPerformance = performanceDenominator
    ? Math.round((performancePresent / performanceDenominator) * 100)
    : null;

  return (
    <main className="page-stack role-dashboard reference-dashboard-preview live-role-dashboard teacher-live-dashboard-v1">
      <section className="page-heading reference-dashboard-heading">
        <div className="teacher-dashboard-welcome">
          <p className="reference-dashboard-greeting">
            Welcome back, {teacherDisplayName || 'Teacher'}
          </p>
          <p className="teacher-dashboard-intro">
            Here’s your teaching overview for today.
          </p>
          {teacherProfileQuery.isSuccess &&
            !teacherProfileQuery.data.profile && (
              <p className="reference-scope-note" role="status">
                Your teacher account is not linked to an active staff profile
                yet. Ask the administrator to check your staff record.
              </p>
            )}
        </div>
      </section>

      <section
        className="teacher-dashboard-summary"
        aria-label="Teaching summary"
      >
        {assignmentsQuery.isError ? (
          <section className="reference-dashboard-panel">
            <h2>Teaching records unavailable</h2>
            <p className="page-description">
              We could not load your assigned sections. Please open My classes
              &amp; students and try again.
            </p>
            <p className="teacher-panel-description">
              If your teaching assignment has recently changed, ask your
              administrator to review your staff profile and class allocation.
            </p>
          </section>
        ) : (
          <section
            aria-label="Teaching summary metrics"
            className="reference-metrics-grid teacher-dashboard-metrics"
          >
            <article className="reference-metric-card teacher-summary-card">
              <div className="reference-metric-icon">
                <BookOpen size={17} aria-hidden="true" />
              </div>
              <span className="reference-metric-label">My classes</span>
              <strong>
                {assignmentsQuery.isPending
                  ? '—'
                  : String(
                      new Set(assignments.map((item) => item.classId)).size,
                    )}
              </strong>
              <small>
                {assignmentsQuery.isPending
                  ? 'Loading class and section totals…'
                  : assignments.length +
                    ' assigned ' +
                    (assignments.length === 1 ? 'section' : 'sections') +
                    ' across your classes'}
              </small>
            </article>
            <MetricCard
              label="Students"
              value={
                assignmentsQuery.isSuccess && assignments.length === 0
                  ? '0'
                  : rosterQuery.isSuccess
                    ? String(students)
                    : '—'
              }
              note={
                assignmentsQuery.isSuccess && assignments.length === 0
                  ? 'No active sections assigned'
                  : rosterQuery.isPending
                    ? 'Loading assigned students…'
                    : rosterQuery.isError
                      ? 'Student roster unavailable'
                      : 'Across your assigned sections'
              }
              icon={Users}
            />
            <MetricCard
              label="Attendance marked"
              value={
                assignmentsQuery.isSuccess && assignments.length === 0
                  ? '0'
                  : rosterQuery.isSuccess
                    ? String(markedToday)
                    : '—'
              }
              note={
                rosterQuery.isPending
                  ? 'Loading student attendance…'
                  : rosterQuery.isError
                    ? 'Attendance data unavailable'
                    : 'Student records saved today'
              }
              icon={CalendarCheck}
            />
            <MetricCard
              label="Present today"
              value={
                assignmentsQuery.isSuccess && assignments.length === 0
                  ? '0'
                  : rosterQuery.isSuccess
                    ? String(presentToday)
                    : '—'
              }
              note={
                rosterQuery.isPending
                  ? 'Loading student attendance…'
                  : rosterQuery.isError
                    ? 'Attendance data unavailable'
                    : 'Students marked present'
              }
              icon={ClipboardList}
            />
          </section>
        )}
      </section>

      {!assignmentsQuery.isError && (
        <>
          <section className="reference-dashboard-bottom teacher-dashboard-workspace">
            <section className="reference-dashboard-panel teacher-dashboard-timetable">
              <div className="reference-panel-heading">
                <div>
                  <h2>My timetable</h2>
                  <p className="teacher-panel-description">
                    {todayPeriods.length
                      ? 'Your periods for today, with the current class highlighted.'
                      : 'Your next scheduled teaching day.'}
                  </p>
                </div>
                <span className="teacher-panel-date">
                  {new Intl.DateTimeFormat('en-PK', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                  }).format(displayDate)}
                </span>
              </div>
              {teacherProfileQuery.isPending ? (
                <p className="reference-scope-note">
                  Loading your teacher profile…
                </p>
              ) : teacherProfileQuery.isError ? (
                <p className="reference-scope-note" role="status">
                  Your teacher profile could not be loaded right now. Please try
                  again later.
                </p>
              ) : !teacherStaffId ? (
                <p className="reference-scope-note" role="status">
                  Your teacher profile is not linked yet, so a personal
                  timetable cannot be loaded.
                </p>
              ) : timetableQuery.isPending ? (
                <p className="reference-scope-note">Loading your timetable…</p>
              ) : timetableQuery.isError ? (
                <p className="reference-scope-note" role="status">
                  Your timetable is unavailable right now. Please try again
                  later.
                </p>
              ) : displayPeriods.length === 0 ? (
                <div className="teacher-dashboard-empty">
                  <CalendarDays size={22} />
                  <strong>No timetable available</strong>
                  <span>
                    Your assigned periods will appear here when the institute
                    publishes the timetable.
                  </span>
                </div>
              ) : (
                <div className="teacher-today-periods">
                  {displayPeriods.slice(0, 5).map((period) => {
                    const isCurrent = currentPeriod?.id === period.id;
                    const isNext = nextPeriod?.id === period.id;
                    return (
                      <article
                        className={
                          'teacher-period-row' +
                          (isCurrent ? ' is-current' : '')
                        }
                        key={period.id}
                      >
                        <div className="teacher-period-time">
                          <strong>{period.startTime}</strong>
                          <span>{period.endTime}</span>
                        </div>
                        <div className="teacher-period-marker">
                          <span />
                        </div>
                        <div className="teacher-period-copy">
                          <strong>
                            {period.subjectName || 'Scheduled period'}
                          </strong>
                          <span>
                            {period.sectionName || 'Assigned section'}
                            {period.room ? ' · Room ' + period.room : ''}
                          </span>
                        </div>
                        {isCurrent ? (
                          <span className="teacher-period-state">Now</span>
                        ) : isNext ? (
                          <span className="teacher-period-state is-next">
                            Next
                          </span>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
            <section className="reference-dashboard-panel teacher-dashboard-classes teacher-class-performance">
              <div className="reference-panel-heading">
                <div>
                  <h2>My class performance</h2>
                  <p className="teacher-panel-description">
                    Attendance across your assigned classes · last 7 days.
                  </p>
                </div>
                <Link
                  className="reference-view-all"
                  to={
                    '/teacher/organizations/' +
                    encodeURIComponent(organizationId) +
                    '/students'
                  }
                >
                  My classes <ArrowUpRight size={13} />
                </Link>
              </div>
              {assignmentsQuery.isPending ? (
                <p className="reference-scope-note">
                  Loading class performance…
                </p>
              ) : assignments.length === 0 ? (
                <p className="reference-scope-note">
                  No active class assignments are linked to this account yet.
                </p>
              ) : (
                <div className="teacher-performance-content">
                  <div className="teacher-performance-summary">
                    <div
                      className="teacher-performance-ring"
                      style={{
                        background:
                          overallClassPerformance === null
                            ? 'var(--color-border)'
                            : 'conic-gradient(var(--color-ink) 0 ' +
                              overallClassPerformance +
                              '%, var(--color-border) ' +
                              overallClassPerformance +
                              '% 100%)',
                      }}
                    >
                      <div>
                        <strong>
                          {overallClassPerformance === null
                            ? '—'
                            : overallClassPerformance + '%'}
                        </strong>
                        <span>Class average</span>
                      </div>
                    </div>
                    <div className="teacher-performance-summary-copy">
                      <strong>
                        {classPerformance.length} assigned{' '}
                        {classPerformance.length === 1 ? 'section' : 'sections'}
                      </strong>
                      <span>
                        {attendanceQuery.isPending
                          ? 'Attendance data is loading.'
                          : performanceDenominator
                            ? 'Based on saved present, late and absent records.'
                            : 'Attendance performance will appear after records are saved.'}
                      </span>
                    </div>
                  </div>
                  <div className="teacher-performance-list">
                    {classPerformance.map((item) => (
                      <Link
                        className="teacher-performance-row"
                        key={item.id}
                        to={
                          '/teacher/organizations/' +
                          encodeURIComponent(organizationId) +
                          '/students?assignmentId=' +
                          encodeURIComponent(item.id)
                        }
                      >
                        <span className="teacher-performance-copy">
                          <strong>
                            {item.className} · {item.sectionName}
                          </strong>
                          <small>
                            {item.assignedSubjects.join(', ') ||
                              'Subject not specified'}{' '}
                            ·{' '}
                            {item.studentCount
                              ? item.studentCount +
                                ' students in attendance records'
                              : 'No attendance records yet'}
                          </small>
                        </span>
                        <span
                          className="teacher-performance-meter"
                          aria-hidden="true"
                        >
                          <i
                            style={{ width: (item.attendanceRate ?? 0) + '%' }}
                          />
                        </span>
                        <strong className="teacher-performance-value">
                          {item.attendanceRate === null
                            ? '—'
                            : item.attendanceRate + '%'}
                        </strong>
                      </Link>
                    ))}
                  </div>
                  {attendanceQuery.isError && (
                    <p className="reference-scope-note" role="status">
                      Class attendance data is unavailable right now.
                    </p>
                  )}
                </div>
              )}
            </section>
          </section>

          <section className="reference-dashboard-bottom teacher-dashboard-workspace teacher-dashboard-upcoming">
            <section
              className="reference-dashboard-panel teacher-self-attendance-panel"
              aria-labelledby="teacher-self-attendance-title"
            >
              <div className="reference-panel-heading">
                <div>
                  <h2 id="teacher-self-attendance-title">
                    My staff attendance
                  </h2>
                  <p className="teacher-panel-description">
                    Your attendance record and daily check-in.
                  </p>
                </div>
                <span className="teacher-self-attendance-today">
                  {new Intl.DateTimeFormat('en-PK', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  }).format(new Date(today + 'T00:00:00'))}
                </span>
              </div>
              {selfAttendanceQuery.isPending ? (
                <p className="reference-scope-note">
                  Loading your attendance policy and history…
                </p>
              ) : selfAttendanceQuery.isError ? (
                <p className="reference-scope-note" role="status">
                  Your own attendance is currently unavailable. Your institute
                  may have disabled attendance history, or your staff profile
                  needs to be linked by an administrator.
                </p>
              ) : (
                <>
                  <div className="teacher-self-attendance-overview">
                    <span className="teacher-self-attendance-overview-label">
                      Today
                    </span>
                    <strong className="teacher-self-attendance-today-status">
                      {todaySelfAttendance?.status.replace('-', ' ') ||
                        'Not marked'}
                    </strong>
                  </div>
                  <div className="teacher-self-attendance-history">
                    <div className="teacher-self-attendance-section-heading">
                      <strong>Recent</strong>
                      <span>Last 7 days</span>
                    </div>
                    {recentSelfAttendance.length ? (
                      <div className="teacher-self-attendance-records">
                        {recentSelfAttendance.map((item) => (
                          <article
                            className="teacher-self-attendance-record"
                            key={item.id}
                          >
                            <span className="teacher-self-attendance-date">
                              <strong>
                                {new Intl.DateTimeFormat('en-PK', {
                                  day: 'numeric',
                                  month: 'short',
                                }).format(new Date(item.date + 'T00:00:00'))}
                              </strong>
                              <small>{formatDay(item.date)}</small>
                            </span>
                            <strong className="teacher-self-attendance-status">
                              {item.status.replace('-', ' ')}
                            </strong>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <p className="teacher-self-attendance-empty">
                        No earlier records this week.
                      </p>
                    )}
                  </div>
                  <div className="teacher-self-attendance-action">
                    {selfAttendanceQuery.data.policy.selfMarkingEnabled &&
                    !hasMarkedOwnAttendance ? (
                      <form
                        className="settings-fields teacher-self-attendance-fields"
                        onSubmit={(event) => {
                          event.preventDefault();
                          selfAttendanceMutation.mutate();
                        }}
                      >
                        <label className="settings-field">
                          <span>Today's attendance</span>
                          <select
                            value={selfAttendanceStatus}
                            onChange={(event) =>
                              setSelfAttendanceStatus(
                                event.target.value as StaffAttendanceStatus,
                              )
                            }
                          >
                            {selfAttendanceQuery.data.policy.allowedStatuses.map(
                              (status) => (
                                <option key={status} value={status}>
                                  {status.replace('-', ' ')}
                                </option>
                              ),
                            )}
                          </select>
                        </label>
                        <label className="settings-field">
                          <span>Remarks (optional)</span>
                          <input
                            maxLength={500}
                            value={selfAttendanceRemarks}
                            onChange={(event) =>
                              setSelfAttendanceRemarks(event.target.value)
                            }
                            placeholder="Add a short note"
                          />
                        </label>
                        <button
                          className="button button-primary"
                          type="submit"
                          disabled={
                            selfAttendanceMutation.isPending ||
                            !selfAttendanceQuery.data.policy.allowedStatuses
                              .length
                          }
                        >
                          {selfAttendanceMutation.isPending
                            ? 'Saving…'
                            : 'Mark my attendance'}
                        </button>
                        {selfAttendanceMutation.error && (
                          <p className="settings-error" role="alert">
                            {selfAttendanceMutation.error.message}
                          </p>
                        )}
                      </form>
                    ) : selfAttendanceQuery.data.policy.selfMarkingEnabled ? (
                      <p className="reference-scope-note">
                        Today's attendance has already been recorded. Contact
                        your administrator if it needs correction.
                      </p>
                    ) : (
                      <p className="reference-scope-note">
                        Self-marking is disabled by your institute. You can view
                        your history here.
                      </p>
                    )}
                  </div>
                </>
              )}
            </section>

            <section className="reference-dashboard-panel">
              <div className="reference-panel-heading">
                <div>
                  <h2>Pending assignments</h2>
                  <p className="teacher-panel-description">
                    Published homework and class tests for your classes.
                  </p>
                </div>
                <Link
                  className="reference-view-all"
                  to={
                    '/teacher/organizations/' +
                    encodeURIComponent(organizationId) +
                    '/homework-tests'
                  }
                >
                  View All
                </Link>
              </div>
              {diaryQuery.isPending ? (
                <p className="reference-scope-note">Loading assignments…</p>
              ) : diaryQuery.isError ? (
                <p className="reference-scope-note" role="status">
                  Assignments could not be loaded right now.
                </p>
              ) : upcomingDiary.length === 0 ? (
                <div className="teacher-dashboard-empty">
                  <FileText size={21} />
                  <strong>No pending assignments</strong>
                  <span>
                    Published work for your assigned classes will appear here.
                  </span>
                </div>
              ) : (
                <div className="teacher-upcoming-list">
                  {upcomingDiary.map((item) => (
                    <article className="teacher-upcoming-row" key={item.id}>
                      <span className="teacher-upcoming-icon">
                        <FileText size={16} />
                      </span>
                      <span className="teacher-upcoming-copy">
                        <strong>{item.title}</strong>
                        <small>
                          {item.className} · {item.sectionName} ·{' '}
                          {item.subjectName}
                        </small>
                      </span>
                      <span className="teacher-upcoming-date">
                        <small>Due</small>
                        <strong>{item.dueDate}</strong>
                      </span>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </section>

          <section className="reference-dashboard-bottom teacher-dashboard-workspace teacher-dashboard-notices-row">
            <section className="reference-dashboard-panel">
              <div className="reference-panel-heading">
                <div>
                  <h2>Upcoming exams</h2>
                  <p className="teacher-panel-description">
                    Exam schedule for your assigned classes.
                  </p>
                </div>
                <Link
                  className="reference-view-all"
                  to={
                    '/teacher/organizations/' +
                    encodeURIComponent(organizationId) +
                    '/examinations'
                  }
                >
                  View exams <ArrowUpRight size={13} />
                </Link>
              </div>
              {examsQuery.isPending ||
              (exams.length > 0 && examSchedulesQuery.isPending) ? (
                <p className="reference-scope-note">Loading exam schedule…</p>
              ) : examsQuery.isError ||
                (exams.length > 0 && examSchedulesQuery.isError) ? (
                <p className="reference-scope-note" role="status">
                  Upcoming exams could not be loaded right now.
                </p>
              ) : upcomingExams.length === 0 ? (
                <div className="teacher-dashboard-empty">
                  <CalendarDays size={21} />
                  <strong>No upcoming exams</strong>
                  <span>
                    Scheduled exams for your classes will appear here.
                  </span>
                </div>
              ) : (
                <div className="teacher-upcoming-list">
                  {upcomingExams.map((item) => {
                    const assignment = assignments.find(
                      (entry) =>
                        entry.sectionId === item.sectionId &&
                        entry.classId === item.classId,
                    );
                    return (
                      <article className="teacher-upcoming-row" key={item.id}>
                        <span className="teacher-upcoming-icon">
                          <CalendarCheck size={16} />
                        </span>
                        <span className="teacher-upcoming-copy">
                          <strong>{item.examName}</strong>
                          <small>
                            {assignment?.className || 'Class'} ·{' '}
                            {assignment?.sectionName || 'Section'} ·{' '}
                            {item.startTime}
                          </small>
                        </span>
                        <span className="teacher-upcoming-date">
                          <small>Exam date</small>
                          <strong>{item.date}</strong>
                        </span>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
            <section className="reference-dashboard-panel teacher-announcements-panel">
              <div className="reference-panel-heading">
                <div>
                  <h2>Institute notices</h2>
                  <p className="teacher-panel-description">
                    Published updates for staff and the whole institute.
                  </p>
                </div>
                <span className="teacher-notice-count">
                  {teacherAnnouncementsQuery.isSuccess
                    ? teacherNotices.length
                    : '—'}
                </span>
              </div>
              {teacherAnnouncementsQuery.isPending ? (
                <p className="reference-scope-note">
                  Loading institute notices…
                </p>
              ) : teacherAnnouncementsQuery.isError ? (
                <p className="reference-scope-note" role="status">
                  Institute notices are unavailable right now.
                </p>
              ) : teacherNotices.length === 0 ? (
                <p className="reference-scope-note">
                  There are no published staff notices right now.
                </p>
              ) : (
                <div className="teacher-notice-list">
                  {teacherNotices.map((notice) => (
                    <article className="teacher-notice-item" key={notice.id}>
                      <div>
                        <strong>{notice.title}</strong>
                        {notice.isPinned && <span>Pinned</span>}
                      </div>
                      <small>
                        {new Intl.DateTimeFormat('en-PK', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        }).format(new Date(notice.publishDate))}
                      </small>
                      <p>{notice.content}</p>
                    </article>
                  ))}
                </div>
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
