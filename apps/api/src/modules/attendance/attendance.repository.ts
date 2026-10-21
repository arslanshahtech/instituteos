import mongoose, { Types } from 'mongoose';
import { AppError } from '../../errors/app-error.js';
import {
  AcademicClassModel,
  AcademicSectionModel,
  AcademicYearModel,
  TeacherAssignmentModel,
} from '../academics/academics.model.js';
import { AuthUserModel } from '../auth/auth.model.js';
import { CampusModel } from '../tenancy/tenancy.model.js';
import {
  StaffMemberModel,
  StudentModel,
} from '../people/people.model.js';
import {
  StaffAttendanceModel,
  StudentAttendanceModel,
  StudentSectionPlacementModel,
} from './attendance.model.js';
import type {
  AttendanceRepository,
  AttendanceStudentChoice,
  StaffAttendanceInput,
  StaffAttendanceQuery,
  StaffAttendanceRecord,
  StudentAttendanceBulkInput,
  StudentAttendanceQuery,
  StudentAttendanceRecord,
  StudentPlacementInput,
  StudentPlacementRecord,
  StudentRosterMember,
  TeacherAttendanceAssignment,
} from './attendance.types.js';

const oid = (id: string) => new Types.ObjectId(id);
const utcDay = (value: string) => new Date(`${value}T00:00:00.000Z`);
const iso = (value: Date) => new Date(value).toISOString();

function studentAttendanceRecord(
  record: Record<string, unknown>,
): StudentAttendanceRecord {
  return {
    id: String(record._id),
    organizationId: String(record.organizationId),
    studentId: String(record.studentId),
    classId: String(record.classId),
    sectionId: String(record.sectionId),
    academicYearId: String(record.academicYearId),
    campusId: String(record.campusId),
    date: iso(record.date as Date).slice(0, 10),
    status: record.status as StudentAttendanceRecord['status'],
    ...(record.remarks ? { remarks: String(record.remarks) } : {}),
    createdAt: iso(record.createdAt as Date),
    updatedAt: iso(record.updatedAt as Date),
  };
}

function staffAttendanceRecord(
  record: Record<string, unknown>,
): StaffAttendanceRecord {
  return {
    id: String(record._id),
    organizationId: String(record.organizationId),
    staffId: String(record.staffId),
    ...(record.campusId ? { campusId: String(record.campusId) } : {}),
    date: iso(record.date as Date).slice(0, 10),
    status: record.status as StaffAttendanceRecord['status'],
    ...(record.remarks ? { remarks: String(record.remarks) } : {}),
    createdAt: iso(record.createdAt as Date),
    updatedAt: iso(record.updatedAt as Date),
  };
}

function placementRecord(
  record: Record<string, unknown>,
): StudentPlacementRecord {
  return {
    id: String(record._id),
    organizationId: String(record.organizationId),
    studentId: String(record.studentId),
    classId: String(record.classId),
    sectionId: String(record.sectionId),
    academicYearId: String(record.academicYearId),
    campusId: String(record.campusId),
    status: record.status === 'inactive' ? 'inactive' : 'active',
  };
}

function dateRangeFilter(input: {
  dateFrom?: string;
  dateTo?: string;
}): Record<string, Date> | undefined {
  if (!input.dateFrom && !input.dateTo) return undefined;
  return {
    ...(input.dateFrom ? { $gte: utcDay(input.dateFrom) } : {}),
    ...(input.dateTo
      ? { $lte: new Date(utcDay(input.dateTo).getTime() + 86_399_999) }
      : {}),
  };
}

export class MongoAttendanceRepository implements AttendanceRepository {
  async listTeacherAssignmentsForUser(
    organizationId: string,
    userId: string,
  ): Promise<TeacherAttendanceAssignment[]> {
    if (
      !Types.ObjectId.isValid(organizationId) ||
      !Types.ObjectId.isValid(userId)
    ) {
      return [];
    }
    const [user] = await AuthUserModel.find({ _id: oid(userId) })
      .select({ email: 1 })
      .limit(1)
      .lean();
    const email =
      typeof user?.email === 'string' ? user.email.trim().toLowerCase() : '';
    if (!email) return [];

    // Staff records currently link to accounts by email. Fail closed if that link is ambiguous.
    const staffMatches = await StaffMemberModel.find({
      organizationId: oid(organizationId),
      email,
      status: 'active',
    })
      .select({ _id: 1 })
      .limit(2)
      .lean();
    if (staffMatches.length !== 1) return [];

    const assignments = await TeacherAssignmentModel.find({
      organizationId: oid(organizationId),
      teacherStaffId: staffMatches[0]!._id,
    })
      .sort({ createdAt: 1 })
      .lean();
    if (!assignments.length) return [];

    const classIds = [
      ...new Set(assignments.map((item) => String(item.classId))),
    ];
    const sectionIds = [
      ...new Set(assignments.map((item) => String(item.sectionId))),
    ];
    const yearIds = [
      ...new Set(assignments.map((item) => String(item.academicYearId))),
    ];
    const [classes, sections, years] = await Promise.all([
      AcademicClassModel.find({
        _id: { $in: classIds.map(oid) },
        organizationId: oid(organizationId),
      })
        .select({ _id: 1, name: 1, campusId: 1 })
        .lean(),
      AcademicSectionModel.find({
        _id: { $in: sectionIds.map(oid) },
        organizationId: oid(organizationId),
      })
        .select({ _id: 1, name: 1, classId: 1 })
        .lean(),
      AcademicYearModel.find({
        _id: { $in: yearIds.map(oid) },
        organizationId: oid(organizationId),
        status: 'active',
      })
        .select({ _id: 1, name: 1 })
        .lean(),
    ]);
    const campusIds = [
      ...new Set(classes.map((item) => String(item.campusId))),
    ];
    const campuses = await CampusModel.find({
      _id: { $in: campusIds.map(oid) },
      organizationId: oid(organizationId),
      status: 'active',
    })
      .select({ _id: 1, name: 1 })
      .lean();

    const classById = new Map(classes.map((item) => [String(item._id), item]));
    const sectionById = new Map(
      sections.map((item) => [String(item._id), item]),
    );
    const yearById = new Map(years.map((item) => [String(item._id), item]));
    const campusById = new Map(
      campuses.map((item) => [String(item._id), item]),
    );

    return assignments.flatMap((assignment) => {
      const classRecord = classById.get(String(assignment.classId));
      const sectionRecord = sectionById.get(String(assignment.sectionId));
      const yearRecord = yearById.get(String(assignment.academicYearId));
      if (
        !classRecord ||
        !sectionRecord ||
        !yearRecord ||
        String(sectionRecord.classId) !== String(classRecord._id)
      )
        return [];
      const campusId = String(classRecord.campusId);
      const campusRecord = campusById.get(campusId);
      if (!campusRecord) return [];
      return [
        {
          id: String(assignment._id),
          classId: String(classRecord._id),
          className: String(classRecord.name),
          sectionId: String(sectionRecord._id),
          sectionName: String(sectionRecord.name),
          academicYearId: String(yearRecord._id),
          academicYearName: String(yearRecord.name),
          campusId,
          campusName: String(campusRecord.name),
        },
      ];
    });
  }

  async isTeacherAssignedToSection(
    organizationId: string,
    userId: string,
    input: { classId: string; sectionId: string; academicYearId: string },
  ): Promise<boolean> {
    const assignments = await this.listTeacherAssignmentsForUser(
      organizationId,
      userId,
    );
    return assignments.some(
      (assignment) =>
        assignment.classId === input.classId &&
        assignment.sectionId === input.sectionId &&
        assignment.academicYearId === input.academicYearId,
    );
  }

  async getClassCampus(
    organizationId: string,
    classId: string,
  ): Promise<string | null> {
    const record = await AcademicClassModel.findOne({
      _id: oid(classId),
      organizationId: oid(organizationId),
    })
      .select({ campusId: 1 })
      .lean();
    return record ? String(record.campusId) : null;
  }

  async validateSection(
    organizationId: string,
    classId: string,
    sectionId: string,
  ): Promise<boolean> {
    return Boolean(
      await AcademicSectionModel.exists({
        _id: oid(sectionId),
        classId: oid(classId),
        organizationId: oid(organizationId),
      }),
    );
  }

  async validateAcademicYear(
    organizationId: string,
    academicYearId: string,
    date: string,
  ): Promise<boolean> {
    const day = utcDay(date);
    return Boolean(
      await AcademicYearModel.exists({
        _id: oid(academicYearId),
        organizationId: oid(organizationId),
        status: 'active',
        startDate: { $lte: day },
        endDate: { $gte: day },
      }),
    );
  }

  async validateActiveAcademicYear(
    organizationId: string,
    academicYearId: string,
  ): Promise<boolean> {
    return Boolean(
      await AcademicYearModel.exists({
        _id: oid(academicYearId),
        organizationId: oid(organizationId),
        status: 'active',
      }),
    );
  }

  async validateStudentEnrollment(
    organizationId: string,
    studentId: string,
    campusId: string,
  ): Promise<boolean> {
    const student = await StudentModel.exists({
      _id: oid(studentId),
      organizationId: oid(organizationId),
      campusId: oid(campusId),
      status: 'active',
    });
    // Class placement is recorded in StudentSectionPlacementModel.
    // Do not create an unrelated admissions Enrollment record here: that
    // model has its own admission/source-application uniqueness rules.
    return Boolean(student);
  }

  async listEligibleStudents(
    organizationId: string,
    campusId: string,
    academicYearId: string,
  ): Promise<AttendanceStudentChoice[]> {
    // A student can have only one active class placement per academic year.
    // Exclude only students already placed at this campus for the selected year.
    const placements = await StudentSectionPlacementModel.find({
      organizationId: oid(organizationId),
      campusId: oid(campusId),
      academicYearId: oid(academicYearId),
      status: 'active',
    })
      .select({ studentId: 1 })
      .lean();
    const placedIds = placements.map((item) => item.studentId);
    const students = await StudentModel.find({
      organizationId: oid(organizationId),
      campusId: oid(campusId),
      status: 'active',
      _id: { $nin: placedIds },
    })
      .select({ _id: 1, firstName: 1, lastName: 1, preferredName: 1 })
      .sort({ lastName: 1, firstName: 1 })
      .lean();

    // Students created directly in the directory may not have an enrollment
    // until they are assigned to a class. Keep them eligible for that action.
    return students.map((student) => ({
      id: String(student._id),
      firstName: String(student.firstName),
      lastName: String(student.lastName),
      ...(student.preferredName
        ? { preferredName: String(student.preferredName) }
        : {}),
    }));
  }

  async upsertStudentPlacements(
    organizationId: string,
    input: StudentPlacementInput,
  ): Promise<StudentPlacementRecord> {
    const record = await StudentSectionPlacementModel.findOneAndUpdate(
      {
        organizationId: oid(organizationId),
        studentId: oid(input.studentId),
        academicYearId: oid(input.academicYearId),
      },
      {
        $set: {
          ...input,
          studentId: oid(input.studentId),
          classId: oid(input.classId),
          sectionId: oid(input.sectionId),
          academicYearId: oid(input.academicYearId),
          campusId: oid(input.campusId),
          status: 'active',
        },
      },
      { upsert: true, new: true, runValidators: true },
    ).lean();
    if (!record) {
      throw new AppError(
        500,
        'STUDENT_PLACEMENT_FAILED',
        'The student placement could not be saved.',
      );
    }
    return placementRecord(record);
  }

  async deactivateStudentPlacement(
    organizationId: string,
    input: StudentPlacementInput,
  ): Promise<boolean> {
    const result = await StudentSectionPlacementModel.updateOne(
      {
        organizationId: oid(organizationId),
        studentId: oid(input.studentId),
        classId: oid(input.classId),
        sectionId: oid(input.sectionId),
        academicYearId: oid(input.academicYearId),
        campusId: oid(input.campusId),
        status: 'active',
      },
      { $set: { status: 'inactive' } },
    );
    return result.modifiedCount > 0;
  }

  async listStudentRoster(
    organizationId: string,
    input: Pick<
      StudentAttendanceBulkInput,
      'classId' | 'sectionId' | 'academicYearId' | 'campusId' | 'date'
    >,
  ): Promise<StudentRosterMember[]> {
    const placements = await StudentSectionPlacementModel.find({
      organizationId: oid(organizationId),
      classId: oid(input.classId),
      sectionId: oid(input.sectionId),
      academicYearId: oid(input.academicYearId),
      campusId: oid(input.campusId),
      status: 'active',
    })
      .select({ studentId: 1 })
      .lean();
    const studentIds = placements.map((placement) => placement.studentId);
    if (!studentIds.length) return [];
    const [students, attendance] = await Promise.all([
      StudentModel.find({
        organizationId: oid(organizationId),
        campusId: oid(input.campusId),
        status: 'active',
        _id: { $in: studentIds },
      })
        .select({
          _id: 1,
          firstName: 1,
          lastName: 1,
          preferredName: 1,
          contactEmail: 1,
          phone: 1,
        })
        .sort({ lastName: 1, firstName: 1 })
        .lean(),
      StudentAttendanceModel.find({
        organizationId: oid(organizationId),
        sectionId: oid(input.sectionId),
        academicYearId: oid(input.academicYearId),
        date: utcDay(input.date),
        studentId: { $in: studentIds },
      })
        .select({ studentId: 1, status: 1, remarks: 1 })
        .lean(),
    ]);
    const marks = new Map(
      attendance.map((item) => [String(item.studentId), item]),
    );
    // The active class placement is the roster source of truth. Requiring a
    // separate admissions Enrollment record hides valid directory-created students.
    return students.map((student) => {
        const mark = marks.get(String(student._id));
        return {
          id: String(student._id),
          firstName: String(student.firstName),
          lastName: String(student.lastName),
          ...(student.preferredName
            ? { preferredName: String(student.preferredName) }
            : {}),
          ...(student.contactEmail
            ? { contactEmail: String(student.contactEmail) }
            : {}),
          ...(student.phone ? { phone: String(student.phone) } : {}),
          ...(mark
            ? {
                status: mark.status as StudentRosterMember['status'],
                ...(mark.remarks ? { remarks: String(mark.remarks) } : {}),
              }
            : {}),
        };
      });
  }

  async saveStudentAttendance(
    organizationId: string,
    input: StudentAttendanceBulkInput,
  ): Promise<StudentAttendanceRecord[]> {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        await StudentAttendanceModel.bulkWrite(
          input.records.map((record) => ({
            updateOne: {
              filter: {
                organizationId: oid(organizationId),
                studentId: oid(record.studentId),
                date: utcDay(input.date),
                academicYearId: oid(input.academicYearId),
              },
              update: {
                $set: {
                  organizationId: oid(organizationId),
                  studentId: oid(record.studentId),
                  classId: oid(input.classId),
                  sectionId: oid(input.sectionId),
                  academicYearId: oid(input.academicYearId),
                  campusId: oid(input.campusId),
                  date: utcDay(input.date),
                  status: record.status,
                  remarks: record.remarks ?? '',
                },
              },
              upsert: true,
            },
          })),
          { ordered: true, session },
        );
      });
    } catch (error) {
      if (
        error instanceof Error &&
        /transaction numbers are only allowed|replica set|mongos/i.test(
          error.message,
        )
      ) {
        throw new AppError(
          503,
          'ATOMIC_ATTENDANCE_REQUIRES_TRANSACTIONS',
          'Attendance was not saved because the database does not support transactions. Configure MongoDB as a replica set and retry; no attendance changes were committed.',
        );
      }
      throw error;
    } finally {
      await session.endSession();
    }
    return this.listStudentAttendance(
      organizationId,
      {
        dateFrom: input.date,
        dateTo: input.date,
        classId: input.classId,
        sectionId: input.sectionId,
      },
      [input.campusId],
    );
  }

  async listStudentAttendance(
    organizationId: string,
    input: StudentAttendanceQuery,
    campusIds?: string[],
  ): Promise<StudentAttendanceRecord[]> {
    if (campusIds?.length === 0) return [];
    const filter: Record<string, unknown> = {
      organizationId: oid(organizationId),
    };
    if (input.studentId) filter.studentId = oid(input.studentId);
    if (input.classId) filter.classId = oid(input.classId);
    if (input.sectionId) filter.sectionId = oid(input.sectionId);
    const allowedCampuses =
      input.campusId && campusIds?.length
        ? campusIds.includes(input.campusId)
          ? [input.campusId]
          : []
        : (campusIds ?? (input.campusId ? [input.campusId] : undefined));
    if (allowedCampuses?.length === 0) return [];
    if (allowedCampuses) filter.campusId = { $in: allowedCampuses.map(oid) };
    const range = dateRangeFilter(input);
    if (range) filter.date = range;
    const records = await StudentAttendanceModel.find(filter)
      .sort({ date: -1, sectionId: 1, studentId: 1 })
      .limit(5000)
      .lean();
    return records.map((record) => studentAttendanceRecord(record));
  }

  async validateStaff(
    organizationId: string,
    staffId: string,
  ): Promise<{ campusId?: string } | null> {
    const record = await StaffMemberModel.findOne({
      _id: oid(staffId),
      organizationId: oid(organizationId),
      status: { $in: ['active', 'on_leave'] },
    })
      .select({ campusId: 1 })
      .lean();
    return record
      ? {
          ...(record.campusId ? { campusId: String(record.campusId) } : {}),
        }
      : null;
  }

  async saveStaffAttendance(
    organizationId: string,
    campusId: string | undefined,
    input: StaffAttendanceInput,
  ): Promise<StaffAttendanceRecord> {
    const record = await StaffAttendanceModel.findOneAndUpdate(
      {
        organizationId: oid(organizationId),
        staffId: oid(input.staffId),
        date: utcDay(input.date),
      },
      {
        $set: {
          organizationId: oid(organizationId),
          staffId: oid(input.staffId),
          campusId: campusId ? oid(campusId) : null,
          date: utcDay(input.date),
          status: input.status,
          remarks: input.remarks ?? '',
        },
      },
      { upsert: true, new: true, runValidators: true },
    ).lean();
    if (!record) {
      throw new AppError(
        500,
        'STAFF_ATTENDANCE_FAILED',
        'Staff attendance could not be saved.',
      );
    }
    return staffAttendanceRecord(record);
  }

  async listStaffAttendance(
    organizationId: string,
    input: StaffAttendanceQuery,
    campusIds?: string[],
  ): Promise<StaffAttendanceRecord[]> {
    if (campusIds?.length === 0) return [];
    const filter: Record<string, unknown> = {
      organizationId: oid(organizationId),
    };
    if (input.staffId) filter.staffId = oid(input.staffId);
    const allowedCampuses =
      input.campusId && campusIds?.length
        ? campusIds.includes(input.campusId)
          ? [input.campusId]
          : []
        : (campusIds ?? (input.campusId ? [input.campusId] : undefined));
    if (allowedCampuses?.length === 0) return [];
    if (allowedCampuses) filter.campusId = { $in: allowedCampuses.map(oid) };
    const range = dateRangeFilter(input);
    if (range) filter.date = range;
    const records = await StaffAttendanceModel.find(filter)
      .sort({ date: -1, staffId: 1 })
      .limit(5000)
      .lean();
    return records.map((record) => staffAttendanceRecord(record));
  }
}
