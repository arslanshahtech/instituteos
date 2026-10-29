import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '../components/ui/Button.js';
import { ErrorState, LoadingState } from '../components/ui/States.js';
import { WorkspacePageHeading } from '../components/ui/WorkspacePrimitives.js';
import { useAcademicsWorkspace } from '../academics/academics-queries.js';
import { getStaff } from './staff-api.js';
import {
  deleteTeacherTimetableEntry,
  listTeacherTimetable,
  saveTeacherTimetableEntry,
} from './teacher-timetable-api.js';
import type {
  TeacherTimetableEntry,
  TeacherTimetableInput,
  TimetableDay,
} from './teacher-timetable-api.js';
import {
  apiMessage,
  StaffAccess,
  useOrganizationAccess,
} from './StaffPageShared.js';

const days: { value: TimetableDay; label: string }[] = [
  { value: 'monday', label: 'Monday' },
  { value: 'tuesday', label: 'Tuesday' },
  { value: 'wednesday', label: 'Wednesday' },
  { value: 'thursday', label: 'Thursday' },
  { value: 'friday', label: 'Friday' },
  { value: 'saturday', label: 'Saturday' },
  { value: 'sunday', label: 'Sunday' },
];

const emptyForm = {
  teacherAssignmentId: '',
  dayOfWeek: 'monday' as TimetableDay,
  startTime: '08:00',
  endTime: '08:40',
  room: '',
};

export function TeacherTimetablePage() {
  const { organizationId = '', staffId = '' } = useParams();
  const queryClient = useQueryClient();
  const access = useOrganizationAccess(organizationId);
  const canRead = access.data?.permissions.includes('staff.read') ?? false;
  const canManage = access.data?.permissions.includes('staff.update') ?? false;
  const staff = useQuery({
    queryKey: ['staff', organizationId, staffId],
    queryFn: () => getStaff(organizationId, staffId),
    enabled: canRead && Boolean(staffId),
  });
  const academics = useAcademicsWorkspace(organizationId, canRead);
  const timetable = useQuery({
    queryKey: ['teacher-timetable', organizationId, staffId],
    queryFn: () => listTeacherTimetable(organizationId, staffId),
    enabled: canRead && Boolean(staffId),
  });
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string>();
  const [formError, setFormError] = useState('');

  const assignments = useMemo(
    () =>
      (academics.assignments.data?.items ?? []).filter(
        (item) => item.teacherStaffId === staffId,
      ),
    [academics.assignments.data?.items, staffId],
  );
  const save = useMutation({
    mutationFn: (input: TeacherTimetableInput) =>
      saveTeacherTimetableEntry(organizationId, editingId, input),
    onSuccess: async () => {
      setForm(emptyForm);
      setEditingId(undefined);
      setFormError('');
      await queryClient.invalidateQueries({
        queryKey: ['teacher-timetable', organizationId, staffId],
      });
    },
    onError: (error) => setFormError(apiMessage(error)),
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteTeacherTimetableEntry(organizationId, id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['teacher-timetable', organizationId, staffId],
      });
    },
    onError: (error) => setFormError(apiMessage(error)),
  });

  function assignmentLabel(assignmentId: string) {
    const assignment = assignments.find((item) => item.id === assignmentId);
    if (!assignment) return 'Assignment unavailable';
    const className =
      academics.classes.data?.items.find(
        (item) => item.id === assignment.classId,
      )?.name ?? 'Class';
    const sectionName =
      academics.sections.data?.items.find(
        (item) => item.id === assignment.sectionId,
      )?.name ?? 'Section';
    const subjectName =
      academics.subjects.data?.items.find(
        (item) => item.id === assignment.subjectId,
      )?.name ?? 'Subject';
    const yearName =
      academics.years.data?.items.find(
        (item) => item.id === assignment.academicYearId,
      )?.name ?? 'Academic year';
    return `${subjectName} · ${className} / ${sectionName} · ${yearName}`;
  }

  function editEntry(entry: TeacherTimetableEntry) {
    setEditingId(entry.id);
    setForm({
      teacherAssignmentId: entry.teacherAssignmentId,
      dayOfWeek: entry.dayOfWeek,
      startTime: entry.startTime,
      endTime: entry.endTime,
      room: entry.room ?? '',
    });
    setFormError('');
  }

  function submitForm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      !form.teacherAssignmentId ||
      !form.startTime ||
      !form.endTime ||
      form.startTime >= form.endTime
    ) {
      setFormError(
        'Assignment select karein aur end time ko start time se baad rakhein.',
      );
      return;
    }
    save.mutate({
      teacherStaffId: staffId,
      teacherAssignmentId: form.teacherAssignmentId,
      dayOfWeek: form.dayOfWeek,
      startTime: form.startTime,
      endTime: form.endTime,
      ...(form.room.trim() ? { room: form.room.trim() } : {}),
    });
  }

  return (
    <StaffAccess
      access={access.data}
      error={access.error}
      loading={access.isPending}
      onRetry={() => void access.refetch()}
      requiredPermission="staff.read"
    >
      {() => {
        if (staff.isPending)
          return <LoadingState message="Teacher profile load ho rahi hai..." />;
        if (staff.isError || !staff.data)
          return (
            <ErrorState
              title="Teacher unavailable"
              description={apiMessage(staff.error)}
              onRetry={() => void staff.refetch()}
            />
          );
        const teacher = staff.data.staff;
        const entries = timetable.data?.items ?? [];
        return (
          <main className="page-stack student-management-page staff-management-page reference-live-module">
            <WorkspacePageHeading
              className="student-page-heading"
              eyebrow="Teacher & staff"
              title={`${teacher.firstName} ${teacher.lastName} — Timetable`}
              description="Teacher ke weekly periods manage karein. Har entry assigned class, section, subject aur academic year se linked hoti hai."
              aside={
                <div className="student-page-actions">
                  <Link
                    className="button button-secondary"
                    to={`/admin/organizations/${encodeURIComponent(organizationId)}/staff/${encodeURIComponent(staffId)}`}
                  >
                    View Profile
                  </Link>
                  <Link
                    className="button button-secondary"
                    to={`/admin/organizations/${encodeURIComponent(organizationId)}/staff`}
                  >
                    Back to staff
                  </Link>
                </div>
              }
            />
            <section className="student-form-panel panel teacher-timetable-form">
              <div className="student-detail-heading">
                <h2>
                  {editingId ? 'Edit timetable period' : 'Add timetable period'}
                </h2>
              </div>
              {!canManage ? (
                <p className="muted-copy">
                  Aap ke account ko timetable edit karne ki permission nahi hai.
                  Aap timetable dekh sakte hain.
                </p>
              ) : assignments.length === 0 ? (
                <p className="muted-copy">
                  Is teacher ko abhi koi subject/class/section assignment nahi
                  diya gaya. Pehle Academics → Teacher Assignments mein
                  assignment create karein, phir timetable set karein.
                </p>
              ) : (
                <form onSubmit={submitForm}>
                  <div className="teacher-timetable-fields">
                    <label className="form-field">
                      <span>Class / subject assignment</span>
                      <select
                        value={form.teacherAssignmentId}
                        onChange={(event) =>
                          setForm({
                            ...form,
                            teacherAssignmentId: event.target.value,
                          })
                        }
                        required
                      >
                        <option value="">Select assignment</option>
                        {assignments.map((item) => (
                          <option key={item.id} value={item.id}>
                            {assignmentLabel(item.id)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="form-field">
                      <span>Day</span>
                      <select
                        value={form.dayOfWeek}
                        onChange={(event) =>
                          setForm({
                            ...form,
                            dayOfWeek: event.target.value as TimetableDay,
                          })
                        }
                      >
                        {days.map((day) => (
                          <option key={day.value} value={day.value}>
                            {day.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="form-field">
                      <span>Start time</span>
                      <input
                        type="time"
                        value={form.startTime}
                        onChange={(event) =>
                          setForm({ ...form, startTime: event.target.value })
                        }
                        required
                      />
                    </label>
                    <label className="form-field">
                      <span>End time</span>
                      <input
                        type="time"
                        value={form.endTime}
                        onChange={(event) =>
                          setForm({ ...form, endTime: event.target.value })
                        }
                        required
                      />
                    </label>
                    <label className="form-field">
                      <span>Room (optional)</span>
                      <input
                        maxLength={80}
                        value={form.room}
                        onChange={(event) =>
                          setForm({ ...form, room: event.target.value })
                        }
                        placeholder="e.g. Room 204"
                      />
                    </label>
                  </div>
                  {formError && (
                    <p className="form-error" role="alert">
                      {formError}
                    </p>
                  )}
                  <div className="button-row">
                    <Button disabled={save.isPending} type="submit">
                      {save.isPending
                        ? 'Saving…'
                        : editingId
                          ? 'Save changes'
                          : 'Add to timetable'}
                    </Button>
                    {editingId && (
                      <Button
                        variant="secondary"
                        type="button"
                        onClick={() => {
                          setEditingId(undefined);
                          setForm(emptyForm);
                          setFormError('');
                        }}
                      >
                        Cancel edit
                      </Button>
                    )}
                  </div>
                </form>
              )}
            </section>
            <section className="student-list-panel panel">
              <div className="student-detail-heading">
                <h2>Weekly timetable</h2>
                <span className="muted-copy">{entries.length} periods</span>
              </div>
              {timetable.isPending ? (
                <LoadingState message="Timetable load ho raha hai..." />
              ) : timetable.isError ? (
                <ErrorState
                  title="Timetable unavailable"
                  description={apiMessage(timetable.error)}
                  onRetry={() => void timetable.refetch()}
                />
              ) : entries.length === 0 ? (
                <p className="muted-copy">
                  Abhi timetable set nahi hua. Upar form se pehla period add
                  karein.
                </p>
              ) : (
                <div className="teacher-timetable-list">
                  {days.map((day) => {
                    const dayEntries = entries
                      .filter((entry) => entry.dayOfWeek === day.value)
                      .sort((a, b) => a.startTime.localeCompare(b.startTime));
                    if (!dayEntries.length) return null;
                    return (
                      <section
                        className="teacher-timetable-day"
                        key={day.value}
                      >
                        <h3>{day.label}</h3>
                        {dayEntries.map((entry) => (
                          <article
                            className="teacher-timetable-entry"
                            key={entry.id}
                          >
                            <div className="teacher-timetable-time">
                              <strong>
                                {entry.startTime}–{entry.endTime}
                              </strong>
                              <span>{entry.room || 'Room not set'}</span>
                            </div>
                            <div className="teacher-timetable-copy">
                              <strong>
                                {assignmentLabel(entry.teacherAssignmentId)}
                              </strong>
                            </div>
                            <div className="teacher-timetable-actions">
                              {canManage && (
                                <Button
                                  variant="secondary"
                                  onClick={() => editEntry(entry)}
                                >
                                  Edit
                                </Button>
                              )}
                              {canManage && (
                                <Button
                                  variant="danger"
                                  disabled={remove.isPending}
                                  onClick={() => {
                                    setFormError('');
                                    remove.mutate(entry.id);
                                  }}
                                >
                                  Delete
                                </Button>
                              )}
                            </div>
                          </article>
                        ))}
                      </section>
                    );
                  })}
                </div>
              )}
            </section>
          </main>
        );
      }}
    </StaffAccess>
  );
}
