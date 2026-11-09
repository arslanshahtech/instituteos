import { useMemo, useState } from 'react';
import {
  Layers3,
  Pencil,
  Plus,
  Search,
  Trash2,
  Users,
  BookOpen,
  Armchair,
} from 'lucide-react';
import type {
  AcademicClass,
  AcademicSection,
  AcademicYear,
  AcademicYearSummary,
} from './academics-api.js';
import { Button } from '../components/ui/Button.js';
import {
  WorkspaceMetricCard,
  WorkspacePageHeading,
} from '../components/ui/WorkspacePrimitives.js';
import './academic-sections.css';

export function AcademicSectionsReferenceView({
  sections,
  classes,
  sessions,
  summary,
  canWrite,
  onCreate,
  onEdit,
  onDelete,
}: {
  sections: AcademicSection[];
  classes: AcademicClass[];
  sessions: AcademicYear[];
  summary: AcademicYearSummary;
  canWrite: boolean;
  onCreate: () => void;
  onEdit: (section: AcademicSection) => void;
  onDelete: (section: AcademicSection) => void;
}) {
  const [classId, setClassId] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const selectedSession = sessions.find((item) => item.status === 'active');
  const sessionId = selectedSession?.id ?? '';
  const sessionStats = summary.bySession.find(
    (item) => item.academicYearId === sessionId,
  );
  const enrolledBySection = useMemo(
    () =>
      new Map(
        summary.bySection
          .filter((item) => item.academicYearId === sessionId)
          .map((item) => [item.sectionId, item.students]),
      ),
    [summary.bySection, sessionId],
  );
  const classNames = useMemo(
    () => new Map(classes.map((item) => [item.id, item.name])),
    [classes],
  );
  const rows = useMemo(
    () =>
      sections.map((section) => ({
        section,
        className: classNames.get(section.classId) ?? 'Class unavailable',
        enrolled: enrolledBySection.get(section.id) ?? 0,
      })),
    [sections, classNames, enrolledBySection],
  );
  const filteredRows = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return rows.filter(
      ({ section, className }) =>
        (classId === 'all' || section.classId === classId) &&
        (!query ||
          (section.name + ' ' + className).toLocaleLowerCase().includes(query)),
    );
  }, [rows, classId, search]);
  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const visibleRows = filteredRows.slice(
    (page - 1) * pageSize,
    page * pageSize,
  );
  const totalCapacity = sections.reduce(
    (total, section) => total + (section.capacity ?? 0),
    0,
  );
  const metrics = [
    {
      label: 'Sections',
      value: String(sessionStats?.sections ?? 0),
      detail: selectedSession
        ? 'In ' + selectedSession.name
        : 'No active session',
      icon: Layers3,
      className: 'academic-sections-metric-primary',
    },
    {
      label: 'Classes',
      value: String(sessionStats?.classes ?? 0),
      detail: 'Have sections assigned',
      icon: BookOpen,
    },
    {
      label: 'Students',
      value: String(sessionStats?.students ?? 0),
      detail: 'Enrolled this academic year',
      icon: Users,
    },
    {
      label: 'Seat Capacity',
      value: String(totalCapacity),
      detail: 'Configured across all sections',
      icon: Armchair,
      className: 'academic-sections-metric-capacity',
    },
  ];

  return (
    <main className="page-stack academic-sections-page">
      <WorkspacePageHeading
        eyebrow="Curriculum"
        title="Sections"
        description="Manage all sections in your school."
        aside={
          canWrite ? (
            <Button onClick={onCreate} type="button" variant="primary">
              <Plus size={16} aria-hidden="true" />
              Add Section
            </Button>
          ) : undefined
        }
      />
      <section
        aria-label="Section summary"
        className="academic-sessions-metrics academic-sections-metrics"
      >
        {metrics.map((metric) => (
          <WorkspaceMetricCard key={metric.label} metric={metric} />
        ))}
      </section>
      <section
        aria-label="Search and filter sections"
        className="academic-sessions-search-panel academic-sections-toolbar-panel"
      >
        <label className="academic-sessions-search">
          <Search size={17} aria-hidden="true" />
          <input
            aria-label="Search sections"
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search sections..."
            type="search"
            value={search}
          />
        </label>
        <label className="academic-sections-filter">
          <select
            aria-label="Filter by class"
            onChange={(event) => {
              setClassId(event.target.value);
              setPage(1);
            }}
            value={classId}
          >
            <option value="all">All Classes</option>
            {classes.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
      </section>
      <section className="academic-sections-table-panel">
        <header className="academic-sessions-table-heading academic-sections-table-heading">
          <div>
            <h2>All Sections ({filteredRows.length})</h2>
          </div>
        </header>
        <div className="table-scroll">
          <table className="data-table academic-sessions-table academic-sections-table">
            <thead>
              <tr>
                <th scope="col">Section</th>
                <th scope="col">Class</th>
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
              {visibleRows.length ? (
                visibleRows.map(({ section, className, enrolled }) => (
                  <tr key={section.id}>
                    <td data-label="Section">
                      <strong className="academic-section-name">
                        {section.name}
                      </strong>
                    </td>
                    <td data-label="Class">
                      <span className="academic-section-class">
                        {className}
                      </span>
                    </td>
                    <td data-label="Students" className="align-center">
                      {enrolled}
                      {section.capacity == null ? '' : ' / ' + section.capacity}
                    </td>
                    {canWrite && (
                      <td data-label="Actions" className="align-right">
                        <span className="academic-section-actions">
                          <Button
                            aria-label={'Edit ' + section.name}
                            onClick={() => onEdit(section)}
                            type="button"
                            variant="quiet"
                          >
                            <Pencil size={15} aria-hidden="true" />
                          </Button>
                          <Button
                            aria-label={'Delete ' + section.name}
                            onClick={() => onDelete(section)}
                            type="button"
                            variant="quiet"
                          >
                            <Trash2 size={15} aria-hidden="true" />
                          </Button>
                        </span>
                      </td>
                    )}
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    className="academic-sections-empty"
                    colSpan={canWrite ? 4 : 3}
                  >
                    <strong>
                      {search.trim() || classId !== 'all'
                        ? 'No matching sections'
                        : 'No sections yet'}
                    </strong>
                    <p>
                      {search.trim() || classId !== 'all'
                        ? 'Change the search or class filter.'
                        : 'Add a section to start organizing students.'}
                    </p>
                    {!search.trim() && classId === 'all' && canWrite && (
                      <Button
                        onClick={onCreate}
                        type="button"
                        variant="secondary"
                      >
                        <Plus size={15} aria-hidden="true" />
                        Add Section
                      </Button>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <footer className="academic-sessions-pagination academic-sections-pagination">
          <div className="academic-sections-pagination-summary">
            <span>
              Showing {filteredRows.length ? (page - 1) * pageSize + 1 : 0}-
              {Math.min(page * pageSize, filteredRows.length)} of{' '}
              {filteredRows.length}
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
          </div>
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
    </main>
  );
}
