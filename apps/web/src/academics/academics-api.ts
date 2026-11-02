import { apiRequest } from '../api/client.js';

export interface AcademicYear {
  id: string;
  organizationId: string;
  name: string;
  startDate: string;
  endDate: string;
  status: 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
}

export interface AcademicTerm {
  id: string;
  organizationId: string;
  name: string;
  academicYearId: string;
  startDate: string;
  endDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface AcademicClass {
  id: string;
  organizationId: string;
  campusId: string;
  name: string;
  code: string;
  sortOrder: number;
  studyLevel?: 'first_year' | 'second_year' | 'other';
  programName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AcademicSection {
  id: string;
  organizationId: string;
  classId: string;
  name: string;
  capacity?: number;
  createdAt: string;
  updatedAt: string;
}

export interface AcademicSubject {
  id: string;
  organizationId: string;
  name: string;
  code: string;
  department?: string;
  classIds?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface TeacherAssignment {
  id: string;
  organizationId: string;
  teacherStaffId: string;
  subjectId: string;
  classId: string;
  sectionId: string;
  academicYearId: string;
  createdAt: string;
  updatedAt: string;
}

export interface AcademicCampus {
  id: string;
  name: string;
}

export type AcademicsResource =
  | 'academic-years'
  | 'terms'
  | 'classes'
  | 'sections'
  | 'subjects'
  | 'teacher-assignments';

export type AcademicsFormPayload = Record<string, string | number | string[]>;

const organizationPath = (organizationId: string) =>
  `/organizations/${encodeURIComponent(organizationId)}`;

function list<T>(organizationId: string, resource: AcademicsResource) {
  return apiRequest<{ items: T[] }>(
    `${organizationPath(organizationId)}/${resource}`,
  );
}

export const listAcademicYears = (organizationId: string) =>
  list<AcademicYear>(organizationId, 'academic-years');
export const listTerms = (organizationId: string) =>
  list<AcademicTerm>(organizationId, 'terms');
export const listAcademicClasses = (organizationId: string) =>
  list<AcademicClass>(organizationId, 'classes');
export const listAcademicSections = (organizationId: string) =>
  list<AcademicSection>(organizationId, 'sections');
export const listAcademicSubjects = (organizationId: string) =>
  list<AcademicSubject>(organizationId, 'subjects');
export const listTeacherAssignments = (organizationId: string) =>
  list<TeacherAssignment>(organizationId, 'teacher-assignments');

export function listAcademicCampuses(organizationId: string) {
  return apiRequest<{ campuses: AcademicCampus[] }>(
    `${organizationPath(organizationId)}/academics/campuses`,
  );
}

export function saveAcademicsResource(
  organizationId: string,
  resource: AcademicsResource,
  id: string | undefined,
  input: AcademicsFormPayload,
): Promise<unknown> {
  return apiRequest(
    `${organizationPath(organizationId)}/${resource}${id ? `/${encodeURIComponent(id)}` : ''}`,
    { method: id ? 'PATCH' : 'POST', body: JSON.stringify(input) },
  );
}

export function deleteAcademicsResource(
  organizationId: string,
  resource: AcademicsResource,
  id: string,
): Promise<void> {
  return apiRequest(
    `${organizationPath(organizationId)}/${resource}/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
  );
}

export interface TeacherTimetableEntry {
  id: string;
  teacherStaffId: string;
  teacherAssignmentId: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  room?: string;
  createdAt: string;
  updatedAt: string;
}

export function listTeacherTimetable(organizationId: string, staffId: string) {
  return apiRequest<{ items: TeacherTimetableEntry[] }>(
    `${organizationPath(organizationId)}/teacher-timetable/${encodeURIComponent(staffId)}`,
  );
}

export function saveTeacherTimetable(
  organizationId: string,
  input: Omit<TeacherTimetableEntry, 'id' | 'createdAt' | 'updatedAt'>,
  id?: string,
) {
  return apiRequest<{ item: TeacherTimetableEntry }>(
    `${organizationPath(organizationId)}/teacher-timetable${id ? `/${encodeURIComponent(id)}` : ''}`,
    { method: id ? 'PATCH' : 'POST', body: JSON.stringify(input) },
  );
}

export function deleteTeacherTimetable(organizationId: string, id: string) {
  return apiRequest<void>(
    `${organizationPath(organizationId)}/teacher-timetable/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
  );
}
