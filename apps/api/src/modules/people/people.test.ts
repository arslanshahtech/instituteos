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
    query?: {
      search?: string;
      page?: number;
      pageSize?: number;
      guardianIds?: string[];
    },
  ): Promise<QuerySummary<GuardianRecord>> {
    const items = this.guardians.filter(
      (guardian) =>
        guardian.organizationId === organizationId &&
        (!query?.guardianIds || query.guardianIds.includes(guardian.id)),
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

  async createGuardianWithLink(
    organizationId: string,
    input: GuardianInput,
    link: Omit<GuardianLinkInput, 'guardianId'>,
  ): Promise<GuardianRecord> {
    const guardian = await this.createGuardian(organizationId, input);
    await this.linkGuardianToStudent(organizationId, {
      ...link,
      guardianId: guardian.id,
    });
    return guardian;
  }

  async linkGuardianToStudent(
    organizationId: string,
    input: GuardianLinkInput,
  ): Promise<GuardianLinkRecord> {
    const existing = this.links.find(
      (link) =>
        link.organizationId === organizationId &&
        link.studentId === input.studentId &&
        link.guardianId === input.guardianId,
    );
    const record: GuardianLinkRecord = existing
      ? {
          ...existing,
          relationship: input.relationship,
          isPrimary: Boolean(input.isPrimary),
          updatedAt: new Date().toISOString(),
        }
      : {
          id: `link-${this.links.length + 1}`,
          organizationId,
          studentId: input.studentId,
          guardianId: input.guardianId,
          relationship: input.relationship,
          isPrimary: Boolean(input.isPrimary),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
    if (existing) {
      this.links = this.links.map((link) =>
        link.id === existing.id ? record : link,
      );
    } else {
      this.links.push(record);
    }
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
    guardianId?: string,
    campusIds?: string[],
  ): Promise<GuardianLinkRecord[]> {
    return this.links.filter(
      (link) =>
        link.organizationId === organizationId &&
        (!studentId || link.studentId === studentId) &&
        (!guardianId || link.guardianId === guardianId) &&
        (!campusIds ||
          campusIds.includes(
            this.students.find((student) => student.id === link.studentId)
              ?.campusId ?? '',
          )),
    );
  }

  async unlinkGuardianFromStudent(
    organizationId: string,
    studentId: string,
    guardianId: string,
  ): Promise<boolean> {
    const before = this.links.length;
    this.links = this.links.filter(
      (link) =>
        link.organizationId !== organizationId ||
        link.studentId !== studentId ||
        link.guardianId !== guardianId,
    );
    const removed = this.links.length < before;
    if (removed) {
      const student = await this.getStudent(organizationId, studentId);
      if (student) {
        await this.updateStudent(organizationId, studentId, {
          guardianIds: student.guardianIds.filter((id) => id !== guardianId),
        });
      }
    }
    return removed;
  }

  async listStaff(
    organizationId: string,
    query?: {
      status?: string;
      department?: string;
      campusId?: string;
      search?: string;
      campusIds?: string[];
      page?: number;
      pageSize?: number;
    },
  ): Promise<QuerySummary<StaffRecord>> {
    const items = this.staff.filter(
      (staff) =>
        staff.organizationId === organizationId &&
        (!query?.status || staff.status === query.status) &&
        (!query?.campusId || staff.campusId === query.campusId) &&
        (!query?.campusIds?.length ||
          (staff.campusId !== undefined &&
            query.campusIds.includes(staff.campusId))) &&
        (!query?.department ||
          (staff.department ?? '')
            .toLowerCase()
            .includes(query.department.toLowerCase())),
    );
    const searched = query?.search
      ? items.filter((staff) =>
          [
            staff.firstName,
            staff.lastName,
            staff.email,
            staff.employeeCode,
            staff.department,
            staff.designation,
            staff.role,
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .includes(query.search!.toLowerCase()),
        )
      : items;
    const page = query?.page ?? 1;
    const pageSize = query?.pageSize ?? 20;
    return {
      items: searched.slice((page - 1) * pageSize, page * pageSize),
      total: searched.length,
      page,
      pageSize,
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
      employeeCode: input.employeeCode,
      department: input.department,
      designation: input.designation ?? input.role,
      qualification: input.qualification,
      qualifications: input.qualifications,
      subjects: input.subjects,
      dateOfBirth: input.dateOfBirth,
      gender: input.gender,
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
          inquiry.organizationId === organizationId && inquiry.id === inquiryId,
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
      gradeLevelInterest: input.gradeLevelInterest,
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
    campusId?: string,
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
      campusId: campusId ?? application.campusId,
      status: 'active',
    });
    const enrollment: EnrollmentRecord = {
      id: `enrollment-${student.id}`,
      organizationId,
      studentId: student.id,
      campusId: campusId ?? application.campusId,
      gradeLevel: 'New admission',
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const approved = {
      ...application,
      status: 'approved',
      campusId: campusId ?? application.campusId,
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

    await service.linkGuardianToStudent(
      { organizationId: 'org-1' },
      {
        studentId: student.id,
        guardianId: guardianA.id,
        relationship: 'father',
        isPrimary: true,
      },
    );
    await service.linkGuardianToStudent(
      { organizationId: 'org-1' },
      {
        studentId: student.id,
        guardianId: guardianB.id,
        relationship: 'mother',
      },
    );

    const saved = await repository.getStudent('org-1', student.id);
    expect(saved?.guardianIds).toHaveLength(2);
    expect(saved?.guardianIds).toEqual(
      expect.arrayContaining([guardianA.id, guardianB.id]),
    );
  });

  it('supports guardian CRUD and linked-student discovery within one organization', async () => {
    const repository = new MemoryPeopleRepository();
    const service = new PeopleService(repository);
    const firstStudent = await service.createStudent('org-1', {
      firstName: 'Mina',
      lastName: 'Rao',
      campusId: 'campus-1',
    });
    const secondStudent = await service.createStudent('org-1', {
      firstName: 'Arun',
      lastName: 'Rao',
      campusId: 'campus-1',
    });
    const guardian = await service.createGuardian(
      'org-1',
      {
        firstName: 'Leela',
        lastName: 'Rao',
        relationship: 'mother',
        email: 'leela@example.test',
      },
      { organizationId: 'org-1' },
      firstStudent.id,
    );

    await service.linkGuardianToStudent(
      { organizationId: 'org-1' },
      {
        studentId: secondStudent.id,
        guardianId: guardian.id,
        relationship: 'mother',
        isPrimary: true,
      },
    );
    const updated = await service.updateGuardian(
      { organizationId: 'org-1' },
      guardian.id,
      { phone: '+1 555 0100' },
    );
    const detail = await service.getGuardian(
      { organizationId: 'org-1' },
      guardian.id,
    );

    expect(updated.phone).toBe('+1 555 0100');
    expect(detail.students.map((relation) => relation.student.id)).toEqual(
      expect.arrayContaining([firstStudent.id, secondStudent.id]),
    );
    expect(
      await service.listStudentGuardians(
        { organizationId: 'org-1' },
        firstStudent.id,
      ),
    ).toHaveLength(1);

    await service.unlinkGuardianFromStudent(
      { organizationId: 'org-1' },
      firstStudent.id,
      guardian.id,
    );
    expect(
      await service.listStudentGuardians(
        { organizationId: 'org-1' },
        firstStudent.id,
      ),
    ).toHaveLength(0);
  });

  it('supports multiple links, duplicate attempts, unlinking, and re-linking', async () => {
    const repository = new MemoryPeopleRepository();
    const service = new PeopleService(repository);
    const firstStudent = await service.createStudent('org-1', {
      firstName: 'Mina',
      lastName: 'Rao',
    });
    const secondStudent = await service.createStudent('org-1', {
      firstName: 'Arun',
      lastName: 'Rao',
    });
    const guardianA = await service.createGuardian('org-1', {
      firstName: 'Leela',
      lastName: 'Rao',
    });
    const guardianB = await service.createGuardian('org-1', {
      firstName: 'Dev',
      lastName: 'Rao',
    });
    const context = { organizationId: 'org-1' };

    await service.linkGuardianToStudent(context, {
      studentId: firstStudent.id,
      guardianId: guardianA.id,
      relationship: 'mother',
      isPrimary: true,
    });
    await service.linkGuardianToStudent(context, {
      studentId: firstStudent.id,
      guardianId: guardianB.id,
      relationship: 'guardian',
    });
    await service.linkGuardianToStudent(context, {
      studentId: secondStudent.id,
      guardianId: guardianA.id,
      relationship: 'mother',
    });

    const duplicate = await service.linkGuardianToStudent(context, {
      studentId: firstStudent.id,
      guardianId: guardianA.id,
      relationship: 'mother',
      isPrimary: false,
    });
    expect(repository.links).toHaveLength(3);
    expect(duplicate.isPrimary).toBe(false);

    await service.unlinkGuardianFromStudent(
      context,
      firstStudent.id,
      guardianA.id,
    );
    expect(await repository.getGuardian('org-1', guardianA.id)).not.toBeNull();
    expect(
      (await service.listStudentGuardians(context, firstStudent.id)).map(
        (relation) => relation.guardian.id,
      ),
    ).toEqual([guardianB.id]);
    expect(
      (await service.listStudentGuardians(context, secondStudent.id)).map(
        (relation) => relation.guardian.id,
      ),
    ).toEqual([guardianA.id]);
    expect(
      (await repository.getStudent('org-1', firstStudent.id))?.guardianIds,
    ).toEqual([guardianB.id]);

    await service.linkGuardianToStudent(context, {
      studentId: firstStudent.id,
      guardianId: guardianA.id,
      relationship: 'mother',
    });
    expect(repository.links).toHaveLength(3);
    expect(
      (await repository.getStudent('org-1', firstStudent.id))?.guardianIds,
    ).toEqual(expect.arrayContaining([guardianA.id, guardianB.id]));
  });

  it('prevents cross-organization and out-of-campus guardian relationships', async () => {
    const repository = new MemoryPeopleRepository();
    const service = new PeopleService(repository);
    const inScopeStudent = await service.createStudent('org-1', {
      firstName: 'Asha',
      lastName: 'Singh',
      campusId: 'campus-1',
    });
    const otherCampusStudent = await service.createStudent('org-1', {
      firstName: 'Dev',
      lastName: 'Singh',
      campusId: 'campus-2',
    });
    const guardian = await service.createGuardian('org-1', {
      firstName: 'Nita',
      lastName: 'Singh',
    });
    const otherTenantGuardian = await service.createGuardian('org-2', {
      firstName: 'Nita',
      lastName: 'Singh',
    });
    const otherCampusGuardian = await service.createGuardian('org-1', {
      firstName: 'Sima',
      lastName: 'Singh',
    });
    const campusAdmin = {
      organizationId: 'org-1',
      role: 'campus_admin',
      campusIds: ['campus-1'],
    };

    await service.linkGuardianToStudent(campusAdmin, {
      studentId: inScopeStudent.id,
      guardianId: guardian.id,
      relationship: 'guardian',
    });
    await service.linkGuardianToStudent(
      { organizationId: 'org-1' },
      {
        studentId: otherCampusStudent.id,
        guardianId: otherCampusGuardian.id,
        relationship: 'guardian',
      },
    );
    await expect(
      service.createGuardian(
        'org-1',
        { firstName: 'Una', lastName: 'Assigned' },
        campusAdmin,
      ),
    ).rejects.toMatchObject({ code: 'STUDENT_REQUIRED' });
    await expect(
      service.createGuardian(
        'org-1',
        { firstName: 'Una', lastName: 'Assigned' },
        campusAdmin,
        otherCampusStudent.id,
      ),
    ).rejects.toMatchObject({ code: 'CAMPUS_FORBIDDEN' });
    await expect(
      service.linkGuardianToStudent(campusAdmin, {
        studentId: otherCampusStudent.id,
        guardianId: guardian.id,
        relationship: 'guardian',
      }),
    ).rejects.toMatchObject({ code: 'CAMPUS_FORBIDDEN' });
    await expect(
      service.getGuardian({ organizationId: 'org-1' }, otherTenantGuardian.id),
    ).rejects.toMatchObject({ code: 'GUARDIAN_NOT_FOUND' });
    await expect(
      service.linkGuardianToStudent(
        { organizationId: 'org-1' },
        {
          studentId: inScopeStudent.id,
          guardianId: otherTenantGuardian.id,
          relationship: 'guardian',
        },
      ),
    ).rejects.toMatchObject({ code: 'GUARDIAN_NOT_FOUND' });
    expect(
      (await service.listGuardians(campusAdmin)).items.map(
        (record) => record.id,
      ),
    ).toEqual([guardian.id]);
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

  it('supports staff profiles, filtered search, details and scoped updates', async () => {
    const repository = new MemoryPeopleRepository();
    const service = new PeopleService(repository);
    const campusAdmin = {
      organizationId: 'org-1',
      role: 'campus_admin',
      campusIds: ['campus-1'],
    };
    const staff = await service.createStaff(
      'org-1',
      {
        firstName: 'Ada',
        lastName: 'Lovelace',
        employeeCode: 'EMP-014',
        department: 'Science',
        designation: 'Teacher',
        status: 'active',
        email: 'ADA@EXAMPLE.TEST',
        phone: '+1 555 0199',
        dateOfBirth: '1988-12-10',
        gender: 'female',
        qualifications: ['MSc Physics', 'BEd'],
        subjects: ['Physics', 'Mathematics'],
        campusId: 'campus-1',
      },
      campusAdmin,
    );

    expect(staff).toMatchObject({
      employeeCode: 'EMP-014',
      designation: 'Teacher',
      email: 'ada@example.test',
      dateOfBirth: '1988-12-10T00:00:00.000Z',
      qualifications: ['MSc Physics', 'BEd'],
      subjects: ['Physics', 'Mathematics'],
    });
    expect(
      (
        await service.listStaff(campusAdmin, {
          search: 'emp-014',
          department: 'science',
          status: 'active',
        })
      ).items.map((record) => record.id),
    ).toEqual([staff.id]);
    await expect(
      service.getStaff(
        { organizationId: 'org-1', role: 'campus_admin', campusIds: [] },
        staff.id,
      ),
    ).rejects.toMatchObject({ code: 'CAMPUS_FORBIDDEN' });
    await expect(
      service.updateStaff(
        'org-1',
        staff.id,
        { department: 'Arts' },
        { organizationId: 'org-1', role: 'campus_admin', campusIds: [] },
      ),
    ).rejects.toMatchObject({ code: 'CAMPUS_FORBIDDEN' });

    const changed = await service.updateStaff(
      'org-1',
      staff.id,
      { status: 'terminated', subjects: ['Physics'] },
      campusAdmin,
    );
    expect(changed).toMatchObject({
      status: 'terminated',
      subjects: ['Physics'],
    });
  });

  it('keeps staff search and detail organization scoped', async () => {
    const repository = new MemoryPeopleRepository();
    const service = new PeopleService(repository);
    const staff = await service.createStaff('org-1', {
      firstName: 'Grace',
      lastName: 'Hopper',
      employeeCode: 'EMP-100',
    });

    expect(
      (await service.listStaff({ organizationId: 'org-2' }, {})).total,
    ).toBe(0);
    await expect(
      service.getStaff({ organizationId: 'org-2' }, staff.id),
    ).rejects.toMatchObject({ code: 'STAFF_MEMBER_NOT_FOUND' });
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
    expect(result).toMatchObject({
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
    });
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
      campusId: 'campus-1',
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

  it('repairs a legacy approved application that has no converted student record', async () => {
    const repository = new MemoryPeopleRepository();
    const service = new PeopleService(repository);
    const application = await service.createApplication('org-1', {
      firstName: 'Nora',
      lastName: 'Ali',
      status: 'submitted',
    });

    // Simulate records approved by an older workflow that only changed status.
    await repository.updateApplication('org-1', application.id, {
      status: 'approved',
    });

    const result = await service.reviewApplication('org-1', application.id, {
      status: 'approved',
      campusId: 'campus-1',
    });

    expect(result.application.status).toBe('approved');
    expect(result.student).toMatchObject({
      firstName: 'Nora',
      lastName: 'Ali',
      status: 'active',
    });
    expect(result.enrollment).toMatchObject({
      studentId: result.student?.id,
      status: 'active',
    });
  });

  it('supports inquiry search filters, closed status, linked applications, and campus isolation', async () => {
    const repository = new MemoryPeopleRepository();
    const service = new PeopleService(repository);
    const campusAdmin = {
      organizationId: 'org-1',
      role: 'campus_admin',
      campusIds: ['campus-1'],
    };
    const inquiry = await service.createInquiry(
      'org-1',
      {
        firstName: 'Nora',
        lastName: 'Ali',
        email: 'nora@example.test',
        campusId: 'campus-1',
        gradeLevelInterest: 'Year 4',
      },
      campusAdmin,
    );

    const page = await service.listInquiries(
      'org-1',
      { search: 'Nora Ali', status: 'new', page: 1, pageSize: 10 },
      campusAdmin,
    );
    expect(page.items[0]).toMatchObject({
      id: inquiry.id,
      gradeLevelInterest: 'Year 4',
    });

    const closed = await service.updateInquiry(
      'org-1',
      inquiry.id,
      { status: 'closed' },
      campusAdmin,
    );
    expect(closed.status).toBe('closed');

    const application = await service.createApplication(
      'org-1',
      {
        inquiryId: inquiry.id,
        firstName: inquiry.firstName,
        lastName: inquiry.lastName,
        status: 'submitted',
      },
      campusAdmin,
    );
    expect(application).toMatchObject({
      inquiryId: inquiry.id,
      campusId: 'campus-1',
      status: 'submitted',
    });

    const foreignInquiry = await service.createInquiry('org-2', {
      firstName: 'Ravi',
      lastName: 'Shah',
      campusId: 'campus-2',
    });
    await expect(
      service.createApplication(
        'org-1',
        {
          inquiryId: foreignInquiry.id,
          firstName: 'Ravi',
          lastName: 'Shah',
          status: 'submitted',
        },
        campusAdmin,
      ),
    ).rejects.toMatchObject({ code: 'INQUIRY_NOT_FOUND' });

    await expect(
      service.createApplication('org-1', {
        firstName: 'Mina',
        lastName: 'Rao',
        status: 'approved',
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
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
