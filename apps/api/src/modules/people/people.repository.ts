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
import { CampusModel } from '../tenancy/tenancy.model.js';

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

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function convertGuardianArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item));
}

function studentDocumentInput(
  organizationId: string,
  input: StudentInput,
  sourceApplicationId?: string,
) {
  return {
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
    ...(sourceApplicationId
      ? { sourceApplicationId: idObject(sourceApplicationId) }
      : {}),
  };
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
    const record = await StudentModel.create(
      studentDocumentInput(organizationId, input),
    );
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
    query?: {
      search?: string;
      page?: number;
      pageSize?: number;
      guardianIds?: string[];
    },
  ): Promise<QuerySummary<GuardianRecord>> {
    const { page, pageSize } = normalizePagination(
      query?.page,
      query?.pageSize ?? 20,
    );
    const search = normalizeFilterValue(query?.search);
    const filters: Record<string, unknown> = {
      organizationId: idObject(organizationId),
    };
    if (query?.guardianIds) {
      filters._id = { $in: query.guardianIds.map(idObject) };
    }
    if (search) {
      filters.$and = search.split(/\s+/).map((term) => {
        const safeTerm = escapeRegex(term);
        return {
          $or: [
            { firstName: { $regex: safeTerm, $options: 'i' } },
            { lastName: { $regex: safeTerm, $options: 'i' } },
            { email: { $regex: safeTerm, $options: 'i' } },
          ],
        };
      });
    }
    const [items, total] = await Promise.all([
      GuardianModel.find(filters)
        .sort({ lastName: 1, firstName: 1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
      GuardianModel.countDocuments(filters),
    ]);
    const studentCounts = items.length
      ? await StudentGuardianLinkModel.aggregate<{
          _id: Types.ObjectId;
          count: number;
        }>([
          {
            $match: {
              organizationId: idObject(organizationId),
              guardianId: { $in: items.map((record) => record._id) },
            },
          },
          { $group: { _id: '$guardianId', count: { $sum: 1 } } },
        ])
      : [];
    const studentCountByGuardian = new Map(
      studentCounts.map((entry) => [String(entry._id), entry.count]),
    );
    return {
      items: items.map((record) => ({
        id: String(record._id),
        studentCount: studentCountByGuardian.get(String(record._id)) ?? 0,
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

  async createGuardianWithLink(
    organizationId: string,
    input: GuardianInput,
    link: Omit<GuardianLinkInput, 'guardianId'>,
  ): Promise<GuardianRecord> {
    const session = await mongoose.startSession();
    let guardianId: Types.ObjectId | undefined;
    try {
      await session.withTransaction(async () => {
        const student = await StudentModel.findOne({
          _id: idObject(link.studentId),
          organizationId: idObject(organizationId),
        })
          .session(session)
          .lean();
        if (!student)
          throw new AppError(404, 'STUDENT_NOT_FOUND', 'Student not found.');

        const [guardian] = await GuardianModel.create(
          [
            {
              organizationId: idObject(organizationId),
              firstName: input.firstName,
              lastName: input.lastName,
              relationship: input.relationship ?? 'guardian',
              phone: input.phone,
              email: input.email,
              communicationPreference: input.communicationPreference ?? 'email',
              address: input.address,
            },
          ],
          { session },
        );
        if (!guardian)
          throw new AppError(
            500,
            'GUARDIAN_CREATE_FAILED',
            'Guardian could not be created.',
          );
        guardianId = guardian._id;

        await StudentGuardianLinkModel.create(
          [
            {
              organizationId: idObject(organizationId),
              studentId: idObject(link.studentId),
              guardianId,
              relationship: link.relationship,
              isPrimary: Boolean(link.isPrimary),
            },
          ],
          { session },
        );
        await StudentModel.updateOne(
          {
            _id: idObject(link.studentId),
            organizationId: idObject(organizationId),
          },
          { $addToSet: { guardianIds: guardianId } },
          { session },
        );
      });
    } finally {
      await session.endSession();
    }

    if (!guardianId)
      throw new AppError(
        500,
        'GUARDIAN_CREATE_FAILED',
        'Guardian could not be created.',
      );
    const guardian = await this.getGuardian(organizationId, String(guardianId));
    if (!guardian)
      throw new AppError(404, 'GUARDIAN_NOT_FOUND', 'Guardian not found.');
    return guardian;
  }

  async linkGuardianToStudent(
    organizationId: string,
    input: GuardianLinkInput,
  ): Promise<GuardianLinkRecord> {
    const session = await mongoose.startSession();
    let record: GuardianLinkRecord | undefined;
    try {
      await session.withTransaction(async () => {
        const student = await StudentModel.findOne({
          _id: idObject(input.studentId),
          organizationId: idObject(organizationId),
        })
          .session(session)
          .lean();
        if (!student)
          throw new AppError(404, 'STUDENT_NOT_FOUND', 'Student not found.');
        const guardian = await GuardianModel.findOne({
          _id: idObject(input.guardianId),
          organizationId: idObject(organizationId),
        })
          .session(session)
          .lean();
        if (!guardian)
          throw new AppError(404, 'GUARDIAN_NOT_FOUND', 'Guardian not found.');

        const linkRecord = await StudentGuardianLinkModel.findOneAndUpdate(
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
          {
            new: true,
            upsert: true,
            runValidators: true,
            session,
          },
        ).lean();
        if (!linkRecord)
          throw new AppError(
            500,
            'GUARDIAN_LINK_FAILED',
            'Guardian relationship could not be saved.',
          );

        await StudentModel.updateOne(
          {
            _id: idObject(input.studentId),
            organizationId: idObject(organizationId),
          },
          { $addToSet: { guardianIds: idObject(input.guardianId) } },
          { session },
        );
        record = {
          id: String(linkRecord._id),
          organizationId: String(linkRecord.organizationId),
          studentId: String(linkRecord.studentId),
          guardianId: String(linkRecord.guardianId),
          relationship:
            linkRecord.relationship as GuardianLinkRecord['relationship'],
          isPrimary: Boolean(linkRecord.isPrimary),
          createdAt: new Date(linkRecord.createdAt).toISOString(),
          updatedAt: new Date(linkRecord.updatedAt).toISOString(),
        };
      });
    } finally {
      await session.endSession();
    }
    if (!record)
      throw new AppError(
        500,
        'GUARDIAN_LINK_FAILED',
        'Guardian relationship could not be saved.',
      );

    return {
      ...record,
    };
  }

  async listGuardianLinks(
    organizationId: string,
    studentId?: string,
    guardianId?: string,
    campusIds?: string[],
  ): Promise<GuardianLinkRecord[]> {
    if (campusIds && campusIds.length === 0) return [];
    const filters: Record<string, unknown> = {
      organizationId: idObject(organizationId),
    };
    if (studentId) filters.studentId = idObject(studentId);
    if (guardianId) filters.guardianId = idObject(guardianId);
    if (campusIds) {
      const students = await StudentModel.find({
        organizationId: idObject(organizationId),
        campusId: { $in: campusIds.map(idObject) },
      })
        .select({ _id: 1 })
        .lean();
      if (students.length === 0) return [];
      const scopedStudentIds = students.map((student) => String(student._id));
      if (studentId && !scopedStudentIds.includes(studentId)) return [];
      if (!studentId)
        filters.studentId = { $in: students.map((student) => student._id) };
    }
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

  async unlinkGuardianFromStudent(
    organizationId: string,
    studentId: string,
    guardianId: string,
  ): Promise<boolean> {
    const session = await mongoose.startSession();
    let removed = false;
    try {
      await session.withTransaction(async () => {
        const result = await StudentGuardianLinkModel.deleteOne(
          {
            organizationId: idObject(organizationId),
            studentId: idObject(studentId),
            guardianId: idObject(guardianId),
          },
          { session },
        );
        removed = result.deletedCount > 0;
        if (removed) {
          await StudentModel.updateOne(
            {
              _id: idObject(studentId),
              organizationId: idObject(organizationId),
            },
            { $pull: { guardianIds: idObject(guardianId) } },
            { session },
          );
        }
      });
    } finally {
      await session.endSession();
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
    const { page, pageSize } = normalizePagination(
      query?.page,
      query?.pageSize ?? 20,
    );
    const filters: Record<string, unknown> = {
      organizationId: idObject(organizationId),
    };
    if (query?.status) filters.status = query.status;
    if (query?.department)
      filters.department = {
        $regex: escapeRegex(query.department),
        $options: 'i',
      };
    if (query?.campusId) filters.campusId = idObject(query.campusId);
    if (query?.campusIds && query.campusIds.length > 0) {
      filters.campusId = { $in: query.campusIds.map((id) => idObject(id)) };
    }
    const search = normalizeFilterValue(query?.search);
    if (search) {
      const fields = [
        'firstName',
        'lastName',
        'email',
        'employeeCode',
        'department',
        'designation',
        'role',
      ];
      filters.$and = search
        .split(/\s+/)
        .filter(Boolean)
        .map((term) => ({
          $or: fields.map((field) => ({
            [field]: { $regex: escapeRegex(term), $options: 'i' },
          })),
        }));
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
        employeeCode: record.employeeCode
          ? String(record.employeeCode)
          : undefined,
        department: record.department ? String(record.department) : undefined,
        designation: record.designation
          ? String(record.designation)
          : record.role
            ? String(record.role)
            : undefined,
        qualification: record.qualification
          ? String(record.qualification)
          : undefined,
        qualifications: Array.isArray(record.qualifications)
          ? record.qualifications.map(String)
          : undefined,
        subjects: Array.isArray(record.subjects)
          ? record.subjects.map(String)
          : undefined,
        dateOfBirth: record.dateOfBirth
          ? new Date(record.dateOfBirth).toISOString()
          : undefined,
        gender: record.gender ? String(record.gender) : undefined,
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
      employeeCode: record.employeeCode
        ? String(record.employeeCode)
        : undefined,
      department: record.department ? String(record.department) : undefined,
      designation: record.designation
        ? String(record.designation)
        : record.role
          ? String(record.role)
          : undefined,
      qualification: record.qualification
        ? String(record.qualification)
        : undefined,
      qualifications: Array.isArray(record.qualifications)
        ? record.qualifications.map(String)
        : undefined,
      subjects: Array.isArray(record.subjects)
        ? record.subjects.map(String)
        : undefined,
      dateOfBirth: record.dateOfBirth
        ? new Date(record.dateOfBirth).toISOString()
        : undefined,
      gender: record.gender ? String(record.gender) : undefined,
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
    if (
      input.campusId &&
      !(await CampusModel.exists({
        _id: idObject(input.campusId),
        organizationId: idObject(organizationId),
      }))
    ) {
      throw new AppError(404, 'CAMPUS_NOT_FOUND', 'Campus not found.');
    }
    const record = await StaffMemberModel.create({
      organizationId: idObject(organizationId),
      campusId: input.campusId ? idObject(input.campusId) : null,
      firstName: input.firstName,
      lastName: input.lastName,
      employeeCode: input.employeeCode,
      department: input.department,
      designation: input.designation ?? input.role,
      qualification: input.qualification,
      qualifications: input.qualifications,
      subjects: input.subjects,
      dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : null,
      gender: input.gender,
      status: input.status ?? 'active',
      role: input.role ?? input.designation,
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
    if (changes.campusId !== undefined) {
      if (
        changes.campusId &&
        !(await CampusModel.exists({
          _id: idObject(changes.campusId),
          organizationId: idObject(organizationId),
        }))
      ) {
        throw new AppError(404, 'CAMPUS_NOT_FOUND', 'Campus not found.');
      }
      update.campusId = changes.campusId ? idObject(changes.campusId) : null;
    }
    if (changes.dateOfBirth !== undefined)
      update.dateOfBirth = changes.dateOfBirth
        ? new Date(changes.dateOfBirth)
        : null;
    if (changes.designation !== undefined)
      update.role = changes.role ?? changes.designation;
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
      employeeCode: record.employeeCode
        ? String(record.employeeCode)
        : undefined,
      department: record.department ? String(record.department) : undefined,
      designation: record.designation
        ? String(record.designation)
        : record.role
          ? String(record.role)
          : undefined,
      qualification: record.qualification
        ? String(record.qualification)
        : undefined,
      qualifications: Array.isArray(record.qualifications)
        ? record.qualifications.map(String)
        : undefined,
      subjects: Array.isArray(record.subjects)
        ? record.subjects.map(String)
        : undefined,
      dateOfBirth: record.dateOfBirth
        ? new Date(record.dateOfBirth).toISOString()
        : undefined,
      gender: record.gender ? String(record.gender) : undefined,
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
      gradeLevelInterest: record.gradeLevelInterest
        ? String(record.gradeLevelInterest)
        : undefined,
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
      const terms = query.search.trim().split(/\s+/).filter(Boolean);
      filters.$and = terms.map((term) => {
        const safeTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return {
          $or: [
            { firstName: { $regex: safeTerm, $options: 'i' } },
            { lastName: { $regex: safeTerm, $options: 'i' } },
            { email: { $regex: safeTerm, $options: 'i' } },
          ],
        };
      });
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
        gradeLevelInterest: record.gradeLevelInterest
          ? String(record.gradeLevelInterest)
          : undefined,
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
      gradeLevelInterest: input.gradeLevelInterest,
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
      gradeLevelInterest: record.gradeLevelInterest
        ? String(record.gradeLevelInterest)
        : undefined,
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
      gradeLevelInterest: record.gradeLevelInterest
        ? String(record.gradeLevelInterest)
        : undefined,
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
      search?: string;
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
    if (query?.search) {
      const terms = query.search.trim().split(/\s+/).filter(Boolean);
      filters.$and = terms.map((term) => {
        const safeTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return {
          $or: [
            { firstName: { $regex: safeTerm, $options: 'i' } },
            { lastName: { $regex: safeTerm, $options: 'i' } },
            { email: { $regex: safeTerm, $options: 'i' } },
            { program: { $regex: safeTerm, $options: 'i' } },
          ],
        };
      });
    }
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
    const convertedStudents = items.length
      ? await StudentModel.find({
          organizationId: idObject(organizationId),
          sourceApplicationId: { $in: items.map((record) => record._id) },
        })
          .select({ _id: 1, sourceApplicationId: 1 })
          .lean()
      : [];
    const studentIdsByApplication = new Map(
      convertedStudents.map((student) => [
        String(student.sourceApplicationId),
        String(student._id),
      ]),
    );
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
        dateOfBirth: record.dateOfBirth ? String(record.dateOfBirth) : undefined,
        guardianName: record.guardianName ? String(record.guardianName) : undefined,
        guardianPhone: record.guardianPhone ? String(record.guardianPhone) : undefined,
        feePlan: record.feePlan ? record.feePlan as ApplicationRecord['feePlan'] : undefined,
        status: (record.status as ApplicationRecord['status']) ?? 'draft',
        convertedStudentId: studentIdsByApplication.get(String(record._id)),
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
    const convertedStudent = await StudentModel.findOne({
      organizationId: idObject(organizationId),
      sourceApplicationId: idObject(applicationId),
    })
      .select({ _id: 1 })
      .lean();
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
      dateOfBirth: record.dateOfBirth ? String(record.dateOfBirth) : undefined,
      guardianName: record.guardianName ? String(record.guardianName) : undefined,
      guardianPhone: record.guardianPhone ? String(record.guardianPhone) : undefined,
      feePlan: record.feePlan ? record.feePlan as ApplicationRecord['feePlan'] : undefined,
      status: (record.status as ApplicationRecord['status']) ?? 'draft',
      convertedStudentId: convertedStudent
        ? String(convertedStudent._id)
        : undefined,
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
      dateOfBirth: input.dateOfBirth,
      guardianName: input.guardianName,
      guardianPhone: input.guardianPhone,
      feePlan: input.feePlan,
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
      dateOfBirth: record.dateOfBirth ? String(record.dateOfBirth) : undefined,
      guardianName: record.guardianName ? String(record.guardianName) : undefined,
      guardianPhone: record.guardianPhone ? String(record.guardianPhone) : undefined,
      feePlan: record.feePlan ? record.feePlan as ApplicationRecord['feePlan'] : undefined,
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
      dateOfBirth: record.dateOfBirth ? String(record.dateOfBirth) : undefined,
      guardianName: record.guardianName ? String(record.guardianName) : undefined,
      guardianPhone: record.guardianPhone ? String(record.guardianPhone) : undefined,
      feePlan: record.feePlan ? record.feePlan as ApplicationRecord['feePlan'] : undefined,
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
    campusId?: string,
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

        const assignedCampusId = campusId ?? (application.campusId ? String(application.campusId) : undefined);
        if (!assignedCampusId) {
          throw new AppError(400, 'CAMPUS_REQUIRED', 'Assign a campus before approving this application.');
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
              studentDocumentInput(
                organizationId,
                {
                  firstName: String(application.firstName),
                  lastName: String(application.lastName),
                  dateOfBirth: application.dateOfBirth
                    ? String(application.dateOfBirth)
                    : undefined,
                  status: 'active',
                  contactEmail: application.email
                    ? String(application.email)
                    : undefined,
                  phone: application.phone
                    ? String(application.phone)
                    : undefined,
                  campusId: assignedCampusId,
                },
                applicationId,
              ),
            ],
            { session },
          );

          studentDocument = createdStudent;
        } else if (String(existingStudent.campusId ?? '') !== assignedCampusId) {
          await StudentModel.updateOne(
            { _id: existingStudent._id, organizationId: idObject(organizationId) },
            { $set: { campusId: idObject(assignedCampusId) } },
            { session },
          );
          studentDocument = await StudentModel.findById(existingStudent._id).session(session).lean();
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
                campusId: idObject(assignedCampusId),
                sourceApplicationId: idObject(applicationId),
                status: 'active',
                gradeLevel: application.program
                  ? String(application.program)
                  : 'New admission',
              },
            ],
            { session },
          );

          enrollmentDocument = createdEnrollment;
        } else if (String(enrollmentDocument.campusId ?? '') !== assignedCampusId) {
          await EnrollmentModel.updateOne(
            { _id: enrollmentDocument._id, organizationId: idObject(organizationId) },
            { $set: { campusId: idObject(assignedCampusId) } },
            { session },
          );
          enrollmentDocument = await EnrollmentModel.findById(enrollmentDocument._id).session(session).lean();
        }

        const approved = await AdmissionApplicationModel.findOneAndUpdate(
          {
            _id: idObject(applicationId),
            organizationId: idObject(organizationId),
          },
          {
            $set: {
              status: 'approved',
              campusId: idObject(assignedCampusId),
              decisionReason: decisionReason ?? 'Approved by admissions review',
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
            campusId: approved.campusId ? String(approved.campusId) : undefined,
            inquiryId: approved.inquiryId
              ? String(approved.inquiryId)
              : undefined,
            firstName: String(approved.firstName),
            lastName: String(approved.lastName),
            email: approved.email ? String(approved.email) : undefined,
            phone: approved.phone ? String(approved.phone) : undefined,
            source: approved.source ? String(approved.source) : undefined,
            program: approved.program ? String(approved.program) : undefined,
            dateOfBirth: approved.dateOfBirth ? String(approved.dateOfBirth) : undefined,
            guardianName: approved.guardianName ? String(approved.guardianName) : undefined,
            guardianPhone: approved.guardianPhone ? String(approved.guardianPhone) : undefined,
            feePlan: approved.feePlan ? approved.feePlan as ApplicationRecord['feePlan'] : undefined,
            status:
              (approved.status as ApplicationRecord['status']) ?? 'approved',
            notes: approved.notes ? String(approved.notes) : undefined,
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
              (studentDocument.status as StudentRecord['status']) ?? 'active',
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
            academicHistory: Array.isArray(studentDocument.academicHistory)
              ? (studentDocument.academicHistory as StudentRecord['academicHistory'])
              : undefined,
            guardianIds: convertGuardianArray(studentDocument.guardianIds),
            createdAt: new Date(studentDocument.createdAt).toISOString(),
            updatedAt: new Date(studentDocument.updatedAt).toISOString(),
          },

          enrollment: {
            id: String(enrollmentDocument._id),
            organizationId: String(enrollmentDocument.organizationId),
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
              ? new Date(enrollmentDocument.startDate).toISOString()
              : undefined,
            endDate: enrollmentDocument.endDate
              ? new Date(enrollmentDocument.endDate).toISOString()
              : undefined,
            status:
              (enrollmentDocument.status as EnrollmentRecord['status']) ??
              'active',
            createdAt: new Date(enrollmentDocument.createdAt).toISOString(),
            updatedAt: new Date(enrollmentDocument.updatedAt).toISOString(),
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
