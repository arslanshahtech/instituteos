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
import { Dialog } from '../components/ui/Dialog.js';
import type {
  AcademicClass,
  AcademicSection,
  AcademicYear,
  AcademicCampus,
  AcademicSubject,
  AcademicYearSummary,
} from './academics-api.js';

interface Props {
  classes: AcademicClass[];
  sections: AcademicSection[];
  years: AcademicYear[];
  campuses: AcademicCampus[];
  subjects: AcademicSubject[];
  studentsCount?: number;
  summary?: AcademicYearSummary;
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
  summary,
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
  const [showStudyLevel, setShowEducationLevels] = useState(false);
  const [detailsClass, setDetailsClass] = useState<AcademicClass | null>(null);
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

  const detailSections = detailsClass
    ? sections.filter((section) => section.classId === detailsClass.id)
    : [];
  const detailSubjects = detailsClass
    ? subjects.filter((subject) => subject.classIds?.includes(detailsClass.id))
    : [];
  const getClassStudentCount = (classId: string) => {
    if (!summary || !activeYear) return undefined;
    return sections
      .filter((section) => section.classId === classId)
      .reduce((total, section) => {
        const placement = summary.bySection.find(
          (item) =>
            item.sectionId === section.id &&
            item.academicYearId === activeYear.id,
        );
        return total + (placement?.students ?? 0);
      }, 0);
  };
  const detailStudentCount = detailsClass
    ? getClassStudentCount(detailsClass.id)
    : undefined;
  const formatDate = (value?: string) => {
    if (!value) return 'Not set';
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? 'Not set'
      : new Intl.DateTimeFormat('en-PK', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        }).format(date);
  };
  const detailLevel = detailsClass
    ? detailsClass.studyLevel === 'first_year'
      ? 'First Year'
      : detailsClass.studyLevel === 'second_year'
        ? 'Second Year'
        : detailsClass.studyLevel === 'other'
          ? 'Other'
          : (detailsClass.programName ?? 'General')
    : '';

  const openCreate = () => {
    if (!canWriteAcademics) return;
    if (campuses.length) onCreate('classes');
    else if (canCreateCampuses) onOpenCampusSetup();
  };

  return (
    <main className="page-stack classes-reference-page">
      <header className="classes-page-heading">
        <div>
          <h1>Classes</h1>
          <p>Manage All Classes in Your Institute.</p>
        </div>
        {canWriteAcademics && (
          <div className="classes-page-heading-action">
            <button
              className="cr-primary-button"
              type="button"
              onClick={openCreate}
            >
              <Plus size={16} /> Add Class
            </button>
          </div>
        )}
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
              placeholder="Search classes..."
              aria-label="Search classes"
            />
          </div>
          <div className="classes-page-actions">
            <div className="cr-education-level-control">
              <button
                className="cr-secondary-button"
                type="button"
                aria-expanded={showStudyLevel}
                aria-haspopup="menu"
                onClick={() => setShowEducationLevels((current) => !current)}
              >
                {levelFilter === 'all'
                  ? 'Study Level'
                  : (levelOptions.find((option) => option.value === levelFilter)
                      ?.label ?? 'Study Level')}
                <ChevronDown size={15} />
              </button>
              {showStudyLevel && (
                <div
                  className="cr-education-levels"
                  role="menu"
                  aria-label="Study level"
                >
                  <button
                    className={levelFilter === 'all' ? 'is-active' : ''}
                    type="button"
                    role="menuitem"
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
                      className={
                        levelFilter === option.value ? 'is-active' : ''
                      }
                      key={option.value}
                      type="button"
                      role="menuitem"
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
            <div className="cr-class-mobile-list" aria-label="All classes">
              {visibleClasses.map((item) => (
                <article className="cr-class-mobile-card" key={item.id}>
                  <div className="cr-class-mobile-copy">
                    <strong className="cr-class-mobile-name">
                      {item.name}
                    </strong>
                    <small>
                      {getClassStudentCount(item.id) ?? '—'} students
                    </small>
                  </div>
                  <button
                    className="cr-mobile-view-button"
                    type="button"
                    onClick={() => setDetailsClass(item)}
                    aria-label={'View details for ' + item.name}
                  >
                    View Details
                  </button>
                </article>
              ))}
            </div>
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
                          <span className="cr-table-count">
                            {getClassStudentCount(item.id) ?? '?'}
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
                ? 'Try a different search or study level.'
                : 'Add the first class for your institute.'}
            </p>
          </div>
        )}
      </section>

      <Dialog
        open={detailsClass !== null}
        onOpenChange={(open) => {
          if (!open) setDetailsClass(null);
        }}
        title={detailsClass?.name ?? 'Class details'}
        description={
          detailsClass
            ? 'Class code ' +
              detailsClass.code +
              ' - ' +
              (campusNames.get(detailsClass.campusId) ?? 'Campus not assigned')
            : undefined
        }
      >
        {detailsClass && (
          <div className="cr-class-details">
            <div className="cr-class-details-summary">
              <span className="cr-class-details-code">{detailsClass.code}</span>
              <span>{detailLevel}</span>
            </div>
            <div className="cr-class-details-grid">
              <div>
                <small>Campus</small>
                <strong>
                  {campusNames.get(detailsClass.campusId) ?? 'Not assigned'}
                </strong>
              </div>
              <div>
                <small>Active session</small>
                <strong>{activeYear?.name ?? 'No active session'}</strong>
              </div>
              <div>
                <small>Session dates</small>
                <strong>
                  {activeYear
                    ? formatDate(activeYear.startDate) +
                      ' - ' +
                      formatDate(activeYear.endDate)
                    : 'Not available'}
                </strong>
              </div>
              <div>
                <small>Sections</small>
                <strong>{detailSections.length}</strong>
              </div>
              <div>
                <small>Subjects</small>
                <strong>{detailSubjects.length}</strong>
              </div>
              <div>
                <small>Enrolled students</small>
                <strong>{detailStudentCount ?? 'Not available'}</strong>
              </div>
              <div>
                <small>Education level</small>
                <strong>{detailLevel}</strong>
              </div>
              <div>
                <small>Program / Stream</small>
                <strong>{detailsClass.programName ?? 'Not specified'}</strong>
              </div>
            </div>
            <section className="cr-class-details-section">
              <header>
                <h3>Sections</h3>
                <span>{detailSections.length} total</span>
              </header>
              {detailSections.length ? (
                <ul>
                  {detailSections.map((section) => (
                    <li key={section.id}>
                      <strong>{section.name}</strong>
                      <span>
                        {section.capacity
                          ? 'Capacity ' + section.capacity
                          : 'Capacity not set'}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No sections have been added to this class yet.</p>
              )}
            </section>
            <section className="cr-class-details-section">
              <header>
                <h3>Subjects</h3>
                <span>{detailSubjects.length} assigned</span>
              </header>
              {detailSubjects.length ? (
                <ul>
                  {detailSubjects.map((subject) => (
                    <li key={subject.id}>
                      <strong>{subject.name}</strong>
                      <span>{subject.code}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No subjects are currently assigned to this class.</p>
              )}
            </section>
            <p className="cr-class-details-note">
              Student total is calculated from actual section placements in the
              active session. If the placement summary is unavailable, the count
              is not displayed as zero.
            </p>
            {canWriteAcademics && (
              <div className="cr-class-details-actions">
                <button
                  className="cr-secondary-button"
                  type="button"
                  onClick={() => {
                    onEdit('classes', detailsClass);
                    setDetailsClass(null);
                  }}
                >
                  <Pencil size={15} /> Edit Class
                </button>
                <button
                  className="cr-danger-button"
                  type="button"
                  onClick={() => {
                    onDelete('classes', detailsClass.id, detailsClass.name);
                    setDetailsClass(null);
                  }}
                >
                  <Trash2 size={15} /> Delete Class
                </button>
              </div>
            )}
          </div>
        )}
      </Dialog>
      <footer className="cr-footer">
        <span>InstituteOS · Classes</span>
        <span>
          <span className="cr-live-dot" /> Live organization data
        </span>
      </footer>
    </main>
  );
}
