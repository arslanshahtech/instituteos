import { useMemo, useState } from 'react';
import {
  CalendarDays,
  Download,
  Eye,
  Layers3,
  Pencil,
  Plus,
  Search,
  Trash2,
  Users,
  BookOpen,
} from 'lucide-react';
import type {
  AcademicClass,
  AcademicSection,
  AcademicYear,
  AcademicYearSummary,
} from './academics-api.js';
import { Button } from '../components/ui/Button.js';
import { Dialog } from '../components/ui/Dialog.js';
import {
  WorkspaceMetricCard,
  WorkspacePageHeading,
} from '../components/ui/WorkspacePrimitives.js';
import './academic-sessions.css';

function formatDate(value: string) {
  const date = new Date(value + 'T00:00:00');
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function sessionDescription(session: AcademicYear) {
  return (
    'Academic session from ' +
    formatDate(session.startDate) +
    ' to ' +
    formatDate(session.endDate)
  );
}

function downloadSessionsCsv(
  sessions: AcademicYear[],
  stats: AcademicYearSummary,
) {
  const counts = new Map(
    stats.bySession.map((item) => [item.academicYearId, item]),
  );
  const rows = [
    ['Session', 'Description', 'Classes', 'Sections', 'Students'],
    ...sessions.map((session) => {
      const count = counts.get(session.id);
      return [
        session.name,
        sessionDescription(session),
        String(count?.classes ?? 0),
        String(count?.sections ?? 0),
        String(count?.students ?? 0),
      ];
    }),
  ];
  const csv = rows
    .map((row) =>
      row.map((value) => '"' + value.replaceAll('"', '""') + '"').join(','),
    )
    .join('\r\n');
  const url = URL.createObjectURL(
    new Blob([csv], { type: 'text/csv;charset=utf-8' }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = 'sessions.csv';
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function AcademicSessionsReferenceView({
  sessions,
  classes = [],
  sections = [],
  summary,
  canWrite,
  onCreate,
  onEdit,
  onDelete,
}: {
  sessions: AcademicYear[];
  classes?: AcademicClass[];
  sections?: AcademicSection[];
  summary: AcademicYearSummary;
  canWrite: boolean;
  onCreate: () => void;
  onEdit: (session: AcademicYear) => void;
  onDelete: (session: AcademicYear) => void;
}) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [detailsSession, setDetailsSession] = useState<AcademicYear | null>(
    null,
  );
  const activeSession = sessions.find((session) => session.status === 'active');
  const counts = useMemo(
    () => new Map(summary.bySession.map((item) => [item.academicYearId, item])),
    [summary.bySession],
  );
  const filteredSessions = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return sessions;
    return sessions.filter((session) =>
      (session.name + ' ' + sessionDescription(session))
        .toLocaleLowerCase()
        .includes(query),
    );
  }, [search, sessions]);
  const sessionClassGroups = useMemo(() => {
    if (!detailsSession) return [];
    const classMap = new Map(classes.map((item) => [item.id, item]));
    const sectionMap = new Map(sections.map((item) => [item.id, item]));
    const groups = new Map<
      string,
      { name: string; sections: Array<{ name: string; students: number }> }
    >();
    summary.bySection
      .filter((placement) => placement.academicYearId === detailsSession.id)
      .forEach((placement) => {
        const section = sectionMap.get(placement.sectionId);
        const academicClass = section
          ? classMap.get(section.classId)
          : undefined;
        if (!section || !academicClass) return;
        const group = groups.get(academicClass.id) ?? {
          name: academicClass.name,
          sections: [],
        };
        group.sections.push({
          name: section.name,
          students: placement.students,
        });
        groups.set(academicClass.id, group);
      });
    return [...groups.values()];
  }, [classes, detailsSession, sections, summary.bySection]);
  const pageCount = Math.max(1, Math.ceil(filteredSessions.length / pageSize));
  const visibleSessions = filteredSessions.slice(
    (page - 1) * pageSize,
    page * pageSize,
  );
  const metrics = [
    {
      label: 'Sessions',
      value: String(sessions.length),
      detail: activeSession
        ? 'Current: ' + activeSession.name
        : 'No active session',
      icon: CalendarDays,
      className: 'sessions-metric-primary',
    },
    {
      label: 'Classes',
      value: String(summary.totals.classes),
      detail: 'In active enrollments',
      icon: BookOpen,
    },
    {
      label: 'Sections',
      value: String(summary.totals.sections),
      detail: 'In active enrollments',
      icon: Layers3,
    },
    {
      label: 'Students',
      value: String(summary.totals.students),
      detail: 'Currently enrolled',
      icon: Users,
    },
  ];

  return (
    <main className="page-stack academic-sessions-page">
      <WorkspacePageHeading
        eyebrow=""
        title="Academy Session"
        description="Manage your institute's academic sessions."
        aside={
          canWrite ? (
            <Button onClick={onCreate} type="button" variant="primary">
              <Plus size={16} aria-hidden="true" />
              Add Session
            </Button>
          ) : undefined
        }
      />
      <section
        aria-label="Session summary"
        className="academic-sessions-metrics"
      >
        {metrics.map((metric) => (
          <WorkspaceMetricCard key={metric.label} metric={metric} />
        ))}
      </section>
      <section className="academic-sessions-search-panel">
        <label className="academic-sessions-search">
          <Search size={17} aria-hidden="true" />
          <input
            aria-label="Search sessions"
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search sessions..."
            type="search"
            value={search}
          />
        </label>
        <Button
          onClick={() => downloadSessionsCsv(filteredSessions, summary)}
          type="button"
          variant="secondary"
        >
          <Download size={15} aria-hidden="true" />
          Export CSV
        </Button>
      </section>
      <section className="academic-sessions-table-panel">
        <header className="academic-sessions-table-heading">
          <div>
            <h2>All Sessions ({filteredSessions.length})</h2>
          </div>
        </header>
        <div className="table-scroll academic-sessions-desktop-list">
          <table className="data-table academic-sessions-table">
            <thead>
              <tr>
                <th scope="col">Session</th>
                <th scope="col">Description</th>
                <th scope="col" className="align-center">
                  Classes
                </th>
                <th scope="col" className="align-center">
                  Sections
                </th>
                <th scope="col" className="align-center">
                  Students
                </th>
                {canWrite && (
                  <th scope="col" className="align-right">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {visibleSessions.length ? (
                visibleSessions.map((session) => {
                  const count = counts.get(session.id);
                  return (
                    <tr key={session.id}>
                      <td data-label="Session">
                        <strong className="academic-session-name">
                          {session.name}
                        </strong>
                        <small className="academic-session-created">
                          {session.status === 'active'
                            ? 'Current'
                            : activeSession &&
                                session.startDate > activeSession.startDate
                              ? 'Upcoming'
                              : 'Archived'}
                        </small>
                      </td>
                      <td data-label="Description">
                        <span className="academic-session-description">
                          {sessionDescription(session)}
                        </span>
                      </td>
                      <td data-label="Classes" className="align-center">
                        {count?.classes ?? 0}
                      </td>
                      <td data-label="Sections" className="align-center">
                        {count?.sections ?? 0}
                      </td>
                      <td data-label="Students" className="align-center">
                        {count?.students ?? 0}
                      </td>
                      {canWrite && (
                        <td data-label="Actions" className="align-right">
                          <span className="academic-session-actions">
                            <Button
                              aria-label={'Edit ' + session.name}
                              onClick={() => onEdit(session)}
                              type="button"
                              variant="quiet"
                            >
                              <Pencil size={15} aria-hidden="true" />
                            </Button>
                            <Button
                              aria-label={'Delete ' + session.name}
                              className="academic-session-delete-button"
                              onClick={() => onDelete(session)}
                              type="button"
                              variant="quiet"
                            >
                              <Trash2 size={15} aria-hidden="true" />
                            </Button>
                          </span>
                        </td>
                      )}
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    className="academic-sessions-empty"
                    colSpan={canWrite ? 6 : 5}
                  >
                    <strong>
                      {search.trim()
                        ? 'No matching sessions'
                        : 'No sessions yet'}
                    </strong>
                    <p>
                      {search.trim()
                        ? 'Try another session name.'
                        : 'Create your first session to get started.'}
                    </p>
                    {!search.trim() && canWrite && (
                      <Button
                        onClick={onCreate}
                        type="button"
                        variant="secondary"
                      >
                        <Plus size={15} aria-hidden="true" />
                        Add Session
                      </Button>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="academic-sessions-mobile-list">
          {visibleSessions.length ? (
            visibleSessions.map((session) => (
              <article
                className="academic-session-mobile-card"
                key={session.id}
              >
                <div className="academic-session-mobile-card-main">
                  <span className="academic-session-mobile-label">SESSION</span>
                  <strong>{session.name}</strong>
                  <small
                    className={session.status === 'active' ? 'is-current' : ''}
                  >
                    {session.status === 'active'
                      ? 'Current session'
                      : activeSession &&
                          session.startDate > activeSession.startDate
                        ? 'Upcoming'
                        : 'Archived'}
                  </small>
                </div>
                <Button
                  aria-label={'View details for ' + session.name}
                  onClick={() => setDetailsSession(session)}
                  type="button"
                  variant="secondary"
                >
                  <Eye size={15} aria-hidden="true" />
                  View Details
                </Button>
              </article>
            ))
          ) : (
            <div className="academic-sessions-empty">
              <strong>
                {search.trim() ? 'No matching sessions' : 'No sessions yet'}
              </strong>
              <p>
                {search.trim()
                  ? 'Try another session name.'
                  : 'Create your first session to get started.'}
              </p>
              {!search.trim() && canWrite && (
                <Button onClick={onCreate} type="button" variant="secondary">
                  <Plus size={15} aria-hidden="true" />
                  Add Session
                </Button>
              )}
            </div>
          )}
        </div>
        <footer className="academic-sessions-pagination">
          <span>
            Showing {filteredSessions.length ? (page - 1) * pageSize + 1 : 0}-
            {Math.min(page * pageSize, filteredSessions.length)} of{' '}
            {filteredSessions.length}
          </span>
          <label>
            Rows per page
            <select
              aria-label="Rows per page"
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setPage(1);
              }}
              value={pageSize}
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={25}>25</option>
            </select>
          </label>
          <div>
            <Button
              aria-label="Previous page"
              disabled={page <= 1}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              type="button"
              variant="quiet"
            >
              Previous
            </Button>
            <span>
              Page {page} of {pageCount}
            </span>
            <Button
              aria-label="Next page"
              disabled={page >= pageCount}
              onClick={() => setPage((value) => Math.min(pageCount, value + 1))}
              type="button"
              variant="quiet"
            >
              Next
            </Button>
          </div>
        </footer>
      </section>
      <Dialog
        open={detailsSession !== null}
        onOpenChange={(open) => {
          if (!open) setDetailsSession(null);
        }}
        title={detailsSession?.name ?? 'Session details'}
        description={
          detailsSession ? sessionDescription(detailsSession) : undefined
        }
      >
        {detailsSession && (
          <div className="academic-session-details">
            <div className="academic-session-details-status">
              <span
                className={
                  detailsSession.status === 'active' ? 'is-active' : ''
                }
              >
                {detailsSession.status === 'active'
                  ? 'Current session'
                  : 'Archived session'}
              </span>
              <span>
                {formatDate(detailsSession.startDate)} –{' '}
                {formatDate(detailsSession.endDate)}
              </span>
            </div>
            <div className="academic-session-details-metrics">
              <div>
                <strong>{counts.get(detailsSession.id)?.classes ?? 0}</strong>
                <span>Classes</span>
              </div>
              <div>
                <strong>{counts.get(detailsSession.id)?.sections ?? 0}</strong>
                <span>Sections</span>
              </div>
              <div>
                <strong>{counts.get(detailsSession.id)?.students ?? 0}</strong>
                <span>Students</span>
              </div>
            </div>
            <div className="academic-session-class-list">
              <h3>Classes &amp; Sections</h3>
              {sessionClassGroups.length ? (
                <ul>
                  {sessionClassGroups.map((group) => (
                    <li key={group.name}>
                      <strong>{group.name}</strong>
                      <span>
                        {group.sections
                          .map(
                            (section) =>
                              `${section.name} · ${section.students} students`,
                          )
                          .join(' / ')}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No enrolled class or section records for this session.</p>
              )}
            </div>
            {canWrite && (
              <div className="academic-session-details-actions">
                <Button
                  onClick={() => {
                    onEdit(detailsSession);
                    setDetailsSession(null);
                  }}
                  type="button"
                  variant="secondary"
                >
                  <Pencil size={15} aria-hidden="true" />
                  Edit Session
                </Button>
                <Button
                  onClick={() => {
                    onDelete(detailsSession);
                    setDetailsSession(null);
                  }}
                  type="button"
                  variant="danger"
                >
                  <Trash2 size={15} aria-hidden="true" />
                  Delete
                </Button>
              </div>
            )}
          </div>
        )}
      </Dialog>
    </main>
  );
}
