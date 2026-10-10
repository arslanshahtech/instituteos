import mongoose from 'mongoose';
import { AppError } from '../../errors/app-error.js';
import type {
  AttendanceContext,
  AttendanceRepository,
  StaffAttendanceInput,
  StaffAttendanceQuery,
  StudentAttendanceBulkInput,
  StudentAttendanceQuery,
  StudentAttendanceStatus,
  StudentPlacementInput,
} from './attendance.types.js';

const studentStatuses: readonly StudentAttendanceStatus[] = [
  'present',
  'absent',
  'late',
  'excused',
];
const staffStatuses = ['present', 'absent', 'half-day', 'on-leave'] as const;

function objectId(value: string, field: string): string {
  if (!mongoose.isValidObjectId(value)) {
    throw new AppError(400, 'VALIDATION_ERROR', `Select a valid ${field}.`);
  }
  return value;
}

function date(value: string, field: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new AppError(400, 'VALIDATION_ERROR', `Enter a valid ${field}.`);
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  ) {
    throw new AppError(400, 'VALIDATION_ERROR', `Enter a valid ${field}.`);
  }
  return value;
}

function dateRange(input: { dateFrom?: string; dateTo?: string }): void {
  if (!input.dateFrom && !input.dateTo) return;
  const from = input.dateFrom
    ? new Date(date(input.dateFrom, 'start date'))
    : undefined;
  const to = input.dateTo
    ? new Date(date(input.dateTo, 'end date'))
    : undefined;
  if (from && to && from > to) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'Start date must not be after end date.',
    );
  }
  if (from && to && to.getTime() - from.getTime() > 366 * 86_400_000) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'Attendance date ranges cannot exceed 366 days.',
    );
  }
}

function campusScope(context: AttendanceContext): string[] | undefined {
  if (context.role === 'campus_admin' && context.campusIds.length === 0) {
    return [];
  }
  return context.campusIds.length ? context.campusIds : undefined;
}

function assertCampus(context: AttendanceContext, campusId: string): void {
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

export class AttendanceService {
  constructor(private readonly repository: AttendanceRepository) {}

  async listStudentRoster(
    context: AttendanceContext,
    input: Pick<
      StudentAttendanceBulkInput,
      'classId' | 'sectionId' | 'academicYearId' | 'campusId' | 'date'
    >,
  ) {
    const normalized = {
      ...input,
      classId: objectId(input.classId, 'class'),
      sectionId: objectId(input.sectionId, 'section'),
      academicYearId: objectId(input.academicYearId, 'academic year'),
      campusId: objectId(input.campusId, 'campus'),
      date: date(input.date, 'date'),
    };
    await this.validateSectionContext(context, normalized);
    return this.repository.listStudentRoster(
      context.organizationId,
      normalized,
    );
  }

  async listEligibleStudents(
    context: AttendanceContext,
    campusId: string,
    academicYearId: string,
  ) {
    const campus = objectId(campusId, 'campus');
    const year = objectId(academicYearId, 'academic year');
    assertCampus(context, campus);
    if (
      !(await this.repository.validateActiveAcademicYear(
        context.organizationId,
        year,
      ))
    ) {
      throw new AppError(
        404,
        'ACADEMIC_YEAR_NOT_FOUND',
        'Active academic year not found.',
      );
    }
    return this.repository.listEligibleStudents(
      context.organizationId,
      campus,
      year,
    );
  }

  async placeStudent(context: AttendanceContext, input: StudentPlacementInput) {
    const normalized = {
      studentId: objectId(input.studentId, 'student'),
      classId: objectId(input.classId, 'class'),
      sectionId: objectId(input.sectionId, 'section'),
      academicYearId: objectId(input.academicYearId, 'academic year'),
      campusId: objectId(input.campusId, 'campus'),
    };
    assertCampus(context, normalized.campusId);
    await this.validateSectionContext(context, {
      ...normalized,
      date: undefined,
    });
    if (
      !(await this.repository.validateStudentEnrollment(
        context.organizationId,
        normalized.studentId,
        normalized.campusId,
      ))
    ) {
      throw new AppError(
        400,
        'STUDENT_NOT_ACTIVE_AT_CAMPUS',
        'Select an active student enrolled at this campus.',
      );
    }
    return this.repository.upsertStudentPlacements(
      context.organizationId,
      normalized,
    );
  }

  async saveStudentAttendance(
    context: AttendanceContext,
    input: StudentAttendanceBulkInput,
  ) {
    const normalized = {
      ...input,
      classId: objectId(input.classId, 'class'),
      sectionId: objectId(input.sectionId, 'section'),
      academicYearId: objectId(input.academicYearId, 'academic year'),
      campusId: objectId(input.campusId, 'campus'),
      date: date(input.date, 'date'),
    };
    if (
      !Array.isArray(input.records) ||
      input.records.length === 0 ||
      input.records.length > 500
    ) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Mark between 1 and 500 students.',
      );
    }
    await this.validateSectionContext(context, normalized);
    const roster = await this.repository.listStudentRoster(
      context.organizationId,
      normalized,
    );
    if (roster.length === 0) {
      throw new AppError(
        400,
        'EMPTY_SECTION_ROSTER',
        'This section has no active students placed for the academic year.',
      );
    }
    const submitted = new Map<string, (typeof input.records)[number]>();
    for (const record of input.records) {
      const studentId = objectId(record.studentId, 'student');
      if (!studentStatuses.includes(record.status)) {
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'Select a valid student attendance status.',
        );
      }
      if (
        record.remarks !== undefined &&
        (typeof record.remarks !== 'string' ||
          record.remarks.trim().length > 500)
      ) {
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'Remarks must be 500 characters or fewer.',
        );
      }
      if (submitted.has(studentId)) {
        throw new AppError(
          400,
          'DUPLICATE_STUDENT',
          'A student can only be marked once per submission.',
        );
      }
      submitted.set(studentId, record);
    }
    const rosterIds = new Set(roster.map((member) => member.id));
    if (
      submitted.size !== rosterIds.size ||
      [...submitted.keys()].some((studentId) => !rosterIds.has(studentId))
    ) {
      throw new AppError(
        400,
        'ROSTER_MISMATCH',
        'Attendance must include every active student in the selected section and no other students.',
      );
    }
    return this.repository.saveStudentAttendance(context.organizationId, {
      ...normalized,
      records: [...submitted].map(([studentId, record]) => ({
        studentId,
        status: record.status,
        ...(record.remarks?.trim() ? { remarks: record.remarks.trim() } : {}),
      })),
    });
  }

  async listStudentAttendance(
    context: AttendanceContext,
    input: StudentAttendanceQuery,
  ) {
    dateRange(input);
    const normalized = {
      ...input,
      ...(input.studentId
        ? { studentId: objectId(input.studentId, 'student') }
        : {}),
      ...(input.classId ? { classId: objectId(input.classId, 'class') } : {}),
      ...(input.sectionId
        ? { sectionId: objectId(input.sectionId, 'section') }
        : {}),
      ...(input.campusId
        ? { campusId: objectId(input.campusId, 'campus') }
        : {}),
    };
    if (normalized.campusId) assertCampus(context, normalized.campusId);
    return this.repository.listStudentAttendance(
      context.organizationId,
      normalized,
      campusScope(context),
    );
  }

  async saveStaffAttendance(
    context: AttendanceContext,
    input: StaffAttendanceInput,
  ) {
    const staffId = objectId(input.staffId, 'staff member');
    const attendanceDate = date(input.date, 'date');
    if (!(staffStatuses as readonly string[]).includes(input.status)) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Select a valid staff attendance status.',
      );
    }
    if (
      input.remarks !== undefined &&
      (typeof input.remarks !== 'string' || input.remarks.trim().length > 500)
    ) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Remarks must be 500 characters or fewer.',
      );
    }
    const staff = await this.repository.validateStaff(
      context.organizationId,
      staffId,
    );
    if (!staff)
      throw new AppError(
        404,
        'STAFF_MEMBER_NOT_FOUND',
        'Active staff member not found.',
      );
    if (staff.campusId) assertCampus(context, staff.campusId);
    else if (context.role === 'campus_admin' || context.campusIds.length > 0) {
      throw new AppError(
        403,
        'CAMPUS_FORBIDDEN',
        'You are not authorized for organization-wide staff.',
      );
    }
    return this.repository.saveStaffAttendance(
      context.organizationId,
      staff.campusId,
      {
        staffId,
        date: attendanceDate,
        status: input.status,
        ...(input.remarks?.trim() ? { remarks: input.remarks.trim() } : {}),
      },
    );
  }

  async listStaffAttendance(
    context: AttendanceContext,
    input: StaffAttendanceQuery,
  ) {
    dateRange(input);
    const normalized = {
      ...input,
      ...(input.staffId
        ? { staffId: objectId(input.staffId, 'staff member') }
        : {}),
      ...(input.campusId
        ? { campusId: objectId(input.campusId, 'campus') }
        : {}),
    };
    if (normalized.campusId) assertCampus(context, normalized.campusId);
    return this.repository.listStaffAttendance(
      context.organizationId,
      normalized,
      campusScope(context),
    );
  }

  private async validateSectionContext(
    context: AttendanceContext,
    input: {
      classId: string;
      sectionId: string;
      academicYearId: string;
      campusId: string;
      date?: string;
    },
  ): Promise<void> {
    assertCampus(context, input.campusId);
    const campusId = await this.repository.getClassCampus(
      context.organizationId,
      input.classId,
    );
    if (!campusId || campusId !== input.campusId) {
      throw new AppError(
        404,
        'CLASS_NOT_FOUND',
        'Class not found at this campus.',
      );
    }
    if (
      !(await this.repository.validateSection(
        context.organizationId,
        input.classId,
        input.sectionId,
      ))
    ) {
      throw new AppError(
        404,
        'SECTION_NOT_FOUND',
        'Section not found for this class.',
      );
    }
    if (
      !(await this.repository.validateActiveAcademicYear(
        context.organizationId,
        input.academicYearId,
      ))
    ) {
      throw new AppError(
        404,
        'ACADEMIC_YEAR_NOT_FOUND',
        'Active academic year not found.',
      );
    }
    if (
      input.date &&
      !(await this.repository.validateAcademicYear(
        context.organizationId,
        input.academicYearId,
        input.date,
      ))
    ) {
      throw new AppError(
        400,
        'DATE_OUTSIDE_ACADEMIC_YEAR',
        'Attendance date must fall within the selected active academic year.',
      );
    }
  }
}
