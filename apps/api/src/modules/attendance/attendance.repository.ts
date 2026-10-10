import { Types } from 'mongoose';
import { AppError } from '../../errors/app-error.js';
import {
  AcademicClassModel,
  AcademicSectionModel,
  AcademicYearModel,
} from '../academics/academics.model.js';
import {
  EnrollmentModel,
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
    if (!student) return false;
    return Boolean(
      await EnrollmentModel.exists({
        organizationId: oid(organizationId),
        studentId: oid(studentId),
        campusId: oid(campusId),
        status: 'active',
      }),
    );
  }

  async listEligibleStudents(
    organizationId: string,
    campusId: string,
    academicYearId: string,
  ): Promise<AttendanceStudentChoice[]> {
    const placements = await StudentSectionPlacementModel.find({
      organizationId: oid(organizationId),
      academicYearId: oid(academicYearId),
      status: 'active',
    })
      .select({ studentId: 1 })
      .lean();
    const placedIds = placements.map((item) => item.studentId);
    const [students, enrollments] = await Promise.all([
      StudentModel.find({
        organizationId: oid(organizationId),
        campusId: oid(campusId),
        status: 'active',
        _id: { $nin: placedIds },
      })
        .select({ _id: 1, firstName: 1, lastName: 1, preferredName: 1 })
        .sort({ lastName: 1, firstName: 1 })
        .lean(),
      EnrollmentModel.find({
        organizationId: oid(organizationId),
        campusId: oid(campusId),
        status: 'active',
      })
        .select({ studentId: 1 })
        .lean(),
    ]);
    const enrolledIds = new Set(
      enrollments.map((item) => String(item.studentId)),
    );
    return students
      .filter((student) => enrolledIds.has(String(student._id)))
      .map((student) => ({
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
    const [students, enrollments, attendance] = await Promise.all([
      StudentModel.find({
        organizationId: oid(organizationId),
        campusId: oid(input.campusId),
        status: 'active',
        _id: { $in: studentIds },
      })
        .select({ _id: 1, firstName: 1, lastName: 1, preferredName: 1 })
        .sort({ lastName: 1, firstName: 1 })
        .lean(),
      EnrollmentModel.find({
        organizationId: oid(organizationId),
        campusId: oid(input.campusId),
        status: 'active',
        studentId: { $in: studentIds },
      })
        .select({ studentId: 1 })
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
    const enrolledIds = new Set(
      enrollments.map((item) => String(item.studentId)),
    );
    return students
      .filter((student) => enrolledIds.has(String(student._id)))
      .map((student) => {
        const mark = marks.get(String(student._id));
        return {
          id: String(student._id),
          firstName: String(student.firstName),
          lastName: String(student.lastName),
          ...(student.preferredName
            ? { preferredName: String(student.preferredName) }
            : {}),
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
      { ordered: true },
    );
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
