import { describe, expect, it } from 'vitest';
import { PeopleService } from './people.service.js';
import type {
  ApplicationInput,
  ApplicationRecord,
  ApplicationStatus,
  EnrollmentRecord,
  GuardianInput,
  GuardianLinkInput,
  GuardianLinkRecord,
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

class MemoryPeopleRepository implements PeopleRepository {
  students: StudentRecord[] = [];
  guardians: GuardianRecord[] = [];
  links: GuardianLinkRecord[] = [];
  staff: StaffRecord[] = [];
  inquiries: InquiryRecord[] = [];
  applications: ApplicationRecord[] = [];

  async listStudents(query: {
    organizationId: string;
    campusId?: string;
    search?: string;
    status?: StudentStatus;
    page?: number;
    pageSize?: number;
  }): Promise<QuerySummary<StudentRecord>> {
    const items = this.students.filter(
      (student) =>
        student.organizationId === query.organizationId &&
        (!query.campusId || student.campusId === query.campusId) &&
        (!query.status || student.status === query.status),
    );
    const filtered = query.search
      ? items.filter((student) =>
          `${student.firstName} ${student.lastName}`
            .toLowerCase()
            .includes(query.search!.toLowerCase()),
        )
      : items;
    return {
      items: filtered.slice(0, query.pageSize ?? 20),
      total: filtered.length,
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 20,
    };
  }

  async getStudent(
    organizationId: string,
    studentId: string,
  ): Promise<StudentRecord | null> {
    return (
      this.students.find(
        (student) =>
          student.organizationId === organizationId && student.id === studentId,
      ) ?? null
    );
  }

  async createStudent(
    organizationId: string,
    input: StudentInput,
  ): Promise<StudentRecord> {
    const record: StudentRecord = {
      id: `student-${this.students.length + 1}`,
      organizationId,
      campusId: input.campusId,
      firstName: input.firstName,
      lastName: input.lastName,
      preferredName: input.preferredName,
      dateOfBirth: input.dateOfBirth,
      gender: input.gender,
      status: input.status ?? 'active',
      contactEmail: input.contactEmail,
      phone: input.phone,
      address: input.address,
      emergencyContact: input.emergencyContact,
      academicHistory: input.academicHistory,
      guardianIds: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.students.push(record);
    return record;
  }

  async updateStudent(
    organizationId: string,
    studentId: string,
    changes: Partial<StudentInput>,
  ): Promise<StudentRecord | null> {
    const current = await this.getStudent(organizationId, studentId);
    if (!current) return null;
    const next = {
      ...current,
      ...changes,
      updatedAt: new Date().toISOString(),
    } as StudentRecord;
    this.students = this.students.map((student) =>
      student.id === studentId ? next : student,
    );
    return next;
  }

  async listGuardians(
    organizationId: string,
    query?: { search?: string; page?: number; pageSize?: number },
  ): Promise<QuerySummary<GuardianRecord>> {
    const items = this.guardians.filter(
      (guardian) => guardian.organizationId === organizationId,
    );
    const filtered = query?.search
      ? items.filter((guardian) =>
          `${guardian.firstName} ${guardian.lastName}`
            .toLowerCase()
            .includes(query.search!.toLowerCase()),
        )
      : items;
    return {
      items: filtered.slice(0, query?.pageSize ?? 20),
      total: filtered.length,
      page: query?.page ?? 1,
      pageSize: query?.pageSize ?? 20,
    };
  }

  async getGuardian(
    organizationId: string,
    guardianId: string,
  ): Promise<GuardianRecord | null> {
    return (
      this.guardians.find(
        (guardian) =>
          guardian.organizationId === organizationId &&
          guardian.id === guardianId,
      ) ?? null
    );
  }

  async createGuardian(
    organizationId: string,
    input: GuardianInput,
  ): Promise<GuardianRecord> {
    const record: GuardianRecord = {
      id: `guardian-${this.guardians.length + 1}`,
      organizationId,
      firstName: input.firstName,
      lastName: input.lastName,
      relationship: input.relationship,
      phone: input.phone,
      email: input.email,
      communicationPreference: input.communicationPreference,
      address: input.address,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.guardians.push(record);
    return record;
  }

  async updateGuardian(
    organizationId: string,
    guardianId: string,
    changes: Partial<GuardianInput>,
  ): Promise<GuardianRecord | null> {
    const current = this.guardians.find(
      (guardian) =>
        guardian.organizationId === organizationId &&
        guardian.id === guardianId,
    );
    if (!current) return null;
    const next = {
      ...current,
      ...changes,
      updatedAt: new Date().toISOString(),
    } as GuardianRecord;
    this.guardians = this.guardians.map((guardian) =>
      guardian.id === guardianId ? next : guardian,
    );
    return next;
  }

  async linkGuardianToStudent(
    organizationId: string,
    input: GuardianLinkInput,
  ): Promise<GuardianLinkRecord> {
    const record: GuardianLinkRecord = {
      id: `link-${this.links.length + 1}`,
      organizationId,
      studentId: input.studentId,
      guardianId: input.guardianId,
      relationship: input.relationship,
      isPrimary: Boolean(input.isPrimary),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.links.push(record);
    const student = await this.getStudent(organizationId, input.studentId);
    if (student) {
      const guardianIds = new Set(student.guardianIds ?? []);
      guardianIds.add(input.guardianId);
      await this.updateStudent(organizationId, input.studentId, {
        guardianIds: Array.from(guardianIds),
      });
    }
    return record;
  }

  async listGuardianLinks(
    organizationId: string,
    studentId?: string,
  ): Promise<GuardianLinkRecord[]> {
    return this.links.filter(
      (link) =>
        link.organizationId === organizationId &&
        (!studentId || link.studentId === studentId),
    );
  }

  async listStaff(
    organizationId: string,
    query?: {
      status?: string;
      department?: string;
      page?: number;
      pageSize?: number;
    },
  ): Promise<QuerySummary<StaffRecord>> {
    const items = this.staff.filter(
      (staff) =>
        staff.organizationId === organizationId &&
        (!query?.status || staff.status === query.status) &&
        (!query?.department ||
          (staff.department ?? '')
            .toLowerCase()
            .includes(query.department.toLowerCase())),
    );
    return {
      items: items.slice(0, query?.pageSize ?? 20),
      total: items.length,
      page: query?.page ?? 1,
      pageSize: query?.pageSize ?? 20,
    };
  }

  async getStaff(
    organizationId: string,
    staffId: string,
  ): Promise<StaffRecord | null> {
    return (
      this.staff.find(
        (member) =>
          member.organizationId === organizationId && member.id === staffId,
      ) ?? null
    );
  }

  async createStaff(
    organizationId: string,
    input: StaffInput,
  ): Promise<StaffRecord> {
    const staff: StaffRecord = {
      id: `staff-${this.staff.length + 1}`,
      organizationId,
      campusId: input.campusId,
      firstName: input.firstName,
      lastName: input.lastName,
      department: input.department,
      qualification: input.qualification,
      status: input.status ?? 'active',
      role: input.role,
      email: input.email,
      phone: input.phone,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.staff.push(staff);
    return staff;
  }

  async updateStaff(
    organizationId: string,
    staffId: string,
    changes: Partial<StaffInput>,
  ): Promise<StaffRecord | null> {
    const current = this.staff.find(
      (member) =>
        member.organizationId === organizationId && member.id === staffId,
    );
    if (!current) return null;
    const next = {
      ...current,
      ...changes,
      updatedAt: new Date().toISOString(),
    } as StaffRecord;
    this.staff = this.staff.map((member) =>
      member.id === staffId ? next : member,
    );
    return next;
  }

  async listInquiries(
    organizationId: string,
    query?: {
      status?: InquiryRecord['status'];
      page?: number;
      pageSize?: number;
    },
  ): Promise<QuerySummary<InquiryRecord>> {
    const items = this.inquiries.filter(
      (inquiry) =>
        inquiry.organizationId === organizationId &&
        (!query?.status || inquiry.status === query.status),
    );
    return {
      items: items.slice(0, query?.pageSize ?? 20),
      total: items.length,
      page: query?.page ?? 1,
      pageSize: query?.pageSize ?? 20,
    };
  }

  async getInquiry(
    organizationId: string,
    inquiryId: string,
  ): Promise<InquiryRecord | null> {
  return (
    this.inquiries.find(
      (inquiry) =>
        inquiry.organizationId === organizationId &&
        inquiry.id === inquiryId,
    ) ?? null
   );
  }

  async createInquiry(
    organizationId: string,
    input: InquiryInput,
  ): Promise<InquiryRecord> {
    const record: InquiryRecord = {
      id: `inquiry-${this.inquiries.length + 1}`,
      organizationId,
      campusId: input.campusId,
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      phone: input.phone,
      source: input.source,
      status: input.status ?? 'new',
      notes: input.notes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.inquiries.push(record);
    return record;
  }

  async updateInquiry(
    organizationId: string,
    inquiryId: string,
    changes: Partial<InquiryInput>,
  ): Promise<InquiryRecord | null> {
    const current = this.inquiries.find(
      (inquiry) =>
        inquiry.organizationId === organizationId && inquiry.id === inquiryId,
    );
    if (!current) return null;
    const next = {
      ...current,
      ...changes,
      updatedAt: new Date().toISOString(),
    } as InquiryRecord;
    this.inquiries = this.inquiries.map((inquiry) =>
      inquiry.id === inquiryId ? next : inquiry,
    );
    return next;
  }

  async listApplications(
    organizationId: string,
    query?: { status?: ApplicationStatus; page?: number; pageSize?: number },
  ): Promise<QuerySummary<ApplicationRecord>> {
    const items = this.applications.filter(
      (application) =>
        application.organizationId === organizationId &&
        (!query?.status || application.status === query.status),
    );
    return {
      items: items.slice(0, query?.pageSize ?? 20),
      total: items.length,
      page: query?.page ?? 1,
      pageSize: query?.pageSize ?? 20,
    };
  }

  async getApplication(
    organizationId: string,
    applicationId: string,
  ): Promise<ApplicationRecord | null> {
    return (
      this.applications.find(
        (application) =>
          application.organizationId === organizationId &&
          application.id === applicationId,
      ) ?? null
    );
  }

  async createApplication(
    organizationId: string,
    input: ApplicationInput,
  ): Promise<ApplicationRecord> {
    const record: ApplicationRecord = {
      id: `application-${this.applications.length + 1}`,
      organizationId,
      campusId: input.preferredCampusId,
      inquiryId: input.inquiryId,
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      phone: input.phone,
      source: input.source,
      program: input.program,
      status: input.status ?? 'draft',
      notes: input.notes,
      decisionReason: undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.applications.push(record);
    return record;
  }

  async updateApplication(
    organizationId: string,
    applicationId: string,
    changes: Partial<ApplicationInput>,
  ): Promise<ApplicationRecord | null> {
    const current = this.applications.find(
      (application) =>
        application.organizationId === organizationId &&
        application.id === applicationId,
    );
    if (!current) return null;
    const next = {
      ...current,
      ...changes,
      updatedAt: new Date().toISOString(),
    } as ApplicationRecord;
    this.applications = this.applications.map((application) =>
      application.id === applicationId ? next : application,
    );
    return next;
  }

  async approveApplication(
    organizationId: string,
    applicationId: string,
    decisionReason?: string,
  ): Promise<{
    application: ApplicationRecord;
    student: StudentRecord;
    enrollment: EnrollmentRecord;
  }> {
    const application = (await this.getApplication(
      organizationId,
      applicationId,
    ))!;
    const student = await this.createStudent(organizationId, {
      firstName: application.firstName,
      lastName: application.lastName,
      contactEmail: application.email,
      phone: application.phone,
      campusId: application.campusId,
      status: 'active',
    });
    const enrollment: EnrollmentRecord = {
      id: `enrollment-${student.id}`,
      organizationId,
      studentId: student.id,
      campusId: application.campusId,
      gradeLevel: 'New admission',
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const approved = {
      ...application,
      status: 'approved',
      decisionReason: decisionReason ?? 'Approved by admissions review',
      updatedAt: new Date().toISOString(),
    } as ApplicationRecord;
    this.applications = this.applications.map((item) =>
      item.id === applicationId ? approved : item,
    );
    return { application: approved, student, enrollment };
  }
}

describe('people domain services', () => {
  it('creates a student profile and allows guardian linkages for multiple children', async () => {
    const repository = new MemoryPeopleRepository();
    const service = new PeopleService(repository);

    const student = await service.createStudent('org-1', {
      firstName: 'Nia',
      lastName: 'Patel',
      status: 'active',
      contactEmail: 'nia@example.test',
    });
    const guardianA = await service.createGuardian('org-1', {
      firstName: 'Rahul',
      lastName: 'Patel',
      relationship: 'father',
      email: 'rahul@example.test',
    });
    const guardianB = await service.createGuardian('org-1', {
      firstName: 'Meera',
      lastName: 'Patel',
      relationship: 'mother',
      email: 'meera@example.test',
    });

    await service.linkGuardianToStudent('org-1', {
      studentId: student.id,
      guardianId: guardianA.id,
      relationship: 'father',
      isPrimary: true,
    });
    await service.linkGuardianToStudent('org-1', {
      studentId: student.id,
      guardianId: guardianB.id,
      relationship: 'mother',
    });

    const saved = await repository.getStudent('org-1', student.id);
    expect(saved?.guardianIds).toHaveLength(2);
    expect(saved?.guardianIds).toEqual(
      expect.arrayContaining([guardianA.id, guardianB.id]),
    );
  });

  it('blocks campus access when the record is outside the allowed campus scope', async () => {
    const repository = new MemoryPeopleRepository();
    const service = new PeopleService(repository);

    const student = await service.createStudent('org-1', {
      firstName: 'Lena',
      lastName: 'Brown',
      status: 'active',
      campusId: 'campus-2',
    });

    await expect(
      service.getStudent('org-1', student.id, {
        organizationId: 'org-1',
        campusIds: ['campus-1'],
      }),
    ).rejects.toMatchObject({ code: 'CAMPUS_FORBIDDEN' });
  });

  it('does not expose students to campus admins without an assigned campus', async () => {
    const repository = new MemoryPeopleRepository();
    const service = new PeopleService(repository);
    await service.createStudent('org-1', {
      firstName: 'Lena',
      lastName: 'Brown',
      status: 'active',
      campusId: 'campus-1',
    });

    const result = await service.listStudents(
      { organizationId: 'org-1', role: 'campus_admin', campusIds: [] },
      {},
    );
    expect(result).toMatchObject({ items: [], total: 0, page: 1, pageSize: 20 });
  });

  it('blocks campus admins from unassigned student records and campus transfers', async () => {
    const repository = new MemoryPeopleRepository();
    const service = new PeopleService(repository);
    const student = await service.createStudent('org-1', {
      firstName: 'Lena',
      lastName: 'Brown',
      status: 'active',
    });

    await expect(
      service.getStudent('org-1', student.id, {
        organizationId: 'org-1',
        role: 'campus_admin',
        campusIds: ['campus-1'],
      }),
    ).rejects.toMatchObject({ code: 'CAMPUS_FORBIDDEN' });

    await expect(
      service.updateStudent(
        'org-1',
        student.id,
        { campusId: 'campus-2' },
        {
          organizationId: 'org-1',
          role: 'campus_admin',
          campusIds: ['campus-1'],
        },
      ),
    ).rejects.toMatchObject({ code: 'CAMPUS_FORBIDDEN' });
  });

  it('approves an application into a student plus enrollment record', async () => {
    const repository = new MemoryPeopleRepository();
    const service = new PeopleService(repository);

    const application = await service.createApplication('org-1', {
      firstName: 'Aisha',
      lastName: 'Khan',
      email: 'aisha@example.test',
      program: 'Grade 6',
      status: 'submitted',
    });

    const result = await service.reviewApplication('org-1', application.id, {
      status: 'approved',
      decisionReason: 'Qualified',
    });

    expect(result.student).toMatchObject({
      firstName: 'Aisha',
      lastName: 'Khan',
    });
    expect(result.enrollment).toMatchObject({
      studentId: result.student?.id,
      status: 'active',
    });
    expect(result.application.status).toBe('approved');
  });

  it('rejects invalid workflow transitions', async () => {
    const repository = new MemoryPeopleRepository();
    const service = new PeopleService(repository);

    const application = await service.createApplication('org-1', {
      firstName: 'Ishaan',
      lastName: 'Rao',
      email: 'ishaan@example.test',
      program: 'Grade 8',
      status: 'draft',
    });

    await expect(
      service.reviewApplication('org-1', application.id, {
        status: 'admitted',
      }),
    ).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });
  });

  it('lists students by search and status filters', async () => {
    const repository = new MemoryPeopleRepository();
    const service = new PeopleService(repository);

    await service.createStudent('org-1', {
      firstName: 'Aarav',
      lastName: 'Sharma',
      status: 'active',
    });
    await service.createStudent('org-1', {
      firstName: 'Aditi',
      lastName: 'Sharma',
      status: 'inactive',
    });

    const result = await service.listStudents(
      { organizationId: 'org-1' },
      { search: 'Aarav', status: 'active' },
    );

    expect(result.total).toBe(1);
    expect(result.items[0]?.firstName).toBe('Aarav');
  });
});
