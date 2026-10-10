import mongoose from 'mongoose';
import { AppError } from '../../errors/app-error.js';
import type {
  AcademicYearInput,
  AcademicYearRecord,
  AcademicCampusChoice,
  AcademicsContext,
  AcademicsRepository,
  ClassInput,
  SectionInput,
  SubjectInput,
  TeacherAssignmentInput,
  TermInput,
} from './academics.types.js';

function requiredText(
  value: string | undefined,
  field: string,
  max: number,
): string {
  const text = value?.trim();
  if (!text || text.length > max)
    throw new AppError(400, 'VALIDATION_ERROR', `Enter a valid ${field}.`);
  return text;
}

function validDate(value: string | undefined, field: string): string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new AppError(400, 'VALIDATION_ERROR', `Enter a valid ${field}.`);
  const date = new Date(`${value}T00:00:00.000Z`);
  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    throw new AppError(400, 'VALIDATION_ERROR', `Enter a valid ${field}.`);
  }
  return value;
}

function assertDateRange(startDate: string, endDate: string): void {
  if (startDate >= endDate)
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'The end date must be after the start date.',
    );
}

function objectId(value: string | undefined, field: string): string {
  if (!value || !mongoose.isValidObjectId(value))
    throw new AppError(400, 'VALIDATION_ERROR', `Select a valid ${field}.`);
  return value;
}

function assertCampusScope(context: AcademicsContext, campusId: string): void {
  if (
    (context.role === 'campus_admin' || context.campusIds.length > 0) &&
    !context.campusIds.includes(campusId)
  ) {
    throw new AppError(
      403,
      'CAMPUS_FORBIDDEN',
      'You are not authorized for this campus.',
    );
  }
}

export class AcademicsService {
  constructor(private readonly repository: AcademicsRepository) {}

  listCampuses(context: AcademicsContext): Promise<AcademicCampusChoice[]> {
    return this.repository.listCampuses(
      context.organizationId,
      this.scope(context),
    );
  }

  private scope(context: AcademicsContext): string[] | undefined {
    if (context.role === 'campus_admin' && context.campusIds.length === 0)
      return [];
    return context.campusIds.length ? context.campusIds : undefined;
  }

  listAcademicYears(context: AcademicsContext) {
    return this.repository.listAcademicYears(context.organizationId);
  }
  getAcademicYear(context: AcademicsContext, id: string) {
    return this.required(
      this.repository.getAcademicYear(context.organizationId, id),
      'ACADEMIC_YEAR_NOT_FOUND',
      'Academic year',
    );
  }
  async createAcademicYear(
    context: AcademicsContext,
    input: AcademicYearInput,
  ) {
    const startDate = validDate(input.startDate, 'start date');
    const endDate = validDate(input.endDate, 'end date');
    assertDateRange(startDate, endDate);
    return this.repository.createAcademicYear(context.organizationId, {
      name: requiredText(input.name, 'academic year name', 100),
      startDate,
      endDate,
      status: this.yearStatus(input.status),
    });
  }
  async updateAcademicYear(
    context: AcademicsContext,
    id: string,
    input: Partial<AcademicYearInput>,
  ) {
    const changes: Partial<AcademicYearInput> = { ...input };
    if (input.name !== undefined)
      changes.name = requiredText(input.name, 'academic year name', 100);
    if (input.startDate !== undefined)
      changes.startDate = validDate(input.startDate, 'start date');
    if (input.endDate !== undefined)
      changes.endDate = validDate(input.endDate, 'end date');
    if (input.status !== undefined)
      changes.status = this.yearStatus(input.status);
    const existing = await this.required(
      this.repository.getAcademicYear(context.organizationId, id),
      'ACADEMIC_YEAR_NOT_FOUND',
      'Academic year',
    );
    const startDate = changes.startDate ?? existing.startDate;
    const endDate = changes.endDate ?? existing.endDate;
    assertDateRange(startDate, endDate);
    if (
      !(await this.repository.termsFitAcademicYear(
        context.organizationId,
        id,
        startDate,
        endDate,
      ))
    ) {
      throw new AppError(
        409,
        'RESOURCE_IN_USE',
        'The academic year cannot exclude dates used by existing terms.',
      );
    }
    return this.required(
      this.repository.updateAcademicYear(context.organizationId, id, changes),
      'ACADEMIC_YEAR_NOT_FOUND',
      'Academic year',
    );
  }
  async deleteAcademicYear(context: AcademicsContext, id: string) {
    await this.required(
      this.repository.getAcademicYear(context.organizationId, id),
      'ACADEMIC_YEAR_NOT_FOUND',
      'Academic year',
    );
    await this.assertUnreferenced(context, 'academicYear', id);
    return this.repository.deleteAcademicYear(context.organizationId, id);
  }

  listTerms(context: AcademicsContext, academicYearId?: string) {
    return this.repository.listTerms(context.organizationId, academicYearId);
  }
  async getTerm(context: AcademicsContext, id: string) {
    return this.required(
      this.repository.getTerm(context.organizationId, id),
      'TERM_NOT_FOUND',
      'Term',
    );
  }
  async createTerm(context: AcademicsContext, input: TermInput) {
    const normalized = this.termInput(input);
    const year = await this.required(
      this.repository.getAcademicYear(
        context.organizationId,
        normalized.academicYearId,
      ),
      'ACADEMIC_YEAR_NOT_FOUND',
      'Academic year',
    );
    this.assertWithinYear(normalized, year);
    return this.repository.createTerm(context.organizationId, normalized);
  }
  async updateTerm(
    context: AcademicsContext,
    id: string,
    input: Partial<TermInput>,
  ) {
    const existing = await this.getTerm(context, id);
    const normalized = this.termInput({ ...existing, ...input });
    const year = await this.required(
      this.repository.getAcademicYear(
        context.organizationId,
        normalized.academicYearId,
      ),
      'ACADEMIC_YEAR_NOT_FOUND',
      'Academic year',
    );
    this.assertWithinYear(normalized, year);
    return this.required(
      this.repository.updateTerm(context.organizationId, id, normalized),
      'TERM_NOT_FOUND',
      'Term',
    );
  }
  async deleteTerm(context: AcademicsContext, id: string) {
    await this.getTerm(context, id);
    return this.repository.deleteTerm(context.organizationId, id);
  }

  listClasses(context: AcademicsContext) {
    return this.repository.listClasses(
      context.organizationId,
      this.scope(context),
    );
  }
  async getClass(context: AcademicsContext, id: string) {
    return this.required(
      this.repository.getClass(context.organizationId, id, this.scope(context)),
      'CLASS_NOT_FOUND',
      'Class',
    );
  }
  async createClass(context: AcademicsContext, input: ClassInput) {
    const campusId = objectId(input.campusId, 'campus');
    assertCampusScope(context, campusId);
    return this.repository.createClass(context.organizationId, {
      name: requiredText(input.name, 'class name', 100),
      code: requiredText(input.code, 'class code', 30).toUpperCase(),
      campusId,
    });
  }
  async updateClass(
    context: AcademicsContext,
    id: string,
    input: Partial<ClassInput>,
  ) {
    const existing = await this.getClass(context, id);
    const changes: Partial<ClassInput> = { ...input };
    if (input.name !== undefined)
      changes.name = requiredText(input.name, 'class name', 100);
    if (input.code !== undefined)
      changes.code = requiredText(input.code, 'class code', 30).toUpperCase();
    if (input.campusId !== undefined) {
      changes.campusId = objectId(input.campusId, 'campus');
      assertCampusScope(context, changes.campusId);
    }
    return this.required(
      this.repository.updateClass(context.organizationId, id, changes),
      'CLASS_NOT_FOUND',
      existing.name,
    );
  }
  async deleteClass(context: AcademicsContext, id: string) {
    await this.getClass(context, id);
    await this.assertUnreferenced(context, 'class', id);
    return this.repository.deleteClass(context.organizationId, id);
  }

  listSections(context: AcademicsContext, classId?: string) {
    return this.repository.listSections(
      context.organizationId,
      classId,
      this.scope(context),
    );
  }
  async getSection(context: AcademicsContext, id: string) {
    return this.required(
      this.repository.getSection(
        context.organizationId,
        id,
        this.scope(context),
      ),
      'SECTION_NOT_FOUND',
      'Section',
    );
  }
  async createSection(context: AcademicsContext, input: SectionInput) {
    const classId = objectId(input.classId, 'class');
    await this.getClass(context, classId);
    return this.repository.createSection(
      context.organizationId,
      this.sectionInput({ ...input, classId }),
    );
  }
  async updateSection(
    context: AcademicsContext,
    id: string,
    input: Partial<SectionInput>,
  ) {
    const existing = await this.getSection(context, id);
    const classId =
      input.classId === undefined
        ? existing.classId
        : objectId(input.classId, 'class');
    await this.getClass(context, classId);
    if (
      classId !== existing.classId &&
      (await this.repository.hasReference(
        context.organizationId,
        'section',
        id,
      ))
    ) {
      throw new AppError(
        409,
        'RESOURCE_IN_USE',
        'A section with teacher assignments cannot be moved to another class.',
      );
    }
    return this.required(
      this.repository.updateSection(
        context.organizationId,
        id,
        this.sectionInput({ ...existing, ...input, classId }),
      ),
      'SECTION_NOT_FOUND',
      'Section',
    );
  }
  async deleteSection(context: AcademicsContext, id: string) {
    await this.getSection(context, id);
    await this.assertUnreferenced(context, 'section', id);
    return this.repository.deleteSection(context.organizationId, id);
  }

  listSubjects(context: AcademicsContext) {
    return this.repository.listSubjects(context.organizationId);
  }
  async getSubject(context: AcademicsContext, id: string) {
    return this.required(
      this.repository.getSubject(context.organizationId, id),
      'SUBJECT_NOT_FOUND',
      'Subject',
    );
  }
  async createSubject(context: AcademicsContext, input: SubjectInput) {
    return this.repository.createSubject(
      context.organizationId,
      this.subjectInput(input),
    );
  }
  async updateSubject(
    context: AcademicsContext,
    id: string,
    input: Partial<SubjectInput>,
  ) {
    await this.getSubject(context, id);
    const changes = { ...input };
    if (input.name !== undefined)
      changes.name = requiredText(input.name, 'subject name', 120);
    if (input.code !== undefined)
      changes.code = requiredText(input.code, 'subject code', 30).toUpperCase();
    if (input.department !== undefined)
      changes.department = input.department.trim()
        ? requiredText(input.department, 'department', 100)
        : '';
    return this.required(
      this.repository.updateSubject(context.organizationId, id, changes),
      'SUBJECT_NOT_FOUND',
      'Subject',
    );
  }
  async deleteSubject(context: AcademicsContext, id: string) {
    await this.getSubject(context, id);
    await this.assertUnreferenced(context, 'subject', id);
    return this.repository.deleteSubject(context.organizationId, id);
  }

  listTeacherAssignments(context: AcademicsContext) {
    return this.repository.listTeacherAssignments(
      context.organizationId,
      this.scope(context),
    );
  }
  async getTeacherAssignment(context: AcademicsContext, id: string) {
    return this.required(
      this.repository.getTeacherAssignment(
        context.organizationId,
        id,
        this.scope(context),
      ),
      'TEACHER_ASSIGNMENT_NOT_FOUND',
      'Teacher assignment',
    );
  }
  async createTeacherAssignment(
    context: AcademicsContext,
    input: TeacherAssignmentInput,
  ) {
    const normalized = this.assignmentInput(input);
    await this.validateAssignmentReferences(context, normalized);
    await this.assertNoTeacherConflict(context, normalized);
    return this.repository.createTeacherAssignment(
      context.organizationId,
      normalized,
    );
  }
  async updateTeacherAssignment(
    context: AcademicsContext,
    id: string,
    input: TeacherAssignmentInput,
  ) {
    await this.getTeacherAssignment(context, id);
    const normalized = this.assignmentInput(input);
    await this.validateAssignmentReferences(context, normalized);
    await this.assertNoTeacherConflict(context, normalized, id);
    return this.required(
      this.repository.updateTeacherAssignment(
        context.organizationId,
        id,
        normalized,
      ),
      'TEACHER_ASSIGNMENT_NOT_FOUND',
      'Teacher assignment',
    );
  }
  async deleteTeacherAssignment(context: AcademicsContext, id: string) {
    await this.getTeacherAssignment(context, id);
    return this.repository.deleteTeacherAssignment(context.organizationId, id);
  }

  private termInput(input: TermInput): TermInput {
    const startDate = validDate(input.startDate, 'term start date');
    const endDate = validDate(input.endDate, 'term end date');
    assertDateRange(startDate, endDate);
    return {
      name: requiredText(input.name, 'term name', 100),
      academicYearId: objectId(input.academicYearId, 'academic year'),
      startDate,
      endDate,
    };
  }

  private assertWithinYear(term: TermInput, year: AcademicYearRecord): void {
    if (
      term.startDate < year.startDate.slice(0, 10) ||
      term.endDate > year.endDate.slice(0, 10)
    ) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'The term dates must fall within the academic year.',
      );
    }
  }

  private sectionInput(input: SectionInput): SectionInput {
    const capacity = input.capacity;
    if (
      capacity !== undefined &&
      capacity !== null &&
      (!Number.isInteger(capacity) || capacity < 1 || capacity > 10000)
    ) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Enter a valid section capacity.',
      );
    }
    return {
      name: requiredText(input.name, 'section name', 80),
      classId: objectId(input.classId, 'class'),
      ...(capacity === undefined || capacity === null
        ? { ...(capacity === null ? { capacity: null } : {}) }
        : { capacity }),
    };
  }

  private subjectInput(input: SubjectInput): SubjectInput {
    return {
      name: requiredText(input.name, 'subject name', 120),
      code: requiredText(input.code, 'subject code', 30).toUpperCase(),
      ...(input.department?.trim()
        ? { department: requiredText(input.department, 'department', 100) }
        : {}),
    };
  }

  private assignmentInput(
    input: TeacherAssignmentInput,
  ): TeacherAssignmentInput {
    return {
      teacherStaffId: objectId(input.teacherStaffId, 'teacher'),
      subjectId: objectId(input.subjectId, 'subject'),
      classId: objectId(input.classId, 'class'),
      sectionId: objectId(input.sectionId, 'section'),
      academicYearId: objectId(input.academicYearId, 'academic year'),
    };
  }

  private async validateAssignmentReferences(
    context: AcademicsContext,
    input: TeacherAssignmentInput,
  ): Promise<void> {
    if (
      !(await this.repository.validateStaff(
        context.organizationId,
        input.teacherStaffId,
      ))
    )
      throw new AppError(404, 'STAFF_MEMBER_NOT_FOUND', 'Teacher not found.');
    if (
      !(await this.repository.validateSubject(
        context.organizationId,
        input.subjectId,
      ))
    )
      throw new AppError(404, 'SUBJECT_NOT_FOUND', 'Subject not found.');
    const classRecord = await this.getClass(context, input.classId);
    const section = await this.getSection(context, input.sectionId);
    if (section.classId !== classRecord.id)
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'The section must belong to the selected class.',
      );
    if (
      !(await this.repository.validateAcademicYear(
        context.organizationId,
        input.academicYearId,
      ))
    )
      throw new AppError(
        404,
        'ACADEMIC_YEAR_NOT_FOUND',
        'Academic year not found.',
      );
  }

  private async assertNoTeacherConflict(
    context: AcademicsContext,
    input: TeacherAssignmentInput,
    exceptId?: string,
  ): Promise<void> {
    if (
      await this.repository.findTeacherAssignmentConflict(
        context.organizationId,
        input,
        exceptId,
      )
    ) {
      throw new AppError(
        409,
        'TEACHER_ASSIGNMENT_CONFLICT',
        'This teacher is already assigned to the selected section for this academic year.',
      );
    }
  }

  private async assertUnreferenced(
    context: AcademicsContext,
    resource: 'academicYear' | 'class' | 'section' | 'subject',
    id: string,
  ): Promise<void> {
    if (
      await this.repository.hasReference(context.organizationId, resource, id)
    ) {
      throw new AppError(
        409,
        'RESOURCE_IN_USE',
        'This record is in use and cannot be deleted.',
      );
    }
  }

  private yearStatus(value: string | undefined): 'active' | 'archived' {
    if (value === undefined || value === 'active') return 'active';
    if (value === 'archived') return value;
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'Select a valid academic year status.',
    );
  }

  private required<T>(
    value: Promise<T | null>,
    code: string,
    label: string,
  ): Promise<T> {
    return value.then((record) => {
      if (record === null) throw new AppError(404, code, `${label} not found.`);
      return record;
    });
  }
}
