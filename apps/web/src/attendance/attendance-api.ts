import { apiRequest } from '../api/client.js';

export interface TeacherAttendanceAssignment {
  id: string;
  classId: string;
  className: string;
  sectionId: string;
  sectionName: string;
  academicYearId: string;
  academicYearName: string;
  campusId: string;
  campusName: string;
}

export type StudentAttendanceStatus = 'present' | 'absent' | 'leave' | 'late';
export type StaffAttendanceStatus =
  'present' | 'absent' | 'half-day' | 'on-leave';

export interface AttendancePerson {
  id: string;
  firstName: string;
  lastName: string;
  preferredName?: string;
}

export interface StudentRosterMember extends AttendancePerson {
  contactEmail?: string;
  phone?: string;
  status?: StudentAttendanceStatus;
  remarks?: string;
}

export interface StudentAttendanceRecord {
  id: string;
  studentId: string;
  classId: string;
  sectionId: string;
  academicYearId: string;
  campusId: string;
  date: string;
  status: StudentAttendanceStatus;
  remarks?: string;
}

export interface StaffAttendanceRecord {
  id: string;
  staffId: string;
  campusId?: string;
  date: string;
  status: StaffAttendanceStatus;
  remarks?: string;
}

const organizationPath = (organizationId: string) =>
  `/organizations/${encodeURIComponent(organizationId)}`;

export function listTeacherAttendanceAssignments(organizationId: string) {
  return apiRequest<{ items: TeacherAttendanceAssignment[] }>(
    `${organizationPath(organizationId)}/attendance/teacher-assignments`,
  );
}

function queryString(values: Record<string, string>) {
  return new URLSearchParams(values).toString();
}

export function getStudentRoster(
  organizationId: string,
  input: {
    classId: string;
    sectionId: string;
    academicYearId: string;
    campusId: string;
    date: string;
  },
) {
  return apiRequest<{ items: StudentRosterMember[] }>(
    `${organizationPath(organizationId)}/attendance/students/roster?${queryString(input)}`,
  );
}

export function getEligibleStudents(
  organizationId: string,
  campusId: string,
  academicYearId: string,
) {
  return apiRequest<{ items: AttendancePerson[] }>(
    `${organizationPath(organizationId)}/attendance/students/eligible?${queryString({ campusId, academicYearId })}`,
  );
}

export function placeStudent(
  organizationId: string,
  input: {
    studentId: string;
    classId: string;
    sectionId: string;
    academicYearId: string;
    campusId: string;
  },
) {
  return apiRequest(
    `${organizationPath(organizationId)}/attendance/students/placements`,
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export function removeStudentFromSection(
  organizationId: string,
  studentId: string,
  input: { classId: string; sectionId: string; academicYearId: string; campusId: string },
) {
  return apiRequest<{ removed: boolean }>(
    `${organizationPath(organizationId)}/attendance/students/placements/${encodeURIComponent(studentId)}`,
    { method: 'DELETE', body: JSON.stringify(input) },
  );
}

export function bulkPlaceStudents(
  organizationId: string,
  input: {
    studentIds: string[];
    classId: string;
    sectionId: string;
    academicYearId: string;
    campusId: string;
  },
) {
  return apiRequest<{
    added: string[];
    skipped: string[];
    failed: Array<{ studentId: string; message: string }>;
  }>(
    `${organizationPath(organizationId)}/attendance/students/placements/bulk`,
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export function saveStudentAttendance(
  organizationId: string,
  input: {
    classId: string;
    sectionId: string;
    academicYearId: string;
    campusId: string;
    date: string;
    records: Array<{
      studentId: string;
      status: StudentAttendanceStatus;
      remarks?: string;
    }>;
  },
) {
  return apiRequest<{ items: StudentAttendanceRecord[] }>(
    `${organizationPath(organizationId)}/attendance/students/bulk`,
    { method: 'PUT', body: JSON.stringify(input) },
  );
}

export function listStudentAttendance(
  organizationId: string,
  input: { dateFrom?: string; dateTo?: string; sectionId?: string },
) {
  const query = Object.fromEntries(
    Object.entries(input).filter((entry): entry is [string, string] =>
      Boolean(entry[1]),
    ),
  );
  return apiRequest<{ items: StudentAttendanceRecord[] }>(
    `${organizationPath(organizationId)}/attendance/students?${queryString(query)}`,
  );
}

export function listStaffAttendance(
  organizationId: string,
  input: { dateFrom?: string; dateTo?: string; campusId?: string },
) {
  const query = Object.fromEntries(
    Object.entries(input).filter((entry): entry is [string, string] =>
      Boolean(entry[1]),
    ),
  );
  return apiRequest<{ items: StaffAttendanceRecord[] }>(
    `${organizationPath(organizationId)}/attendance/staff?${queryString(query)}`,
  );
}

export function saveStaffAttendance(
  organizationId: string,
  input: {
    staffId: string;
    date: string;
    status: StaffAttendanceStatus;
    remarks?: string;
  },
) {
  return apiRequest<{ attendance: StaffAttendanceRecord }>(
    `${organizationPath(organizationId)}/attendance/staff`,
    { method: 'POST', body: JSON.stringify(input) },
  );
}
