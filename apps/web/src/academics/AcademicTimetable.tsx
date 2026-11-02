import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiMessage } from '../staff/StaffPageShared.js';
import {
  deleteTeacherTimetable,
  listTeacherTimetable,
  saveTeacherTimetable,
} from './academics-api.js';
import type {
  AcademicClass,
  AcademicSection,
  AcademicSubject,
  AcademicYear,
  TeacherAssignment,
  TeacherTimetableEntry,
} from './academics-api.js';

interface TeacherChoice {
  id: string;
  firstName: string;
  lastName: string;
}
interface Props {
  organizationId: string;
  teachers: TeacherChoice[];
  assignments: TeacherAssignment[];
  classes: AcademicClass[];
  sections: AcademicSection[];
  subjects: AcademicSubject[];
  years: AcademicYear[];
  canWrite?: boolean;
}

const days = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

export function AcademicTimetable({
  organizationId,
  teachers,
  assignments,
  classes,
  sections,
  subjects,
  years,
  canWrite = true,
}: Props) {
  const queryClient = useQueryClient();
  const [teacherId, setTeacherId] = useState(teachers[0]?.id ?? '');
  const [editingId, setEditingId] = useState<string>();
  useEffect(() => {
    if (!teacherId && teachers[0]) setTeacherId(teachers[0].id);
  }, [teacherId, teachers]);
  const [assignmentId, setAssignmentId] = useState('');
  const [dayOfWeek, setDayOfWeek] = useState('monday');
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('08:40');
  const [room, setRoom] = useState('');
  const teacherAssignments = assignments.filter(
    (item) => item.teacherStaffId === teacherId,
  );
  const timetable = useQuery({
    queryKey: ['academics', organizationId, 'timetable', teacherId],
    queryFn: () => listTeacherTimetable(organizationId, teacherId),
    enabled: Boolean(teacherId),
    retry: false,
  });
  const refresh = () =>
    queryClient.invalidateQueries({
      queryKey: ['academics', organizationId, 'timetable', teacherId],
    });
  const create = useMutation({
    mutationFn: () =>
      saveTeacherTimetable(
        organizationId,
        {
          teacherStaffId: teacherId,
          teacherAssignmentId: assignmentId,
          dayOfWeek,
          startTime,
          endTime,
          ...(room.trim() ? { room: room.trim() } : {}),
        },
        editingId,
      ),
    onSuccess: () => {
      setRoom('');
      setEditingId(undefined);
      void refresh();
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteTeacherTimetable(organizationId, id),
    onSuccess: () => void refresh(),
  });
  const labelFor = (entry: TeacherTimetableEntry) => {
    const assignment = assignments.find(
      (item) => item.id === entry.teacherAssignmentId,
    );
    if (!assignment) return 'Assignment unavailable';
    const subject =
      subjects.find((item) => item.id === assignment.subjectId)?.name ??
      'Subject';
    const className =
      classes.find((item) => item.id === assignment.classId)?.name ?? 'Class';
    const sectionName =
      sections.find((item) => item.id === assignment.sectionId)?.name ??
      'Section';
    const yearName =
      years.find((item) => item.id === assignment.academicYearId)?.name ??
      'Session';
    return `${subject} · ${className} - ${sectionName} · ${yearName}`;
  };

  return (
    <section
      className="academic-timetable page-stack"
      aria-labelledby="academic-timetable-title"
    >
      <header>
        <div>
          <h2 id="academic-timetable-title">Teacher Timetable</h2>
          <p>
            Existing staff aur teacher assignments se weekly periods schedule
            karein.
          </p>
        </div>
      </header>
      {!canWrite && (
        <p className="academics-readonly-note" role="status">
          You have read-only access to the timetable. Ask the Owner to grant
          academics.write if you need to change periods.
        </p>
      )}
      {teachers.length === 0 ? (
        <p className="form-help-text">
          No teaching staff are available. Check staff.read access and ensure
          teacher profiles have a teaching designation or assigned subjects.
        </p>
      ) : (
        <>
          {canWrite && (
            <div className="academic-timetable-form">
              <label>
                Teacher
                <select
                  value={teacherId}
                  onChange={(event) => {
                    setTeacherId(event.target.value);
                    setAssignmentId('');
                  }}
                >
                  {teachers.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacher.firstName} {teacher.lastName}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Class / Subject assignment
                <select
                  value={assignmentId}
                  onChange={(event) => setAssignmentId(event.target.value)}
                >
                  <option value="">Select assignment</option>
                  {teacherAssignments.map((assignment) => {
                    const subject =
                      subjects.find((item) => item.id === assignment.subjectId)
                        ?.name ?? 'Subject';
                    const className =
                      classes.find((item) => item.id === assignment.classId)
                        ?.name ?? 'Class';
                    const sectionName =
                      sections.find((item) => item.id === assignment.sectionId)
                        ?.name ?? 'Section';
                    return (
                      <option key={assignment.id} value={assignment.id}>
                        {subject} · {className} - {sectionName}
                      </option>
                    );
                  })}
                </select>
              </label>
              <label>
                Day
                <select
                  value={dayOfWeek}
                  onChange={(event) => setDayOfWeek(event.target.value)}
                >
                  {days.map((day) => (
                    <option key={day} value={day}>
                      {day[0]!.toUpperCase() + day.slice(1)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Start time
                <input
                  type="time"
                  value={startTime}
                  onChange={(event) => setStartTime(event.target.value)}
                />
              </label>
              <label>
                End time
                <input
                  type="time"
                  value={endTime}
                  onChange={(event) => setEndTime(event.target.value)}
                />
              </label>
              <label>
                Room (optional)
                <input
                  value={room}
                  onChange={(event) => setRoom(event.target.value)}
                  maxLength={80}
                  placeholder="e.g. Room 12"
                />
              </label>
              <button
                type="button"
                disabled={
                  !assignmentId || startTime >= endTime || create.isPending
                }
                onClick={() => create.mutate()}
              >
                {create.isPending
                  ? 'Saving…'
                  : editingId
                    ? 'Update timetable period'
                    : 'Add timetable period'}
              </button>
              {editingId && (
                <button
                  type="button"
                  className="academic-timetable-cancel"
                  onClick={() => {
                    setEditingId(undefined);
                    setAssignmentId('');
                    setRoom('');
                    setStartTime('08:00');
                    setEndTime('08:40');
                  }}
                >
                  Cancel edit
                </button>
              )}
            </div>
          )}
          {create.isError && (
            <p className="form-error" role="alert">
              {apiMessage(create.error)}
            </p>
          )}
          {timetable.isPending ? (
            <p>Loading teacher timetable…</p>
          ) : timetable.isError ? (
            <p className="form-error" role="alert">
              {apiMessage(timetable.error)}
            </p>
          ) : (
            <div className="academic-timetable-list">
              {days.map((day) => {
                const entries = (timetable.data?.items ?? [])
                  .filter((entry) => entry.dayOfWeek === day)
                  .sort((a, b) => a.startTime.localeCompare(b.startTime));
                return (
                  <section key={day} className="academic-timetable-day">
                    <h3>{day[0]!.toUpperCase() + day.slice(1)}</h3>
                    {entries.length ? (
                      entries.map((entry) => (
                        <article key={entry.id}>
                          <div>
                            <strong>
                              {entry.startTime}–{entry.endTime}
                            </strong>
                            <span>{labelFor(entry)}</span>
                            {entry.room && <small>{entry.room}</small>}
                          </div>
                          {canWrite && (
                            <div className="academic-timetable-entry-actions">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingId(entry.id);
                                  setAssignmentId(entry.teacherAssignmentId);
                                  setDayOfWeek(entry.dayOfWeek);
                                  setStartTime(entry.startTime);
                                  setEndTime(entry.endTime);
                                  setRoom(entry.room ?? '');
                                }}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                disabled={remove.isPending}
                                onClick={() => {
                                  if (
                                    window.confirm(
                                      'Remove this timetable period?',
                                    )
                                  )
                                    remove.mutate(entry.id);
                                }}
                              >
                                Remove
                              </button>
                            </div>
                          )}
                        </article>
                      ))
                    ) : (
                      <p>No periods scheduled.</p>
                    )}
                  </section>
                );
              })}
            </div>
          )}
          {remove.isError && (
            <p className="form-error" role="alert">
              {apiMessage(remove.error)}
            </p>
          )}
        </>
      )}
    </section>
  );
}
