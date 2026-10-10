export type AcademicYearStatus = 'active' | 'archived';

export interface AcademicsContext {
  organizationId: string;
  campusIds: string[];
  role: string;
}

export interface AcademicCampusChoice {
  id: string;
  name: string;
}

export interface AcademicYearInput {
  name: string;
  startDate: string;
  endDate: string;
  status?: AcademicYearStatus;
}

export interface AcademicYearRecord extends AcademicYearInput {
  id: string;
  organizationId: string;
  status: AcademicYearStatus;
  createdAt: string;
  updatedAt: string;
}

export interface TermInput {
  name: string;
  academicYearId: string;
  startDate: string;
  endDate: string;
}

export interface TermRecord extends TermInput {
  id: string;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ClassInput {
  name: string;
  code: string;
  campusId: string;
}

export interface ClassRecord extends ClassInput {
  id: string;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
}

export interface SectionInput {
  name: string;
  classId: string;
  capacity?: number | null;
}

export interface SectionRecord extends Omit<SectionInput, 'capacity'> {
  id: string;
  organizationId: string;
  capacity?: number;
  createdAt: string;
  updatedAt: string;
}

export interface SubjectInput {
  name: string;
  code: string;
  department?: string;
}

export interface SubjectRecord extends SubjectInput {
  id: string;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
}

export interface TeacherAssignmentInput {
  teacherStaffId: string;
  subjectId: string;
  classId: string;
  sectionId: string;
  academicYearId: string;
}

export interface TeacherAssignmentRecord extends TeacherAssignmentInput {
  id: string;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
}

export interface AcademicsRepository {
  listCampuses(
    organizationId: string,
    campusIds?: string[],
  ): Promise<AcademicCampusChoice[]>;
  listAcademicYears(organizationId: string): Promise<AcademicYearRecord[]>;
  getAcademicYear(
    organizationId: string,
    id: string,
  ): Promise<AcademicYearRecord | null>;
  termsFitAcademicYear(
    organizationId: string,
    id: string,
    startDate: string,
    endDate: string,
  ): Promise<boolean>;
  createAcademicYear(
    organizationId: string,
    input: AcademicYearInput,
  ): Promise<AcademicYearRecord>;
  updateAcademicYear(
    organizationId: string,
    id: string,
    input: Partial<AcademicYearInput>,
  ): Promise<AcademicYearRecord | null>;
  deleteAcademicYear(organizationId: string, id: string): Promise<boolean>;
  listTerms(
    organizationId: string,
    academicYearId?: string,
  ): Promise<TermRecord[]>;
  getTerm(organizationId: string, id: string): Promise<TermRecord | null>;
  createTerm(organizationId: string, input: TermInput): Promise<TermRecord>;
  updateTerm(
    organizationId: string,
    id: string,
    input: Partial<TermInput>,
  ): Promise<TermRecord | null>;
  deleteTerm(organizationId: string, id: string): Promise<boolean>;
  listClasses(
    organizationId: string,
    campusIds?: string[],
  ): Promise<ClassRecord[]>;
  getClass(
    organizationId: string,
    id: string,
    campusIds?: string[],
  ): Promise<ClassRecord | null>;
  createClass(organizationId: string, input: ClassInput): Promise<ClassRecord>;
  updateClass(
    organizationId: string,
    id: string,
    input: Partial<ClassInput>,
  ): Promise<ClassRecord | null>;
  deleteClass(organizationId: string, id: string): Promise<boolean>;
  listSections(
    organizationId: string,
    classId?: string,
    campusIds?: string[],
  ): Promise<SectionRecord[]>;
  getSection(
    organizationId: string,
    id: string,
    campusIds?: string[],
  ): Promise<SectionRecord | null>;
  createSection(
    organizationId: string,
    input: SectionInput,
  ): Promise<SectionRecord>;
  updateSection(
    organizationId: string,
    id: string,
    input: Partial<SectionInput>,
  ): Promise<SectionRecord | null>;
  deleteSection(organizationId: string, id: string): Promise<boolean>;
  listSubjects(organizationId: string): Promise<SubjectRecord[]>;
  getSubject(organizationId: string, id: string): Promise<SubjectRecord | null>;
  createSubject(
    organizationId: string,
    input: SubjectInput,
  ): Promise<SubjectRecord>;
  updateSubject(
    organizationId: string,
    id: string,
    input: Partial<SubjectInput>,
  ): Promise<SubjectRecord | null>;
  deleteSubject(organizationId: string, id: string): Promise<boolean>;
  listTeacherAssignments(
    organizationId: string,
    campusIds?: string[],
  ): Promise<TeacherAssignmentRecord[]>;
  getTeacherAssignment(
    organizationId: string,
    id: string,
    campusIds?: string[],
  ): Promise<TeacherAssignmentRecord | null>;
  findTeacherAssignmentConflict(
    organizationId: string,
    input: TeacherAssignmentInput,
    exceptId?: string,
  ): Promise<boolean>;
  createTeacherAssignment(
    organizationId: string,
    input: TeacherAssignmentInput,
  ): Promise<TeacherAssignmentRecord>;
  updateTeacherAssignment(
    organizationId: string,
    id: string,
    input: TeacherAssignmentInput,
  ): Promise<TeacherAssignmentRecord | null>;
  deleteTeacherAssignment(organizationId: string, id: string): Promise<boolean>;
  hasReference(
    organizationId: string,
    resource: 'academicYear' | 'class' | 'section' | 'subject',
    id: string,
  ): Promise<boolean>;
  validateAcademicYear(organizationId: string, id: string): Promise<boolean>;
  validateSubject(organizationId: string, id: string): Promise<boolean>;
  validateStaff(organizationId: string, id: string): Promise<boolean>;
}
