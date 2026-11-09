import { useMemo, useState } from 'react';
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

  const sectionTotals = summaryQuery.data?.summary.bySection ?? [];
  const dailyRecords = dailyQuery.data?.items ?? [];
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
          status,
          percent: total
            ? Math.min(100, Math.round((marked / total) * 100))
            : 0,
        };
      }),
    [sections, classes, sectionTotals, dailyRecords, academicYearId],
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

  const pageCount = Math.max(1, Math.ceil(filteredCards.length / pageSize));
  const visibleCards = filteredCards.slice(
    (page - 1) * pageSize,
    page * pageSize,
  );

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
  const fullyMarked = cards.filter((card) => card.status === 'Marked').length;
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

  if (summaryQuery.isPending || dailyQuery.isPending) {
    return <LoadingState message="Loading class attendance overview..." />;
  }
  if (summaryQuery.isError || dailyQuery.isError) {
    return (
      <ErrorState
        title="Class attendance overview unavailable"
        description={
          (summaryQuery.error ?? dailyQuery.error) instanceof Error
            ? (summaryQuery.error ?? (dailyQuery.error as Error)).message
            : 'Attendance data could not be loaded.'
        }
        onRetry={() => {
          void summaryQuery.refetch();
          void dailyQuery.refetch();
        }}
      />
    );
  }
  if (!cards.length) {
    return (
      <EmptyState
        title="No class sections available"
        description="Create classes and sections in Academics before taking attendance."
      />
    );
  }

  return (
    <div
      className="attendance-classes-overview"
      data-testid="attendance-classes-overview"
    >
      <div className="attendance-classes-stats">
        <article className="attendance-classes-stat">
          <span>Registers Marked</span>
          <strong>
            {fullyMarked} <small>/ {cards.length}</small>
          </strong>
          <p>Classes fully marked</p>
        </article>
        <article className="attendance-classes-stat">
          <span>Students Marked</span>
          <strong>
            {totals.marked} <small>/ {totals.students}</small>
          </strong>
          <p>Attendance records saved</p>
        </article>
        <article className="attendance-classes-stat">
          <span>Present</span>
          <strong>{totals.present}</strong>
          <p>
            {totals.late} late · {totals.leave} on leave
          </p>
        </article>
        <article className="attendance-classes-stat">
          <span>Absent</span>
          <strong>{totals.absent}</strong>
          <p>Needs follow-up</p>
        </article>
      </div>

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
          <div className="attendance-classes-search-row">
            <label className="attendance-classes-search">
              <span className="sr-only">Search classes and sections</span>
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
        <div
          className="attendance-classes-chips"
          aria-label="Register status filter"
        >
          {(
            ['All', 'Not marked', 'Partly marked', 'Marked'] as RegisterFilter[]
          ).map((item) => (
            <button
              aria-pressed={filter === item}
              className={filter === item ? 'is-active' : ''}
              key={item}
              onClick={() => {
                setFilter(item);
                setPage(1);
              }}
              type="button"
            >
              {item === 'All' ? 'All Students' : item}{' '}
              <span>{filterCounts[item]}</span>
            </button>
          ))}
        </div>
        <div className="attendance-classes-list-toolbar">
          <div className="attendance-classes-results" aria-live="polite">
            Showing {filteredCards.length === 0 ? 0 : (page - 1) * pageSize + 1}{' '}
            to {Math.min(page * pageSize, filteredCards.length)} of{' '}
            {filteredCards.length} class sections
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
                  <p>{card.total} students enrolled</p>
                </div>
                <span
                  className={`attendance-class-status attendance-class-status-${card.status.toLowerCase().replaceAll(' ', '-')}`}
                >
                  {card.status}
                </span>
              </div>
              <div className="attendance-class-progress">
                <div>
                  <strong>
                    {card.marked} of {card.total} marked
                  </strong>
                  <span>{card.percent}%</span>
                </div>
                <div className="attendance-class-progress-track">
                  <span style={{ width: `${card.percent}%` }} />
                </div>
              </div>
              <div className="attendance-class-counts">
                <span className="is-present">P: {card.counts.present}</span>
                <span className="is-absent">A: {card.counts.absent}</span>
                <span className="is-late">L: {card.counts.late}</span>
                <span className="is-leave" title="LV = Leave">
                  LV: {card.counts.leave}
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
              <strong>No classes match this filter.</strong>
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
            Page {page} of {pageCount}
          </span>
          <div>
            <button
              aria-label="Previous page"
              disabled={page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              type="button"
            >
              <span aria-hidden="true">‹</span>
            </button>
            <button
              aria-label="Next page"
              disabled={page >= pageCount}
              onClick={() =>
                setPage((current) => Math.min(pageCount, current + 1))
              }
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
