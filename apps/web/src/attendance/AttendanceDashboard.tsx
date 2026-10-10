import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { Button } from '../components/ui/Button.js';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PermissionDeniedState,
} from '../components/ui/States.js';
import { apiMessage, useOrganizationAccess } from '../staff/StaffPageShared.js';
import { listStaff } from '../staff/staff-api.js';
import type { StaffRecord } from '../staff/staff-api.js';
import { useAcademicsWorkspace } from '../academics/academics-queries.js';
import type {
  AcademicClass,
  AcademicSection,
  AcademicYear,
} from '../academics/academics-api.js';
import type {
  StaffAttendanceStatus,
  StudentAttendanceStatus,
  StudentRosterMember,
} from './attendance-api.js';
import {
  useAttendanceRoster,
  useEligibleStudents,
  usePlaceStudent,
  useSaveStaffAttendance,
  useSaveStudentAttendance,
  useStaffAttendance,
} from './attendance-queries.js';

const managerRoles = [
  'organization_owner',
  'organization_admin',
  'campus_admin',
  'principal_director',
  'academic_coordinator',
];

const studentStatuses: StudentAttendanceStatus[] = [
  'present',
  'absent',
  'late',
  'excused',
];
const staffStatuses: StaffAttendanceStatus[] = [
  'present',
  'absent',
  'half-day',
  'on-leave',
];

function today() {
  const current = new Date();
  return new Date(current.getTime() - current.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 10);
}

function personName(person: {
  firstName: string;
  lastName: string;
  preferredName?: string;
}) {
  return person.preferredName
    ? `${person.preferredName} (${person.firstName} ${person.lastName})`
    : `${person.firstName} ${person.lastName}`;
}

export function AttendanceDashboard() {
  const { organizationId = '' } = useParams();
  const access = useOrganizationAccess(organizationId);
  const canManage = managerRoles.includes(access.data?.role ?? '');
  const workspace = useAcademicsWorkspace(
    organizationId,
    Boolean(access.data && canManage),
  );
  const [view, setView] = useState<'students' | 'staff'>('students');
  const [selectedCampusId, setSelectedCampusId] = useState('');
  const [selectedYearId, setSelectedYearId] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedSectionId, setSelectedSectionId] = useState('');
  const [attendanceDate, setAttendanceDate] = useState(today);
  const [studentStatusesById, setStudentStatusesById] = useState<
    Record<string, StudentAttendanceStatus | ''>
  >({});
  const [studentRemarksById, setStudentRemarksById] = useState<
    Record<string, string>
  >({});
  const [staffStatusesById, setStaffStatusesById] = useState<
    Record<string, StaffAttendanceStatus | ''>
  >({});
  const [placementStudentId, setPlacementStudentId] = useState('');
  const attendance = useSaveStudentAttendance(organizationId);
  const place = usePlaceStudent(organizationId);
  const staffSave = useSaveStaffAttendance(organizationId);

  const campuses = workspace.campuses.data?.campuses ?? [];
  const years = (workspace.years.data?.items ?? []).filter(
    (year: AcademicYear) => year.status === 'active',
  );
  const campusId = selectedCampusId || campuses[0]?.id || '';
  const academicYearId = selectedYearId || years[0]?.id || '';
  const classes = (workspace.classes.data?.items ?? []).filter(
    (item: AcademicClass) => item.campusId === campusId,
  );
  const sections = (workspace.sections.data?.items ?? []).filter(
    (item: AcademicSection) =>
      item.classId === (selectedClassId || classes[0]?.id),
  );
  const classId = selectedClassId || classes[0]?.id || '';
  const sectionId = selectedSectionId || sections[0]?.id || '';
  const rosterQuery = useAttendanceRoster(
    organizationId,
    {
      campusId,
      academicYearId,
      classId,
      sectionId,
      date: attendanceDate,
    },
    Boolean(access.data && canManage && view === 'students'),
  );
  const eligible = useEligibleStudents(
    organizationId,
    campusId,
    academicYearId,
    Boolean(access.data && canManage && view === 'students'),
  );
  const staffQuery = useQuery({
    queryKey: ['attendance', organizationId, 'staff-list', campusId],
    queryFn: () =>
      listStaff(organizationId, {
        search: '',
        department: '',
        status: 'active',
        ...(campusId ? { campusId } : {}),
        page: 1,
        pageSize: 100,
      }),
    enabled: Boolean(access.data && canManage && view === 'staff'),
    retry: false,
  });
  const staffAttendance = useStaffAttendance(
    organizationId,
    campusId,
    attendanceDate,
    Boolean(access.data && canManage && view === 'staff'),
  );
  const staff = staffQuery.data?.items ?? [];
  const staffMarks = staffAttendance.data?.items ?? [];
  const roster = rosterQuery.data?.items ?? [];

  useEffect(() => {
    setStudentStatusesById(
      Object.fromEntries(
        roster.map((student) => [student.id, student.status ?? '']),
      ),
    );
    setStudentRemarksById(
      Object.fromEntries(
        roster.map((student) => [student.id, student.remarks ?? '']),
      ),
    );
  }, [roster]);

  useEffect(() => {
    const current = new Map(
      staffMarks.map((record) => [record.staffId, record.status]),
    );
    setStaffStatusesById(
      Object.fromEntries(
        staff.map((person: StaffRecord) => [
          person.id,
          current.get(person.id) ?? '',
        ]),
      ),
    );
  }, [staff, staffMarks]);

  const attendancePercent = useMemo(() => {
    const applicable = roster.filter(
      (person) =>
        studentStatusesById[person.id] !== '' &&
        studentStatusesById[person.id] !== 'excused',
    );
    if (applicable.length === 0) return null;
    const present = applicable.filter(
      (person) =>
        studentStatusesById[person.id] === 'present' ||
        studentStatusesById[person.id] === 'late',
    ).length;
    return Math.round((present / applicable.length) * 100);
  }, [roster, studentStatusesById]);
  const markedCount = roster.filter((person) =>
    Boolean(studentStatusesById[person.id]),
  ).length;
  const statusCounts = Object.fromEntries(
    studentStatuses.map((status) => [
      status,
      roster.filter((person) => studentStatusesById[person.id] === status)
        .length,
    ]),
  ) as Record<StudentAttendanceStatus, number>;

  const studentSaveReady =
    roster.length > 0 &&
    roster.every((person) => Boolean(studentStatusesById[person.id])) &&
    !attendance.isPending;

  async function saveStaff() {
    const pending = staff.filter(
      (person: StaffRecord) => staffStatusesById[person.id],
    );
    for (const person of pending) {
      await staffSave.mutateAsync({
        staffId: person.id,
        date: attendanceDate,
        status: staffStatusesById[person.id] as StaffAttendanceStatus,
      });
    }
  }

  if (access.isPending) {
    return <LoadingState message="Checking attendance workspace access..." />;
  }
  if (access.isError || !access.data) {
    return (
      <ErrorState
        title="Attendance workspace unavailable"
        description={
          access.error
            ? apiMessage(access.error)
            : 'Organization access could not be verified.'
        }
        onRetry={() => void access.refetch()}
      />
    );
  }
  if (!canManage) return <PermissionDeniedState />;

  const filters = (
    <div
      className={`attendance-filters${view === 'staff' ? ' attendance-filters-compact' : ''}`}
    >
      <label>
        Campus
        <select
          onChange={(event) => {
            setSelectedCampusId(event.target.value);
            setSelectedClassId('');
            setSelectedSectionId('');
          }}
          value={campusId}
        >
          <option value="">Select campus</option>
          {campuses.map((campus) => (
            <option key={campus.id} value={campus.id}>
              {campus.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Date
        <input
          onChange={(event) => setAttendanceDate(event.target.value)}
          type="date"
          value={attendanceDate}
        />
      </label>
      {view === 'students' && (
        <>
          <label>
            Academic year
            <select
              onChange={(event) => setSelectedYearId(event.target.value)}
              value={academicYearId}
            >
              <option value="">Select academic year</option>
              {years.map((year) => (
                <option key={year.id} value={year.id}>
                  {year.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Class
            <select
              onChange={(event) => {
                setSelectedClassId(event.target.value);
                setSelectedSectionId('');
              }}
              value={classId}
            >
              <option value="">Select class</option>
              {classes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Section
            <select
              onChange={(event) => setSelectedSectionId(event.target.value)}
              value={sectionId}
            >
              <option value="">Select section</option>
              {sections.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
        </>
      )}
    </div>
  );

  return (
    <main className="page-stack attendance-page">
      <section className="page-heading attendance-page-heading">
        <div>
          <h1>
            {view === 'students' ? 'Student roll call' : 'Staff attendance'}
          </h1>
          <p className="page-description">
            {view === 'students'
              ? 'Record daily attendance for the selected class and section.'
              : 'Record daily attendance for staff at the selected campus.'}
          </p>
        </div>
      </section>

      <nav
        aria-label="Attendance type"
        className="academics-tabs attendance-tabs"
      >
        <button
          aria-current={view === 'students' ? 'page' : undefined}
          className={`academics-tab${view === 'students' ? ' academics-tab-active' : ''}`}
          onClick={() => setView('students')}
          type="button"
        >
          Student attendance
        </button>
        <button
          aria-current={view === 'staff' ? 'page' : undefined}
          className={`academics-tab${view === 'staff' ? ' academics-tab-active' : ''}`}
          onClick={() => setView('staff')}
          type="button"
        >
          Staff attendance
        </button>
      </nav>

      <section className="panel attendance-panel">
        <div className="attendance-filter-toolbar">{filters}</div>

        {view === 'students' ? (
          <>
            {eligible.data?.items.length ? (
              <form
                className="attendance-placement"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (
                    !placementStudentId ||
                    !campusId ||
                    !academicYearId ||
                    !classId ||
                    !sectionId
                  )
                    return;
                  place.mutate(
                    {
                      studentId: placementStudentId,
                      campusId,
                      academicYearId,
                      classId,
                      sectionId,
                    },
                    { onSuccess: () => setPlacementStudentId('') },
                  );
                }}
              >
                <label>
                  Place an enrolled student in this section
                  <select
                    onChange={(event) =>
                      setPlacementStudentId(event.target.value)
                    }
                    value={placementStudentId}
                  >
                    <option value="">Select student</option>
                    {eligible.data.items.map((person) => (
                      <option key={person.id} value={person.id}>
                        {personName(person)}
                      </option>
                    ))}
                  </select>
                </label>
                <Button
                  disabled={
                    !placementStudentId ||
                    !campusId ||
                    !academicYearId ||
                    !classId ||
                    !sectionId ||
                    place.isPending
                  }
                  type="submit"
                >
                  {place.isPending ? 'Placing…' : 'Add to section'}
                </Button>
              </form>
            ) : null}

            {workspace.years.isPending ||
            workspace.classes.isPending ||
            workspace.sections.isPending ||
            workspace.campuses.isPending ? (
              <LoadingState message="Loading academic setup..." />
            ) : workspace.years.isError ||
              workspace.classes.isError ||
              workspace.sections.isError ||
              workspace.campuses.isError ? (
              <ErrorState
                title="Academic setup unavailable"
                description="Check that campuses, active academic years, classes, and sections are configured."
              />
            ) : !academicYearId || !classId || !sectionId || !campusId ? (
              <div className="attendance-setup-notice">
                <EmptyState
                  title="Attendance setup is incomplete"
                  description="Add an active academic year, campus, class, and section in Academics before marking attendance."
                />
              </div>
            ) : rosterQuery.isPending ? (
              <LoadingState message="Loading the section roster..." />
            ) : rosterQuery.isError ? (
              <ErrorState
                title="Student roster unavailable"
                description={apiMessage(rosterQuery.error)}
                onRetry={() => void rosterQuery.refetch()}
              />
            ) : eligible.isPending && roster.length === 0 ? (
              <LoadingState message="Loading eligible students..." />
            ) : roster.length === 0 ? (
              <EmptyState
                title="No students placed in this section"
                description={
                  eligible.isError
                    ? apiMessage(eligible.error)
                    : eligible.data?.items.length
                      ? 'Choose an enrolled student above to add them to this academic-year section.'
                      : 'No unplaced active students are available at this campus.'
                }
              />
            ) : (
              <>
                <div className="attendance-summary" aria-live="polite">
                  <strong>{roster.length} students</strong>
                  <span>
                    {attendancePercent === null
                      ? `${markedCount} marked`
                      : `${attendancePercent}% present or late among marked, excluding excused`}
                  </span>
                  <div
                    aria-label="Attendance totals"
                    className="attendance-breakdown"
                  >
                    {studentStatuses.map((status) => (
                      <span key={status}>
                        {status}: {statusCounts[status]}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="attendance-people-list">
                  {roster.map((student: StudentRosterMember) => (
                    <article className="attendance-person" key={student.id}>
                      <div className="attendance-person-name">
                        <strong>{personName(student)}</strong>
                      </div>
                      <label>
                        Status
                        <select
                          onChange={(event) =>
                            setStudentStatusesById((current) => ({
                              ...current,
                              [student.id]: event.target.value as
                                StudentAttendanceStatus | '',
                            }))
                          }
                          value={studentStatusesById[student.id] ?? ''}
                        >
                          <option value="">Choose status</option>
                          {studentStatuses.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Remarks
                        <input
                          maxLength={500}
                          onChange={(event) =>
                            setStudentRemarksById((current) => ({
                              ...current,
                              [student.id]: event.target.value,
                            }))
                          }
                          value={studentRemarksById[student.id] ?? ''}
                        />
                      </label>
                    </article>
                  ))}
                </div>
                <div className="attendance-save-row">
                  {attendance.isError && (
                    <p className="form-error" role="alert">
                      {apiMessage(attendance.error)}
                    </p>
                  )}
                  <Button
                    disabled={!studentSaveReady}
                    onClick={() =>
                      attendance.mutate({
                        campusId,
                        academicYearId,
                        classId,
                        sectionId,
                        date: attendanceDate,
                        records: roster.map((student) => ({
                          studentId: student.id,
                          status: studentStatusesById[
                            student.id
                          ] as StudentAttendanceStatus,
                          ...(studentRemarksById[student.id]?.trim()
                            ? { remarks: studentRemarksById[student.id].trim() }
                            : {}),
                        })),
                      })
                    }
                    type="button"
                    variant="primary"
                  >
                    {attendance.isPending
                      ? 'Saving attendance…'
                      : 'Save attendance'}
                  </Button>
                </div>
              </>
            )}
            {(place.isError || eligible.isError) && (
              <p className="form-error" role="alert">
                {place.isError
                  ? apiMessage(place.error)
                  : apiMessage(eligible.error)}
              </p>
            )}
          </>
        ) : (
          <>
            {staffQuery.isPending || staffAttendance.isPending ? (
              <LoadingState message="Loading staff attendance..." />
            ) : staffQuery.isError || staffAttendance.isError ? (
              <ErrorState
                title="Staff attendance unavailable"
                description={apiMessage(
                  staffQuery.error ?? staffAttendance.error,
                )}
                onRetry={() => {
                  void staffQuery.refetch();
                  void staffAttendance.refetch();
                }}
              />
            ) : staff.length === 0 ? (
              <EmptyState
                title="No active staff at this campus"
                description="Add active staff records in the Staff workspace before recording attendance."
              />
            ) : (
              <>
                <div className="attendance-people-list">
                  {staff.map((person: StaffRecord) => (
                    <article
                      className="attendance-person attendance-staff-person"
                      key={person.id}
                    >
                      <div className="attendance-person-name">
                        <strong>{personName(person)}</strong>
                        {person.designation && (
                          <span>{person.designation}</span>
                        )}
                      </div>
                      <label>
                        Status
                        <select
                          onChange={(event) =>
                            setStaffStatusesById((current) => ({
                              ...current,
                              [person.id]: event.target.value as
                                StaffAttendanceStatus | '',
                            }))
                          }
                          value={staffStatusesById[person.id] ?? ''}
                        >
                          <option value="">Not marked</option>
                          {staffStatuses.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      </label>
                    </article>
                  ))}
                </div>
                <div className="attendance-save-row">
                  {staffSave.isError && (
                    <p className="form-error" role="alert">
                      Attendance save stopped after an error. Some earlier staff
                      entries may already have been saved:{' '}
                      {apiMessage(staffSave.error)}
                    </p>
                  )}
                  <Button
                    disabled={
                      staffSave.isPending ||
                      !staff.some(
                        (person: StaffRecord) => staffStatusesById[person.id],
                      )
                    }
                    onClick={() => void saveStaff()}
                    type="button"
                    variant="primary"
                  >
                    {staffSave.isPending
                      ? 'Saving attendance…'
                      : 'Save staff attendance'}
                  </Button>
                </div>
              </>
            )}
          </>
        )}
      </section>
    </main>
  );
}
