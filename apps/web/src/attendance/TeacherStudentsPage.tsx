import { useEffect, useMemo, useState } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import {
  Link,
  useLocation,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import { ArrowRight, CalendarCheck, GraduationCap, Users } from 'lucide-react';
import { WorkspacePageHeading } from '../components/ui/WorkspacePrimitives.js';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PermissionDeniedState,
} from '../components/ui/States.js';
import { useOrganizationAccess, apiMessage } from '../staff/StaffPageShared.js';
import {
  listTeacherAttendanceAssignments,
  getStudentRoster,
  type TeacherAttendanceAssignment,
} from './attendance-api.js';

function today() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 10);
}

function studentName(person: {
  firstName: string;
  lastName: string;
  preferredName?: string;
}) {
  const fullName = [person.firstName, person.lastName]
    .filter(Boolean)
    .join(' ');
  return person.preferredName ? person.preferredName : fullName;
}

export function TeacherStudentsPage() {
  const { organizationId = '' } = useParams();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const access = useOrganizationAccess(organizationId);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState(
    () => searchParams.get('assignmentId') ?? '',
  );
  const [attendanceDate, setAttendanceDate] = useState(today);
  const [searchQuery, setSearchQuery] = useState('');
  useEffect(() => {
    setSearchQuery('');
  }, [selectedAssignmentId, attendanceDate]);
  const assignmentsQuery = useQuery({
    queryKey: ['attendance', organizationId, 'teacher-assignments'],
    queryFn: () => listTeacherAttendanceAssignments(organizationId),
    enabled: Boolean(access.data && access.data.role === 'teacher'),
    retry: false,
  });
  const assignments = useMemo(
    () => assignmentsQuery.data?.items ?? [],
    [assignmentsQuery.data?.items],
  );
  const assignedSections = useMemo(() => {
    const grouped = new Map<
      string,
      { assignment: TeacherAttendanceAssignment; subjects: Set<string> }
    >();
    for (const assignment of assignments) {
      const key = [
        assignment.campusId,
        assignment.academicYearId,
        assignment.classId,
        assignment.sectionId,
      ].join(':');
      const existing = grouped.get(key);
      if (existing) {
        if (assignment.subjectName)
          existing.subjects.add(assignment.subjectName);
      } else {
        grouped.set(key, {
          assignment,
          subjects: new Set(
            assignment.subjectName ? [assignment.subjectName] : [],
          ),
        });
      }
    }
    return Array.from(grouped, ([id, group]) => ({
      ...group.assignment,
      id,
      subjectName: Array.from(group.subjects).join(', '),
    }));
  }, [assignments]);

  useEffect(() => {
    if (
      assignedSections.length &&
      !assignedSections.some(
        (assignment) => assignment.id === selectedAssignmentId,
      )
    ) {
      setSelectedAssignmentId(assignedSections[0]!.id);
    }
  }, [assignedSections, selectedAssignmentId]);

  const selectedAssignment = assignedSections.find(
    (assignment) => assignment.id === selectedAssignmentId,
  );
  const sectionRosterQueries = useQueries({
    queries: assignedSections.map((assignment) => ({
      queryKey: [
        'attendance',
        organizationId,
        'teacher-students',
        assignment.id,
        attendanceDate,
      ],
      queryFn: () =>
        getStudentRoster(organizationId, {
          campusId: assignment.campusId,
          academicYearId: assignment.academicYearId,
          classId: assignment.classId,
          sectionId: assignment.sectionId,
          date: attendanceDate,
        }),
      enabled: Boolean(access.data?.role === 'teacher'),
      retry: false,
    })),
  });
  const allRosterCountsLoaded = sectionRosterQueries.every(
    (query) => query.isSuccess,
  );
  const totalAssignedStudents = useMemo(() => {
    const studentIds = new Set(
      sectionRosterQueries.flatMap(
        (query) => query.data?.items.map((student) => student.id) ?? [],
      ),
    );
    return studentIds.size;
  }, [sectionRosterQueries]);
  const assignedClassCount = new Set(
    assignedSections.map(
      (assignment) =>
        `${assignment.campusId}:${assignment.academicYearId}:${assignment.classId}`,
    ),
  ).size;
  const attendanceQuery = new URLSearchParams(
    selectedAssignment
      ? {
          campusId: selectedAssignment.campusId,
          academicYearId: selectedAssignment.academicYearId,
          classId: selectedAssignment.classId,
          sectionId: selectedAssignment.sectionId,
          date: attendanceDate,
        }
      : { date: attendanceDate },
  );
  const attendanceHref = `/teacher/organizations/${encodeURIComponent(organizationId)}/attendance?${attendanceQuery.toString()}`;
  const studentListReturnQuery = new URLSearchParams({
    assignmentId: selectedAssignmentId,
    date: attendanceDate,
  });
  const studentListReturnHref = `${location.pathname}?${studentListReturnQuery.toString()}`;
  const rosterQuery = useQuery({
    queryKey: [
      'attendance',
      organizationId,
      'teacher-students',
      selectedAssignment?.id,
      attendanceDate,
    ],
    queryFn: () =>
      getStudentRoster(organizationId, {
        campusId: selectedAssignment!.campusId,
        academicYearId: selectedAssignment!.academicYearId,
        classId: selectedAssignment!.classId,
        sectionId: selectedAssignment!.sectionId,
        date: attendanceDate,
      }),
    enabled: Boolean(access.data?.role === 'teacher' && selectedAssignment),
    retry: false,
  });
  const roster = rosterQuery.data?.items ?? [];
  const filteredRoster = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase();
    if (!query) return roster;
    return roster.filter((student) =>
      studentName(student).toLocaleLowerCase().includes(query),
    );
  }, [roster, searchQuery]);
  if (access.isPending)
    return <LoadingState message="Checking your teaching workspace..." />;
  if (access.isError || !access.data) {
    return (
      <ErrorState
        title="Teaching workspace unavailable"
        description={
          access.error
            ? apiMessage(access.error)
            : 'Your organization access could not be verified.'
        }
        onRetry={() => void access.refetch()}
      />
    );
  }
  if (access.data.role !== 'teacher') return <PermissionDeniedState />;

  return (
    <main className="page-stack reference-live-module teacher-students-page">
      <WorkspacePageHeading
        eyebrow=""
        title="My classes & students"
        description="Select an assigned class to view its students and attendance."
        aside={
          <Link className="button button-secondary" to={attendanceHref}>
            <CalendarCheck size={16} aria-hidden="true" /> Mark attendance
          </Link>
        }
      />

      {assignmentsQuery.isPending ? (
        <LoadingState message="Loading your assigned classes..." />
      ) : assignmentsQuery.isError ? (
        <ErrorState
          title="Assigned classes could not be loaded"
          description={apiMessage(assignmentsQuery.error)}
          onRetry={() => void assignmentsQuery.refetch()}
        />
      ) : assignedSections.length === 0 ? (
        <EmptyState
          title="No active class assignments"
          description="Ask the college administrator to link your account to a staff record and assign your teaching sections for an active academic year."
        />
      ) : (
        <>
          <section
            className="teacher-class-stats"
            aria-label="Teaching overview"
          >
            <article>
              <span>Assigned classes</span>
              <strong>{assignedClassCount}</strong>
            </article>
            <article>
              <span>Teaching sections</span>
              <strong>{assignedSections.length}</strong>
            </article>
            <article>
              <span>Students</span>
              <strong>
                {allRosterCountsLoaded ? totalAssignedStudents : '—'}
              </strong>
            </article>
          </section>
          <section
            className="teacher-assignment-grid"
            aria-label="Assigned classes"
          >
            {assignedSections.map((assignment: TeacherAttendanceAssignment) => (
              <button
                aria-pressed={selectedAssignmentId === assignment.id}
                className={`teacher-assignment-card${selectedAssignmentId === assignment.id ? ' is-selected' : ''}`}
                key={assignment.id}
                onClick={() => setSelectedAssignmentId(assignment.id)}
                type="button"
              >
                <span className="teacher-assignment-icon" aria-hidden="true">
                  <GraduationCap size={22} />
                </span>
                <span className="teacher-assignment-copy">
                  <strong>
                    {assignment.className} <span aria-hidden="true">/</span>{' '}
                    {assignment.sectionName}
                  </strong>
                  {assignment.subjectName && (
                    <span className="teacher-assignment-subject">
                      {assignment.subjectName}
                    </span>
                  )}
                  <span className="teacher-assignment-meta">
                    {assignment.campusName} <span aria-hidden="true">·</span>{' '}
                    {assignment.academicYearName}
                  </span>
                  <span className="teacher-assignment-action">
                    {selectedAssignmentId === assignment.id
                      ? 'Viewing students'
                      : 'View students'}
                    <ArrowRight size={15} aria-hidden="true" />
                  </span>
                </span>
              </button>
            ))}
          </section>

          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>
                  {selectedAssignment
                    ? `${selectedAssignment.className} · ${selectedAssignment.sectionName}`
                    : 'Students'}
                </h2>
                <p className="page-description">
                  {selectedAssignment
                    ? `${selectedAssignment.campusName} · ${selectedAssignment.academicYearName}`
                    : 'Choose one of your assigned sections.'}
                </p>
              </div>
            </div>
            {rosterQuery.isPending ? (
              <LoadingState message="Loading the selected section's student roster..." />
            ) : rosterQuery.isError ? (
              <ErrorState
                title="Student roster could not be loaded"
                description={apiMessage(rosterQuery.error)}
                onRetry={() => void rosterQuery.refetch()}
              />
            ) : roster.length === 0 ? (
              <EmptyState
                title="No students placed in this section"
                description="The administrator must enroll students and assign them to this section before the roster appears."
              />
            ) : (
              <>
                <div className="teacher-roster-toolbar">
                  <div className="teacher-roster-summary">
                    <Users size={17} aria-hidden="true" />
                    <strong>{filteredRoster.length}</strong>
                    <span>of {roster.length} students</span>
                  </div>
                  <div className="teacher-roster-controls">
                    <label className="teacher-attendance-date-control">
                      <span>Attendance date</span>
                      <input
                        aria-label="Attendance date"
                        type="date"
                        value={attendanceDate}
                        onChange={(event) =>
                          setAttendanceDate(event.target.value)
                        }
                      />
                    </label>
                    <label className="teacher-roster-search">
                      <span>Search students</span>
                      <input
                        aria-label="Find a student in the assigned section"
                        onChange={(event) => setSearchQuery(event.target.value)}
                        placeholder="Search by student name"
                        type="search"
                        value={searchQuery}
                      />
                    </label>
                  </div>
                </div>
                {filteredRoster.length === 0 ? (
                  <EmptyState
                    title="No students match this search"
                    description="Try another name or clear the search field."
                  />
                ) : (
                  <div className="teacher-roster-table-wrap">
                    <table className="teacher-roster-table">
                      <thead>
                        <tr>
                          <th scope="col">Student</th>
                          <th scope="col">Attendance</th>
                          <th scope="col">Remarks</th>
                          <th
                            scope="col"
                            className="teacher-roster-actions-heading"
                          >
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRoster.map((student) => (
                          <tr key={student.id}>
                            <td data-label="Student">
                              <div className="teacher-roster-person">
                                <span
                                  className="teacher-student-avatar"
                                  aria-hidden="true"
                                >
                                  {studentName(student)
                                    .slice(0, 1)
                                    .toUpperCase()}
                                </span>
                                <span className="teacher-roster-person-copy">
                                  <strong>{studentName(student)}</strong>
                                </span>
                              </div>
                            </td>
                            <td data-label="Attendance">
                              <span
                                className={`teacher-roster-status${student.status ? ` is-${student.status}` : ' is-unmarked'}`}
                              >
                                {student.status
                                  ? `${student.status[0]!.toUpperCase()}${student.status.slice(1)}`
                                  : 'Not marked'}
                              </span>
                            </td>
                            <td
                              data-label="Remarks"
                              className="teacher-roster-remarks"
                            >
                              {student.remarks?.trim() || '—'}
                            </td>
                            <td data-label="Actions">
                              <Link
                                className="teacher-student-view-button"
                                to={`/teacher/organizations/${encodeURIComponent(organizationId)}/students/${encodeURIComponent(student.id)}`}
                                state={{ from: studentListReturnHref }}
                              >
                                View profile
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </section>
        </>
      )}
    </main>
  );
}
