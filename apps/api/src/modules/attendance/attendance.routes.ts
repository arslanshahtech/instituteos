import { Router } from 'express';
import mongoose from 'mongoose';
import { AppError } from '../../errors/app-error.js';
import { asyncHandler } from '../../middleware/async-handler.js';
import { env } from '../../config/env.js';
import { authEmailDelivery } from '../auth/auth.email.js';
import {
  createAuthenticationMiddleware,
  csrfProtection,
} from '../auth/auth.middleware.js';
import { MongoAuthRepository } from '../auth/auth.repository.js';
import { AuthService } from '../auth/auth.service.js';
import { MongoOrganizationAccessRepository } from '../tenancy/tenancy.repository.js';
import type { OrganizationAccessRepository } from '../tenancy/tenancy.types.js';
import {
  createOrganizationContextMiddleware,
  requireOrganizationRole,
} from '../tenancy/tenant-context.middleware.js';
import { MongoAttendanceRepository } from './attendance.repository.js';
import { AttendanceService } from './attendance.service.js';
import type {
  AttendanceContext,
  StaffAttendanceStatus,
  StudentAttendanceStatus,
} from './attendance.types.js';

// Managers allowed to manage placements and staff attendance
const staffAttendanceManagers = [
  'organization_owner',
  'organization_admin',
  'campus_admin',
  'principal_director',
  'academic_coordinator',
] as const;

// Roles allowed to take and view student roll-calls (Teachers included)
const studentAttendanceRoles = [
  'organization_owner',
  'organization_admin',
  'campus_admin',
  'principal_director',
  'academic_coordinator',
  'teacher',
] as const;

function bodyObject(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'A valid JSON object is required.',
    );
  }
  return value as Record<string, unknown>;
}

function text(value: unknown, field: string, max = 160): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) {
    throw new AppError(400, 'VALIDATION_ERROR', `Enter a valid ${field}.`);
  }
  return value.trim();
}

function optionalText(
  value: unknown,
  field: string,
  max = 500,
): string | undefined {
  if (value === undefined || value === '') return undefined;
  return text(value, field, max);
}

function queryValue(value: unknown, field: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || value.length > 160) {
    throw new AppError(400, 'VALIDATION_ERROR', `Enter a valid ${field}.`);
  }
  return value || undefined;
}

function objectId(value: unknown, field: string): string {
  const normalized = text(value, field, 24);
  if (!mongoose.isValidObjectId(normalized)) {
    throw new AppError(400, 'VALIDATION_ERROR', `Select a valid ${field}.`);
  }
  return normalized;
}

function organizationContext(response: {
  locals?: {
    organizationContext?: {
      organizationId: string;
      campusIds?: string[];
      role?: string;
      userId?: string;
    };
  };
}): AttendanceContext {
  const context = response.locals?.organizationContext;
  if (!context) {
    throw new AppError(
      404,
      'ORGANIZATION_NOT_FOUND',
      'Organization not found.',
    );
  }
  return {
    organizationId: context.organizationId,
    campusIds: context.campusIds ?? [],
    role: context.role ?? '',
    userId: context.userId,
  };
}

function defaultAuthenticate() {
  const authService = new AuthService(
    new MongoAuthRepository(),
    authEmailDelivery,
    {
      sessionTtlDays: env.authSessionTtlDays,
      requireEmailVerification: env.authRequireEmailVerification,
      webAppUrl: env.authWebAppUrl,
    },
  );
  return createAuthenticationMiddleware(authService);
}

function queryString(
  query: Record<string, unknown>,
  field: string,
): string | undefined {
  const value = queryValue(query[field], field);
  return value === undefined ? undefined : objectId(value, field);
}

export function createAttendanceRouter(
  service: AttendanceService = new AttendanceService(
    new MongoAttendanceRepository(),
  ),
  accessRepository: OrganizationAccessRepository = new MongoOrganizationAccessRepository(),
  authenticate = defaultAuthenticate(),
) {
  const router = Router();
  const resolveOrganization =
    createOrganizationContextMiddleware(accessRepository);

  // Student Attendance: Accessible by Admins and Teachers
  const protectStudentAttendance = [
    authenticate,
    resolveOrganization,
    requireOrganizationRole(studentAttendanceRoles),
  ] as const;

  const protectTeacherAttendance = [
    authenticate,
    resolveOrganization,
    requireOrganizationRole(['teacher']),
  ] as const;

  // Management & Staff Attendance: Accessible only by Admin/Managers
  const protectStaffAttendance = [
    authenticate,
    resolveOrganization,
    requireOrganizationRole(staffAttendanceManagers),
  ] as const;

  const base = '/:organizationId';

  router.get(
    `${base}/attendance/teacher-assignments`,
    ...protectTeacherAttendance,
    asyncHandler(async (_request, response) => {
      const assignments = await service.listTeacherAssignments(
        organizationContext(response),
      );
      response.status(200).json({ items: assignments });
    }),
  );

  router.get(
    `${base}/attendance/students/roster`,
    ...protectStudentAttendance,
    asyncHandler(async (request, response) => {
      const query = request.query as Record<string, unknown>;
      const roster = await service.listStudentRoster(
        organizationContext(response),
        {
          classId: queryString(query, 'classId') ?? '',
          sectionId: queryString(query, 'sectionId') ?? '',
          academicYearId: queryString(query, 'academicYearId') ?? '',
          campusId: queryString(query, 'campusId') ?? '',
          date: queryValue(query.date, 'date') ?? '',
        },
      );
      response.status(200).json({ items: roster });
    }),
  );

  router.get(
    `${base}/attendance/students/eligible`,
    ...protectStaffAttendance,
    asyncHandler(async (request, response) => {
      const query = request.query as Record<string, unknown>;
      const items = await service.listEligibleStudents(
        organizationContext(response),
        queryString(query, 'campusId') ?? '',
        queryString(query, 'academicYearId') ?? '',
      );
      response.status(200).json({ items });
    }),
  );

  // Student placement into classes/sections remains a manager action
  router.post(
    `${base}/attendance/students/placements`,
    ...protectStaffAttendance,
    csrfProtection,
    asyncHandler(async (request, response) => {
      const body = bodyObject(request.body);
      const placement = await service.placeStudent(
        organizationContext(response),
        {
          studentId: objectId(body.studentId, 'student'),
          classId: objectId(body.classId, 'class'),
          sectionId: objectId(body.sectionId, 'section'),
          academicYearId: objectId(body.academicYearId, 'academic year'),
          campusId: objectId(body.campusId, 'campus'),
        },
      );
      response.status(201).json({ placement });
    }),
  );

  router.delete(
    `${base}/attendance/students/placements/:studentId`,
    ...protectStaffAttendance,
    csrfProtection,
    asyncHandler(async (request, response) => {
      const body = bodyObject(request.body);
      const result = await service.removeStudentFromSection(
        organizationContext(response),
        {
          studentId: objectId(request.params.studentId, 'student'),
          classId: objectId(body.classId, 'class'),
          sectionId: objectId(body.sectionId, 'section'),
          academicYearId: objectId(body.academicYearId, 'academic year'),
          campusId: objectId(body.campusId, 'campus'),
        },
      );
      response.status(200).json(result);
    }),
  );

  router.post(
    `${base}/attendance/students/placements/bulk`,
    ...protectStaffAttendance,
    csrfProtection,
    asyncHandler(async (request, response) => {
      const body = bodyObject(request.body);
      if (
        !Array.isArray(body.studentIds) ||
        body.studentIds.length === 0 ||
        body.studentIds.length > 500
      ) {
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'Select between 1 and 500 students to add.',
        );
      }
      const studentIds = [
        ...new Set(body.studentIds.map((value) => objectId(value, 'student'))),
      ];
      const context = organizationContext(response);
      const classId = objectId(body.classId, 'class');
      const sectionId = objectId(body.sectionId, 'section');
      const academicYearId = objectId(body.academicYearId, 'academic year');
      const campusId = objectId(body.campusId, 'campus');
      const eligible = await service.listEligibleStudents(
        context,
        campusId,
        academicYearId,
      );
      const eligibleIds = new Set(eligible.map((student) => student.id));
      const added: string[] = [];
      const skipped: string[] = [];
      const failed: Array<{ studentId: string; message: string }> = [];
      for (const studentId of studentIds) {
        if (!eligibleIds.has(studentId)) {
          skipped.push(studentId);
          continue;
        }
        try {
          await service.placeStudent(context, {
            studentId,
            classId,
            sectionId,
            academicYearId,
            campusId,
          });
          added.push(studentId);
        } catch (error) {
          console.error(
            JSON.stringify({
              level: 'error',
              event: 'student.placement.bulk_item_failed',
              requestId: response.locals.requestId,
              studentId,
              errorName: error instanceof Error ? error.name : 'UnknownError',
              errorMessage:
                error instanceof Error ? error.message : String(error),
              databaseCode:
                typeof error === 'object' && error !== null && 'code' in error
                  ? String(error.code)
                  : undefined,
            }),
          );
          failed.push({
            studentId,
            message:
              error instanceof AppError
                ? error.message
                : 'A server error prevented this student from being added. Contact the administrator with the request ID.',
          });
        }
      }
      response.status(201).json({ added, skipped, failed });
    }),
  );

  router.put(
    `${base}/attendance/students/bulk`,
    ...protectStudentAttendance,
    csrfProtection,
    asyncHandler(async (request, response) => {
      const body = bodyObject(request.body);
      if (!Array.isArray(body.records)) {
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'Attendance records are required.',
        );
      }
      const rowErrors: Array<{ row: number; field: string; message: string }> =
        [];
      const records = body.records.map((entry, index) => {
        if (
          typeof entry !== 'object' ||
          entry === null ||
          Array.isArray(entry)
        ) {
          rowErrors.push({
            row: index + 1,
            field: 'record',
            message: 'A student attendance record is required.',
          });
          return null;
        }
        const record = entry as Record<string, unknown>;
        let studentId = '';
        let status: StudentAttendanceStatus = 'present';
        let remarks: string | undefined;
        try {
          studentId = objectId(record.studentId, 'student');
        } catch {
          rowErrors.push({
            row: index + 1,
            field: 'studentId',
            message: 'Select a valid student.',
          });
        }
        if (
          typeof record.status !== 'string' ||
          !['present', 'absent', 'leave', 'late'].includes(record.status)
        ) {
          rowErrors.push({
            row: index + 1,
            field: 'status',
            message: 'Choose Present, Absent, Late, or Leave.',
          });
        } else {
          status = record.status as StudentAttendanceStatus;
        }
        if (
          record.remarks !== undefined &&
          record.remarks !== '' &&
          (typeof record.remarks !== 'string' ||
            record.remarks.trim().length > 500)
        ) {
          rowErrors.push({
            row: index + 1,
            field: 'remarks',
            message: 'Remarks must be 500 characters or fewer.',
          });
        } else if (
          typeof record.remarks === 'string' &&
          record.remarks.trim()
        ) {
          remarks = record.remarks.trim();
        }
        return studentId
          ? { studentId, status, ...(remarks ? { remarks } : {}) }
          : null;
      });
      if (rowErrors.length) {
        throw new AppError(
          400,
          'ATTENDANCE_ROW_VALIDATION_FAILED',
          'Fix the attendance errors listed for the affected rows. No records were saved.',
          { rows: rowErrors },
        );
      }
      const validRecords = records.filter(
        (record): record is NonNullable<typeof record> => record !== null,
      );
      const attendance = await service.saveStudentAttendance(
        organizationContext(response),
        {
          classId: objectId(body.classId, 'class'),
          sectionId: objectId(body.sectionId, 'section'),
          academicYearId: objectId(body.academicYearId, 'academic year'),
          campusId: objectId(body.campusId, 'campus'),
          date: text(body.date, 'date', 10),
          records: validRecords,
        },
      );
      response.status(200).json({ items: attendance });
    }),
  );

  router.get(
    `${base}/attendance/students`,
    ...protectStudentAttendance,
    asyncHandler(async (request, response) => {
      const query = request.query as Record<string, unknown>;
      const items = await service.listStudentAttendance(
        organizationContext(response),
        {
          ...(queryValue(query.dateFrom, 'dateFrom')
            ? { dateFrom: queryValue(query.dateFrom, 'dateFrom') }
            : {}),
          ...(queryValue(query.dateTo, 'dateTo')
            ? { dateTo: queryValue(query.dateTo, 'dateTo') }
            : {}),
          ...(queryString(query, 'studentId')
            ? { studentId: queryString(query, 'studentId') }
            : {}),
          ...(queryString(query, 'classId')
            ? { classId: queryString(query, 'classId') }
            : {}),
          ...(queryString(query, 'sectionId')
            ? { sectionId: queryString(query, 'sectionId') }
            : {}),
          ...(queryString(query, 'campusId')
            ? { campusId: queryString(query, 'campusId') }
            : {}),
        },
      );
      response.status(200).json({ items });
    }),
  );

  // Staff Attendance stays protected for managers only
  router.post(
    `${base}/attendance/staff`,
    ...protectStaffAttendance,
    csrfProtection,
    asyncHandler(async (request, response) => {
      const body = bodyObject(request.body);
      const status = text(body.status, 'staff attendance status', 20);
      if (!['present', 'absent', 'half-day', 'on-leave'].includes(status)) {
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'Select a valid staff attendance status.',
        );
      }
      const record = await service.saveStaffAttendance(
        organizationContext(response),
        {
          staffId: objectId(body.staffId, 'staff member'),
          date: text(body.date, 'date', 10),
          status: status as StaffAttendanceStatus,
          ...(optionalText(body.remarks, 'remarks')
            ? { remarks: optionalText(body.remarks, 'remarks') }
            : {}),
        },
      );
      response.status(200).json({ attendance: record });
    }),
  );

  router.get(
    `${base}/attendance/staff`,
    ...protectStaffAttendance,
    asyncHandler(async (request, response) => {
      const query = request.query as Record<string, unknown>;
      const items = await service.listStaffAttendance(
        organizationContext(response),
        {
          ...(queryValue(query.dateFrom, 'dateFrom')
            ? { dateFrom: queryValue(query.dateFrom, 'dateFrom') }
            : {}),
          ...(queryValue(query.dateTo, 'dateTo')
            ? { dateTo: queryValue(query.dateTo, 'dateTo') }
            : {}),
          ...(queryString(query, 'staffId')
            ? { staffId: queryString(query, 'staffId') }
            : {}),
          ...(queryString(query, 'campusId')
            ? { campusId: queryString(query, 'campusId') }
            : {}),
        },
      );
      response.status(200).json({ items });
    }),
  );

  return router;
}

export const attendanceRouter = createAttendanceRouter();
