import { useMemo, useState } from 'react';
import { BookOpen, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import type { AcademicClass, AcademicSubject } from './academics-api.js';
import type { ExamSchedule } from '../examinations/examinations-api.js';
import { Button } from '../components/ui/Button.js';
import {
  WorkspaceMetricCard,
  WorkspacePageHeading,
} from '../components/ui/WorkspacePrimitives.js';
import './academic-subjects.css';

type SubjectAssessment = { totalMarks: number; passingMarks: number };

export function AcademicSubjectsReferenceView({
  subjects,
  classes,
  schedules,
  canWrite,
  onCreate,
  onEdit,
  onDelete,
}: {
  subjects: AcademicSubject[];
  classes: AcademicClass[];
  schedules: ExamSchedule[];
  canWrite: boolean;
  onCreate: () => void;
  onEdit: (subject: AcademicSubject) => void;
  onDelete: (subject: AcademicSubject) => void;
}) {
  const [classId, setClassId] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const classNames = useMemo(
    () => new Map(classes.map((item) => [item.id, item.name])),
    [classes],
  );
  const assessmentBySubject = useMemo(() => {
    const result = new Map<string, SubjectAssessment>();
    for (const schedule of schedules) {
      const current = result.get(schedule.subjectId) ?? {
        totalMarks: 0,
        passingMarks: 0,
      };
      current.totalMarks += schedule.totalMarks;
      current.passingMarks += schedule.passingMarks;
      result.set(schedule.subjectId, current);
    }
    return result;
  }, [schedules]);
  const rows = useMemo(
    () =>
      subjects.map((subject) => {
        const assessment = assessmentBySubject.get(subject.id) ?? {
          totalMarks: 0,
          passingMarks: 0,
        };
        const subjectClasses = (subject.classIds ?? [])
          .map((id) => classNames.get(id))
          .filter(Boolean) as string[];
        return {
          subject,
          classIds: subject.classIds ?? [],
          classNames: subjectClasses,
          totalMarks:
            assessment.totalMarks > 0
              ? assessment.totalMarks
              : (subject.totalMarks ?? 0),
          passingPercentage:
            assessment.totalMarks > 0
              ? (assessment.passingMarks / assessment.totalMarks) * 100
              : (subject.passingPercentage ?? null),
        };
      }),
    [subjects, classNames, assessmentBySubject],
  );
  const filteredRows = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return rows.filter(
      ({ subject, classIds, classNames: names }) =>
        (classId === 'all' || classIds.includes(classId)) &&
        (!query ||
          (subject.name + ' ' + subject.code + ' ' + names.join(' '))
            .toLocaleLowerCase()
            .includes(query)),
    );
  }, [rows, classId, search]);
  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const visibleRows = filteredRows.slice(
    (page - 1) * pageSize,
    page * pageSize,
  );
  const subjectsWithAssessments = rows.filter((item) => item.totalMarks > 0);
  const averageTotalMarks = subjectsWithAssessments.length
    ? subjectsWithAssessments.reduce((sum, item) => sum + item.totalMarks, 0) /
      subjectsWithAssessments.length
    : null;
  const subjectsWithPassingRate = rows.filter(
    (item) => item.totalMarks > 0 && item.passingPercentage !== null,
  );
  const averagePassingRate = subjectsWithPassingRate.length
    ? subjectsWithPassingRate.reduce(
        (sum, item) => sum + (item.passingPercentage ?? 0),
        0,
      ) / subjectsWithPassingRate.length
    : null;
  const metrics = [
    {
      label: 'Subjects',
      value: String(subjects.length),
      detail: 'Available in this organization',
      icon: BookOpen,
    },
    {
      label: 'Classes',
      value: String(classes.length),
      detail: 'Available in this organization',
      icon: BookOpen,
    },
    {
      label: 'AVG TOTAL MARKS',
      value: averageTotalMarks === null ? '?' : averageTotalMarks.toFixed(0),
      detail: 'Across configured subject assessments',
      icon: BookOpen,
    },
    {
      label: 'AVG PASSING %',
      value:
        averagePassingRate === null ? '?' : averagePassingRate.toFixed(1) + '%',
      detail: 'Across configured subject assessments',
      icon: BookOpen,
    },
  ];

  return (
    <main className="page-stack academic-subjects-page">
      <WorkspacePageHeading
        eyebrow="Curriculum"
        title="Subjects"
        description="Manage the subjects offered across your classes."
        aside={
          canWrite ? (
            <Button onClick={onCreate} type="button" variant="primary">
              <Plus size={16} aria-hidden="true" />
              Add Subject
            </Button>
          ) : undefined
        }
      />
      <section
        aria-label="Subject summary"
        className="academic-sessions-metrics academic-subjects-metrics"
      >
        {metrics.map((metric) => (
          <WorkspaceMetricCard key={metric.label} metric={metric} />
        ))}
      </section>
      <section
        aria-label="Search and filter subjects"
        className="academic-sessions-search-panel academic-subjects-toolbar-panel"
      >
        <label className="academic-sessions-search">
          <Search size={17} aria-hidden="true" />
          <input
            aria-label="Search subjects"
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search subjects..."
            type="search"
            value={search}
          />
        </label>
        <label className="academic-subjects-filter">
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
      <section className="academic-subjects-table-panel">
        <header className="academic-sessions-table-heading academic-subjects-table-heading">
          <div>
            <h2>All Subjects ({filteredRows.length})</h2>
          </div>
        </header>
        <div className="table-scroll">
          <table className="data-table academic-sessions-table academic-subjects-table">
            <thead>
              <tr>
                <th scope="col">Subject</th>
                <th scope="col">Class</th>
                <th scope="col" className="align-center">
                  Total Marks
                </th>
                <th scope="col" className="align-center">
                  Passing %
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
                visibleRows.map(
                  ({
                    subject,
                    classNames: names,
                    totalMarks,
                    passingPercentage,
                  }) => (
                    <tr key={subject.id}>
                      <td data-label="Subject">
                        <strong className="academic-subject-name">
                          {subject.name}
                        </strong>
                        <span className="academic-subject-code">
                          {subject.code}
                        </span>
                      </td>
                      <td data-label="Class">
                        <span className="academic-subject-class">
                          {names.length ? names.join(', ') : 'Not assigned'}
                        </span>
                      </td>
                      <td data-label="Total Marks" className="align-center">
                        {totalMarks > 0 ? totalMarks : '?'}
                      </td>
                      <td data-label="Passing %" className="align-center">
                        {passingPercentage === null
                          ? '?'
                          : passingPercentage.toFixed(1) + '%'}
                      </td>
                      {canWrite && (
                        <td data-label="Actions" className="align-right">
                          <span className="academic-subject-actions">
                            <Button
                              aria-label={'Edit ' + subject.name}
                              onClick={() => onEdit(subject)}
                              type="button"
                              variant="quiet"
                            >
                              <Pencil size={15} aria-hidden="true" />
                            </Button>
                            <Button
                              aria-label={'Delete ' + subject.name}
                              onClick={() => onDelete(subject)}
                              type="button"
                              variant="quiet"
                            >
                              <Trash2 size={15} aria-hidden="true" />
                            </Button>
                          </span>
                        </td>
                      )}
                    </tr>
                  ),
                )
              ) : (
                <tr>
                  <td
                    className="academic-subjects-empty"
                    colSpan={canWrite ? 5 : 4}
                  >
                    <strong>
                      {search.trim() || classId !== 'all'
                        ? 'No matching subjects'
                        : 'No subjects yet'}
                    </strong>
                    <p>
                      {search.trim() || classId !== 'all'
                        ? 'Change the search or class filter.'
                        : 'Add a subject to start building your curriculum.'}
                    </p>
                    {!search.trim() && classId === 'all' && canWrite && (
                      <Button
                        onClick={onCreate}
                        type="button"
                        variant="secondary"
                      >
                        <Plus size={15} aria-hidden="true" />
                        Add Subject
                      </Button>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <footer className="academic-sessions-pagination academic-subjects-pagination">
          <div className="academic-subjects-pagination-summary">
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
