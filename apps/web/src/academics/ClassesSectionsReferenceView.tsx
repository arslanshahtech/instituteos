import { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  ChevronDown,
  Pencil,
  Plus,
  Search,
  Trash2,
  Users,
} from 'lucide-react';
import type {
  AcademicClass,
  AcademicSection,
  AcademicYear,
  AcademicCampus,
  AcademicSubject,
} from './academics-api.js';

interface Props {
  classes: AcademicClass[];
  sections: AcademicSection[];
  years: AcademicYear[];
  campuses: AcademicCampus[];
  subjects: AcademicSubject[];
  studentsCount?: number;
  onCreate: (resource: 'classes') => void;
  onEdit: (resource: 'classes', record: AcademicClass) => void;
  onDelete: (resource: 'classes', id: string, title: string) => void;
  onOpenCampusSetup: () => void;
  canWriteAcademics?: boolean;
  canCreateCampuses?: boolean;
}

export function ClassesSectionsReferenceView({
  classes,
  sections,
  years,
  campuses,
  subjects,
  studentsCount,
  onCreate,
  onEdit,
  onDelete,
  onOpenCampusSetup,
  canWriteAcademics = true,
  canCreateCampuses = true,
}: Props) {
  const [levelFilter, setLevelFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [showEducationLevels, setShowEducationLevels] = useState(false);
  const activeYear = years.find((year) => year.status === 'active') ?? years[0];

  const campusNames = useMemo(
    () => new Map(campuses.map((campus) => [campus.id, campus.name])),
    [campuses],
  );
  const levelOptions = useMemo(() => {
    const options = new Map<string, { label: string; count: number }>([
      ['first_year', { label: 'First Year', count: 0 }],
      ['second_year', { label: 'Second Year', count: 0 }],
    ]);
    classes.forEach((item) => {
      const key = item.studyLevel ?? (item.programName ? 'program' : 'general');
      const label =
        key === 'first_year'
          ? 'First Year'
          : key === 'second_year'
            ? 'Second Year'
            : key === 'other'
              ? 'Other'
              : key === 'program'
                ? 'College Program'
                : 'General Class';
      const current = options.get(key);
      options.set(key, { label, count: (current?.count ?? 0) + 1 });
    });
    return Array.from(options, ([value, option]) => ({ value, ...option }));
  }, [classes]);

  const filteredClasses = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    return classes.filter((item) => {
      const key = item.studyLevel ?? (item.programName ? 'program' : 'general');
      const matchesLevel = levelFilter === 'all' || key === levelFilter;
      const matchesSearch =
        !term ||
        (
          item.name +
          ' ' +
          item.code +
          ' ' +
          (item.programName ?? '') +
          ' ' +
          (item.studyLevel ?? '') +
          ' ' +
          (campusNames.get(item.campusId) ?? '')
        )
          .toLocaleLowerCase()
          .includes(term);
      return matchesLevel && matchesSearch;
    });
  }, [classes, campusNames, levelFilter, search]);

  const pageCount = Math.max(1, Math.ceil(filteredClasses.length / pageSize));
  const visibleClasses = filteredClasses.slice(
    (page - 1) * pageSize,
    page * pageSize,
  );
  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const openCreate = () => {
    if (!canWriteAcademics) return;
    if (campuses.length) onCreate('classes');
    else if (canCreateCampuses) onOpenCampusSetup();
  };

  return (
    <main className="page-stack classes-reference-page">
      <header className="classes-page-heading">
        <div>
          <span className="cr-eyebrow">ACADEMIC MANAGEMENT</span>
          <h1>Classes</h1>
          <p>Manage All Classes in Your Institute.</p>
        </div>
        <div className="classes-page-actions">
          <div className="cr-education-level-control">
            <button
              className="cr-secondary-button"
              type="button"
              aria-expanded={showEducationLevels}
              aria-haspopup="menu"
              onClick={() => setShowEducationLevels((current) => !current)}
            >
              Education Levels <ChevronDown size={15} />
            </button>
            {showEducationLevels && (
              <div
                className="cr-education-levels"
                role="menu"
                aria-label="Education levels"
              >
                <button
                  className={levelFilter === 'all' ? 'is-active' : ''}
                  type="button"
                  role="menuitem"
                  aria-current={levelFilter === 'all' ? 'true' : undefined}
                  onClick={() => {
                    setLevelFilter('all');
                    setPage(1);
                    setShowEducationLevels(false);
                  }}
                >
                  <span>All Levels</span>
                  <small>{classes.length}</small>
                </button>
                {levelOptions.map((option) => (
                  <button
                    className={levelFilter === option.value ? 'is-active' : ''}
                    key={option.value}
                    type="button"
                    role="menuitem"
                    aria-current={
                      levelFilter === option.value ? 'true' : undefined
                    }
                    onClick={() => {
                      setLevelFilter(option.value);
                      setPage(1);
                      setShowEducationLevels(false);
                    }}
                  >
                    <span>{option.label}</span>
                    <small>{option.count}</small>
                  </button>
                ))}
              </div>
            )}
          </div>
          {canWriteAcademics && (
            <button
              className="cr-primary-button"
              type="button"
              onClick={openCreate}
            >
              <Plus size={16} /> Add Class
            </button>
          )}
        </div>
      </header>

      {campuses.length === 0 && (
        <section className="cr-campus-setup-alert" role="status">
          <div>
            <strong>Set up a campus before adding a class</strong>
            <p>Every class must belong to one of your institute’s campuses.</p>
          </div>
          {canCreateCampuses && (
            <button
              className="cr-primary-button"
              type="button"
              onClick={onOpenCampusSetup}
            >
              Create Campus
            </button>
          )}
        </section>
      )}

      <section className="cr-stat-grid" aria-label="Academic summary">
        <article className="cr-stat-card">
          <span className="cr-stat-icon">
            <BookOpen size={17} />
          </span>
          <p>Classes</p>
          <strong>{classes.length.toLocaleString()}</strong>
          <small>In this institute</small>
        </article>
        <article className="cr-stat-card">
          <span className="cr-stat-icon">
            <Users size={17} />
          </span>
          <p>Sections</p>
          <strong>{sections.length.toLocaleString()}</strong>
          <small>Across all classes</small>
        </article>
        <article className="cr-stat-card">
          <span className="cr-stat-icon">
            <BookOpen size={17} />
          </span>
          <p>Subjects</p>
          <strong>{subjects.length.toLocaleString()}</strong>
          <small>Available in this institute</small>
        </article>
        <article className="cr-stat-card">
          <span className="cr-stat-icon">
            <Users size={17} />
          </span>
          <p>Students</p>
          <strong>
            {studentsCount === undefined ? '—' : studentsCount.toLocaleString()}
          </strong>
          <small>Active student records</small>
        </article>
      </section>

      <section className="cr-class-list-card">
        <div className="cr-search-panel">
          <div className="cr-search">
            <Search size={17} />
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search by class name or class code..."
              aria-label="Search classes"
            />
          </div>
        </div>

        <div className="cr-section-title">
          <div>
            <span className="cr-eyebrow">CLASS DIRECTORY</span>
            <h2>All Classes</h2>
          </div>
          <span className="cr-count">{filteredClasses.length} classes</span>
        </div>

        {filteredClasses.length ? (
          <>
            <div className="cr-class-table-wrap">
              <table className="cr-class-table">
                <thead>
                  <tr>
                    <th scope="col">Class</th>
                    <th scope="col">Level / Grade</th>
                    <th scope="col">Session</th>
                    <th scope="col" className="cr-number-heading">
                      Sections
                    </th>
                    <th scope="col" className="cr-number-heading">
                      Subjects
                    </th>
                    <th scope="col" className="cr-number-heading">
                      Students
                    </th>
                    <th scope="col" className="cr-actions-heading">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visibleClasses.map((item) => {
                    const itemSections = sections.filter(
                      (section) => section.classId === item.id,
                    );
                    const itemSubjects = subjects.filter((subject) =>
                      subject.classIds?.includes(item.id),
                    );
                    const levelLabel =
                      item.studyLevel === 'first_year'
                        ? 'First Year'
                        : item.studyLevel === 'second_year'
                          ? 'Second Year'
                          : item.studyLevel === 'other'
                            ? 'Other'
                            : (item.programName ?? 'General');
                    return (
                      <tr key={item.id}>
                        <td>
                          <div className="cr-class-name">
                            <strong>{item.name}</strong>
                            <small>{item.code}</small>
                          </div>
                        </td>
                        <td>
                          <span className="cr-level-label">{levelLabel}</span>
                          <small className="cr-grade-unavailable">
                            {item.programName ?? 'Grade not set'}
                          </small>
                        </td>
                        <td>{activeYear?.name ?? '—'}</td>
                        <td className="cr-number-cell">
                          <span className="cr-table-count">
                            {itemSections.length}
                          </span>
                        </td>
                        <td className="cr-number-cell">
                          <span className="cr-table-count">
                            {itemSubjects.length}
                          </span>
                        </td>
                        <td className="cr-number-cell">
                          <span
                            className="cr-table-count"
                            title="Per-class placement count is not provided by the current class list API"
                          >
                            —
                          </span>
                        </td>
                        <td>
                          <div className="cr-table-actions">
                            {canWriteAcademics && (
                              <>
                                <button
                                  className="cr-table-icon-button"
                                  type="button"
                                  aria-label={'Edit ' + item.name}
                                  onClick={() => onEdit('classes', item)}
                                >
                                  <Pencil size={15} />
                                </button>
                                <button
                                  className="cr-table-icon-button danger"
                                  type="button"
                                  aria-label={'Delete ' + item.name}
                                  onClick={() =>
                                    onDelete('classes', item.id, item.name)
                                  }
                                >
                                  <Trash2 size={15} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="cr-pagination">
              <div className="cr-pagination-summary">
                <span>
                  Showing{' '}
                  {filteredClasses.length ? (page - 1) * pageSize + 1 : 0}–
                  {Math.min(page * pageSize, filteredClasses.length)} of{' '}
                  {filteredClasses.length}
                </span>
                <label>
                  <span>Rows per page</span>
                  <select
                    aria-label="Rows per page"
                    value={pageSize}
                    onChange={(event) => {
                      setPageSize(Number(event.target.value));
                      setPage(1);
                    }}
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                  </select>
                </label>
              </div>
              <div className="cr-pagination-controls">
                <button
                  type="button"
                  aria-label="Previous page"
                  disabled={page <= 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                >
                  ‹
                </button>
                <span>
                  Page {page} of {pageCount}
                </span>
                <button
                  type="button"
                  aria-label="Next page"
                  disabled={page >= pageCount}
                  onClick={() =>
                    setPage((current) => Math.min(pageCount, current + 1))
                  }
                >
                  ›
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="cr-empty-state">
            <span className="cr-empty-icon">
              <BookOpen size={22} />
            </span>
            <h3>No classes found</h3>
            <p>
              {search || levelFilter !== 'all'
                ? 'Try a different search or education level.'
                : 'Add the first class for your institute.'}
            </p>
            {!search && levelFilter === 'all' && canWriteAcademics && (
              <button
                className="cr-primary-button"
                type="button"
                onClick={openCreate}
              >
                <Plus size={16} /> Add Class
              </button>
            )}
          </div>
        )}
      </section>

      <footer className="cr-footer">
        <span>InstituteOS · Classes</span>
        <span>
          <span className="cr-live-dot" /> Live organization data
        </span>
      </footer>
    </main>
  );
}
