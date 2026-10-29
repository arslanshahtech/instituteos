import { AppError } from '../../errors/app-error.js';
import type {
  ApplicationInput,
  ApplicationRecord,
  ApplicationStatus,
  GuardianInput,
  GuardianStudentRelation,
  GuardianRecord,
  PeopleAccessContext,
  InquiryInput,
  InquiryRecord,
  PeopleRepository,
  QuerySummary,
  StaffInput,
  StaffRecord,
  StudentInput,
  StudentRecord,
  StudentGuardianRelation,
  StudentStatus,
} from './people.types.js';

const TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  draft: ['submitted', 'rejected'],
  submitted: ['in_review', 'approved', 'rejected'],
  in_review: ['approved', 'rejected'],
  approved: ['admitted'],
  rejected: [],
  admitted: [],
};

function emptyPage<T>(page?: number, pageSize?: number): QuerySummary<T> {
  return {
    items: [],
    total: 0,
    page: Math.max(1, Number(page) || 1),
    pageSize: Math.min(100, Math.max(1, Number(pageSize) || 20)),
  };
}

function normalizeName(value: string | undefined, field: string): string {
  const trimmed = value?.trim();
  if (!trimmed || trimmed.length < 2 || trimmed.length > 80)
    throw new AppError(400, 'VALIDATION_ERROR', `Enter a valid ${field}.`);
  return trimmed;
}

function normalizeOptionalEmail(value: string | undefined): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const normalized = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized))
    throw new AppError(400, 'VALIDATION_ERROR', 'Enter a valid email address.');
  return normalized;
}

function normalizeOptionalDate(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value.slice(0, 10)
  ) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Enter a valid birth date.');
  }
  return date.toISOString();
}

function normalizeOptionalDateOnly(
  value: string | undefined,
): string | undefined {
  if (!value) return undefined;
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Enter a valid birth date.');
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Enter a valid birth date.');
  }
  return value;
}

function normalizeStatus(
  value: string | undefined,
  allowed: readonly string[],
  field: string,
): string {
  if (!value) return allowed[0];
  if (!allowed.includes(value))
    throw new AppError(400, 'VALIDATION_ERROR', `Select a valid ${field}.`);
  return value;
}

function assertCampusScope(
  context: {
    organizationId: string;
    campusIds?: string[];
    role?: string;
  },
  campusId?: string,
): void {
  if (
    context.role === 'campus_admin' &&
    (!campusId || !context.campusIds?.includes(campusId))
  ) {
    throw new AppError(
      403,
      'CAMPUS_FORBIDDEN',
      'You are not authorized for this campus.',
    );
  }
  if (!campusId || !context.campusIds || context.campusIds.length === 0) return;
  if (!context.campusIds.includes(campusId)) {
    throw new AppError(
      403,
      'CAMPUS_FORBIDDEN',
      'You are not authorized for this campus.',
    );
  }
}

export class PeopleService {
  constructor(private readonly repository: PeopleRepository) {}

  async listStudents(
    context: {
      organizationId: string;
      campusIds?: string[];
      role?: string;
    },
    input: {
      search?: string;
      status?: StudentStatus;
      campusIds?: string[];
      page?: number;
      pageSize?: number;
    },
  ): Promise<QuerySummary<StudentRecord>> {
    if (context.role === 'campus_admin' && !context.campusIds?.length) {
      return {
        items: [],
        total: 0,
        page: Math.max(1, Number(input.page) || 1),
        pageSize: Math.min(100, Math.max(1, Number(input.pageSize) || 20)),
      };
    }
    const campusIds = input.campusIds?.length
      ? input.campusIds
      : context.campusIds;
    return this.repository.listStudents({
      organizationId: context.organizationId,
      campusIds,
      search: input.search,
      status: input.status,
      page: input.page,
      pageSize: input.pageSize,
    });
  }

  async createStudent(
    organizationId: string,
    input: StudentInput,
    context?: { organizationId: string; campusIds?: string[]; role?: string },
  ): Promise<StudentRecord> {
    assertCampusScope(context ?? { organizationId }, input.campusId);
    return this.repository.createStudent(organizationId, {
      ...input,
      firstName: normalizeName(input.firstName, 'first name'),
      lastName: normalizeName(input.lastName, 'last name'),
      preferredName: input.preferredName?.trim() || undefined,
      contactEmail: normalizeOptionalEmail(input.contactEmail),
    });
  }

  async getStudent(
    organizationId: string,
    studentId: string,
    context?: { organizationId: string; campusIds?: string[]; role?: string },
  ): Promise<StudentRecord> {
    const student = await this.repository.getStudent(organizationId, studentId);
    if (!student)
      throw new AppError(404, 'STUDENT_NOT_FOUND', 'Student not found.');
    assertCampusScope(context ?? { organizationId }, student.campusId);
    return student;
  }

  async updateStudent(
    organizationId: string,
    studentId: string,
    changes: Partial<StudentInput>,
    context?: { organizationId: string; campusIds?: string[]; role?: string },
  ): Promise<StudentRecord> {
    if (changes.firstName)
      changes.firstName = normalizeName(changes.firstName, 'first name');
    if (changes.lastName)
      changes.lastName = normalizeName(changes.lastName, 'last name');
    if (changes.contactEmail !== undefined)
      changes.contactEmail = normalizeOptionalEmail(changes.contactEmail);
    const existing = await this.repository.getStudent(
      organizationId,
      studentId,
    );
    if (!existing)
      throw new AppError(404, 'STUDENT_NOT_FOUND', 'Student not found.');
    assertCampusScope(
      context ?? { organizationId },
      changes.campusId ?? existing.campusId,
    );
    const student = await this.repository.updateStudent(
      organizationId,
      studentId,
      changes,
    );
    if (!student)
      throw new AppError(404, 'STUDENT_NOT_FOUND', 'Student not found.');
    return student;
  }

  async listGuardians(
    context: PeopleAccessContext,
    input?: { search?: string; page?: number; pageSize?: number },
  ): Promise<QuerySummary<GuardianRecord>> {
    const guardianIds =
      context.role === 'campus_admin'
        ? Array.from(
            new Set(
              (
                await this.repository.listGuardianLinks(
                  context.organizationId,
                  undefined,
                  undefined,
                  context.campusIds ?? [],
                )
              ).map((link) => link.guardianId),
            ),
          )
        : undefined;
    return this.repository.listGuardians(context.organizationId, {
      ...input,
      guardianIds,
    });
  }

  async createGuardian(
    organizationId: string,
    input: GuardianInput,
    context?: PeopleAccessContext,
    studentId?: string,
  ): Promise<GuardianRecord> {
    const normalized = {
      ...input,
      firstName: normalizeName(input.firstName, 'guardian first name'),
      lastName: normalizeName(input.lastName, 'guardian last name'),
      email: normalizeOptionalEmail(input.email),
    };
    if (context?.role === 'campus_admin' && !studentId) {
      throw new AppError(
        400,
        'STUDENT_REQUIRED',
        'Select an assigned student for this guardian.',
      );
    }
    if (!studentId)
      return this.repository.createGuardian(organizationId, normalized);

    const student = await this.repository.getStudent(organizationId, studentId);
    if (!student)
      throw new AppError(404, 'STUDENT_NOT_FOUND', 'Student not found.');
    assertCampusScope(context ?? { organizationId }, student.campusId);
    return this.repository.createGuardianWithLink(organizationId, normalized, {
      studentId,
      relationship: input.relationship ?? 'guardian',
      isPrimary: false,
    });
  }

  async getGuardian(
    context: PeopleAccessContext,
    guardianId: string,
  ): Promise<{
    guardian: GuardianRecord;
    students: GuardianStudentRelation[];
  }> {
    const guardian = await this.repository.getGuardian(
      context.organizationId,
      guardianId,
    );
    if (!guardian)
      throw new AppError(404, 'GUARDIAN_NOT_FOUND', 'Guardian not found.');
    const links = await this.repository.listGuardianLinks(
      context.organizationId,
      undefined,
      guardianId,
      context.role === 'campus_admin' ? (context.campusIds ?? []) : undefined,
    );
    const students: GuardianStudentRelation[] = [];
    for (const link of links) {
      const student = await this.repository.getStudent(
        context.organizationId,
        link.studentId,
      );
      if (!student) continue;
      students.push({
        id: link.id,
        relationship: link.relationship,
        isPrimary: link.isPrimary,
        student: {
          id: student.id,
          firstName: student.firstName,
          lastName: student.lastName,
          campusId: student.campusId,
        },
      });
    }
    if (
      context.role === 'campus_admin' &&
      (context.campusIds?.length ?? 0) === 0
    ) {
      throw new AppError(404, 'GUARDIAN_NOT_FOUND', 'Guardian not found.');
    }
    if (context.role === 'campus_admin' && students.length === 0)
      throw new AppError(404, 'GUARDIAN_NOT_FOUND', 'Guardian not found.');
    return { guardian, students };
  }

  async updateGuardian(
    context: PeopleAccessContext,
    guardianId: string,
    changes: Partial<GuardianInput>,
  ): Promise<GuardianRecord> {
    await this.getGuardian(context, guardianId);
    const normalized = { ...changes };
    if (changes.firstName !== undefined)
      normalized.firstName = normalizeName(
        changes.firstName,
        'guardian first name',
      );
    if (changes.lastName !== undefined)
      normalized.lastName = normalizeName(
        changes.lastName,
        'guardian last name',
      );
    if (changes.email !== undefined)
      normalized.email = normalizeOptionalEmail(changes.email);
    const guardian = await this.repository.updateGuardian(
      context.organizationId,
      guardianId,
      normalized,
    );
    if (!guardian)
      throw new AppError(404, 'GUARDIAN_NOT_FOUND', 'Guardian not found.');
    return guardian;
  }

  async listStudentGuardians(
    context: PeopleAccessContext,
    studentId: string,
  ): Promise<StudentGuardianRelation[]> {
    const student = await this.repository.getStudent(
      context.organizationId,
      studentId,
    );
    if (!student)
      throw new AppError(404, 'STUDENT_NOT_FOUND', 'Student not found.');
    assertCampusScope(context, student.campusId);
    const links = await this.repository.listGuardianLinks(
      context.organizationId,
      studentId,
    );
    const relations: StudentGuardianRelation[] = [];
    for (const link of links) {
      const guardian = await this.repository.getGuardian(
        context.organizationId,
        link.guardianId,
      );
      if (!guardian) continue;
      relations.push({
        id: link.id,
        relationship: link.relationship,
        isPrimary: link.isPrimary,
        guardian,
      });
    }
    return relations;
  }

  async linkGuardianToStudent(
    context: PeopleAccessContext,
    input: Parameters<PeopleRepository['linkGuardianToStudent']>[1],
  ) {
    const student = await this.repository.getStudent(
      context.organizationId,
      input.studentId,
    );
    if (!student)
      throw new AppError(404, 'STUDENT_NOT_FOUND', 'Student not found.');
    assertCampusScope(context, student.campusId);
    const guardian = await this.repository.getGuardian(
      context.organizationId,
      input.guardianId,
    );
    if (!guardian)
      throw new AppError(404, 'GUARDIAN_NOT_FOUND', 'Guardian not found.');
    return this.repository.linkGuardianToStudent(context.organizationId, input);
  }

  async unlinkGuardianFromStudent(
    context: PeopleAccessContext,
    studentId: string,
    guardianId: string,
  ): Promise<void> {
    const student = await this.repository.getStudent(
      context.organizationId,
      studentId,
    );
    if (!student)
      throw new AppError(404, 'STUDENT_NOT_FOUND', 'Student not found.');
    assertCampusScope(context, student.campusId);
    const guardian = await this.repository.getGuardian(
      context.organizationId,
      guardianId,
    );
    if (!guardian)
      throw new AppError(404, 'GUARDIAN_NOT_FOUND', 'Guardian not found.');
    await this.repository.unlinkGuardianFromStudent(
      context.organizationId,
      studentId,
      guardianId,
    );
  }

  async listStaff(
    context: PeopleAccessContext,
    input?: {
      status?: string;
      department?: string;
      campusId?: string;
      search?: string;
      campusIds?: string[];
      page?: number;
      pageSize?: number;
    },
  ): Promise<QuerySummary<StaffRecord>> {
    if (context.role === 'campus_admin' && !context.campusIds?.length) {
      return {
        items: [],
        total: 0,
        page: Math.max(1, Number(input?.page) || 1),
        pageSize: Math.min(100, Math.max(1, Number(input?.pageSize) || 20)),
      };
    }
    if (input?.campusId) assertCampusScope(context, input.campusId);
    const campusIds =
      input?.campusId !== undefined
        ? [input.campusId]
        : context.campusIds?.length
          ? context.campusIds
          : input?.campusIds;
    return this.repository.listStaff(context.organizationId, {
      ...input,
      campusIds,
    });
  }

  async getStaff(
    context: PeopleAccessContext,
    staffId: string,
  ): Promise<StaffRecord> {
    const staff = await this.repository.getStaff(
      context.organizationId,
      staffId,
    );
    if (!staff)
      throw new AppError(
        404,
        'STAFF_MEMBER_NOT_FOUND',
        'Staff record not found.',
      );
    assertCampusScope(context, staff.campusId);
    return staff;
  }

  async createStaff(
    organizationId: string,
    input: StaffInput,
    context?: {
      organizationId: string;
      campusIds?: string[];
      role?: string;
    },
  ): Promise<StaffRecord> {
    assertCampusScope(context ?? { organizationId }, input.campusId);
    const qualifications = input.qualifications?.map((value) => value.trim());
    const subjects = input.subjects?.map((value) => value.trim());
    return this.repository.createStaff(organizationId, {
      ...input,
      firstName: normalizeName(input.firstName, 'first name'),
      lastName: normalizeName(input.lastName, 'last name'),
      status: normalizeStatus(
        input.status,
        ['active', 'on_leave', 'terminated', 'inactive'],
        'staff status',
      ) as StaffRecord['status'],
      email: normalizeOptionalEmail(input.email),
      employeeCode: input.employeeCode?.trim() || undefined,
      department: input.department?.trim() || undefined,
      designation: input.designation?.trim() || input.role?.trim() || undefined,
      role: input.role?.trim() || undefined,
      qualification: input.qualification?.trim() || undefined,
      qualifications: qualifications?.filter(Boolean),
      subjects: subjects?.filter(Boolean),
      dateOfBirth: normalizeOptionalDate(input.dateOfBirth),
    });
  }

  async updateStaff(
    organizationId: string,
    staffId: string,
    changes: Partial<StaffInput>,
    context?: {
      organizationId: string;
      campusIds?: string[];
      role?: string;
    },
  ): Promise<StaffRecord> {
    const existing = await this.repository.getStaff(organizationId, staffId);
    if (!existing)
      throw new AppError(
        404,
        'STAFF_MEMBER_NOT_FOUND',
        'Staff record not found.',
      );
    const access = context ?? { organizationId };
    assertCampusScope(access, existing.campusId);
    if (changes.campusId !== undefined)
      assertCampusScope(access, changes.campusId);
    if (changes.firstName)
      changes.firstName = normalizeName(changes.firstName, 'first name');
    if (changes.lastName)
      changes.lastName = normalizeName(changes.lastName, 'last name');
    if (changes.email !== undefined)
      changes.email = changes.email
        ? normalizeOptionalEmail(changes.email)
        : '';
    if (changes.status !== undefined)
      changes.status = normalizeStatus(
        changes.status,
        ['active', 'on_leave', 'terminated', 'inactive'],
        'staff status',
      ) as StaffRecord['status'];
    if (changes.employeeCode !== undefined)
      changes.employeeCode = changes.employeeCode.trim();
    if (changes.department !== undefined)
      changes.department = changes.department.trim();
    if (changes.designation !== undefined)
      changes.designation = changes.designation.trim();
    if (changes.role !== undefined) changes.role = changes.role.trim();
    if (changes.qualification !== undefined)
      changes.qualification = changes.qualification.trim();
    if (changes.qualifications !== undefined)
      changes.qualifications = changes.qualifications
        .map((value) => value.trim())
        .filter(Boolean);
    if (changes.subjects !== undefined)
      changes.subjects = changes.subjects
        .map((value) => value.trim())
        .filter(Boolean);
    if (changes.email !== undefined)
      changes.email = normalizeOptionalEmail(changes.email);
    if (changes.dateOfBirth !== undefined)
      changes.dateOfBirth = changes.dateOfBirth
        ? normalizeOptionalDate(changes.dateOfBirth)
        : '';
    const staff = await this.repository.updateStaff(
      organizationId,
      staffId,
      changes,
    );
    if (!staff)
      throw new AppError(
        404,
        'STAFF_MEMBER_NOT_FOUND',
        'Staff record not found.',
      );
    return staff;
  }

  async getInquiry(
    organizationId: string,
    inquiryId: string,
    context?: { organizationId: string; campusIds?: string[] },
  ): Promise<InquiryRecord> {
    const inquiry = await this.repository.getInquiry(organizationId, inquiryId);
    if (!inquiry)
      throw new AppError(404, 'INQUIRY_NOT_FOUND', 'Inquiry not found.');
    assertCampusScope(context ?? { organizationId }, inquiry.campusId);
    return inquiry;
  }

  async listInquiries(
    organizationId: string,
    input?: {
      status?: InquiryRecord['status'];
      search?: string;
      page?: number;
      pageSize?: number;
    },
    context?: { organizationId: string; campusIds?: string[]; role?: string },
  ): Promise<QuerySummary<InquiryRecord>> {
    if (context?.role === 'campus_admin' && !context.campusIds?.length) {
      return emptyPage(input?.page, input?.pageSize);
    }
    return this.repository.listInquiries(organizationId, {
      ...input,
      ...(context?.role === 'campus_admin'
        ? { campusIds: context.campusIds }
        : {}),
    });
  }

  async createInquiry(
    organizationId: string,
    input: InquiryInput,
    context?: { organizationId: string; campusIds?: string[]; role?: string },
  ): Promise<InquiryRecord> {
    assertCampusScope(context ?? { organizationId }, input.campusId);
    return this.repository.createInquiry(organizationId, {
      ...input,
      firstName: normalizeName(input.firstName, 'first name'),
      lastName: normalizeName(input.lastName, 'last name'),
      status: normalizeStatus(
        input.status,
        ['new', 'contacted', 'qualified', 'converted', 'closed'],
        'inquiry status',
      ) as InquiryRecord['status'],
      email: normalizeOptionalEmail(input.email),
    });
  }

  async updateInquiry(
    organizationId: string,
    inquiryId: string,
    changes: Partial<InquiryInput>,
    context?: { organizationId: string; campusIds?: string[]; role?: string },
  ): Promise<InquiryRecord> {
    if (changes.firstName)
      changes.firstName = normalizeName(changes.firstName, 'first name');
    if (changes.lastName)
      changes.lastName = normalizeName(changes.lastName, 'last name');
    if (changes.email !== undefined)
      changes.email = normalizeOptionalEmail(changes.email);
    if (changes.status !== undefined)
      changes.status = normalizeStatus(
        changes.status,
        ['new', 'contacted', 'qualified', 'converted', 'closed'],
        'inquiry status',
      ) as InquiryRecord['status'];

    const existing = await this.repository.getInquiry(
      organizationId,
      inquiryId,
    );
    if (!existing)
      throw new AppError(404, 'INQUIRY_NOT_FOUND', 'Inquiry not found.');
    assertCampusScope(
      context ?? { organizationId },
      changes.campusId ?? existing.campusId,
    );

    const inquiry = await this.repository.updateInquiry(
      organizationId,
      inquiryId,
      changes,
    );
    if (!inquiry)
      throw new AppError(404, 'INQUIRY_NOT_FOUND', 'Inquiry not found.');
    return inquiry;
  }

  async listApplications(
    organizationId: string,
    input?: {
      status?: ApplicationStatus;
      search?: string;
      page?: number;
      pageSize?: number;
    },
    context?: { organizationId: string; campusIds?: string[]; role?: string },
  ): Promise<QuerySummary<ApplicationRecord>> {
    if (context?.role === 'campus_admin' && !context.campusIds?.length) {
      return emptyPage(input?.page, input?.pageSize);
    }
    return this.repository.listApplications(organizationId, {
      ...input,
      ...(context?.role === 'campus_admin'
        ? { campusIds: context.campusIds }
        : {}),
    });
  }

  async getApplication(
    organizationId: string,
    applicationId: string,
    context?: { organizationId: string; campusIds?: string[]; role?: string },
  ): Promise<ApplicationRecord> {
    const application = await this.repository.getApplication(
      organizationId,
      applicationId,
    );
    if (!application)
      throw new AppError(
        404,
        'APPLICATION_NOT_FOUND',
        'Application not found.',
      );
    assertCampusScope(context ?? { organizationId }, application.campusId);
    return application;
  }

  async createApplication(
    organizationId: string,
    input: ApplicationInput,
    context?: { organizationId: string; campusIds?: string[]; role?: string },
  ): Promise<ApplicationRecord> {
    const inquiry = input.inquiryId
      ? await this.getInquiry(organizationId, input.inquiryId, context)
      : undefined;
    const preferredCampusId = input.preferredCampusId ?? inquiry?.campusId;
    assertCampusScope(context ?? { organizationId }, preferredCampusId);
    return this.repository.createApplication(organizationId, {
      ...input,
      preferredCampusId,
      firstName: normalizeName(input.firstName, 'first name'),
      lastName: normalizeName(input.lastName, 'last name'),
      status: normalizeStatus(
        input.status,
        ['draft', 'submitted'],
        'application status',
      ) as ApplicationRecord['status'],
      email: normalizeOptionalEmail(input.email),
      dateOfBirth: normalizeOptionalDateOnly(input.dateOfBirth),
      guardianName: input.guardianName?.trim() || undefined,
      guardianPhone: input.guardianPhone?.trim() || undefined,
    });
  }

  async reviewApplication(
    organizationId: string,
    applicationId: string,
    input: {
      status: ApplicationStatus;
      decisionReason?: string;
      campusId?: string;
    },
    context?: { organizationId: string; campusIds?: string[]; role?: string },
  ): Promise<{
    application: ApplicationRecord;
    student?: StudentRecord;
    enrollment?: {
      id: string;
      organizationId: string;
      studentId: string;
      status: string;
    };
  }> {
    const existing = await this.getApplication(
      organizationId,
      applicationId,
      context,
    );
    const allowed = TRANSITIONS[existing.status] ?? [];
    // Approval is intentionally idempotent when an older application was
    // marked approved before its student record was created. The repository
    // repairs missing student/enrollment records without creating duplicates.
    const repairingApprovedApplication =
      existing.status === 'approved' &&
      input.status === 'approved' &&
      !existing.convertedStudentId;
    if (!allowed.includes(input.status) && !repairingApprovedApplication) {
      throw new AppError(
        400,
        'INVALID_TRANSITION',
        'This application status change is not allowed.',
      );
    }
    if (input.status === 'approved') {
      const campusId = input.campusId ?? existing.campusId;
      if (!campusId) {
        throw new AppError(
          400,
          'CAMPUS_REQUIRED',
          'Assign a campus before approving this application so the student is placed in the correct campus roster.',
        );
      }
      assertCampusScope(context ?? { organizationId }, campusId);
      const result = await this.repository.approveApplication(
        organizationId,
        applicationId,
        input.decisionReason,
        campusId,
      );
      return {
        application: result.application,
        student: result.student,
        enrollment: result.enrollment,
      };
    }
    const updated = await this.repository.updateApplication(
      organizationId,
      applicationId,
      {
        status: input.status,
        notes: existing.notes,
        ...(input.decisionReason
          ? { decisionReason: input.decisionReason }
          : {}),
      },
    );
    if (!updated)
      throw new AppError(
        404,
        'APPLICATION_NOT_FOUND',
        'Application not found.',
      );
    return { application: updated };
  }
}
