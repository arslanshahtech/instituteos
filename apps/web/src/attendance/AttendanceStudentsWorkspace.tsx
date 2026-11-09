import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '../components/ui/Button.js';
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '../components/ui/States.js';
import {
  listStudents,
  listStudentPlacements,
  type StudentRecord,
  type StudentPlacement,
  type StudentStatus,
} from '../students/students-api.js';
import {
  listStudentAttendance,
  saveStudentAttendance,
  type StudentAttendanceRecord,
  type StudentAttendanceStatus,
  type TeacherAttendanceAssignment,
} from './attendance-api.js';

interface Choice {
  id: string;
  name: string;
}
interface SectionChoice extends Choice {
  classId: string;
}
interface Props {
  organizationId: string;
  campusId: string;
  academicYearId: string;
  date: string;
  initialClassId?: string;
  initialSectionId?: string;
  onDateChange: (date: string) => void;
  classes: Choice[];
  sections: SectionChoice[];
  canWrite: boolean;
  isTeacher: boolean;
  teacherAssignments: TeacherAttendanceAssignment[];
}

type StudentStatusFilter = 'all' | StudentStatus;
type AttendanceFilter = 'all' | StudentAttendanceStatus | 'unmarked';

const attendanceStatuses: StudentAttendanceStatus[] = [
  'present',
  'absent',
  'late',
  'leave',
];

function displayName(student: StudentRecord) {
  return student.preferredName || `${student.firstName} ${student.lastName}`;
}
function errorText(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'The request could not be completed.';
}
function csvCell(value: string | undefined) {
  return `"${(value ?? '').replaceAll('"', '""')}"`;
}
function downloadCsv(
  rows: Array<{
    student: StudentRecord;
    placement?: StudentPlacement;
    attendance?: StudentAttendanceStatus;
  }>,
  date: string,
) {
  const header = [
    'Student Name',
    'Student ID',
    'Parent',
    'Parent Mobile',
    'Class',
    'Section',
    'Status',
  ];
  const lines = rows.map(({ student, placement, attendance }) =>
    [
      displayName(student),
      student.registrationNumber || student.id,
      student.fatherName || student.motherName || '',
      student.parentMobile || '',
      placement?.className || 'Not assigned',
      placement?.sectionName || 'Not assigned',
      attendance
        ? attendance[0].toUpperCase() + attendance.slice(1)
        : 'Not marked',
    ]
      .map(csvCell)
      .join(','),
  );
  const blob = new Blob(
    ['\uFEFF', header.map(csvCell).join(','), '\r\n', lines.join('\r\n')],
    { type: 'text/csv;charset=utf-8;' },
  );
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `instituteos-student-attendance-${date || new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function AttendanceStudentsWorkspace({
  organizationId,
  campusId,
  academicYearId,
  date,
  initialClassId = '',
  initialSectionId = '',
  onDateChange,
  classes,
  sections,
  canWrite,
  isTeacher,
  teacherAssignments,
}: Props) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState(initialClassId);
  const [sectionFilter, setSectionFilter] = useState(initialSectionId);
  const [studentStatusFilter, setStudentStatusFilter] =
    useState<StudentStatusFilter>('all');
  const [attendanceFilter, setAttendanceFilter] =
    useState<AttendanceFilter>('all');
  const [statuses, setStatuses] = useState<
    Record<string, StudentAttendanceStatus | ''>
  >({});
  const [dirtyIds, setDirtyIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveMessage, setSaveMessage] = useState('');

  const scopedAssignments = useMemo(
    () =>
      teacherAssignments.filter(
        (item) =>
          item.campusId === campusId &&
          item.academicYearId === academicYearId &&
          (!classFilter || item.classId === classFilter) &&
          (!sectionFilter || item.sectionId === sectionFilter),
      ),
    [teacherAssignments, campusId, academicYearId, classFilter, sectionFilter],
  );

  const studentsQuery = useQuery({
    queryKey: [
      'attendance',
      organizationId,
      'student-workspace',
      campusId,
      academicYearId,
      isTeacher ? classFilter : '',
      isTeacher ? sectionFilter : '',
      studentStatusFilter,
      search,
      isTeacher,
      scopedAssignments.map((item) => item.sectionId).join(','),
    ],
    queryFn: async () => {
      const common = {
        page: 1,
        pageSize: 100,
        ...(studentStatusFilter !== 'all'
          ? { status: studentStatusFilter }
          : {}),
        ...(search.trim() ? { search: search.trim() } : {}),
      };
      if (isTeacher) {
        const results = await Promise.all(
          scopedAssignments.map(async (assignment) => {
            const input = {
              ...common,
              classId: assignment.classId,
              sectionId: assignment.sectionId,
            };
            const first = await listStudents(organizationId, input);
            const pages = await Promise.all(
              Array.from(
                {
                  length: Math.max(
                    0,
                    Math.ceil(first.total / first.pageSize) - 1,
                  ),
                },
                (_, index) =>
                  listStudents(organizationId, {
                    ...input,
                    page: index + 2,
                    pageSize: 100,
                  }),
              ),
            );
            return [...first.items, ...pages.flatMap((page) => page.items)];
          }),
        );
        const unique = new Map<string, StudentRecord>();
        results.forEach((items) =>
          items.forEach((student) => unique.set(student.id, student)),
        );
        return [...unique.values()];
      }
      const first = await listStudents(organizationId, common);
      const pages = await Promise.all(
        Array.from(
          { length: Math.max(0, Math.ceil(first.total / first.pageSize) - 1) },
          (_, index) =>
            listStudents(organizationId, {
              ...common,
              page: index + 2,
              pageSize: 100,
            }),
        ),
      );
      return [...first.items, ...pages.flatMap((page) => page.items)];
    },
    enabled: Boolean(organizationId && campusId),
    retry: false,
  });

  const students = (studentsQuery.data ?? []).filter(
    (student) => student.campusId === campusId,
  );
  const studentIds = useMemo(
    () => students.map((student) => student.id).sort(),
    [students],
  );
  const placementsQuery = useQuery({
    queryKey: [
      'attendance',
      organizationId,
      'student-workspace-placements',
      academicYearId,
      studentIds.join(','),
    ],
    queryFn: async () => {
      const batches: string[][] = [];
      for (let offset = 0; offset < studentIds.length; offset += 100) {
        batches.push(studentIds.slice(offset, offset + 100));
      }
      const results = await Promise.all(
        batches.map((batch) =>
          listStudentPlacements(organizationId, batch, academicYearId),
        ),
      );
      return { items: results.flatMap((result) => result.items) };
    },
    enabled: studentsQuery.isSuccess && studentIds.length > 0,
    retry: false,
  });
  const placements = useMemo(() => {
    const map = new Map<string, StudentPlacement>();
    for (const placement of placementsQuery.data?.items ?? []) {
      if (
        placement.academicYearId === academicYearId &&
        (!campusId || placement.campusId === campusId) &&
        !map.has(placement.studentId)
      ) {
        map.set(placement.studentId, placement);
      }
    }
    return map;
  }, [placementsQuery.data, academicYearId, campusId]);

  const attendanceQuery = useQuery({
    queryKey: [
      'attendance',
      organizationId,
      'student-workspace-daily',
      campusId,
      academicYearId,
      date,
      classFilter,
      sectionFilter,
      isTeacher,
      scopedAssignments.map((item) => item.sectionId).join(','),
    ],
    queryFn: async () => {
      if (isTeacher) {
        if (!scopedAssignments.length) return [];
        const results = await Promise.all(
          scopedAssignments.map((assignment) =>
            listStudentAttendance(organizationId, {
              dateFrom: date,
              dateTo: date,
              sectionId: assignment.sectionId,
              academicYearId,
            }),
          ),
        );
        return results.flatMap((result) => result.items);
      }
      const result = await listStudentAttendance(organizationId, {
        dateFrom: date,
        dateTo: date,
        campusId,
        academicYearId,
        ...(classFilter ? { classId: classFilter } : {}),
        ...(sectionFilter ? { sectionId: sectionFilter } : {}),
      });
      return result.items;
    },
    enabled: Boolean(organizationId && campusId && date),
    retry: false,
  });

  const attendanceByStudent = useMemo(() => {
    const map = new Map<string, StudentAttendanceRecord>();
    for (const record of attendanceQuery.data ?? [])
      map.set(record.studentId, record);
    return map;
  }, [attendanceQuery.data]);

  useEffect(() => {
    setStatuses({});
    setDirtyIds([]);
    setSaveMessage('');
    setSaveError('');
  }, [date, campusId, academicYearId, classFilter, sectionFilter]);

  useEffect(() => {
    if (!attendanceQuery.data) return;
    setStatuses((current) => {
      const next = { ...current };
      for (const record of attendanceQuery.data ?? []) {
        if (!dirtyIds.includes(record.studentId))
          next[record.studentId] = record.status;
      }
      return next;
    });
  }, [attendanceQuery.data, dirtyIds]);

  const summaryRows = useMemo(
    () =>
      students
        .filter((student) => {
          const placement = placements.get(student.id);
          const needle = search.trim().toLocaleLowerCase();
          const matchesSearch =
            !needle ||
            [
              displayName(student),
              student.registrationNumber,
              student.fatherName,
              student.motherName,
              student.parentMobile,
              student.phone,
            ].some((value) => value?.toLocaleLowerCase().includes(needle));
          const matchesClass =
            !classFilter || placement?.classId === classFilter;
          const matchesSection =
            !sectionFilter || placement?.sectionId === sectionFilter;
          return matchesSearch && matchesClass && matchesSection;
        })
        .sort((a, b) => displayName(a).localeCompare(displayName(b))),
    [students, placements, search, classFilter, sectionFilter],
  );

  const visibleRows = useMemo(
    () =>
      summaryRows.filter((student) => {
        const attendance =
          statuses[student.id] ||
          attendanceByStudent.get(student.id)?.status ||
          '';
        return (
          attendanceFilter === 'all' ||
          (attendanceFilter === 'unmarked'
            ? !attendance
            : attendance === attendanceFilter)
        );
      }),
    [summaryRows, statuses, attendanceByStudent, attendanceFilter],
  );

  const counts = useMemo(() => {
    const result = {
      total: summaryRows.length,
      present: 0,
      absent: 0,
      late: 0,
      leave: 0,
      unmarked: 0,
    };
    summaryRows.forEach((student) => {
      const status =
        statuses[student.id] || attendanceByStudent.get(student.id)?.status;
      if (status) result[status] += 1;
      else result.unmarked += 1;
    });
    return result;
  }, [summaryRows, statuses, attendanceByStudent]);

  function setStudentStatus(
    studentId: string,
    status: StudentAttendanceStatus,
  ) {
    setStatuses((current) => ({ ...current, [studentId]: status }));
    setDirtyIds((current) =>
      current.includes(studentId) ? current : [...current, studentId],
    );
    setSaveMessage('');
    setSaveError('');
  }

  function markVisiblePresent() {
    const ids = visibleRows
      .filter(
        (student) => student.status === 'active' && placements.has(student.id),
      )
      .map((student) => student.id);
    setStatuses((current) =>
      Object.fromEntries([
        ...Object.entries(current),
        ...ids.map((id) => [id, 'present']),
      ]),
    );
    setDirtyIds((current) => [...new Set([...current, ...ids])]);
    setSaveMessage('');
  }

  async function saveChanges() {
    if (!canWrite || saving) return;
    const pending = students.filter(
      (student) =>
        student.status === 'active' &&
        dirtyIds.includes(student.id) &&
        statuses[student.id] &&
        placements.has(student.id),
    );
    const groups = new Map<
      string,
      {
        placement: StudentPlacement;
        records: Array<{ studentId: string; status: StudentAttendanceStatus }>;
      }
    >();
    for (const student of pending) {
      const placement = placements.get(student.id)!;
      const key = [
        placement.classId,
        placement.sectionId,
        placement.academicYearId,
        campusId,
      ].join(':');
      const group = groups.get(key) ?? { placement, records: [] };
      group.records.push({
        studentId: student.id,
        status: statuses[student.id] as StudentAttendanceStatus,
      });
      groups.set(key, group);
    }
    if (!groups.size) return;
    setSaving(true);
    setSaveError('');
    setSaveMessage('');
    try {
      for (const { placement, records } of groups.values()) {
        for (let offset = 0; offset < records.length; offset += 500) {
          await saveStudentAttendance(organizationId, {
            campusId,
            academicYearId: placement.academicYearId,
            classId: placement.classId,
            sectionId: placement.sectionId,
            date,
            records: records.slice(offset, offset + 500),
          });
        }
      }
      setDirtyIds([]);
      setSaveMessage(`Attendance saved for ${pending.length} students.`);
      await queryClient.invalidateQueries({
        queryKey: ['attendance', organizationId],
      });
    } catch (error) {
      setSaveError(errorText(error));
    } finally {
      setSaving(false);
    }
  }

  const sectionsForClass = classFilter
    ? sections.filter((section) => section.classId === classFilter)
    : [];
  const loading =
    studentsQuery.isFetching ||
    (students.length > 0 && placementsQuery.isFetching) ||
    attendanceQuery.isFetching;
  const failed =
    studentsQuery.isError || placementsQuery.isError || attendanceQuery.isError;
  const failure =
    studentsQuery.error ?? placementsQuery.error ?? attendanceQuery.error;

  return (
    <section className="attendance-students-workspace">
      <div className="attendance-students-heading">
        <div>
          <p className="attendance-students-eyebrow">DAILY REGISTER</p>
          <h2>Student attendance</h2>
          <p>
            Review the full student register, mark daily attendance, and track
            each student’s status.
          </p>
        </div>
      </div>

      <div className="attendance-students-metrics" aria-live="polite">
        {[
          {
            label: 'Marked',
            value: counts.total - counts.unmarked,
            detail: `${counts.total - counts.unmarked} of ${counts.total} students marked`,
            tone: 'marked',
            icon: '✓',
          },
          {
            label: 'Present',
            value: counts.present,
            detail: 'Students present today',
            tone: 'present',
            icon: 'P',
          },
          {
            label: 'Absent',
            value: counts.absent,
            detail: 'Students absent today',
            tone: 'absent',
            icon: 'A',
          },
          {
            label: 'On leave',
            value: counts.leave,
            detail: 'Students on approved leave',
            tone: 'leave',
            icon: 'L',
          },
        ].map((item) => (
          <div
            className={`attendance-students-metric attendance-students-metric-${item.tone}`}
            key={item.label}
          >
            <span
              className="attendance-students-metric-icon"
              aria-hidden="true"
            >
              {item.icon}
            </span>
            <span className="attendance-students-metric-label">
              {item.label}
            </span>
            <strong>{item.value}</strong>
            <small>{item.detail}</small>
          </div>
        ))}
      </div>

      <div className="attendance-students-filters">
        <label>
          Date
          <input
            aria-label="Date"
            type="date"
            value={date}
            onChange={(event) => onDateChange(event.target.value)}
          />
        </label>
        <label className="attendance-students-search">
          Search
          <input
            aria-label="Search students"
            type="search"
            placeholder="Name, student ID, parent or mobile"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <label>
          Class
          <select
            aria-label="Class"
            value={classFilter}
            onChange={(event) => {
              setClassFilter(event.target.value);
              setSectionFilter('');
            }}
          >
            <option value="">All classes</option>
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
            aria-label="Section"
            disabled={!classFilter}
            value={sectionFilter}
            onChange={(event) => setSectionFilter(event.target.value)}
          >
            <option value="">All sections</option>
            {sectionsForClass.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Enrollment status
          <select
            aria-label="Enrollment status"
            value={studentStatusFilter}
            onChange={(event) =>
              setStudentStatusFilter(event.target.value as StudentStatusFilter)
            }
          >
            <option value="all">All students</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="withdrawn">Withdrawn</option>
          </select>
        </label>
      </div>

      <div className="attendance-students-toolbar">
        <div
          className="attendance-students-status-filters"
          aria-label="Attendance status filter"
        >
          {(
            [
              ['all', 'All'],
              ['unmarked', 'Not marked'],
              ['present', 'Present'],
              ['absent', 'Absent'],
              ['late', 'Late'],
              ['leave', 'Leave'],
            ] as Array<[AttendanceFilter, string]>
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={attendanceFilter === value}
              className={attendanceFilter === value ? 'is-active' : ''}
              onClick={() => setAttendanceFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="attendance-students-actions">
          <Button
            onClick={() =>
              downloadCsv(
                visibleRows.map((student) => ({
                  student,
                  placement: placements.get(student.id),
                  attendance: (statuses[student.id] ||
                    attendanceByStudent.get(student.id)?.status) as
                    StudentAttendanceStatus | undefined,
                })),
                date,
              )
            }
            type="button"
            variant="secondary"
            disabled={loading || !visibleRows.length}
          >
            Download CSV
          </Button>
          {canWrite && (
            <Button
              onClick={markVisiblePresent}
              type="button"
              variant="secondary"
              disabled={
                !visibleRows.some(
                  (student) =>
                    student.status === 'active' && placements.has(student.id),
                )
              }
            >
              Mark visible present
            </Button>
          )}
          {canWrite && (
            <Button
              onClick={saveChanges}
              type="button"
              disabled={!dirtyIds.length || saving}
            >
              {saving
                ? 'Saving...'
                : `Save changes${dirtyIds.length ? ` (${dirtyIds.length})` : ''}`}
            </Button>
          )}
        </div>
      </div>

      {saveError && (
        <p className="form-error" role="alert">
          {saveError}
        </p>
      )}
      {saveMessage && (
        <p className="attendance-students-save-message" role="status">
          {saveMessage}
        </p>
      )}
      {!canWrite && (
        <p className="attendance-readonly-note" role="status">
          Read-only access: you can review and export attendance, but cannot
          change records.
        </p>
      )}
      {loading ? (
        <LoadingState message="Loading students and attendance..." />
      ) : failed ? (
        <ErrorState
          title="Student attendance could not be loaded"
          description={errorText(failure)}
          onRetry={() => {
            void studentsQuery.refetch();
            void placementsQuery.refetch();
            void attendanceQuery.refetch();
          }}
        />
      ) : !visibleRows.length ? (
        <EmptyState
          title="No students found"
          description="Try changing the filters or search term, or check student enrolments for this academic year."
        />
      ) : (
        <div className="attendance-students-table-wrap">
          <table className="attendance-students-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Parent</th>
                <th>Class</th>
                <th>Section</th>
                <th>Mark attendance</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((student) => {
                const placement = placements.get(student.id);
                const current =
                  statuses[student.id] ||
                  attendanceByStudent.get(student.id)?.status ||
                  '';
                return (
                  <tr key={student.id}>
                    <td>
                      <div className="attendance-student-identity">
                        <span>
                          {displayName(student)
                            .split(' ')
                            .map((part) => part[0])
                            .slice(0, 2)
                            .join('')
                            .toUpperCase()}
                        </span>
                        <div>
                          <strong>{displayName(student)}</strong>
                          <small>
                            {student.registrationNumber || student.id.slice(-7)}
                          </small>
                        </div>
                      </div>
                    </td>
                    <td>
                      <strong>
                        {student.fatherName || student.motherName || '—'}
                      </strong>
                      <small>{student.parentMobile || 'No contact'}</small>
                    </td>
                    <td>{placement?.className || '—'}</td>
                    <td>{placement?.sectionName || '—'}</td>
                    <td>
                      <div
                        className="attendance-students-choice-group"
                        role="group"
                        aria-label={`${displayName(student)} attendance`}
                      >
                        {attendanceStatuses.map((status) => (
                          <button
                            key={status}
                            type="button"
                            title={status[0].toUpperCase() + status.slice(1)}
                            aria-label={`${displayName(student)} ${status}`}
                            aria-pressed={current === status}
                            disabled={
                              !canWrite ||
                              !placement ||
                              student.status !== 'active'
                            }
                            className={`attendance-students-choice attendance-students-choice-${status}${current === status ? ' is-active' : ''}`}
                            onClick={() => setStudentStatus(student.id, status)}
                          >
                            {status === 'leave'
                              ? 'LV'
                              : status[0].toUpperCase()}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td className="attendance-students-status-cell">
                      <span
                        className={`attendance-students-status-pill is-${current || 'unmarked'}`}
                      >
                        {current
                          ? current[0].toUpperCase() + current.slice(1)
                          : 'Not marked'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <div className="attendance-students-footer">
        <span>
          Showing {visibleRows.length} of {students.length} students
        </span>
        <span>P Present · A Absent · L Late · LV Leave</span>
      </div>
    </section>
  );
}
