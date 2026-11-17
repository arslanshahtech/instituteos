import { useMemo, useState } from 'react';
import { paginateItems } from './attendance-utils.js';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '../components/ui/Button.js';
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '../components/ui/States.js';
import { getAcademicYearSummary } from '../academics/academics-api.js';
import {
  getStudentRoster,
  listStudentAttendance,
  saveStudentAttendance,
  type StudentAttendanceStatus,
} from './attendance-api.js';

type RegisterFilter = 'All' | 'Not marked' | 'Partly marked' | 'Marked';

interface ClassChoice {
  id: string;
  name: string;
}

interface SectionChoice {
  id: string;
  name: string;
  classId: string;
}

interface Props {
  organizationId: string;
  campusId: string;
  academicYearId: string;
  date: string;
  onDateChange: (date: string) => void;
  classes: ClassChoice[];
  sections: SectionChoice[];
  canWrite: boolean;
  onOpenRegister: (classId: string, sectionId: string) => void;
}

const statuses: StudentAttendanceStatus[] = [
  'present',
  'absent',
  'late',
  'leave',
];

function localDateLabel(value: string) {
  if (!value) return 'Selected date';
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${value}T12:00:00`));
}

function periodRange(date: string, period: 'week' | 'month') {
  const anchor = new Date(`${date}T00:00:00`);
  const key = (value: Date) =>
    `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  if (period === 'week') {
    const from = new Date(anchor);
    from.setDate(anchor.getDate() - ((anchor.getDay() + 6) % 7));
    const to = new Date(from);
    to.setDate(from.getDate() + 6);
    return { dateFrom: key(from), dateTo: key(to) };
  }
  return {
    dateFrom: key(new Date(anchor.getFullYear(), anchor.getMonth(), 1)),
    dateTo: key(new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0)),
  };
}

export function AttendanceClassesOverview({
  organizationId,
  campusId,
  academicYearId,
  date,
  onDateChange,
  classes,
  sections,
  canWrite,
  onOpenRegister,
}: Props) {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<RegisterFilter>('All');
  const [period, setPeriod] = useState<'week' | 'month'>('month');
  const range = useMemo(() => periodRange(date, period), [date, period]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 6;
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkMessage, setBulkMessage] = useState('');

  const summaryQuery = useQuery({
    queryKey: ['attendance', organizationId, 'class-summary', academicYearId],
    queryFn: () => getAcademicYearSummary(organizationId),
    enabled: Boolean(organizationId && academicYearId),
  });
  const dailyQuery = useQuery({
    queryKey: [
      'attendance',
      organizationId,
      'class-overview',
      campusId,
      academicYearId,
      date,
    ],
    queryFn: () =>
      listStudentAttendance(organizationId, {
        dateFrom: date,
        dateTo: date,
        campusId,
        academicYearId,
      }),
    enabled: Boolean(organizationId && campusId && date),
  });

  const historyQuery = useQuery({
    queryKey: [
      'attendance',
      organizationId,
      'class-period-summary',
      campusId,
      academicYearId,
      period,
      range.dateFrom,
      range.dateTo,
    ],
    queryFn: () =>
      listStudentAttendance(organizationId, {
        dateFrom: range.dateFrom,
        dateTo: range.dateTo,
        campusId,
        academicYearId,
      }),
    enabled: Boolean(organizationId && campusId && academicYearId),
  });

  const sectionTotals = summaryQuery.data?.summary.bySection ?? [];
  const dailyRecords = dailyQuery.data?.items ?? [];
  const historyRecords = historyQuery.data?.items ?? [];
  const cards = useMemo(
    () =>
      sections.map((section) => {
        const classInfo = classes.find((item) => item.id === section.classId);
        const total =
          sectionTotals.find(
            (item) =>
              item.sectionId === section.id &&
              item.academicYearId === academicYearId,
          )?.students ?? 0;
        const records = dailyRecords.filter(
          (item) => item.sectionId === section.id,
        );
        const counts = Object.fromEntries(
          statuses.map((status) => [
            status,
            records.filter((item) => item.status === status).length,
          ]),
        ) as Record<StudentAttendanceStatus, number>;
        const marked = records.length;
        const periodRecords = historyRecords.filter(
          (item) => item.sectionId === section.id,
        );
        const periodCounts = Object.fromEntries(
          statuses.map((status) => [
            status,
            periodRecords.filter((item) => item.status === status).length,
          ]),
        ) as Record<StudentAttendanceStatus, number>;
        const periodRecorded = periodRecords.length;
        const attended = periodCounts.present + periodCounts.late;
        const attendanceRate = periodRecorded
          ? Math.round((attended / periodRecorded) * 100)
          : null;
        const status: RegisterFilter =
          total > 0 && marked >= total
            ? 'Marked'
            : marked > 0
              ? 'Partly marked'
              : 'Not marked';
        return {
          classId: section.classId,
          className: classInfo?.name ?? 'Class',
          sectionId: section.id,
          sectionName: section.name,
          total,
          marked,
          counts,
          periodCounts,
          periodRecorded,
          attendanceRate,
          status,
          percent: total
            ? Math.min(100, Math.round((marked / total) * 100))
            : 0,
        };
      }),
    [
      sections,
      classes,
      sectionTotals,
      dailyRecords,
      historyRecords,
      academicYearId,
    ],
  );

  const filteredCards = cards.filter((card) => {
    const matchesFilter = filter === 'All' || card.status === filter;
    const needle = search.trim().toLocaleLowerCase();
    const matchesSearch =
      !needle ||
      `${card.className} ${card.sectionName}`
        .toLocaleLowerCase()
        .includes(needle);
    return matchesFilter && matchesSearch;
  });

  const {
    items: visibleCards,
    pageCount,
    currentPage,
    start: pageStart,
    end: pageEnd,
  } = paginateItems(filteredCards, page, pageSize);

  const totals = cards.reduce(
    (result, card) => ({
      students: result.students + card.total,
      marked: result.marked + card.marked,
      present: result.present + card.counts.present,
      absent: result.absent + card.counts.absent,
      late: result.late + card.counts.late,
      leave: result.leave + card.counts.leave,
    }),
    { students: 0, marked: 0, present: 0, absent: 0, late: 0, leave: 0 },
  );
  const periodTotals = cards.reduce(
    (result, card) => ({
      recorded: result.recorded + card.periodRecorded,
      present: result.present + card.periodCounts.present,
      absent: result.absent + card.periodCounts.absent,
      late: result.late + card.periodCounts.late,
      leave: result.leave + card.periodCounts.leave,
    }),
    { recorded: 0, present: 0, absent: 0, late: 0, leave: 0 },
  );

  const fullyMarked = cards.filter((card) => card.status === 'Marked').length;
  const totalClasses = new Set(cards.map((card) => card.classId)).size;
  const filterCounts: Record<RegisterFilter, number> = {
    All: cards.length,
    'Not marked': cards.filter((card) => card.status === 'Not marked').length,
    'Partly marked': cards.filter((card) => card.status === 'Partly marked')
      .length,
    Marked: fullyMarked,
  };

  async function markAllPresent() {
    if (!canWrite || bulkSaving || cards.length === 0) return;
    if (
      !window.confirm(
        `Mark all students present across ${cards.length} class registers for ${localDateLabel(date)}?`,
      )
    )
      return;
    setBulkSaving(true);
    setBulkMessage('');
    let saved = 0;
    try {
      for (const card of cards) {
        const roster = await getStudentRoster(organizationId, {
          campusId,
          academicYearId,
          classId: card.classId,
          sectionId: card.sectionId,
          date,
        });
        if (!roster.items.length) continue;
        await saveStudentAttendance(organizationId, {
          campusId,
          academicYearId,
          classId: card.classId,
          sectionId: card.sectionId,
          date,
          records: roster.items.map((student) => ({
            studentId: student.id,
            status: 'present',
          })),
        });
        saved += roster.items.length;
      }
      setBulkMessage(
        `Saved attendance for ${saved} students across the class registers.`,
      );
      await queryClient.invalidateQueries({
        queryKey: ['attendance', organizationId],
      });
    } catch (error) {
      setBulkMessage(
        `Bulk marking stopped after ${saved} students. ${error instanceof Error ? error.message : 'Some registers may need review.'}`,
      );
      await queryClient.invalidateQueries({
        queryKey: ['attendance', organizationId],
      });
    } finally {
      setBulkSaving(false);
    }
  }

  if (
    summaryQuery.isPending ||
    dailyQuery.isPending ||
    historyQuery.isPending
  ) {
    return <LoadingState message="Loading class attendance overview..." />;
  }
  if (summaryQuery.isError || dailyQuery.isError || historyQuery.isError) {
    return (
      <ErrorState
        title="Class attendance overview unavailable"
        description={
          (summaryQuery.error ??
            dailyQuery.error ??
            historyQuery.error) instanceof Error
            ? (
                summaryQuery.error ??
                dailyQuery.error ??
                (historyQuery.error as Error)
              ).message
            : 'Attendance data could not be loaded.'
        }
        onRetry={() => {
          void summaryQuery.refetch();
          void dailyQuery.refetch();
          void historyQuery.refetch();
        }}
      />
    );
  }
  if (!cards.length) {
    return (
      <EmptyState
        title="No class sections available"
        description="Add classes and sections in Academics to start taking attendance."
      />
    );
  }

  return (
    <div
      className="attendance-classes-overview"
      data-testid="attendance-classes-overview"
    >
      <section
        className="attendance-classes-summary"
        aria-label="Attendance summary"
      >
        <div className="attendance-classes-summary-heading">
          <div>
            <h2>Attendance summary</h2>
            <p>
              {period === 'week' ? 'This week' : 'This month'} ·{' '}
              {periodTotals.recorded} recorded entries
            </p>
          </div>
          <span>
            {totalClasses} {totalClasses === 1 ? 'class' : 'classes'} ·{' '}
            {cards.length} sections · {totals.students} students
          </span>
        </div>
        <div className="attendance-classes-stats">
          {(
            [
              {
                status: 'present',
                label: 'Present',
                count: periodTotals.present,
              },
              { status: 'absent', label: 'Absent', count: periodTotals.absent },
              { status: 'late', label: 'Late', count: periodTotals.late },
              { status: 'leave', label: 'Leave', count: periodTotals.leave },
            ] as const
          ).map((item) => (
            <article
              className={`attendance-classes-stat attendance-classes-stat--${item.status}`}
              key={item.status}
            >
              <span className="attendance-classes-stat-label">
                <span aria-hidden="true" />
                {item.label}
              </span>
              <strong>{item.count}</strong>
              <p>
                {periodTotals.recorded
                  ? `${Math.round((item.count / periodTotals.recorded) * 100)}% of recorded entries`
                  : 'No records in this period'}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section
        className="attendance-classes-filter-panel"
        aria-label="Class filters"
      >
        <div className="attendance-classes-filter-controls">
          <label className="attendance-classes-date">
            <span>Date</span>
            <input
              aria-label="Attendance date"
              onChange={(event) => onDateChange(event.target.value)}
              type="date"
              value={date}
            />
          </label>
          <label className="attendance-classes-period">
            <span>Summary period</span>
            <select
              aria-label="Attendance summary period"
              value={period}
              onChange={(event) =>
                setPeriod(event.target.value as 'week' | 'month')
              }
            >
              <option value="week">This week</option>
              <option value="month">This month</option>
            </select>
          </label>
          <div className="attendance-classes-search-row">
            <label className="attendance-classes-search">
              <span>Search classes</span>
              <input
                aria-label="Search classes and sections"
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Search by class or section"
                type="search"
                value={search}
              />
            </label>
            {search && (
              <button
                aria-label="Clear class search"
                className="attendance-classes-search-clear"
                onClick={() => {
                  setSearch('');
                  setPage(1);
                }}
                type="button"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </section>

      {bulkMessage && (
        <p className="attendance-classes-feedback" role="status">
          {bulkMessage}
        </p>
      )}

      <section
        className="attendance-classes-list-panel"
        aria-label="Class registers"
      >
        <label className="attendance-classes-status-filter">
          <span>Attendance status</span>
          <select
            aria-label="Attendance status"
            onChange={(event) => {
              setFilter(event.target.value as RegisterFilter);
              setPage(1);
            }}
            value={filter}
          >
            <option value="All">All Students ({filterCounts.All})</option>
            <option value="Not marked">
              Not marked ({filterCounts['Not marked']})
            </option>
            <option value="Partly marked">
              Partly marked ({filterCounts['Partly marked']})
            </option>
            <option value="Marked">Marked ({filterCounts.Marked})</option>
          </select>
        </label>
        <div className="attendance-classes-list-toolbar">
          <div className="attendance-classes-results" aria-live="polite">
            Showing {pageStart + (filteredCards.length > 0 ? 1 : 0)} to{' '}
            {pageEnd} of {filteredCards.length} class sections
          </div>
          {canWrite && (
            <Button disabled={bulkSaving} onClick={() => void markAllPresent()}>
              {bulkSaving ? 'Saving...' : 'Mark All Present'}
            </Button>
          )}
        </div>
        <div className="attendance-classes-grid">
          {visibleCards.map((card, index) => (
            <article
              className="attendance-class-card"
              key={card.sectionId}
              style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}
            >
              <div className="attendance-class-card-heading">
                <div className="attendance-class-avatar">{`${card.className.charAt(0)}${card.sectionName.charAt(0)}`}</div>
                <div className="attendance-class-title">
                  <h3>
                    {card.className} <span>· Sec {card.sectionName}</span>
                  </h3>
                  <p>
                    {card.total} students enrolled · {card.periodRecorded}{' '}
                    records
                  </p>
                </div>
                <span
                  className={`attendance-class-status attendance-class-status-${card.status.toLowerCase().replaceAll(' ', '-')}`}
                >
                  {card.status}
                </span>
              </div>
              <div className="attendance-class-progress">
                <div>
                  <strong>Attendance rate</strong>
                  <span>
                    {card.attendanceRate === null
                      ? '—'
                      : `${card.attendanceRate}%`}
                  </span>
                </div>
                <div className="attendance-class-progress-track">
                  <span style={{ width: `${card.attendanceRate ?? 0}%` }} />
                </div>
              </div>
              <div className="attendance-class-counts">
                <span className="is-present">
                  P: {card.periodCounts.present}
                </span>
                <span className="is-absent">A: {card.periodCounts.absent}</span>
                <span className="is-late">L: {card.periodCounts.late}</span>
                <span className="is-leave" title="LV = Leave">
                  LV: {card.periodCounts.leave}
                </span>
              </div>
              <Button
                className="attendance-class-open-button"
                onClick={() => onOpenRegister(card.classId, card.sectionId)}
              >
                {card.status === 'Marked'
                  ? 'View Attendance'
                  : 'Mark Attendance'}
              </Button>
            </article>
          ))}
          {filteredCards.length === 0 && (
            <div className="attendance-classes-empty">
              <strong>No class sections match these filters.</strong>
              <button
                onClick={() => {
                  setFilter('All');
                  setSearch('');
                  setPage(1);
                }}
                type="button"
              >
                Show all {cards.length} classes
              </button>
            </div>
          )}
        </div>
        <nav
          className="attendance-classes-pagination"
          aria-label="Class register pages"
        >
          <span>
            Page {currentPage} of {pageCount}
          </span>
          <div>
            <button
              aria-label="Previous page"
              disabled={currentPage <= 1}
              onClick={() => setPage(currentPage - 1)}
              type="button"
            >
              <span aria-hidden="true">‹</span>
            </button>
            <button
              aria-label="Next page"
              disabled={currentPage >= pageCount}
              onClick={() => setPage(currentPage + 1)}
              type="button"
            >
              <span aria-hidden="true">›</span>
            </button>
          </div>
        </nav>
      </section>
    </div>
  );
}
