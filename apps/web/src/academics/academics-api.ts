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

export type AcademicsFormPayload = Record<string, string | number>;

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
