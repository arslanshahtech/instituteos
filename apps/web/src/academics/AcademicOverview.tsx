import type {
  AcademicCampus,
  AcademicClass,
  AcademicSection,
  AcademicSubject,
  AcademicTerm,
  AcademicYear,
  TeacherAssignment,
} from './academics-api.js';

interface Props {
  years: AcademicYear[];
  terms: AcademicTerm[];
  classes: AcademicClass[];
  sections: AcademicSection[];
  subjects: AcademicSubject[];
  assignments: TeacherAssignment[];
  campuses: AcademicCampus[];
  onOpen: (
    area:
      | 'academic-years'
      | 'terms'
      | 'classes'
      | 'subjects'
      | 'teacher-assignments',
  ) => void;
}

function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: number | string;
  hint: string;
}) {
  return (
    <article className="academic-overview-metric">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{hint}</small>
    </article>
  );
}

export function AcademicOverview({
  years,
  terms,
  classes,
  sections,
  subjects,
  assignments,
  campuses,
  onOpen,
}: Props) {
  const activeYear = years.find((year) => year.status === 'active');
  const currentTerms = activeYear
    ? terms.filter((term) => term.academicYearId === activeYear.id)
    : [];

  return (
    <section
      className="academic-overview page-stack"
      aria-labelledby="academic-overview-title"
    >
      <header className="academic-overview-header">
        <div>
          <span className="academic-overview-eyebrow">ACADEMIC CENTRE</span>
          <h2 id="academic-overview-title">Academic Overview</h2>
          <p>
            Institute ke academic calendar, classes, sections aur teaching setup
            ki overall situation.
          </p>
        </div>
        <span
          className={
            activeYear
              ? 'academic-year-status is-active'
              : 'academic-year-status'
          }
        >
          {activeYear ? 'Active session configured' : 'No active session'}
        </span>
      </header>

      <div className="academic-overview-grid">
        <Metric
          label="Academic years"
          value={years.length}
          hint={
            activeYear
              ? `Current: ${activeYear.name}`
              : 'Create and activate a session'
          }
        />
        <Metric
          label="Terms"
          value={terms.length}
          hint={`${currentTerms.length} in the active session`}
        />
        <Metric
          label="Classes"
          value={classes.length}
          hint="Configured academic classes"
        />
        <Metric
          label="Sections"
          value={sections.length}
          hint="Class groups and sections"
        />
        <Metric
          label="Subjects"
          value={subjects.length}
          hint="Available subject catalogue"
        />
        <Metric
          label="Teacher assignments"
          value={assignments.length}
          hint="Subject and class assignments"
        />
        <Metric
          label="Campuses"
          value={campuses.length}
          hint="Institute locations"
        />
      </div>

      <div className="academic-overview-lower">
        <article className="academic-overview-card">
          <h3>Current academic session</h3>
          {activeYear ? (
            <>
              <strong>{activeYear.name}</strong>
              <p>
                {activeYear.startDate} — {activeYear.endDate}
              </p>
              <small>{currentTerms.length} term(s) configured</small>
            </>
          ) : (
            <>
              <strong>Setup required</strong>
              <p>Abhi koi active academic session select nahi hai.</p>
              <button type="button" onClick={() => onOpen('academic-years')}>
                Set up academic year
              </button>
            </>
          )}
        </article>
        <article className="academic-overview-card">
          <h3>Academic setup shortcuts</h3>
          <div className="academic-overview-actions">
            <button type="button" onClick={() => onOpen('academic-years')}>
              Manage academic years
            </button>
            <button type="button" onClick={() => onOpen('terms')}>
              Manage terms
            </button>
            <button type="button" onClick={() => onOpen('classes')}>
              Manage classes & sections
            </button>
            <button type="button" onClick={() => onOpen('subjects')}>
              Open subject catalogue
            </button>
            <button type="button" onClick={() => onOpen('teacher-assignments')}>
              Manage teacher assignments
            </button>
          </div>
        </article>
      </div>
    </section>
  );
}
