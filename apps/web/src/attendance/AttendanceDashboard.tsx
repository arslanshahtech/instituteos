import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, useSearchParams } from 'react-router-dom';
import { Button } from '../components/ui/Button.js';
import { WorkspacePageHeading } from '../components/ui/WorkspacePrimitives.js';
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
import {
  listTeacherAttendanceAssignments,
  type StaffAttendanceStatus,
  type StudentAttendanceStatus,
  type StudentRosterMember,
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
  'leave',
];
const allStudentStatuses: StudentAttendanceStatus[] = [
  'present',
  'absent',
  'late',
  'leave',
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

function savedAttendanceFilter(organizationId: string, key: string) {
  if (typeof window === 'undefined' || !organizationId) return '';
  try {
    return window.localStorage.getItem(`instituteos:attendance:${organizationId}:${key}`) ?? '';
  } catch {
    return '';
  }
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

function hasSameValues<T extends string>(
  current: Record<string, T>,
  next: Record<string, T>,
) {
  const currentKeys = Object.keys(current);
  const nextKeys = Object.keys(next);
  return (
    currentKeys.length === nextKeys.length &&
    nextKeys.every(
      (key) => Object.hasOwn(current, key) && current[key] === next[key],
    )
  );
}

export function AttendanceDashboard() {
  const { organizationId = '' } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const access = useOrganizationAccess(organizationId);
  const isTeacher = access.data?.role === 'teacher';
  const canManage = managerRoles.includes(access.data?.role ?? '');
  const canTakeAttendance = canManage || isTeacher;
  const workspace = useAcademicsWorkspace(
    organizationId,
    Boolean(access.data && canManage),
  );
  const teacherAssignmentsQuery = useQuery({
    queryKey: ['attendance', organizationId, 'teacher-assignments'],
    queryFn: () => listTeacherAttendanceAssignments(organizationId),
    enabled: Boolean(access.data && isTeacher),
    retry: false,
  });
  const teacherAssignments = teacherAssignmentsQuery.data?.items ?? [];
  const [view, setView] = useState<'students' | 'staff'>('students');
  const [selectedCampusId, setSelectedCampusId] = useState(
    () => searchParams.get('campusId') ?? savedAttendanceFilter(organizationId, 'campusId'),
  );
  const [selectedYearId, setSelectedYearId] = useState(
    () => searchParams.get('academicYearId') ?? savedAttendanceFilter(organizationId, 'academicYearId'),
  );
  const [selectedClassId, setSelectedClassId] = useState(
    () => searchParams.get('classId') ?? savedAttendanceFilter(organizationId, 'classId'),
  );
  const [selectedSectionId, setSelectedSectionId] = useState(
    () => searchParams.get('sectionId') ?? savedAttendanceFilter(organizationId, 'sectionId'),
  );
  const [attendanceDate, setAttendanceDate] = useState(
    () => searchParams.get('date') || savedAttendanceFilter(organizationId, 'date') || today(),
  );
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
  const [placingAllStudents, setPlacingAllStudents] = useState(false);
  const attendance = useSaveStudentAttendance(organizationId);
  const place = usePlaceStudent(organizationId);
  const staffSave = useSaveStaffAttendance(organizationId);

  const campuses = isTeacher
    ? [
        ...new Map(
          teacherAssignments.map((item) => [
            item.campusId,
            { id: item.campusId, name: item.campusName },
          ]),
        ).values(),
      ]
    : (workspace.campuses.data?.campuses ?? []);
  const campusId = selectedCampusId || campuses[0]?.id || '';
  const years = isTeacher
    ? [
        ...new Map(
          teacherAssignments
            .filter((item) => item.campusId === campusId)
            .map((item) => [
              item.academicYearId,
              {
                id: item.academicYearId,
                name: item.academicYearName,
                status: 'active' as const,
              },
            ]),
        ).values(),
      ]
    : (workspace.years.data?.items ?? []).filter(
        (year: AcademicYear) => year.status === 'active',
      );
  const academicYearId = selectedYearId || years[0]?.id || '';
  const classes = isTeacher
    ? [
        ...new Map(
          teacherAssignments
            .filter(
              (item) =>
                item.campusId === campusId &&
                item.academicYearId === academicYearId,
            )
            .map((item) => [
              item.classId,
              {
                id: item.classId,
                name: item.className,
                campusId: item.campusId,
              },
            ]),
        ).values(),
      ]
    : (workspace.classes.data?.items ?? []).filter(
        (item: AcademicClass) => item.campusId === campusId,
      );
  const classId = selectedClassId || classes[0]?.id || '';
  const sections = isTeacher
    ? [
        ...new Map(
          teacherAssignments
            .filter(
              (item) =>
                item.campusId === campusId &&
                item.academicYearId === academicYearId &&
                item.classId === classId,
            )
            .map((item) => [
              item.sectionId,
              {
                id: item.sectionId,
                name: item.sectionName,
                classId: item.classId,
              },
            ]),
        ).values(),
      ]
    : (workspace.sections.data?.items ?? []).filter(
        (item: AcademicSection) => item.classId === classId,
      );
  const sectionId = selectedSectionId || sections[0]?.id || '';
  const classSectionOptions = isTeacher
    ? [
        ...new Map(
          teacherAssignments
            .filter(
              (item) =>
                item.campusId === campusId &&
                item.academicYearId === academicYearId,
            )
            .map((item) => [
              `${item.classId}::${item.sectionId}`,
              {
                classId: item.classId,
                className: item.className,
                sectionId: item.sectionId,
                sectionName: item.sectionName,
              },
            ]),
        ).values(),
      ]
    : (workspace.sections.data?.items ?? [])
        .filter((item) => classes.some((classItem) => classItem.id === item.classId))
        .map((item) => ({
          classId: item.classId,
          className: classes.find((classItem) => classItem.id === item.classId)?.name ?? 'Class',
          sectionId: item.id,
          sectionName: item.name,
        }));
  useEffect(() => {
    const ready = isTeacher
      ? teacherAssignmentsQuery.isSuccess
      : workspace.campuses.isSuccess && workspace.years.isSuccess && workspace.classes.isSuccess && workspace.sections.isSuccess;
    if (!ready) return;
    if (selectedCampusId && !campuses.some((item) => item.id === selectedCampusId)) setSelectedCampusId('');
    if (selectedYearId && !years.some((item) => item.id === selectedYearId)) setSelectedYearId('');
    if (selectedClassId && !classes.some((item) => item.id === selectedClassId)) setSelectedClassId('');
    if (selectedSectionId && !sections.some((item) => item.id === selectedSectionId)) setSelectedSectionId('');
  }, [isTeacher, teacherAssignmentsQuery.isSuccess, workspace.campuses.isSuccess, workspace.years.isSuccess, workspace.classes.isSuccess, workspace.sections.isSuccess, campuses, years, classes, sections, selectedCampusId, selectedYearId, selectedClassId, selectedSectionId]);

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (campusId) next.set('campusId', campusId); else next.delete('campusId');
    if (academicYearId) next.set('academicYearId', academicYearId); else next.delete('academicYearId');
    if (classId) next.set('classId', classId); else next.delete('classId');
    if (sectionId) next.set('sectionId', sectionId); else next.delete('sectionId');
    if (attendanceDate) next.set('date', attendanceDate); else next.delete('date');
    if (next.toString() !== searchParams.toString()) setSearchParams(next, { replace: true });
  }, [campusId, academicYearId, classId, sectionId, attendanceDate, searchParams, setSearchParams]);

  useEffect(() => {
    const filtersReady = isTeacher
      ? teacherAssignmentsQuery.isSuccess
      : workspace.campuses.isSuccess && workspace.years.isSuccess && workspace.classes.isSuccess && workspace.sections.isSuccess;
    if (!filtersReady || !organizationId) return;
    try {
      const values: Record<string, string> = {
        campusId,
        academicYearId,
        classId,
        sectionId,
        date: attendanceDate,
      };
      for (const [key, value] of Object.entries(values)) {
        if (value) window.localStorage.setItem(`instituteos:attendance:${organizationId}:${key}`, value);
        else window.localStorage.removeItem(`instituteos:attendance:${organizationId}:${key}`);
      }
    } catch {
      // Keep attendance usable if browser storage is unavailable.
    }
  }, [
    isTeacher,
    teacherAssignmentsQuery.isSuccess,
    workspace.campuses.isSuccess,
    workspace.years.isSuccess,
    workspace.classes.isSuccess,
    workspace.sections.isSuccess,
    organizationId,
    campusId,
    academicYearId,
    classId,
    sectionId,
    attendanceDate,
  ]);
  const rosterQuery = useAttendanceRoster(
    organizationId,
    {
      campusId,
      academicYearId,
      classId,
      sectionId,
      date: attendanceDate,
    },
    Boolean(
      access.data &&
      canTakeAttendance &&
      view === 'students' &&
      (!isTeacher || teacherAssignmentsQuery.isSuccess),
    ),
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
  const staffItems = staffQuery.data?.items;
  const staffMarkItems = staffAttendance.data?.items;
  const rosterItems = rosterQuery.data?.items;
  const staff = useMemo(() => staffItems ?? [], [staffItems]);
  const staffMarks = useMemo(() => staffMarkItems ?? [], [staffMarkItems]);
  const roster = useMemo(() => rosterItems ?? [], [rosterItems]);

  useEffect(() => {
    const nextStatuses: Record<string, StudentAttendanceStatus | ''> =
      Object.fromEntries(
        roster.map((student) => [student.id, student.status ?? '']),
      );
    const nextRemarks = Object.fromEntries(
      roster.map((student) => [student.id, student.remarks ?? '']),
    );
    setStudentStatusesById((current) =>
      hasSameValues(current, nextStatuses) ? current : nextStatuses,
    );
    setStudentRemarksById((current) =>
      hasSameValues(current, nextRemarks) ? current : nextRemarks,
    );
  }, [roster]);

  useEffect(() => {
    const current = new Map(
      staffMarks.map((record) => [record.staffId, record.status]),
    );
    const nextStatuses: Record<string, StaffAttendanceStatus | ''> =
      Object.fromEntries(
        staff.map((person: StaffRecord) => [
          person.id,
          current.get(person.id) ?? '',
        ]),
      );
    setStaffStatusesById((previous) =>
      hasSameValues(previous, nextStatuses) ? previous : nextStatuses,
    );
  }, [staff, staffMarks]);

  const attendancePercent = useMemo(() => {
    const applicable = roster.filter((person) =>
      Boolean(studentStatusesById[person.id]),
    );
    if (applicable.length === 0) return null;
    const present = applicable.filter(
      (person) => studentStatusesById[person.id] === 'present',
    ).length;
    return Math.round((present / applicable.length) * 100);
  }, [roster, studentStatusesById]);
  const markedCount = roster.filter((person) =>
    Boolean(studentStatusesById[person.id]),
  ).length;
  const statusCounts = Object.fromEntries(
    allStudentStatuses.map((status) => [
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
  if (!canManage && !isTeacher) return <PermissionDeniedState />;

  const filters = (
    <div
      className={`attendance-filters attendance-reference-filters${view === 'staff' ? ' attendance-filters-compact' : ''}`}
    >
      {view === 'students' ? (
        <>
          <label className="attendance-reference-date">
            Date
            <input
              onChange={(event) => setAttendanceDate(event.target.value)}
              type="date"
              value={attendanceDate}
            />
          </label>
          <label className="attendance-reference-class">
            Class
            <select
              onChange={(event) => {
                const [nextClassId, nextSectionId] = event.target.value.split('::');
                setSelectedClassId(nextClassId ?? '');
                setSelectedSectionId(nextSectionId ?? '');
              }}
              value={`${classId}::${sectionId}`}
            >
              <option value="">Select class</option>
              {classSectionOptions.map((item) => (
                <option
                  key={`${item.classId}::${item.sectionId}`}
                  value={`${item.classId}::${item.sectionId}`}
                >
                  {item.className}-{item.sectionName}
                </option>
              ))}
            </select>
          </label>
          <details className="attendance-reference-advanced">
            <summary>Academic filters</summary>
            <div className="attendance-reference-advanced-fields">
              <label>
                Campus
                <select
                  onChange={(event) => {
                    setSelectedCampusId(event.target.value);
                    setSelectedYearId('');
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
                Academic year
                <select
                  onChange={(event) => {
                    setSelectedYearId(event.target.value);
                    setSelectedClassId('');
                    setSelectedSectionId('');
                  }}
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
            </div>
          </details>
        </>
      ) : (
        <>
          <label>
            Campus
            <select
              onChange={(event) => setSelectedCampusId(event.target.value)}
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
        </>
      )}
    </div>
  );

  return (
    <main className="page-stack attendance-page reference-attendance-page reference-live-module">
      <WorkspacePageHeading
        className="attendance-page-heading"
        eyebrow="Organization workspace"
        title={view === 'students' ? 'Attendance' : 'Staff attendance'}
        description={
          view === 'students'
            ? 'Record attendance for the selected class and date.'
            : 'Record daily attendance for staff at the selected campus.'
        }
      />

      {!isTeacher && (
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
      )}

      <section className="panel attendance-panel reference-module-section">
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
                <div className="attendance-placement-actions">
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
                  <Button
                    disabled={
                      !eligible.data.items.length ||
                      !campusId ||
                      !academicYearId ||
                      !classId ||
                      !sectionId ||
                      place.isPending ||
                      placingAllStudents
                    }
                    onClick={async () => {
                      const unplacedStudents = [...eligible.data.items];
                      setPlacingAllStudents(true);
                      try {
                        for (const student of unplacedStudents) {
                          await place.mutateAsync({
                            studentId: student.id,
                            campusId,
                            academicYearId,
                            classId,
                            sectionId,
                          });
                        }
                      } finally {
                        setPlacingAllStudents(false);
                      }
                    }}
                    type="button"
                    variant="secondary"
                  >
                    {placingAllStudents
                      ? 'Adding students…'
                      : `Add all ${eligible.data.items.length} students`}
                  </Button>
                </div>
              </form>
            ) : null}

            {isTeacher && teacherAssignmentsQuery.isPending ? (
              <LoadingState message="Loading your assigned classes..." />
            ) : isTeacher && teacherAssignmentsQuery.isError ? (
              <ErrorState
                title="Assigned classes unavailable"
                description={apiMessage(teacherAssignmentsQuery.error)}
                onRetry={() => void teacherAssignmentsQuery.refetch()}
              />
            ) : isTeacher && teacherAssignments.length === 0 ? (
              <EmptyState
                title="No active class assignments"
                description="Your account has no assigned teaching sections for an active academic year. Ask the administrator to link your staff email and assign your classes."
              />
            ) : !isTeacher &&
              (workspace.years.isPending ||
                workspace.classes.isPending ||
                workspace.sections.isPending ||
                workspace.campuses.isPending) ? (
              <LoadingState message="Loading academic setup..." />
            ) : !isTeacher &&
              (workspace.years.isError ||
                workspace.classes.isError ||
                workspace.sections.isError ||
                workspace.campuses.isError) ? (
              <ErrorState
                title="Academic setup could not be loaded"
                description={apiMessage(
                  workspace.campuses.error ??
                    workspace.years.error ??
                    workspace.classes.error ??
                    workspace.sections.error,
                )}
                onRetry={() => {
                  void workspace.campuses.refetch();
                  void workspace.years.refetch();
                  void workspace.classes.refetch();
                  void workspace.sections.refetch();
                }}
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
                  <div
                    aria-label="Roll-call progress"
                    className="attendance-summary-counts"
                    role="group"
                  >
                    <span className="attendance-badge attendance-badge-neutral">
                      Total: {roster.length}
                    </span>
                    <span className="attendance-badge attendance-badge-neutral">
                      Marked: {markedCount}
                    </span>
                  </div>
                  <span
                    aria-live="polite"
                    className="attendance-summary-rate"
                  >
                    Overall{' '}
                    <strong>
                      {attendancePercent === null
                        ? '—'
                        : `${attendancePercent}%`}
                    </strong>
                  </span>
                  <div
                    aria-label="Attendance totals"
                    className="attendance-breakdown"
                    role="group"
                  >
                    {allStudentStatuses.map((status) => (
                      <span
                        className={`attendance-badge attendance-badge-${status}`}
                        key={status}
                      >
                        {status.charAt(0).toUpperCase() + status.slice(1)}:{' '}
                        {statusCounts[status]}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="attendance-people-list">
                  <div className="attendance-roster-scroll">
                    <table className="attendance-roster-table">
                      <thead>
                        <tr>
                          <th scope="col">Student · {classes.find((item) => item.id === classId)?.name ?? 'Class'}-{sections.find((item) => item.id === sectionId)?.name ?? 'Section'}</th>
                          <th scope="col">Mark attendance</th>
                          <th className="attendance-reference-notes-column" scope="col">Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {roster.map((student: StudentRosterMember) => (
                          <tr key={student.id}>
                            <td data-label="Student">
                              <strong>{personName(student)}</strong>
                            </td>
                            <td data-label="Status">
                              <div
                                aria-label={`${personName(student)} attendance status`}
                                className="attendance-status-choices"
                                role="group"
                              >
                                {studentStatuses.map((status) => (
                                  <button
                                    aria-pressed={
                                      studentStatusesById[student.id] === status
                                    }
                                    className={`attendance-status-choice attendance-status-choice-${status}${studentStatusesById[student.id] === status ? ' is-active' : ''}`}
                                    key={status}
                                    onClick={() =>
                                      setStudentStatusesById((current) => ({
                                        ...current,
                                        [student.id]: status,
                                      }))
                                    }
                                    type="button"
                                  >
                                    {status.charAt(0).toUpperCase() +
                                      status.slice(1)}
                                  </button>
                                ))}
                              </div>
                            </td>
                            <td data-label="Notes">
                              <details className="attendance-remark-details">
                                <summary>
                                  {studentRemarksById[student.id]?.trim()
                                    ? 'Edit note'
                                    : 'Add note'}
                                </summary>
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
                              </details>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
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
                      : 'Save Attendance'}
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
