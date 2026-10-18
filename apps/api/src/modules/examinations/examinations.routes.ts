import { Router } from 'express';
import mongoose from 'mongoose';
import { env } from '../../config/env.js';
import { AppError } from '../../errors/app-error.js';
import { asyncHandler } from '../../middleware/async-handler.js';
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
  requireOrganizationPermission,
  requireOrganizationRole,
} from '../tenancy/tenant-context.middleware.js';
import { MongoExaminationsRepository } from './examinations.repository.js';
import { ExaminationsService } from './examinations.service.js';
import type {
  ExamInput,
  ExamMarkInput,
  ExamScheduleInput,
  ExamType,
  GradeBreakdown,
  GradingScaleInput,
} from './examinations.types.js';

// Roles permitted to create, delete or alter exam setups and grading scales
const examManagementRoles = [
  'organization_owner',
  'organization_admin',
  'campus_admin',
  'principal_director',
  'academic_coordinator',
] as const;

function bodyObject(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'A valid JSON object is required.',
    );
  return value as Record<string, unknown>;
}

function stringField(
  body: Record<string, unknown>,
  field: string,
  max: number,
  optional = false,
): string | undefined {
  const value = body[field];
  if (optional && value === undefined) return undefined;
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max)
    throw new AppError(400, 'VALIDATION_ERROR', `Enter a valid ${field}.`);
  return value.trim();
}

function numberField(
  body: Record<string, unknown>,
  field: string,
  optional = false,
): number | undefined {
  const value = body[field];
  if (optional && value === undefined) return undefined;
  if (typeof value !== 'number' || !Number.isFinite(value))
    throw new AppError(400, 'VALIDATION_ERROR', `Enter a valid ${field}.`);
  return value;
}

function booleanField(
  body: Record<string, unknown>,
  field: string,
  optional = false,
): boolean | undefined {
  const value = body[field];
  if (optional && value === undefined) return undefined;
  if (typeof value !== 'boolean')
    throw new AppError(400, 'VALIDATION_ERROR', `Enter a valid ${field}.`);
  return value;
}

function objectId(value: unknown, field: string): string {
  if (typeof value !== 'string' || !mongoose.isValidObjectId(value))
    throw new AppError(400, 'VALIDATION_ERROR', `Select a valid ${field}.`);
  return value;
}

function routeId(value: string | string[] | undefined, label: string) {
  const normalized = Array.isArray(value) ? value[0] : value;
  if (!normalized || !mongoose.isValidObjectId(normalized))
    throw new AppError(404, 'RESOURCE_NOT_FOUND', `${label} not found.`);
  return normalized;
}

function queryId(value: unknown, field: string, optional = false) {
  if (optional && value === undefined) return undefined;
  return objectId(value, field);
}

function examType(value: string | undefined): ExamType {
  if (value !== 'midterm' && value !== 'final' && value !== 'quiz')
    throw new AppError(400, 'VALIDATION_ERROR', 'Select a valid exam type.');
  return value;
}

function examInput(body: Record<string, unknown>): ExamInput {
  return {
    name: stringField(body, 'name', 120)!,
    type: examType(stringField(body, 'type', 20)),
    academicYearId: objectId(body.academicYearId, 'academic year'),
    termId: objectId(body.termId, 'term'),
    campusId: objectId(body.campusId, 'campus'),
    startDate: stringField(body, 'startDate', 10)!,
    endDate: stringField(body, 'endDate', 10)!,
  };
}

function partialExamInput(body: Record<string, unknown>): Partial<ExamInput> {
  const input: Partial<ExamInput> = {};
  if (body.name !== undefined) input.name = stringField(body, 'name', 120)!;
  if (body.type !== undefined)
    input.type = examType(stringField(body, 'type', 20));
  if (body.academicYearId !== undefined)
    input.academicYearId = objectId(body.academicYearId, 'academic year');
  if (body.termId !== undefined) input.termId = objectId(body.termId, 'term');
  if (body.campusId !== undefined)
    input.campusId = objectId(body.campusId, 'campus');
  if (body.startDate !== undefined)
    input.startDate = stringField(body, 'startDate', 10)!;
  if (body.endDate !== undefined)
    input.endDate = stringField(body, 'endDate', 10)!;
  return input;
}

function scheduleInput(body: Record<string, unknown>): ExamScheduleInput {
  return {
    subjectId: objectId(body.subjectId, 'subject'),
    classId: objectId(body.classId, 'class'),
    sectionId: objectId(body.sectionId, 'section'),
    date: stringField(body, 'date', 10)!,
    startTime: stringField(body, 'startTime', 5)!,
    durationMinutes: numberField(body, 'durationMinutes')!,
    totalMarks: numberField(body, 'totalMarks')!,
    passingMarks: numberField(body, 'passingMarks')!,
  };
}

function partialScheduleInput(
  body: Record<string, unknown>,
): Partial<ExamScheduleInput> {
  const input: Partial<ExamScheduleInput> = {};
  for (const field of ['subjectId', 'classId', 'sectionId'] as const) {
    if (body[field] !== undefined) input[field] = objectId(body[field], field);
  }
  if (body.date !== undefined) input.date = stringField(body, 'date', 10)!;
  if (body.startTime !== undefined)
    input.startTime = stringField(body, 'startTime', 5)!;
  for (const field of [
    'durationMinutes',
    'totalMarks',
    'passingMarks',
  ] as const) {
    if (body[field] !== undefined) input[field] = numberField(body, field)!;
  }
  return input;
}

function scaleBreakdowns(value: unknown): GradeBreakdown[] {
  if (!Array.isArray(value) || value.length > 30)
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'Enter valid grade breakdowns.',
    );
  return value.map((entry) => {
    const body = bodyObject(entry);
    return {
      grade: stringField(body, 'grade', 10)!,
      minPercentage: numberField(body, 'minPercentage')!,
      maxPercentage: numberField(body, 'maxPercentage')!,
      gpa: numberField(body, 'gpa')!,
    };
  });
}

function scaleInput(body: Record<string, unknown>): GradingScaleInput {
  return {
    name: stringField(body, 'name', 100)!,
    gradeBreakdowns: scaleBreakdowns(body.gradeBreakdowns),
    ...(body.isActive === undefined
      ? {}
      : { isActive: booleanField(body, 'isActive')! }),
  };
}

function partialScaleInput(
  body: Record<string, unknown>,
): Partial<GradingScaleInput> {
  const input: Partial<GradingScaleInput> = {};
  if (body.name !== undefined) input.name = stringField(body, 'name', 100)!;
  if (body.gradeBreakdowns !== undefined)
    input.gradeBreakdowns = scaleBreakdowns(body.gradeBreakdowns);
  if (body.isActive !== undefined)
    input.isActive = booleanField(body, 'isActive')!;
  return input;
}

function markInputs(value: unknown): ExamMarkInput[] {
  if (!Array.isArray(value) || value.length > 1000)
    throw new AppError(400, 'VALIDATION_ERROR', 'Enter a valid marks roster.');
  return value.map((entry) => {
    const body = bodyObject(entry);
    const marksObtained =
      body.marksObtained === undefined
        ? undefined
        : numberField(body, 'marksObtained');
    const remarks =
      body.remarks === undefined
        ? undefined
        : stringField(body, 'remarks', 500, true);
    return {
      studentId: objectId(body.studentId, 'student'),
      isAbsent: booleanField(body, 'isAbsent')!,
      ...(marksObtained === undefined ? {} : { marksObtained }),
      ...(remarks === undefined ? {} : { remarks }),
    };
  });
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
}) {
  const context = response.locals?.organizationContext;
  if (!context)
    throw new AppError(
      404,
      'ORGANIZATION_NOT_FOUND',
      'Organization not found.',
    );
  return {
    organizationId: context.organizationId,
    campusIds: context.campusIds ?? [],
    role: context.role ?? '',
    userId: context.userId,
  };
}

function defaultAuthenticate() {
  const service = new AuthService(
    new MongoAuthRepository(),
    authEmailDelivery,
    {
      sessionTtlDays: env.authSessionTtlDays,
      requireEmailVerification: env.authRequireEmailVerification,
      webAppUrl: env.authWebAppUrl,
    },
  );
  return createAuthenticationMiddleware(service);
}

export function createExaminationsRouter(
  service: ExaminationsService = new ExaminationsService(
    new MongoExaminationsRepository(),
  ),
  accessRepository: OrganizationAccessRepository = new MongoOrganizationAccessRepository(),
  authenticate = defaultAuthenticate(),
) {
  const router = Router();
  const resolveOrganization =
    createOrganizationContextMiddleware(accessRepository);

  // Read: Accessible to anyone with examination.read (Teachers, Admins, etc.)
  const read = [
    authenticate,
    resolveOrganization,
    requireOrganizationPermission('examination.read'),
  ] as const;

  // Structural Exam / Scale Management: Strict roles only (Admins/Managers)
  const manageExams = [
    authenticate,
    resolveOrganization,
    requireOrganizationPermission('examination.write'),
    requireOrganizationRole(examManagementRoles),
  ] as const;

  // Marks Entry: Teachers and Admins can save marks
  const enterMarks = [
    authenticate,
    resolveOrganization,
    requireOrganizationPermission('examination.write'),
  ] as const;

  const base = '/:organizationId/examinations';

  router.get(
    base,
    ...read,
    asyncHandler(async (request, response) => {
      const campusId = queryId(request.query.campusId, 'campus', true);
      const termId = queryId(request.query.termId, 'term', true);
      response.status(200).json({
        items: await service.listExams(organizationContext(response), {
          ...(campusId ? { campusId } : {}),
          ...(termId ? { termId } : {}),
        }),
      });
    }),
  );

  // Creating exams is restricted to managers
  router.post(
    base,
    ...manageExams,
    csrfProtection,
    asyncHandler(async (request, response) => {
      response.status(201).json({
        exam: await service.createExam(
          organizationContext(response),
          examInput(bodyObject(request.body)),
        ),
      });
    }),
  );

  router.patch(
    `${base}/:examId`,
    ...manageExams,
    csrfProtection,
    asyncHandler(async (request, response) => {
      response.status(200).json({
        exam: await service.updateExam(
          organizationContext(response),
          routeId(request.params.examId, 'Exam'),
          partialExamInput(bodyObject(request.body)),
        ),
      });
    }),
  );

  router.delete(
    `${base}/:examId`,
    ...manageExams,
    csrfProtection,
    asyncHandler(async (request, response) => {
      await service.deleteExam(
        organizationContext(response),
        routeId(request.params.examId, 'Exam'),
      );
      response.status(204).end();
    }),
  );

  router.get(
    `${base}/:examId/schedules`,
    ...read,
    asyncHandler(async (request, response) => {
      response.status(200).json({
        items: await service.listSchedules(
          organizationContext(response),
          routeId(request.params.examId, 'Exam'),
        ),
      });
    }),
  );

  router.post(
    `${base}/:examId/schedules`,
    ...manageExams,
    csrfProtection,
    asyncHandler(async (request, response) => {
      response.status(201).json({
        schedule: await service.createSchedule(
          organizationContext(response),
          routeId(request.params.examId, 'Exam'),
          scheduleInput(bodyObject(request.body)),
        ),
      });
    }),
  );

  router.patch(
    `${base}/schedules/:scheduleId`,
    ...manageExams,
    csrfProtection,
    asyncHandler(async (request, response) => {
      response.status(200).json({
        schedule: await service.updateSchedule(
          organizationContext(response),
          routeId(request.params.scheduleId, 'Exam schedule'),
          partialScheduleInput(bodyObject(request.body)),
        ),
      });
    }),
  );

  router.delete(
    `${base}/schedules/:scheduleId`,
    ...manageExams,
    csrfProtection,
    asyncHandler(async (request, response) => {
      await service.deleteSchedule(
        organizationContext(response),
        routeId(request.params.scheduleId, 'Exam schedule'),
      );
      response.status(204).end();
    }),
  );

  router.get(
    `${base}/grading-scales`,
    ...read,
    asyncHandler(async (_request, response) => {
      response.status(200).json({
        items: await service.listGradingScales(organizationContext(response)),
      });
    }),
  );

  router.post(
    `${base}/grading-scales`,
    ...manageExams,
    csrfProtection,
    asyncHandler(async (request, response) => {
      response.status(201).json({
        gradingScale: await service.createGradingScale(
          organizationContext(response),
          scaleInput(bodyObject(request.body)),
        ),
      });
    }),
  );

  router.patch(
    `${base}/grading-scales/:scaleId`,
    ...manageExams,
    csrfProtection,
    asyncHandler(async (request, response) => {
      response.status(200).json({
        gradingScale: await service.updateGradingScale(
          organizationContext(response),
          routeId(request.params.scaleId, 'Grading scale'),
          partialScaleInput(bodyObject(request.body)),
        ),
      });
    }),
  );

  router.delete(
    `${base}/grading-scales/:scaleId`,
    ...manageExams,
    csrfProtection,
    asyncHandler(async (request, response) => {
      await service.deleteGradingScale(
        organizationContext(response),
        routeId(request.params.scaleId, 'Grading scale'),
      );
      response.status(204).end();
    }),
  );

  router.get(
    `${base}/schedules/:scheduleId/marks`,
    ...read,
    asyncHandler(async (request, response) => {
      const sectionId = queryId(request.query.sectionId, 'section');
      response.status(200).json({
        items: await service.getMarkSheet(
          organizationContext(response),
          routeId(request.params.scheduleId, 'Exam schedule'),
          sectionId!,
        ),
      });
    }),
  );

  // Teachers and authorized staff can record/update marks
  router.put(
    `${base}/schedules/:scheduleId/marks`,
    ...enterMarks,
    csrfProtection,
    asyncHandler(async (request, response) => {
      const body = bodyObject(request.body);
      response.status(200).json({
        items: await service.saveMarks(
          organizationContext(response),
          routeId(request.params.scheduleId, 'Exam schedule'),
          markInputs(body.records),
        ),
      });
    }),
  );

  router.get(
    `${base}/:examId/students/:studentId/report`,
    ...read,
    asyncHandler(async (request, response) => {
      response.status(200).json({
        report: await service.getStudentReport(
          organizationContext(response),
          routeId(request.params.examId, 'Exam'),
          routeId(request.params.studentId, 'Student'),
        ),
      });
    }),
  );

  return router;
}

export const examinationsRouter = createExaminationsRouter();
