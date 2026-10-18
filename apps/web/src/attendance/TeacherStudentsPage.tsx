import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { CalendarCheck, GraduationCap, Users } from 'lucide-react';
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
  const [searchParams] = useSearchParams();
  const access = useOrganizationAccess(organizationId);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState(
    () => searchParams.get('assignmentId') ?? '',
  );
  const [attendanceDate, setAttendanceDate] = useState(today);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  useEffect(() => {
    setSearchQuery('');
    setSelectedStudentId('');
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

  useEffect(() => {
    if (
      assignments.length &&
      !assignments.some((assignment) => assignment.id === selectedAssignmentId)
    ) {
      setSelectedAssignmentId(assignments[0]!.id);
    }
  }, [assignments, selectedAssignmentId]);

  const selectedAssignment = assignments.find(
    (assignment) => assignment.id === selectedAssignmentId,
  );
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
  const selectedStudent = roster.find(
    (student) => student.id === selectedStudentId,
  );

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
        eyebrow="Teacher workspace"
        title="My classes & students"
        description="Only classes and student rosters assigned to your teacher account are shown here."
        aside={(
          <Link className="button button-secondary" to={attendanceHref}>
            <CalendarCheck size={16} aria-hidden="true" /> Mark attendance
          </Link>
        )}
      />

      {assignmentsQuery.isPending ? (
        <LoadingState message="Loading your assigned classes..." />
      ) : assignmentsQuery.isError ? (
        <ErrorState
          title="Assigned classes could not be loaded"
          description={apiMessage(assignmentsQuery.error)}
          onRetry={() => void assignmentsQuery.refetch()}
        />
      ) : assignments.length === 0 ? (
        <EmptyState
          title="No active class assignments"
          description="Ask the college administrator to link your account to a staff record and assign your teaching sections for an active academic year."
        />
      ) : (
        <>
          <section
            className="teacher-assignment-grid"
            aria-label="Assigned classes"
          >
            {assignments.map((assignment: TeacherAttendanceAssignment) => (
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
                    {assignment.className} · {assignment.sectionName}
                  </strong>
                  <span>Assigned teaching section</span>
                  <span>
                    {assignment.campusName} · {assignment.academicYearName}
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
              <label className="teacher-attendance-date-control">
                Attendance date
                <input
                  aria-label="Attendance date"
                  type="date"
                  value={attendanceDate}
                  onChange={(event) => setAttendanceDate(event.target.value)}
                />
              </label>
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
                    <strong>{roster.length}</strong>{' '}
                    {roster.length === 1 ? 'student' : 'students'} · Attendance
                    for {attendanceDate}
                  </div>
                  <label className="teacher-roster-search">
                    <span>Find a student</span>
                    <input
                      aria-label="Find a student in the assigned section"
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="Search student name"
                      type="search"
                      value={searchQuery}
                    />
                  </label>
                </div>
                {filteredRoster.length === 0 ? (
                  <EmptyState
                    title="No students match this search"
                    description="Try another name or clear the search field."
                  />
                ) : (
                  <div className="teacher-student-grid">
                    {filteredRoster.map((student) => (
                      <article
                        className={`teacher-student-card${selectedStudentId === student.id ? ' is-selected' : ''}`}
                        key={student.id}
                      >
                        <span
                          className="teacher-student-avatar"
                          aria-hidden="true"
                        >
                          {studentName(student).slice(0, 1).toUpperCase()}
                        </span>
                        <span className="teacher-student-copy">
                          <strong>{studentName(student)}</strong>
                          <span>
                            {student.status
                              ? `Attendance: ${student.status[0]!.toUpperCase()}${student.status.slice(1)}`
                              : 'Attendance not marked for this date'}
                          </span>
                          {student.remarks && <span>{student.remarks}</span>}
                        </span>
                        <button
                          aria-expanded={selectedStudentId === student.id}
                          className="teacher-student-view-button"
                          onClick={() =>
                            setSelectedStudentId((current) =>
                              current === student.id ? '' : student.id,
                            )
                          }
                          type="button"
                        >
                          {selectedStudentId === student.id
                            ? 'Hide details'
                            : 'View details'}
                        </button>
                      </article>
                    ))}
                  </div>
                )}
                {selectedStudent && (
                  <section
                    className="teacher-student-detail panel"
                    aria-label={`Details for ${studentName(selectedStudent)}`}
                  >
                    <div className="teacher-student-detail-heading">
                      <div>
                        <p className="eyebrow">Assigned student</p>
                        <h3>{studentName(selectedStudent)}</h3>
                        <p>
                          {selectedAssignment?.className} ·{' '}
                          {selectedAssignment?.sectionName}
                        </p>
                      </div>
                      <button
                        aria-label="Close student details"
                        className="teacher-student-detail-close"
                        onClick={() => setSelectedStudentId('')}
                        type="button"
                      >
                        Close
                      </button>
                    </div>
                    <dl className="teacher-student-detail-list">
                      <div>
                        <dt>Contact email</dt>
                        <dd>
                          {selectedStudent.contactEmail || 'Not provided'}
                        </dd>
                      </div>
                      <div>
                        <dt>Phone</dt>
                        <dd>{selectedStudent.phone || 'Not provided'}</dd>
                      </div>
                      <div>
                        <dt>Campus</dt>
                        <dd>{selectedAssignment?.campusName}</dd>
                      </div>
                      <div>
                        <dt>Academic year</dt>
                        <dd>{selectedAssignment?.academicYearName}</dd>
                      </div>
                      <div>
                        <dt>Attendance · {attendanceDate}</dt>
                        <dd>
                          {selectedStudent.status
                            ? `${selectedStudent.status[0]!.toUpperCase()}${selectedStudent.status.slice(1)}`
                            : 'Not marked'}
                        </dd>
                      </div>
                      <div>
                        <dt>Remarks</dt>
                        <dd>
                          {selectedStudent.remarks?.trim() ||
                            'No remarks recorded for this date'}
                        </dd>
                      </div>
                    </dl>
                    <Link
                      className="button button-primary"
                      to={`/teacher/organizations/${encodeURIComponent(organizationId)}/attendance`}
                    >
                      <CalendarCheck size={16} aria-hidden="true" /> Update
                      attendance
                    </Link>
                  </section>
                )}
                <p className="parent-explainer">
                  This is a read-only roster. Attendance changes are saved from
                  the Attendance screen with its required confirmation.
                </p>
              </>
            )}
          </section>
        </>
      )}
    </main>
  );
}
