import { apiRequest } from '../api/client.js';

export interface AcademicYear {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  startDate: string;
  endDate: string;
  status: 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
}

export interface AcademicYearSummary {
  totals: { classes: number; sections: number; students: number };
  bySession: Array<{
    academicYearId: string;
    classes: number;
    sections: number;
    students: number;
  }>;
  bySection: Array<{
    academicYearId: string;
    sectionId: string;
    students: number;
  }>;
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

export type SubjectMarkComponentKey = 'theory' | 'practical' | 'viva';

export interface SubjectMarkComponent {
  key: SubjectMarkComponentKey;
  label: string;
  totalMarks: number;
  passingMarks: number;
  enabled: boolean;
}

export interface AcademicSubject {
  id: string;
  organizationId: string;
  name: string;
  code: string;
  classIds?: string[];
  totalMarks?: number;
  passingPercentage?: number;
  markComponents?: SubjectMarkComponent[];
  description?: string;
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
  'academic-years' | 'terms' | 'classes' | 'sections' | 'subjects';

export type AcademicsFormPayload = Record<
  string,
  string | number | boolean | string[] | SubjectMarkComponent[]
>;

const organizationPath = (organizationId: string) =>
  `/organizations/${encodeURIComponent(organizationId)}`;

function list<T>(organizationId: string, resource: AcademicsResource) {
  return apiRequest<{ items: T[] }>(
    `${organizationPath(organizationId)}/${resource}`,
  );
}

export const listAcademicYears = (organizationId: string) =>
  list<AcademicYear>(organizationId, 'academic-years');
export function getAcademicYearSummary(organizationId: string) {
  return apiRequest<{ summary: AcademicYearSummary }>(
    organizationPath(organizationId) + '/academic-years/summary',
  );
}
export const listTerms = (organizationId: string) =>
  list<AcademicTerm>(organizationId, 'terms');
export const listAcademicClasses = (organizationId: string) =>
  list<AcademicClass>(organizationId, 'classes');
export const listAcademicSections = (organizationId: string) =>
  list<AcademicSection>(organizationId, 'sections');
export const listAcademicSubjects = (organizationId: string) =>
  list<AcademicSubject>(organizationId, 'subjects');

export const listTeacherAssignments = (organizationId: string) =>
  apiRequest<{ items: TeacherAssignment[] }>(
    `${organizationPath(organizationId)}/teacher-assignments`,
  );

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

export type TimetableEntryType = 'class' | 'break' | 'activity';
export type AcademicWeekDay =
  | 'sunday'
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday';
export interface SectionTimetableEntry {
  id?: string;
  type: TimetableEntryType;
  dayOfWeek: AcademicWeekDay;
  startTime: string;
  endTime: string;
  subjectId?: string;
  teacherStaffId?: string;
  additionalTeacherStaffId?: string;
  room?: string;
  name?: string;
  description?: string;
}
export interface SectionTimetable {
  id: string;
  organizationId: string;
  academicYearId: string;
  sectionId: string;
  workingDays: AcademicWeekDay[];
  entries: SectionTimetableEntry[];
  createdAt: string;
  updatedAt: string;
}
export interface SectionTimetableInput {
  academicYearId: string;
  sectionId: string;
  workingDays: AcademicWeekDay[];
  entries: SectionTimetableEntry[];
}
export function listSectionTimetables(
  organizationId: string,
  academicYearId: string,
) {
  return apiRequest<{ items: SectionTimetable[] }>(
    `${organizationPath(organizationId)}/section-timetables?academicYearId=${encodeURIComponent(academicYearId)}`,
  );
}
export function saveSectionTimetable(
  organizationId: string,
  input: SectionTimetableInput,
) {
  return apiRequest<{ item: SectionTimetable }>(
    `${organizationPath(organizationId)}/section-timetables`,
    { method: 'POST', body: JSON.stringify(input) },
  );
}
export function deleteSectionTimetable(organizationId: string, id: string) {
  return apiRequest<void>(
    `${organizationPath(organizationId)}/section-timetables/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
  );
}
export interface BulkBreakInput {
  academicYearId: string;
  name: string;
  startTime: string;
  endTime: string;
  days: AcademicWeekDay[];
  sectionIds?: string[];
}
export function addBulkBreak(organizationId: string, input: BulkBreakInput) {
  return apiRequest<{
    added: number;
    skipped: Array<{ sectionId: string; sectionName: string; day: string }>;
  }>(`${organizationPath(organizationId)}/section-timetables/bulk-break`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
