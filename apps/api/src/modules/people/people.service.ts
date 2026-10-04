import { AppError } from '../../errors/app-error.js';
import type {
  ApplicationInput,
  ApplicationRecord,
  ApplicationStatus,
  GuardianInput,
  GuardianRecord,
  InquiryInput,
  InquiryRecord,
  PeopleRepository,
  QuerySummary,
  StaffInput,
  StaffRecord,
  StudentInput,
  StudentRecord,
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
  context: { organizationId: string; campusIds?: string[] },
  campusId?: string,
): void {
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
    context: { organizationId: string; campusIds?: string[] },
    input: {
      search?: string;
      status?: StudentStatus;
      campusIds?: string[];
      page?: number;
      pageSize?: number;
    },
  ): Promise<QuerySummary<StudentRecord>> {
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
    context?: { organizationId: string; campusIds?: string[] },
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
    context?: { organizationId: string; campusIds?: string[] },
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
    context?: { organizationId: string; campusIds?: string[] },
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
    organizationId: string,
    input?: { search?: string; page?: number; pageSize?: number },
  ): Promise<QuerySummary<GuardianRecord>> {
    return this.repository.listGuardians(organizationId, input);
  }

  async createGuardian(
    organizationId: string,
    input: GuardianInput,
  ): Promise<GuardianRecord> {
    return this.repository.createGuardian(organizationId, {
      ...input,
      firstName: normalizeName(input.firstName, 'guardian first name'),
      lastName: normalizeName(input.lastName, 'guardian last name'),
      email: normalizeOptionalEmail(input.email),
    });
  }

  async linkGuardianToStudent(
    organizationId: string,
    input: Parameters<PeopleRepository['linkGuardianToStudent']>[1],
  ) {
    const student = await this.repository.getStudent(
      organizationId,
      input.studentId,
    );
    if (!student)
      throw new AppError(404, 'STUDENT_NOT_FOUND', 'Student not found.');
    const guardian = await this.repository.getGuardian(
      organizationId,
      input.guardianId,
    );
    if (!guardian)
      throw new AppError(404, 'GUARDIAN_NOT_FOUND', 'Guardian not found.');
    return this.repository.linkGuardianToStudent(organizationId, input);
  }

  async listStaff(
    organizationId: string,
    input?: {
      status?: string;
      department?: string;
      campusIds?: string[];
      page?: number;
      pageSize?: number;
    },
  ): Promise<QuerySummary<StaffRecord>> {
    return this.repository.listStaff(organizationId, input);
  }

  async createStaff(
    organizationId: string,
    input: StaffInput,
    context?: { organizationId: string; campusIds?: string[] },
  ): Promise<StaffRecord> {
    assertCampusScope(context ?? { organizationId }, input.campusId);
    return this.repository.createStaff(organizationId, {
      ...input,
      firstName: normalizeName(input.firstName, 'first name'),
      lastName: normalizeName(input.lastName, 'last name'),
      status: normalizeStatus(
        input.status,
        ['active', 'on_leave', 'inactive'],
        'staff status',
      ) as StaffRecord['status'],
      email: normalizeOptionalEmail(input.email),
    });
  }

  async updateStaff(
    organizationId: string,
    staffId: string,
    changes: Partial<StaffInput>,
    context?: { organizationId: string; campusIds?: string[] },
  ): Promise<StaffRecord> {
    if (changes.firstName)
      changes.firstName = normalizeName(changes.firstName, 'first name');
    if (changes.lastName)
      changes.lastName = normalizeName(changes.lastName, 'last name');
    if (changes.email !== undefined)
      changes.email = normalizeOptionalEmail(changes.email);
    if (changes.status !== undefined)
      changes.status = normalizeStatus(
        changes.status,
        ['active', 'on_leave', 'inactive'],
        'staff status',
      ) as StaffRecord['status'];
    assertCampusScope(context ?? { organizationId }, changes.campusId);
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
      campusIds?: string[];
      search?: string;
      page?: number;
      pageSize?: number;
    },
    context?: { organizationId: string; campusIds?: string[] },
  ): Promise<QuerySummary<InquiryRecord>> {
    const campusIds = input?.campusIds?.length
      ? input.campusIds
      : context?.campusIds;
    return this.repository.listInquiries(organizationId, {
      ...input,
      campusIds,
    });
  }

  async createInquiry(
    organizationId: string,
    input: InquiryInput,
    context?: { organizationId: string; campusIds?: string[] },
  ): Promise<InquiryRecord> {
    assertCampusScope(context ?? { organizationId }, input.campusId);
    return this.repository.createInquiry(organizationId, {
      ...input,
      firstName: normalizeName(input.firstName, 'first name'),
      lastName: normalizeName(input.lastName, 'last name'),
      status: normalizeStatus(
        input.status,
        ['new', 'contacted', 'qualified', 'converted'],
        'inquiry status',
      ) as InquiryRecord['status'],
      email: normalizeOptionalEmail(input.email),
    });
  }

  async updateInquiry(
    organizationId: string,
    inquiryId: string,
    changes: Partial<InquiryInput>,
    context?: { organizationId: string; campusIds?: string[] },
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
        ['new', 'contacted', 'qualified', 'converted'],
        'inquiry status',
      ) as InquiryRecord['status'];

    const existing = await this.repository.getInquiry(organizationId, inquiryId);
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
      campusIds?: string[];
      page?: number;
      pageSize?: number;
    },
  ): Promise<QuerySummary<ApplicationRecord>> {
    return this.repository.listApplications(organizationId, input);
  }

  async createApplication(
    organizationId: string,
    input: ApplicationInput,
    context?: { organizationId: string; campusIds?: string[] },
  ): Promise<ApplicationRecord> {
    assertCampusScope(context ?? { organizationId }, input.preferredCampusId);
    return this.repository.createApplication(organizationId, {
      ...input,
      firstName: normalizeName(input.firstName, 'first name'),
      lastName: normalizeName(input.lastName, 'last name'),
      status: normalizeStatus(
        input.status,
        ['draft', 'submitted', 'in_review', 'approved', 'rejected', 'admitted'],
        'application status',
      ) as ApplicationRecord['status'],
      email: normalizeOptionalEmail(input.email),
    });
  }

  async reviewApplication(
    organizationId: string,
    applicationId: string,
    input: { status: ApplicationStatus; decisionReason?: string },
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
    const existing = await this.repository.getApplication(
      organizationId,
      applicationId,
    );
    if (!existing)
      throw new AppError(
        404,
        'APPLICATION_NOT_FOUND',
        'Application not found.',
      );
    const allowed = TRANSITIONS[existing.status] ?? [];
    if (!allowed.includes(input.status)) {
      throw new AppError(
        400,
        'INVALID_TRANSITION',
        'This application status change is not allowed.',
      );
    }
    if (input.status === 'approved') {
      const result = await this.repository.approveApplication(
        organizationId,
        applicationId,
        input.decisionReason,
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
