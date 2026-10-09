import mongoose, { Types } from 'mongoose';
import { AppError } from '../../errors/app-error.js';
import {
  AdmissionApplicationModel,
  AdmissionInquiryModel,
  EnrollmentModel,
  GuardianModel,
  StaffMemberModel,
  StudentGuardianLinkModel,
  StudentModel,
} from './people.model.js';
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
  QuerySummary,
  StaffInput,
  StaffRecord,
  StudentInput,
  StudentListQuery,
  StudentRecord,
} from './people.types.js';

function idObject(id: string): Types.ObjectId {
  return new Types.ObjectId(id);
}

function normalizePagination(
  page = 1,
  pageSize = 20,
): { page: number; pageSize: number } {
  const safePage = Math.max(1, Number(page) || 1);
  const safePageSize = Math.min(100, Math.max(1, Number(pageSize) || 20));
  return { page: safePage, pageSize: safePageSize };
}

function normalizeFilterValue(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  return value.trim() || undefined;
}

function convertGuardianArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item));
}

export class MongoPeopleRepository {
  async listStudents(
    query: StudentListQuery,
  ): Promise<QuerySummary<StudentRecord>> {
    const { page, pageSize } = normalizePagination(query.page, query.pageSize);
    const search = normalizeFilterValue(query.search);
    const filters: Record<string, unknown> = {
      organizationId: idObject(query.organizationId),
    };
    const campusIds =
      query.campusIds && query.campusIds.length > 0
        ? query.campusIds
        : query.campusId
          ? [query.campusId]
          : [];
    if (campusIds.length === 1) filters.campusId = idObject(campusIds[0]);
    if (campusIds.length > 1)
      filters.campusId = { $in: campusIds.map((id) => idObject(id)) };
    if (query.status) filters.status = query.status;
    if (search) {
      filters.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { contactEmail: { $regex: search, $options: 'i' } },
      ];
    }

    const [items, total] = await Promise.all([
      StudentModel.find(filters)
        .sort({ lastName: 1, firstName: 1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
      StudentModel.countDocuments(filters),
    ]);

    return {
      items: items.map((record) => ({
        id: String(record._id),
        organizationId: String(record.organizationId),
        campusId: record.campusId ? String(record.campusId) : undefined,
        firstName: String(record.firstName),
        lastName: String(record.lastName),
        preferredName: record.preferredName
          ? String(record.preferredName)
          : undefined,
        dateOfBirth: record.dateOfBirth
          ? new Date(record.dateOfBirth).toISOString()
          : undefined,
        gender: record.gender ? String(record.gender) : undefined,
        status: (record.status as StudentRecord['status']) ?? 'active',
        contactEmail: record.contactEmail
          ? String(record.contactEmail)
          : undefined,
        phone: record.phone ? String(record.phone) : undefined,
        address: record.address
          ? (record.address as StudentRecord['address'])
          : undefined,
        emergencyContact: record.emergencyContact
          ? (record.emergencyContact as StudentRecord['emergencyContact'])
          : undefined,
        academicHistory: Array.isArray(record.academicHistory)
          ? (record.academicHistory as StudentRecord['academicHistory'])
          : undefined,
        guardianIds: convertGuardianArray(record.guardianIds),
        createdAt: new Date(record.createdAt).toISOString(),
        updatedAt: new Date(record.updatedAt).toISOString(),
      })),
      total,
      page,
      pageSize,
    };
  }

  async getStudent(
    organizationId: string,
    studentId: string,
  ): Promise<StudentRecord | null> {
    const record = await StudentModel.findOne({
      _id: idObject(studentId),
      organizationId: idObject(organizationId),
    }).lean();
    if (!record) return null;
    return {
      id: String(record._id),
      organizationId: String(record.organizationId),
      campusId: record.campusId ? String(record.campusId) : undefined,
      firstName: String(record.firstName),
      lastName: String(record.lastName),
      preferredName: record.preferredName
        ? String(record.preferredName)
        : undefined,
      dateOfBirth: record.dateOfBirth
        ? new Date(record.dateOfBirth).toISOString()
        : undefined,
      gender: record.gender ? String(record.gender) : undefined,
      status: (record.status as StudentRecord['status']) ?? 'active',
      contactEmail: record.contactEmail
        ? String(record.contactEmail)
        : undefined,
      phone: record.phone ? String(record.phone) : undefined,
      address: record.address
        ? (record.address as StudentRecord['address'])
        : undefined,
      emergencyContact: record.emergencyContact
        ? (record.emergencyContact as StudentRecord['emergencyContact'])
        : undefined,
      academicHistory: Array.isArray(record.academicHistory)
        ? (record.academicHistory as StudentRecord['academicHistory'])
        : undefined,
      guardianIds: convertGuardianArray(record.guardianIds),
      createdAt: new Date(record.createdAt).toISOString(),
      updatedAt: new Date(record.updatedAt).toISOString(),
    };
  }

  async createStudent(
    organizationId: string,
    input: StudentInput,
  ): Promise<StudentRecord> {
    const body = {
      organizationId: idObject(organizationId),
      firstName: input.firstName,
      lastName: input.lastName,
      preferredName: input.preferredName,
      dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : null,
      gender: input.gender,
      status: input.status ?? 'active',
      contactEmail: input.contactEmail,
      phone: input.phone,
      address: input.address,
      emergencyContact: input.emergencyContact,
      academicHistory: input.academicHistory,
      campusId: input.campusId ? idObject(input.campusId) : null,
    };
    const record = await StudentModel.create(body);
    return this.getStudent(
      organizationId,
      String(record._id),
    ) as Promise<StudentRecord>;
  }

  async updateStudent(
    organizationId: string,
    studentId: string,
    changes: Partial<StudentInput>,
  ): Promise<StudentRecord | null> {
    const update: Record<string, unknown> = { ...changes };
    if (changes.dateOfBirth !== undefined)
      update.dateOfBirth = changes.dateOfBirth
        ? new Date(changes.dateOfBirth)
        : null;
    if (changes.campusId !== undefined)
      update.campusId = changes.campusId ? idObject(changes.campusId) : null;
    const record = await StudentModel.findOneAndUpdate(
      { _id: idObject(studentId), organizationId: idObject(organizationId) },
      { $set: update },
      { new: true, runValidators: true },
    ).lean();
    if (!record) return null;
    return {
      id: String(record._id),
      organizationId: String(record.organizationId),
      campusId: record.campusId ? String(record.campusId) : undefined,
      firstName: String(record.firstName),
      lastName: String(record.lastName),
      preferredName: record.preferredName
        ? String(record.preferredName)
        : undefined,
      dateOfBirth: record.dateOfBirth
        ? new Date(record.dateOfBirth).toISOString()
        : undefined,
      gender: record.gender ? String(record.gender) : undefined,
      status: (record.status as StudentRecord['status']) ?? 'active',
      contactEmail: record.contactEmail
        ? String(record.contactEmail)
        : undefined,
      phone: record.phone ? String(record.phone) : undefined,
      address: record.address
        ? (record.address as StudentRecord['address'])
        : undefined,
      emergencyContact: record.emergencyContact
        ? (record.emergencyContact as StudentRecord['emergencyContact'])
        : undefined,
      academicHistory: Array.isArray(record.academicHistory)
        ? (record.academicHistory as StudentRecord['academicHistory'])
        : undefined,
      guardianIds: convertGuardianArray(record.guardianIds),
      createdAt: new Date(record.createdAt).toISOString(),
      updatedAt: new Date(record.updatedAt).toISOString(),
    };
  }

  async listGuardians(
    organizationId: string,
    query?: { search?: string; page?: number; pageSize?: number },
  ): Promise<QuerySummary<GuardianRecord>> {
    const { page, pageSize } = normalizePagination(
      query?.page,
      query?.pageSize ?? 20,
    );
    const search = normalizeFilterValue(query?.search);
    const filters: Record<string, unknown> = {
      organizationId: idObject(organizationId),
    };
    if (search) {
      filters.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }
    const [items, total] = await Promise.all([
      GuardianModel.find(filters)
        .sort({ lastName: 1, firstName: 1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
      GuardianModel.countDocuments(filters),
    ]);
    return {
      items: items.map((record) => ({
        id: String(record._id),
        organizationId: String(record.organizationId),
        firstName: String(record.firstName),
        lastName: String(record.lastName),
        relationship: record.relationship as GuardianRecord['relationship'],
        phone: record.phone ? String(record.phone) : undefined,
        email: record.email ? String(record.email) : undefined,
        communicationPreference:
          record.communicationPreference as GuardianRecord['communicationPreference'],
        address: record.address
          ? (record.address as GuardianRecord['address'])
          : undefined,
        createdAt: new Date(record.createdAt).toISOString(),
        updatedAt: new Date(record.updatedAt).toISOString(),
      })),
      total,
      page,
      pageSize,
    };
  }

  async getGuardian(
    organizationId: string,
    guardianId: string,
  ): Promise<GuardianRecord | null> {
    const record = await GuardianModel.findOne({
      _id: idObject(guardianId),
      organizationId: idObject(organizationId),
    }).lean();
    if (!record) return null;
    return {
      id: String(record._id),
      organizationId: String(record.organizationId),
      firstName: String(record.firstName),
      lastName: String(record.lastName),
      relationship: record.relationship as GuardianRecord['relationship'],
      phone: record.phone ? String(record.phone) : undefined,
      email: record.email ? String(record.email) : undefined,
      communicationPreference:
        record.communicationPreference as GuardianRecord['communicationPreference'],
      address: record.address
        ? (record.address as GuardianRecord['address'])
        : undefined,
      createdAt: new Date(record.createdAt).toISOString(),
      updatedAt: new Date(record.updatedAt).toISOString(),
    };
  }

  async createGuardian(
    organizationId: string,
    input: GuardianInput,
  ): Promise<GuardianRecord> {
    const record = await GuardianModel.create({
      organizationId: idObject(organizationId),
      firstName: input.firstName,
      lastName: input.lastName,
      relationship: input.relationship ?? 'guardian',
      phone: input.phone,
      email: input.email,
      communicationPreference: input.communicationPreference ?? 'email',
      address: input.address,
    });
    return {
      id: String(record._id),
      organizationId: String(record.organizationId),
      firstName: String(record.firstName),
      lastName: String(record.lastName),
      relationship: record.relationship as GuardianRecord['relationship'],
      phone: record.phone ? String(record.phone) : undefined,
      email: record.email ? String(record.email) : undefined,
      communicationPreference:
        record.communicationPreference as GuardianRecord['communicationPreference'],
      address: record.address
        ? (record.address as GuardianRecord['address'])
        : undefined,
      createdAt: new Date(record.createdAt).toISOString(),
      updatedAt: new Date(record.updatedAt).toISOString(),
    };
  }

  async updateGuardian(
    organizationId: string,
    guardianId: string,
    changes: Partial<GuardianInput>,
  ): Promise<GuardianRecord | null> {
    const record = await GuardianModel.findOneAndUpdate(
      { _id: idObject(guardianId), organizationId: idObject(organizationId) },
      { $set: changes },
      { new: true, runValidators: true },
    ).lean();
    if (!record) return null;
    return {
      id: String(record._id),
      organizationId: String(record.organizationId),
      firstName: String(record.firstName),
      lastName: String(record.lastName),
      relationship: record.relationship as GuardianRecord['relationship'],
      phone: record.phone ? String(record.phone) : undefined,
      email: record.email ? String(record.email) : undefined,
      communicationPreference:
        record.communicationPreference as GuardianRecord['communicationPreference'],
      address: record.address
        ? (record.address as GuardianRecord['address'])
        : undefined,
      createdAt: new Date(record.createdAt).toISOString(),
      updatedAt: new Date(record.updatedAt).toISOString(),
    };
  }

  async linkGuardianToStudent(
    organizationId: string,
    input: GuardianLinkInput,
  ): Promise<GuardianLinkRecord> {
    const record = await StudentGuardianLinkModel.findOneAndUpdate(
      {
        organizationId: idObject(organizationId),
        studentId: idObject(input.studentId),
        guardianId: idObject(input.guardianId),
      },
      {
        $set: {
          relationship: input.relationship,
          isPrimary: Boolean(input.isPrimary),
        },
      },
      { new: true, upsert: true, runValidators: true },
    ).lean();

    const student = await StudentModel.findOne({
      _id: idObject(input.studentId),
      organizationId: idObject(organizationId),
    }).lean();
    if (student) {
      const guardianIds = new Set<string>(
        (Array.isArray(student.guardianIds)
          ? (student.guardianIds as unknown[])
          : []
        ).map((id) => String(id)),
      );
      guardianIds.add(String(input.guardianId));
      await StudentModel.findOneAndUpdate(
        {
          _id: idObject(input.studentId),
          organizationId: idObject(organizationId),
        },
        {
          $set: {
            guardianIds: Array.from(guardianIds).map(
              (id) => new Types.ObjectId(id),
            ),
          },
        },
      );
    }

    return {
      id: String(record._id),
      organizationId: String(record.organizationId),
      studentId: String(record.studentId),
      guardianId: String(record.guardianId),
      relationship: record.relationship as GuardianLinkRecord['relationship'],
      isPrimary: Boolean(record.isPrimary),
      createdAt: new Date(record.createdAt).toISOString(),
      updatedAt: new Date(record.updatedAt).toISOString(),
    };
  }

  async listGuardianLinks(
    organizationId: string,
    studentId?: string,
  ): Promise<GuardianLinkRecord[]> {
    const filters: Record<string, unknown> = {
      organizationId: idObject(organizationId),
    };
    if (studentId) filters.studentId = idObject(studentId);
    const records = await StudentGuardianLinkModel.find(filters).lean();
    return records.map((record) => ({
      id: String(record._id),
      organizationId: String(record.organizationId),
      studentId: String(record.studentId),
      guardianId: String(record.guardianId),
      relationship: record.relationship as GuardianLinkRecord['relationship'],
      isPrimary: Boolean(record.isPrimary),
      createdAt: new Date(record.createdAt).toISOString(),
      updatedAt: new Date(record.updatedAt).toISOString(),
    }));
  }

  async listStaff(
    organizationId: string,
    query?: {
      status?: string;
      department?: string;
      campusIds?: string[];
      page?: number;
      pageSize?: number;
    },
  ): Promise<QuerySummary<StaffRecord>> {
    const { page, pageSize } = normalizePagination(
      query?.page,
      query?.pageSize ?? 20,
    );
    const filters: Record<string, unknown> = {
      organizationId: idObject(organizationId),
    };
    if (query?.status) filters.status = query.status;
    if (query?.department)
      filters.department = { $regex: query.department, $options: 'i' };
    if (query?.campusIds && query.campusIds.length > 0) {
      filters.campusId = { $in: query.campusIds.map((id) => idObject(id)) };
    }
    const [items, total] = await Promise.all([
      StaffMemberModel.find(filters)
        .sort({ lastName: 1, firstName: 1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
      StaffMemberModel.countDocuments(filters),
    ]);
    return {
      items: items.map((record) => ({
        id: String(record._id),
        organizationId: String(record.organizationId),
        campusId: record.campusId ? String(record.campusId) : undefined,
        firstName: String(record.firstName),
        lastName: String(record.lastName),
        department: record.department ? String(record.department) : undefined,
        qualification: record.qualification
          ? String(record.qualification)
          : undefined,
        status: (record.status as StaffRecord['status']) ?? 'active',
        role: record.role ? String(record.role) : undefined,
        email: record.email ? String(record.email) : undefined,
        phone: record.phone ? String(record.phone) : undefined,
        createdAt: new Date(record.createdAt).toISOString(),
        updatedAt: new Date(record.updatedAt).toISOString(),
      })),
      total,
      page,
      pageSize,
    };
  }

  async getStaff(
    organizationId: string,
    staffId: string,
  ): Promise<StaffRecord | null> {
    const record = await StaffMemberModel.findOne({
      _id: idObject(staffId),
      organizationId: idObject(organizationId),
    }).lean();
    if (!record) return null;
    return {
      id: String(record._id),
      organizationId: String(record.organizationId),
      campusId: record.campusId ? String(record.campusId) : undefined,
      firstName: String(record.firstName),
      lastName: String(record.lastName),
      department: record.department ? String(record.department) : undefined,
      qualification: record.qualification
        ? String(record.qualification)
        : undefined,
      status: (record.status as StaffRecord['status']) ?? 'active',
      role: record.role ? String(record.role) : undefined,
      email: record.email ? String(record.email) : undefined,
      phone: record.phone ? String(record.phone) : undefined,
      createdAt: new Date(record.createdAt).toISOString(),
      updatedAt: new Date(record.updatedAt).toISOString(),
    };
  }

  async createStaff(
    organizationId: string,
    input: StaffInput,
  ): Promise<StaffRecord> {
    const record = await StaffMemberModel.create({
      organizationId: idObject(organizationId),
      campusId: input.campusId ? idObject(input.campusId) : null,
      firstName: input.firstName,
      lastName: input.lastName,
      department: input.department,
      qualification: input.qualification,
      status: input.status ?? 'active',
      role: input.role,
      email: input.email,
      phone: input.phone,
    });
    return this.getStaff(
      organizationId,
      String(record._id),
    ) as Promise<StaffRecord>;
  }

  async updateStaff(
    organizationId: string,
    staffId: string,
    changes: Partial<StaffInput>,
  ): Promise<StaffRecord | null> {
    const update: Record<string, unknown> = { ...changes };
    if (changes.campusId !== undefined)
      update.campusId = changes.campusId ? idObject(changes.campusId) : null;
    const record = await StaffMemberModel.findOneAndUpdate(
      { _id: idObject(staffId), organizationId: idObject(organizationId) },
      { $set: update },
      { new: true, runValidators: true },
    ).lean();
    if (!record) return null;
    return {
      id: String(record._id),
      organizationId: String(record.organizationId),
      campusId: record.campusId ? String(record.campusId) : undefined,
      firstName: String(record.firstName),
      lastName: String(record.lastName),
      department: record.department ? String(record.department) : undefined,
      qualification: record.qualification
        ? String(record.qualification)
        : undefined,
      status: (record.status as StaffRecord['status']) ?? 'active',
      role: record.role ? String(record.role) : undefined,
      email: record.email ? String(record.email) : undefined,
      phone: record.phone ? String(record.phone) : undefined,
      createdAt: new Date(record.createdAt).toISOString(),
      updatedAt: new Date(record.updatedAt).toISOString(),
    };
  }

  async getInquiry(
    organizationId: string,
    inquiryId: string,
  ): Promise<InquiryRecord | null> {
    const record = await AdmissionInquiryModel.findOne({
      _id: idObject(inquiryId),
      organizationId: idObject(organizationId),
    }).lean();
    if (!record) return null;
    return {
      id: String(record._id),
      organizationId: String(record.organizationId),
      campusId: record.campusId ? String(record.campusId) : undefined,
      firstName: String(record.firstName),
      lastName: String(record.lastName),
      email: record.email ? String(record.email) : undefined,
      phone: record.phone ? String(record.phone) : undefined,
      source: record.source ? String(record.source) : undefined,
      status: (record.status as InquiryRecord['status']) ?? 'new',
      notes: record.notes ? String(record.notes) : undefined,
      createdAt: new Date(record.createdAt).toISOString(),
      updatedAt: new Date(record.updatedAt).toISOString(),
    };
  }

  async listInquiries(
    organizationId: string,
    query?: {
      status?: InquiryRecord['status'];
      campusIds?: string[];
      search?: string;
      page?: number;
      pageSize?: number;
    },
  ): Promise<QuerySummary<InquiryRecord>> {
    const { page, pageSize } = normalizePagination(
      query?.page,
      query?.pageSize ?? 20,
    );
    const filters: Record<string, unknown> = {
      organizationId: idObject(organizationId),
    };
    if (query?.status) filters.status = query.status;
    if (query?.search) {
      filters.$or = [
        { firstName: { $regex: query.search, $options: 'i' } },
        { lastName: { $regex: query.search, $options: 'i' } },
        { email: { $regex: query.search, $options: 'i' } },
      ];
    }
    if (query?.campusIds && query.campusIds.length > 0) {
      filters.campusId = { $in: query.campusIds.map((id) => idObject(id)) };
    }
    const [items, total] = await Promise.all([
      AdmissionInquiryModel.find(filters)
        .sort({ createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
      AdmissionInquiryModel.countDocuments(filters),
    ]);
    return {
      items: items.map((record) => ({
        id: String(record._id),
        organizationId: String(record.organizationId),
        campusId: record.campusId ? String(record.campusId) : undefined,
        firstName: String(record.firstName),
        lastName: String(record.lastName),
        email: record.email ? String(record.email) : undefined,
        phone: record.phone ? String(record.phone) : undefined,
        source: record.source ? String(record.source) : undefined,
        status: (record.status as InquiryRecord['status']) ?? 'new',
        notes: record.notes ? String(record.notes) : undefined,
        createdAt: new Date(record.createdAt).toISOString(),
        updatedAt: new Date(record.updatedAt).toISOString(),
      })),
      total,
      page,
      pageSize,
    };
  }

  async createInquiry(
    organizationId: string,
    input: InquiryInput,
  ): Promise<InquiryRecord> {
    const record = await AdmissionInquiryModel.create({
      organizationId: idObject(organizationId),
      campusId: input.campusId ? idObject(input.campusId) : null,
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      phone: input.phone,
      source: input.source,
      status: input.status ?? 'new',
      notes: input.notes,
    });
    return {
      id: String(record._id),
      organizationId: String(record.organizationId),
      campusId: record.campusId ? String(record.campusId) : undefined,
      firstName: String(record.firstName),
      lastName: String(record.lastName),
      email: record.email ? String(record.email) : undefined,
      phone: record.phone ? String(record.phone) : undefined,
      source: record.source ? String(record.source) : undefined,
      status: (record.status as InquiryRecord['status']) ?? 'new',
      notes: record.notes ? String(record.notes) : undefined,
      createdAt: new Date(record.createdAt).toISOString(),
      updatedAt: new Date(record.updatedAt).toISOString(),
    };
  }

  async updateInquiry(
    organizationId: string,
    inquiryId: string,
    changes: Partial<InquiryInput>,
  ): Promise<InquiryRecord | null> {
    const update: Record<string, unknown> = { ...changes };
    if (changes.campusId !== undefined)
      update.campusId = changes.campusId ? idObject(changes.campusId) : null;
    const record = await AdmissionInquiryModel.findOneAndUpdate(
      { _id: idObject(inquiryId), organizationId: idObject(organizationId) },
      { $set: update },
      { new: true, runValidators: true },
    ).lean();
    if (!record) return null;
    return {
      id: String(record._id),
      organizationId: String(record.organizationId),
      campusId: record.campusId ? String(record.campusId) : undefined,
      firstName: String(record.firstName),
      lastName: String(record.lastName),
      email: record.email ? String(record.email) : undefined,
      phone: record.phone ? String(record.phone) : undefined,
      source: record.source ? String(record.source) : undefined,
      status: (record.status as InquiryRecord['status']) ?? 'new',
      notes: record.notes ? String(record.notes) : undefined,
      createdAt: new Date(record.createdAt).toISOString(),
      updatedAt: new Date(record.updatedAt).toISOString(),
    };
  }

  async listApplications(
    organizationId: string,
    query?: {
      status?: ApplicationStatus;
      campusIds?: string[];
      page?: number;
      pageSize?: number;
    },
  ): Promise<QuerySummary<ApplicationRecord>> {
    const { page, pageSize } = normalizePagination(
      query?.page,
      query?.pageSize ?? 20,
    );
    const filters: Record<string, unknown> = {
      organizationId: idObject(organizationId),
    };
    if (query?.status) filters.status = query.status;
    if (query?.campusIds && query.campusIds.length > 0) {
      filters.campusId = { $in: query.campusIds.map((id) => idObject(id)) };
    }
    const [items, total] = await Promise.all([
      AdmissionApplicationModel.find(filters)
        .sort({ createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
      AdmissionApplicationModel.countDocuments(filters),
    ]);
    return {
      items: items.map((record) => ({
        id: String(record._id),
        organizationId: String(record.organizationId),
        campusId: record.campusId ? String(record.campusId) : undefined,
        inquiryId: record.inquiryId ? String(record.inquiryId) : undefined,
        firstName: String(record.firstName),
        lastName: String(record.lastName),
        email: record.email ? String(record.email) : undefined,
        phone: record.phone ? String(record.phone) : undefined,
        source: record.source ? String(record.source) : undefined,
        program: record.program ? String(record.program) : undefined,
        status: (record.status as ApplicationRecord['status']) ?? 'draft',
        notes: record.notes ? String(record.notes) : undefined,
        decisionReason: record.decisionReason
          ? String(record.decisionReason)
          : undefined,
        createdAt: new Date(record.createdAt).toISOString(),
        updatedAt: new Date(record.updatedAt).toISOString(),
      })),
      total,
      page,
      pageSize,
    };
  }

  async getApplication(
    organizationId: string,
    applicationId: string,
  ): Promise<ApplicationRecord | null> {
    const record = await AdmissionApplicationModel.findOne({
      _id: idObject(applicationId),
      organizationId: idObject(organizationId),
    }).lean();
    if (!record) return null;
    return {
      id: String(record._id),
      organizationId: String(record.organizationId),
      campusId: record.campusId ? String(record.campusId) : undefined,
      inquiryId: record.inquiryId ? String(record.inquiryId) : undefined,
      firstName: String(record.firstName),
      lastName: String(record.lastName),
      email: record.email ? String(record.email) : undefined,
      phone: record.phone ? String(record.phone) : undefined,
      source: record.source ? String(record.source) : undefined,
      program: record.program ? String(record.program) : undefined,
      status: (record.status as ApplicationRecord['status']) ?? 'draft',
      notes: record.notes ? String(record.notes) : undefined,
      decisionReason: record.decisionReason
        ? String(record.decisionReason)
        : undefined,
      createdAt: new Date(record.createdAt).toISOString(),
      updatedAt: new Date(record.updatedAt).toISOString(),
    };
  }

  async createApplication(
    organizationId: string,
    input: ApplicationInput,
  ): Promise<ApplicationRecord> {
    const record = await AdmissionApplicationModel.create({
      organizationId: idObject(organizationId),
      inquiryId: input.inquiryId ? idObject(input.inquiryId) : null,
      campusId: input.preferredCampusId
        ? idObject(input.preferredCampusId)
        : null,
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      phone: input.phone,
      source: input.source,
      program: input.program,
      status: input.status ?? 'draft',
      notes: input.notes,
    });
    return {
      id: String(record._id),
      organizationId: String(record.organizationId),
      campusId: record.campusId ? String(record.campusId) : undefined,
      inquiryId: record.inquiryId ? String(record.inquiryId) : undefined,
      firstName: String(record.firstName),
      lastName: String(record.lastName),
      email: record.email ? String(record.email) : undefined,
      phone: record.phone ? String(record.phone) : undefined,
      source: record.source ? String(record.source) : undefined,
      program: record.program ? String(record.program) : undefined,
      status: (record.status as ApplicationRecord['status']) ?? 'draft',
      notes: record.notes ? String(record.notes) : undefined,
      decisionReason: record.decisionReason
        ? String(record.decisionReason)
        : undefined,
      createdAt: new Date(record.createdAt).toISOString(),
      updatedAt: new Date(record.updatedAt).toISOString(),
    };
  }

  async updateApplication(
    organizationId: string,
    applicationId: string,
    changes: Partial<ApplicationInput>,
  ): Promise<ApplicationRecord | null> {
    const update: Record<string, unknown> = { ...changes };
    if (changes.preferredCampusId !== undefined)
      update.campusId = changes.preferredCampusId
        ? idObject(changes.preferredCampusId)
        : null;
    if (changes.inquiryId !== undefined)
      update.inquiryId = changes.inquiryId ? idObject(changes.inquiryId) : null;
    const record = await AdmissionApplicationModel.findOneAndUpdate(
      {
        _id: idObject(applicationId),
        organizationId: idObject(organizationId),
      },
      { $set: update },
      { new: true, runValidators: true },
    ).lean();
    if (!record) return null;
    return {
      id: String(record._id),
      organizationId: String(record.organizationId),
      campusId: record.campusId ? String(record.campusId) : undefined,
      inquiryId: record.inquiryId ? String(record.inquiryId) : undefined,
      firstName: String(record.firstName),
      lastName: String(record.lastName),
      email: record.email ? String(record.email) : undefined,
      phone: record.phone ? String(record.phone) : undefined,
      source: record.source ? String(record.source) : undefined,
      program: record.program ? String(record.program) : undefined,
      status: (record.status as ApplicationRecord['status']) ?? 'draft',
      notes: record.notes ? String(record.notes) : undefined,
      decisionReason: record.decisionReason
        ? String(record.decisionReason)
        : undefined,
      createdAt: new Date(record.createdAt).toISOString(),
      updatedAt: new Date(record.updatedAt).toISOString(),
    };
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
    const session = await mongoose.startSession();

    try {
      let result:
        | {
            application: ApplicationRecord;
            student: StudentRecord;
            enrollment: EnrollmentRecord;
          }
        | undefined;

      await session.withTransaction(async () => {
        const application = await AdmissionApplicationModel.findOne({
          _id: idObject(applicationId),
          organizationId: idObject(organizationId),
        })
          .session(session)
          .lean();

        if (!application) {
          throw new AppError(
            404,
            'APPLICATION_NOT_FOUND',
            'Application not found.',
          );
        }

        const existingStudent = await StudentModel.findOne({
          organizationId: idObject(organizationId),
          sourceApplicationId: idObject(applicationId),
        })
          .session(session)
          .lean();

        let studentDocument = existingStudent;

        if (!studentDocument) {
          const [createdStudent] = await StudentModel.create(
            [
              {
                organizationId: idObject(organizationId),
                campusId: application.campusId
                  ? idObject(String(application.campusId))
                  : null,
                sourceApplicationId: idObject(applicationId),
                firstName: application.firstName,
                lastName: application.lastName,
                status: 'active',
                contactEmail: application.email,
                phone: application.phone,
                guardianIds: [],
              },
            ],
            { session },
          );

          studentDocument = createdStudent;
        }

        let enrollmentDocument = await EnrollmentModel.findOne({
          organizationId: idObject(organizationId),
          studentId: studentDocument._id,
          sourceApplicationId: idObject(applicationId),
        })
          .session(session)
          .lean();

        if (!enrollmentDocument) {
          const [createdEnrollment] = await EnrollmentModel.create(
            [
              {
                organizationId: idObject(organizationId),
                studentId: studentDocument._id,
                campusId: application.campusId
                  ? idObject(String(application.campusId))
                  : null,
                sourceApplicationId: idObject(applicationId),
                status: 'active',
                gradeLevel: 'New admission',
              },
            ],
            { session },
          );

          enrollmentDocument = createdEnrollment;
        }

        const approved = await AdmissionApplicationModel.findOneAndUpdate(
          {
            _id: idObject(applicationId),
            organizationId: idObject(organizationId),
          },
          {
            $set: {
              status: 'approved',
              decisionReason:
                decisionReason ?? 'Approved by admissions review',
            },
          },
          {
            new: true,
            runValidators: true,
            session,
          },
        ).lean();

        if (!approved) {
          throw new AppError(
            500,
            'APPLICATION_APPROVAL_FAILED',
            'Approval failed while updating the application.',
          );
        }

        result = {
          application: {
            id: String(approved._id),
            organizationId: String(approved.organizationId),
            campusId: approved.campusId
              ? String(approved.campusId)
              : undefined,
            inquiryId: approved.inquiryId
              ? String(approved.inquiryId)
              : undefined,
            firstName: String(approved.firstName),
            lastName: String(approved.lastName),
            email: approved.email
              ? String(approved.email)
              : undefined,
            phone: approved.phone
              ? String(approved.phone)
              : undefined,
            source: approved.source
              ? String(approved.source)
              : undefined,
            program: approved.program
              ? String(approved.program)
              : undefined,
            status:
              (approved.status as ApplicationRecord['status']) ??
              'approved',
            notes: approved.notes
              ? String(approved.notes)
              : undefined,
            decisionReason: approved.decisionReason
              ? String(approved.decisionReason)
              : undefined,
            createdAt: new Date(approved.createdAt).toISOString(),
            updatedAt: new Date(approved.updatedAt).toISOString(),
          },

          student: {
            id: String(studentDocument._id),
            organizationId: String(studentDocument.organizationId),
            campusId: studentDocument.campusId
              ? String(studentDocument.campusId)
              : undefined,
            sourceApplicationId: studentDocument.sourceApplicationId
              ? String(studentDocument.sourceApplicationId)
              : undefined,
            firstName: String(studentDocument.firstName),
            lastName: String(studentDocument.lastName),
            preferredName: studentDocument.preferredName
              ? String(studentDocument.preferredName)
              : undefined,
            dateOfBirth: studentDocument.dateOfBirth
              ? new Date(studentDocument.dateOfBirth).toISOString()
              : undefined,
            gender: studentDocument.gender
              ? String(studentDocument.gender)
              : undefined,
            status:
              (studentDocument.status as StudentRecord['status']) ??
              'active',
            contactEmail: studentDocument.contactEmail
              ? String(studentDocument.contactEmail)
              : undefined,
            phone: studentDocument.phone
              ? String(studentDocument.phone)
              : undefined,
            address: studentDocument.address
              ? (studentDocument.address as StudentRecord['address'])
              : undefined,
            emergencyContact: studentDocument.emergencyContact
              ? (studentDocument.emergencyContact as StudentRecord['emergencyContact'])
              : undefined,
            academicHistory: Array.isArray(
              studentDocument.academicHistory,
            )
              ? (studentDocument.academicHistory as StudentRecord['academicHistory'])
              : undefined,
            guardianIds: convertGuardianArray(studentDocument.guardianIds),
            createdAt: new Date(
              studentDocument.createdAt,
            ).toISOString(),
            updatedAt: new Date(
              studentDocument.updatedAt,
            ).toISOString(),
          },

          enrollment: {
            id: String(enrollmentDocument._id),
            organizationId: String(
              enrollmentDocument.organizationId,
            ),
            studentId: String(enrollmentDocument.studentId),
            campusId: enrollmentDocument.campusId
              ? String(enrollmentDocument.campusId)
              : undefined,
            sourceApplicationId: enrollmentDocument.sourceApplicationId
              ? String(enrollmentDocument.sourceApplicationId)
              : undefined,
            gradeLevel: enrollmentDocument.gradeLevel
              ? String(enrollmentDocument.gradeLevel)
              : undefined,
            startDate: enrollmentDocument.startDate
              ? new Date(
                  enrollmentDocument.startDate,
                ).toISOString()
              : undefined,
            endDate: enrollmentDocument.endDate
              ? new Date(
                  enrollmentDocument.endDate,
                ).toISOString()
              : undefined,
            status:
              (enrollmentDocument.status as EnrollmentRecord['status']) ??
              'active',
            createdAt: new Date(
              enrollmentDocument.createdAt,
            ).toISOString(),
            updatedAt: new Date(
              enrollmentDocument.updatedAt,
            ).toISOString(),
          },
        };
      });

      if (!result) {
        throw new AppError(
          500,
          'APPLICATION_APPROVAL_FAILED',
          'Application approval did not produce a result.',
        );
      }

      return result;
    } finally {
      await session.endSession();
    }
  }
}
