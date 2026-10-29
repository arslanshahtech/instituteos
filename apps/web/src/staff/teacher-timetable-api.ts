import { apiRequest } from '../api/client.js';

export type TimetableDay =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

export interface TeacherTimetableEntry {
  id: string;
  teacherStaffId: string;
  teacherAssignmentId: string;
  dayOfWeek: TimetableDay;
  startTime: string;
  endTime: string;
  room?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TeacherTimetableInput {
  teacherStaffId: string;
  teacherAssignmentId: string;
  dayOfWeek: TimetableDay;
  startTime: string;
  endTime: string;
  room?: string;
}

const path = (organizationId: string) =>
  `/organizations/${encodeURIComponent(organizationId)}/teacher-timetable`;

export function listTeacherTimetable(organizationId: string, staffId: string) {
  return apiRequest<{ items: TeacherTimetableEntry[] }>(
    `${path(organizationId)}/${encodeURIComponent(staffId)}`,
  );
}

export function saveTeacherTimetableEntry(
  organizationId: string,
  id: string | undefined,
  input: TeacherTimetableInput,
) {
  return apiRequest<{ item: TeacherTimetableEntry }>(
    `${path(organizationId)}${id ? `/${encodeURIComponent(id)}` : ''}`,
    { method: id ? 'PATCH' : 'POST', body: JSON.stringify(input) },
  );
}

export function deleteTeacherTimetableEntry(
  organizationId: string,
  id: string,
) {
  return apiRequest<void>(`${path(organizationId)}/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}
