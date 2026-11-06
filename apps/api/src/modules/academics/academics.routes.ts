import { Router, type Response } from 'express';
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
  requireOrganizationMethodPermission,
  requireOrganizationRole,
} from '../tenancy/tenant-context.middleware.js';
import { MongoAcademicsRepository } from './academics.repository.js';
import { AcademicsService } from './academics.service.js';
import {
  AcademicYearModel,
  AcademicSectionModel,
  SubjectModel,
  SectionTimetableModel,
  TeacherTimetableModel,
  type SectionTimetableRecord,
} from './academics.model.js';
import { StaffMemberModel } from '../people/people.model.js';
import type {
  AcademicYearInput,
  AcademicsContext,
  ClassInput,
  SectionInput,
  SubjectInput,
  TeacherAssignmentInput,
  TermInput,
} from './academics.types.js';

const academicManagers = [
  'organization_owner',
  'organization_admin',
  'campus_admin',
  'principal_director',
  'academic_coordinator',
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

function requiredString(
  body: Record<string, unknown>,
  field: string,
  max: number,
): string {
  const value = body[field];
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) {
    throw new AppError(400, 'VALIDATION_ERROR', `Enter a valid ${field}.`);
  }
  return value.trim();
}

function optionalString(
  body: Record<string, unknown>,
  field: string,
  max: number,
): string | undefined {
  if (body[field] === undefined || body[field] === '') return undefined;
  return requiredString(body, field, max);
}

function optionalInteger(
  body: Record<string, unknown>,
  field: string,
  min: number,
  max: number,
): number | undefined {
  const value = body[field];
  if (value === undefined) return undefined;
  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value) ||
    value < min ||
    value > max
  ) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      `Enter a whole-number ${field} between ${min} and ${max}.`,
    );
  }
  return value;
}

function academicYearStatus(
  body: Record<string, unknown>,
): NonNullable<AcademicYearInput['status']> {
  const status = requiredString(body, 'status', 20);
  if (status !== 'active' && status !== 'archived') {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'Select a valid academic year status.',
    );
  }
  return status;
}

function routeId(value: string | string[] | undefined, label: string): string {
  const normalized = Array.isArray(value) ? value[0] : value;
  if (!normalized || !mongoose.isValidObjectId(normalized))
    throw new AppError(404, 'RESOURCE_NOT_FOUND', `${label} not found.`);
  return normalized;
}

function organizationContext(response: {
  locals?: {
    organizationContext?: {
      organizationId: string;
      campusIds?: string[];
      role?: string;
    };
  };
}): AcademicsContext {
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
  };
}

function assertAcademicYearLifecycleAuthority(response: Response): void {
  const { role } = organizationContext(response);
  const context = response.locals.organizationContext as
    | {
        role?: string;
        permissions?: readonly string[];
      }
    | undefined;
  if (
    role !== 'organization_owner' &&
    (role !== 'organization_admin' ||
      !context?.permissions?.includes('organization.update'))
  ) {
    throw new AppError(
      403,
      'ACADEMIC_YEAR_LIFECYCLE_FORBIDDEN',
      'Only the Organization Owner or Organization Admin can activate, archive, or delete an academic year.',
    );
  }
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

export function createAcademicsRouter(
  service: AcademicsService = new AcademicsService(
    new MongoAcademicsRepository(),
  ),
  accessRepository: OrganizationAccessRepository = new MongoOrganizationAccessRepository(),
  authenticate = defaultAuthenticate(),
) {
  const router = Router();
  const resolveOrganization =
    createOrganizationContextMiddleware(accessRepository);
  const authorize = requireOrganizationRole(academicManagers);
  const protect = [
    authenticate,
    resolveOrganization,
    authorize,
    requireOrganizationMethodPermission('academics.read', 'academics.write'),
  ] as const;
  const base = '/:organizationId';

  router.get(
    `${base}/academics/campuses`,
    ...protect,
    asyncHandler(async (_request, response) => {
      response.status(200).json({
        campuses: await service.listCampuses(organizationContext(response)),
      });
    }),
  );
  router.get(
    `${base}/academic-years`,
    ...protect,
    asyncHandler(async (_request, response) => {
      response.status(200).json({
        items: await service.listAcademicYears(organizationContext(response)),
      });
    }),
  );
  router.get(
    '/:organizationId/academic-years/summary',
    ...protect,
    asyncHandler(async (_request, response) => {
      response.status(200).json({
        summary: await service.getAcademicYearSummary(
          organizationContext(response),
        ),
      });
    }),
  );
  router.post(
    `${base}/academic-years`,
    ...protect,
    csrfProtection,
    asyncHandler(async (request, response) => {
      const body = bodyObject(request.body);
      if (body.status !== undefined)
        assertAcademicYearLifecycleAuthority(response);
      const input: AcademicYearInput = {
        name: requiredString(body, 'name', 100),
        startDate: requiredString(body, 'startDate', 10),
        endDate: requiredString(body, 'endDate', 10),
        ...(body.status === undefined
          ? {}
          : { status: academicYearStatus(body) }),
      };
      response.status(201).json({
        academicYear: await service.createAcademicYear(
          organizationContext(response),
          input,
        ),
      });
    }),
  );
  router.get(
    `${base}/academic-years/:id`,
    ...protect,
    asyncHandler(async (request, response) => {
      response.status(200).json({
        academicYear: await service.getAcademicYear(
          organizationContext(response),
          routeId(request.params.id!, 'Academic year'),
        ),
      });
    }),
  );
  router.patch(
    `${base}/academic-years/:id`,
    ...protect,
    csrfProtection,
    asyncHandler(async (request, response) => {
      const body = bodyObject(request.body);
      if (body.status !== undefined)
        assertAcademicYearLifecycleAuthority(response);
      const input: Partial<AcademicYearInput> = {
        ...(body.name === undefined
          ? {}
          : { name: requiredString(body, 'name', 100) }),
        ...(body.startDate === undefined
          ? {}
          : { startDate: requiredString(body, 'startDate', 10) }),
        ...(body.endDate === undefined
          ? {}
          : { endDate: requiredString(body, 'endDate', 10) }),
        ...(body.status === undefined
          ? {}
          : { status: academicYearStatus(body) }),
      };
      response.status(200).json({
        academicYear: await service.updateAcademicYear(
          organizationContext(response),
          routeId(request.params.id!, 'Academic year'),
          input,
        ),
      });
    }),
  );
  router.delete(
    `${base}/academic-years/:id`,
    ...protect,
    csrfProtection,
    asyncHandler(async (request, response) => {
      assertAcademicYearLifecycleAuthority(response);
      await service.deleteAcademicYear(
        organizationContext(response),
        routeId(request.params.id!, 'Academic year'),
      );
      response.status(204).end();
    }),
  );

  router.get(
    `${base}/terms`,
    ...protect,
    asyncHandler(async (request, response) => {
      const academicYearId =
        request.query.academicYearId === undefined
          ? undefined
          : routeId(String(request.query.academicYearId), 'Academic year');
      response.status(200).json({
        items: await service.listTerms(
          organizationContext(response),
          academicYearId,
        ),
      });
    }),
  );
  router.post(
    `${base}/terms`,
    ...protect,
    csrfProtection,
    asyncHandler(async (request, response) => {
      const body = bodyObject(request.body);
      const input: TermInput = {
        name: requiredString(body, 'name', 100),
        academicYearId: requiredString(body, 'academicYearId', 24),
        startDate: requiredString(body, 'startDate', 10),
        endDate: requiredString(body, 'endDate', 10),
      };
      response.status(201).json({
        term: await service.createTerm(organizationContext(response), input),
      });
    }),
  );
  router.get(
    `${base}/terms/:id`,
    ...protect,
    asyncHandler(async (request, response) => {
      response.status(200).json({
        term: await service.getTerm(
          organizationContext(response),
          routeId(request.params.id!, 'Term'),
        ),
      });
    }),
  );
  router.patch(
    `${base}/terms/:id`,
    ...protect,
    csrfProtection,
    asyncHandler(async (request, response) => {
      const body = bodyObject(request.body);
      const input: Partial<TermInput> = {
        ...(body.name === undefined
          ? {}
          : { name: requiredString(body, 'name', 100) }),
        ...(body.academicYearId === undefined
          ? {}
          : { academicYearId: requiredString(body, 'academicYearId', 24) }),
        ...(body.startDate === undefined
          ? {}
          : { startDate: requiredString(body, 'startDate', 10) }),
        ...(body.endDate === undefined
          ? {}
          : { endDate: requiredString(body, 'endDate', 10) }),
      };
      response.status(200).json({
        term: await service.updateTerm(
          organizationContext(response),
          routeId(request.params.id!, 'Term'),
          input,
        ),
      });
    }),
  );
  router.delete(
    `${base}/terms/:id`,
    ...protect,
    csrfProtection,
    asyncHandler(async (request, response) => {
      await service.deleteTerm(
        organizationContext(response),
        routeId(request.params.id!, 'Term'),
      );
      response.status(204).end();
    }),
  );

  router.get(
    `${base}/classes`,
    ...protect,
    asyncHandler(async (_request, response) => {
      response.status(200).json({
        items: await service.listClasses(organizationContext(response)),
      });
    }),
  );
  router.post(
    `${base}/classes`,
    ...protect,
    csrfProtection,
    asyncHandler(async (request, response) => {
      const body = bodyObject(request.body);
      const studyLevel = body.studyLevel;
      if (
        studyLevel !== undefined &&
        !['first_year', 'second_year', 'other'].includes(String(studyLevel))
      )
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'Select a valid study level.',
        );
      const sortOrder = optionalInteger(body, 'sortOrder', 0, 100000);
      const input: ClassInput = {
        name: requiredString(body, 'name', 100),
        code: requiredString(body, 'code', 30),
        campusId: requiredString(body, 'campusId', 24),
        ...(sortOrder === undefined ? {} : { sortOrder }),
        ...(studyLevel
          ? { studyLevel: studyLevel as ClassInput['studyLevel'] }
          : {}),
        ...(body.programName === undefined
          ? {}
          : { programName: requiredString(body, 'programName', 120) }),
      };
      response.status(201).json({
        class: await service.createClass(organizationContext(response), input),
      });
    }),
  );
  router.get(
    `${base}/classes/:id`,
    ...protect,
    asyncHandler(async (request, response) => {
      response.status(200).json({
        class: await service.getClass(
          organizationContext(response),
          routeId(request.params.id!, 'Class'),
        ),
      });
    }),
  );
  router.patch(
    `${base}/classes/:id`,
    ...protect,
    csrfProtection,
    asyncHandler(async (request, response) => {
      const body = bodyObject(request.body);
      const sortOrder = optionalInteger(body, 'sortOrder', 0, 100000);
      const input: Partial<ClassInput> = {
        ...(body.name === undefined
          ? {}
          : { name: requiredString(body, 'name', 100) }),
        ...(body.code === undefined
          ? {}
          : { code: requiredString(body, 'code', 30) }),
        ...(body.campusId === undefined
          ? {}
          : { campusId: requiredString(body, 'campusId', 24) }),
        ...(body.studyLevel === undefined
          ? {}
          : { studyLevel: body.studyLevel as ClassInput['studyLevel'] }),
        ...(sortOrder === undefined ? {} : { sortOrder }),
        ...(body.programName === undefined
          ? {}
          : {
              programName:
                body.programName === ''
                  ? ''
                  : requiredString(body, 'programName', 120),
            }),
      };
      response.status(200).json({
        class: await service.updateClass(
          organizationContext(response),
          routeId(request.params.id!, 'Class'),
          input,
        ),
      });
    }),
  );
  router.delete(
    `${base}/classes/:id`,
    ...protect,
    csrfProtection,
    asyncHandler(async (request, response) => {
      await service.deleteClass(
        organizationContext(response),
        routeId(request.params.id!, 'Class'),
      );
      response.status(204).end();
    }),
  );

  router.get(
    `${base}/sections`,
    ...protect,
    asyncHandler(async (request, response) => {
      const classId =
        request.query.classId === undefined
          ? undefined
          : routeId(String(request.query.classId), 'Class');
      response.status(200).json({
        items: await service.listSections(
          organizationContext(response),
          classId,
        ),
      });
    }),
  );
  router.post(
    `${base}/sections`,
    ...protect,
    csrfProtection,
    asyncHandler(async (request, response) => {
      const body = bodyObject(request.body);
      const capacity =
        body.capacity === undefined || body.capacity === ''
          ? undefined
          : Number(body.capacity);
      const input: SectionInput = {
        name: requiredString(body, 'name', 80),
        classId: requiredString(body, 'classId', 24),
        ...(capacity === undefined ? {} : { capacity }),
      };
      response.status(201).json({
        section: await service.createSection(
          organizationContext(response),
          input,
        ),
      });
    }),
  );
  router.get(
    `${base}/sections/:id`,
    ...protect,
    asyncHandler(async (request, response) => {
      response.status(200).json({
        section: await service.getSection(
          organizationContext(response),
          routeId(request.params.id!, 'Section'),
        ),
      });
    }),
  );
  router.patch(
    `${base}/sections/:id`,
    ...protect,
    csrfProtection,
    asyncHandler(async (request, response) => {
      const body = bodyObject(request.body);
      const capacity =
        body.capacity === undefined
          ? undefined
          : body.capacity === ''
            ? null
            : Number(body.capacity);
      const input: Partial<SectionInput> = {
        ...(body.name === undefined
          ? {}
          : { name: requiredString(body, 'name', 80) }),
        ...(body.classId === undefined
          ? {}
          : { classId: requiredString(body, 'classId', 24) }),
        ...(body.capacity === undefined ? {} : { capacity }),
      };
      response.status(200).json({
        section: await service.updateSection(
          organizationContext(response),
          routeId(request.params.id!, 'Section'),
          input,
        ),
      });
    }),
  );
  router.delete(
    `${base}/sections/:id`,
    ...protect,
    csrfProtection,
    asyncHandler(async (request, response) => {
      await service.deleteSection(
        organizationContext(response),
        routeId(request.params.id!, 'Section'),
      );
      response.status(204).end();
    }),
  );

  router.get(
    `${base}/subjects`,
    ...protect,
    asyncHandler(async (_request, response) => {
      response.status(200).json({
        items: await service.listSubjects(organizationContext(response)),
      });
    }),
  );
  router.post(
    `${base}/subjects`,
    ...protect,
    csrfProtection,
    asyncHandler(async (request, response) => {
      const body = bodyObject(request.body);
      const description = optionalString(body, 'description', 1000);
      const totalMarks = optionalInteger(body, 'totalMarks', 1, 100000);
      const passingPercentage = optionalInteger(
        body,
        'passingPercentage',
        0,
        100,
      );
      if (totalMarks === undefined || passingPercentage === undefined)
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'Enter total marks and passing percentage.',
        );
      if (
        body.classIds !== undefined &&
        (!Array.isArray(body.classIds) ||
          body.classIds.length > 100 ||
          body.classIds.some(
            (id) => typeof id !== 'string' || !mongoose.isValidObjectId(id),
          ))
      )
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'Choose valid classes for this subject.',
        );
      const input: SubjectInput = {
        name: requiredString(body, 'name', 120),
        ...(body.code ? { code: requiredString(body, 'code', 30) } : {}),
        totalMarks,
        passingPercentage,
        ...(description ? { description } : {}),
        ...(body.classIds !== undefined
          ? { classIds: body.classIds as string[] }
          : {}),
      };
      response.status(201).json({
        subject: await service.createSubject(
          organizationContext(response),
          input,
        ),
      });
    }),
  );
  router.get(
    `${base}/subjects/:id`,
    ...protect,
    asyncHandler(async (request, response) => {
      response.status(200).json({
        subject: await service.getSubject(
          organizationContext(response),
          routeId(request.params.id!, 'Subject'),
        ),
      });
    }),
  );
  router.patch(
    `${base}/subjects/:id`,
    ...protect,
    csrfProtection,
    asyncHandler(async (request, response) => {
      const body = bodyObject(request.body);
      const input: Partial<SubjectInput> = {
        ...(body.name === undefined
          ? {}
          : { name: requiredString(body, 'name', 120) }),
        ...(body.code === undefined
          ? {}
          : { code: requiredString(body, 'code', 30) }),
        ...(body.totalMarks === undefined
          ? {}
          : { totalMarks: optionalInteger(body, 'totalMarks', 1, 100000) }),
        ...(body.passingPercentage === undefined
          ? {}
          : {
              passingPercentage: optionalInteger(
                body,
                'passingPercentage',
                0,
                100,
              ),
            }),
        ...(body.description === undefined
          ? {}
          : { description: optionalString(body, 'description', 1000) ?? '' }),
        ...(body.classIds === undefined
          ? {}
          : (() => {
              if (
                !Array.isArray(body.classIds) ||
                body.classIds.length > 100 ||
                body.classIds.some(
                  (id) =>
                    typeof id !== 'string' || !mongoose.isValidObjectId(id),
                )
              )
                throw new AppError(
                  400,
                  'VALIDATION_ERROR',
                  'Choose valid classes for this subject.',
                );
              return { classIds: body.classIds as string[] };
            })()),
      };
      response.status(200).json({
        subject: await service.updateSubject(
          organizationContext(response),
          routeId(request.params.id!, 'Subject'),
          input,
        ),
      });
    }),
  );
  router.delete(
    `${base}/subjects/:id`,
    ...protect,
    csrfProtection,
    asyncHandler(async (request, response) => {
      await service.deleteSubject(
        organizationContext(response),
        routeId(request.params.id!, 'Subject'),
      );
      response.status(204).end();
    }),
  );

  router.get(
    `${base}/teacher-assignments`,
    ...protect,
    asyncHandler(async (_request, response) => {
      response.status(200).json({
        items: await service.listTeacherAssignments(
          organizationContext(response),
        ),
      });
    }),
  );
  router.post(
    `${base}/teacher-assignments`,
    ...protect,
    csrfProtection,
    asyncHandler(async (request, response) => {
      const body = bodyObject(request.body);
      const input: TeacherAssignmentInput = {
        teacherStaffId: requiredString(body, 'teacherStaffId', 24),
        subjectId: requiredString(body, 'subjectId', 24),
        classId: requiredString(body, 'classId', 24),
        sectionId: requiredString(body, 'sectionId', 24),
        academicYearId: requiredString(body, 'academicYearId', 24),
      };
      response.status(201).json({
        assignment: await service.createTeacherAssignment(
          organizationContext(response),
          input,
        ),
      });
    }),
  );
  router.get(
    `${base}/teacher-assignments/:id`,
    ...protect,
    asyncHandler(async (request, response) => {
      response.status(200).json({
        assignment: await service.getTeacherAssignment(
          organizationContext(response),
          routeId(request.params.id!, 'Teacher assignment'),
        ),
      });
    }),
  );
  router.patch(
    `${base}/teacher-assignments/:id`,
    ...protect,
    csrfProtection,
    asyncHandler(async (request, response) => {
      const body = bodyObject(request.body);
      const input: TeacherAssignmentInput = {
        teacherStaffId: requiredString(body, 'teacherStaffId', 24),
        subjectId: requiredString(body, 'subjectId', 24),
        classId: requiredString(body, 'classId', 24),
        sectionId: requiredString(body, 'sectionId', 24),
        academicYearId: requiredString(body, 'academicYearId', 24),
      };
      response.status(200).json({
        assignment: await service.updateTeacherAssignment(
          organizationContext(response),
          routeId(request.params.id!, 'Teacher assignment'),
          input,
        ),
      });
    }),
  );
  router.delete(
    `${base}/teacher-assignments/:id`,
    ...protect,
    csrfProtection,
    asyncHandler(async (request, response) => {
      await service.deleteTeacherAssignment(
        organizationContext(response),
        routeId(request.params.id!, 'Teacher assignment'),
      );
      response.status(204).end();
    }),
  );

  const sectionTimetableDays = [
    'sunday',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
  ];
  const sectionTimetableTimeIsValid = (value: string) =>
    /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
  const serializeSectionTimetable = (record: SectionTimetableRecord) => ({
    id: String(record._id),
    organizationId: String(record.organizationId),
    academicYearId: String(record.academicYearId),
    sectionId: String(record.sectionId),
    workingDays: record.workingDays ?? [],
    entries: (record.entries ?? []).map((entry) => ({
      id: String(entry._id),
      type: entry.type,
      dayOfWeek: entry.dayOfWeek,
      startTime: entry.startTime,
      endTime: entry.endTime,
      ...(entry.subjectId ? { subjectId: String(entry.subjectId) } : {}),
      ...(entry.teacherStaffId
        ? { teacherStaffId: String(entry.teacherStaffId) }
        : {}),
      ...(entry.additionalTeacherStaffId
        ? { additionalTeacherStaffId: String(entry.additionalTeacherStaffId) }
        : {}),
      ...(entry.room ? { room: entry.room } : {}),
      ...(entry.name ? { name: entry.name } : {}),
      ...(entry.description ? { description: entry.description } : {}),
    })),
    createdAt: new Date(record.createdAt).toISOString(),
    updatedAt: new Date(record.updatedAt).toISOString(),
  });
  const validateSectionTimetableEntries = async (
    context: AcademicsContext,
    sectionId: string,
    academicYearId: string,
    workingDays: string[],
    inputEntries: Record<string, unknown>[],
  ) => {
    if (
      !workingDays.length ||
      workingDays.some((day) => !sectionTimetableDays.includes(day)) ||
      new Set(workingDays).size !== workingDays.length
    )
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Select at least one valid working day.',
      );
    const organizationId = new mongoose.Types.ObjectId(context.organizationId);
    const [section, year] = await Promise.all([
      AcademicSectionModel.findOne({
        _id: new mongoose.Types.ObjectId(sectionId),
        organizationId,
      }).lean(),
      AcademicYearModel.findOne({
        _id: new mongoose.Types.ObjectId(academicYearId),
        organizationId,
      }).lean(),
    ]);
    if (!section || !year)
      throw new AppError(
        404,
        'RESOURCE_NOT_FOUND',
        'Section or academic year was not found.',
      );
    const entries: Array<
      Record<string, unknown> & {
        type: string;
        dayOfWeek: string;
        startTime: string;
        endTime: string;
      }
    > = inputEntries.map((entry) => {
      const type = String(entry.type ?? ''),
        dayOfWeek = String(entry.dayOfWeek ?? '');
      const startTime = String(entry.startTime ?? ''),
        endTime = String(entry.endTime ?? '');
      if (
        !['class', 'break', 'activity'].includes(type) ||
        !sectionTimetableDays.includes(dayOfWeek) ||
        !sectionTimetableTimeIsValid(startTime) ||
        !sectionTimetableTimeIsValid(endTime) ||
        startTime >= endTime
      )
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'Every entry needs a valid day and time range.',
        );
      if (type === 'class' && !entry.subjectId)
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'Select a subject for every class period.',
        );
      if (
        type !== 'class' &&
        (typeof entry.name !== 'string' || !String(entry.name).trim())
      )
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'Enter a name for every break or activity.',
        );
      return { ...entry, type, dayOfWeek, startTime, endTime };
    });
    for (let i = 0; i < entries.length; i++)
      for (let j = i + 1; j < entries.length; j++) {
        const first = entries[i]!,
          second = entries[j]!;
        if (
          first.dayOfWeek === second.dayOfWeek &&
          first.startTime < second.endTime &&
          first.endTime > second.startTime
        )
          throw new AppError(
            409,
            'TIMETABLE_CONFLICT',
            'Two entries in this section overlap.',
          );
      }
    const subjectIds = [
      ...new Set(
        entries
          .filter((entry) => entry.type === 'class' && entry.subjectId)
          .map((entry) => String(entry.subjectId)),
      ),
    ];
    const subjects = subjectIds.length
      ? await SubjectModel.find({
          organizationId,
          _id: { $in: subjectIds },
        }).lean()
      : [];
    if (subjects.length !== subjectIds.length)
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Select subjects from this organization.',
      );
    for (const subject of subjects) {
      const allowed = (subject.classIds ?? []).map(String);
      if (allowed.length && !allowed.includes(String(section.classId)))
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'A selected subject does not belong to this class.',
        );
    }
    const teacherIds = [
      ...new Set(
        entries.flatMap((entry) =>
          [entry.teacherStaffId, entry.additionalTeacherStaffId]
            .filter(Boolean)
            .map(String),
        ),
      ),
    ];
    if (teacherIds.length) {
      const staff = await StaffMemberModel.find({
        organizationId,
        _id: { $in: teacherIds },
      })
        .select('_id')
        .lean();
      if (staff.length !== teacherIds.length)
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'Select teachers from this organization.',
        );
    }
    for (const entry of entries.filter(
      (item) => item.type === 'class' && workingDays.includes(item.dayOfWeek),
    )) {
      if (
        entry.teacherStaffId &&
        String(entry.teacherStaffId) === String(entry.additionalTeacherStaffId)
      )
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'Main and additional teacher must be different.',
        );
      for (const teacherId of [
        entry.teacherStaffId,
        entry.additionalTeacherStaffId,
      ].filter(Boolean)) {
        const overlaps = await SectionTimetableModel.find({
          organizationId,
          academicYearId: new mongoose.Types.ObjectId(academicYearId),
          sectionId: { $ne: new mongoose.Types.ObjectId(sectionId) },
          entries: {
            $elemMatch: {
              dayOfWeek: entry.dayOfWeek,
              startTime: { $lt: entry.endTime },
              endTime: { $gt: entry.startTime },
              $or: [
                {
                  teacherStaffId: new mongoose.Types.ObjectId(
                    String(teacherId),
                  ),
                },
                {
                  additionalTeacherStaffId: new mongoose.Types.ObjectId(
                    String(teacherId),
                  ),
                },
              ],
            },
          },
        })
          .select({ workingDays: 1 })
          .lean();
        if (
          overlaps.some((record) =>
            record.workingDays.includes(entry.dayOfWeek),
          )
        )
          throw new AppError(
            409,
            'TIMETABLE_CONFLICT',
            'A teacher is already scheduled in another section at this time.',
          );
      }
    }
    return entries;
  };
  router.get(
    base + '/section-timetables',
    ...protect,
    asyncHandler(async (request, response) => {
      const context = organizationContext(response);
      const filter: Record<string, unknown> = {
        organizationId: new mongoose.Types.ObjectId(context.organizationId),
      };
      if (request.query.academicYearId)
        filter.academicYearId = new mongoose.Types.ObjectId(
          routeId(String(request.query.academicYearId), 'Academic year'),
        );
      const records = await SectionTimetableModel.find(filter)
        .sort({ sectionId: 1 })
        .lean();
      response
        .status(200)
        .json({ items: records.map(serializeSectionTimetable) });
    }),
  );
  router.post(
    base + '/section-timetables',
    ...protect,
    csrfProtection,
    asyncHandler(async (request, response) => {
      const context = organizationContext(response),
        body = bodyObject(request.body);
      const sectionId = routeId(
        requiredString(body, 'sectionId', 24),
        'Section',
      );
      const academicYearId = routeId(
        requiredString(body, 'academicYearId', 24),
        'Academic year',
      );
      if (
        !Array.isArray(body.workingDays) ||
        !Array.isArray(body.entries) ||
        body.entries.some(
          (entry) =>
            typeof entry !== 'object' || entry === null || Array.isArray(entry),
        )
      )
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'Working days and entries must be lists.',
        );
      const workingDays = body.workingDays.map(String);
      const entries = await validateSectionTimetableEntries(
        context,
        sectionId,
        academicYearId,
        workingDays,
        body.entries as Record<string, unknown>[],
      );
      const record = await SectionTimetableModel.findOneAndUpdate(
        {
          organizationId: new mongoose.Types.ObjectId(context.organizationId),
          academicYearId: new mongoose.Types.ObjectId(academicYearId),
          sectionId: new mongoose.Types.ObjectId(sectionId),
        },
        { $set: { workingDays, entries } },
        {
          upsert: true,
          new: true,
          runValidators: true,
          setDefaultsOnInsert: true,
        },
      ).lean();
      response.status(200).json({ item: serializeSectionTimetable(record) });
    }),
  );
  router.post(
    base + '/section-timetables/bulk-break',
    ...protect,
    csrfProtection,
    asyncHandler(async (request, response) => {
      const context = organizationContext(response),
        body = bodyObject(request.body);
      const name = requiredString(body, 'name', 100),
        startTime = requiredString(body, 'startTime', 5),
        endTime = requiredString(body, 'endTime', 5);
      if (
        !sectionTimetableTimeIsValid(startTime) ||
        !sectionTimetableTimeIsValid(endTime) ||
        startTime >= endTime ||
        !Array.isArray(body.days) ||
        !body.days.length ||
        body.days.some((day) => !sectionTimetableDays.includes(String(day)))
      )
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'Enter valid break times and select at least one day.',
        );
      const academicYearId = routeId(
        requiredString(body, 'academicYearId', 24),
        'Academic year',
      );
      const organizationId = new mongoose.Types.ObjectId(
        context.organizationId,
      );
      if (
        !(await AcademicYearModel.exists({
          _id: new mongoose.Types.ObjectId(academicYearId),
          organizationId,
        }))
      )
        throw new AppError(
          404,
          'RESOURCE_NOT_FOUND',
          'Academic year was not found.',
        );
      const sections = await AcademicSectionModel.find({
        organizationId,
      }).lean();
      const requestedSectionIds = Array.isArray(body.sectionIds)
        ? body.sectionIds.map(String)
        : [];
      const selected = requestedSectionIds.length
        ? sections.filter((section) =>
            requestedSectionIds.includes(String(section._id)),
          )
        : sections;
      const skipped: Array<{
        sectionId: string;
        sectionName: string;
        day: string;
      }> = [];
      let added = 0;
      for (const section of selected) {
        const existing = (await SectionTimetableModel.findOne({
          organizationId,
          academicYearId: new mongoose.Types.ObjectId(academicYearId),
          sectionId: section._id,
        }).lean()) as unknown as SectionTimetableRecord | null;
        const workingDays = existing?.workingDays?.length
          ? existing.workingDays
          : [
              'monday',
              'tuesday',
              'wednesday',
              'thursday',
              'friday',
              'saturday',
            ];
        const entries = (existing?.entries ?? []).map((entry) => ({
          ...entry,
          _id: entry._id,
        }));
        for (const day of body.days.map(String)) {
          if (!workingDays.includes(day)) continue;
          if (
            entries.some(
              (entry) =>
                entry.dayOfWeek === day &&
                entry.startTime < endTime &&
                entry.endTime > startTime,
            )
          ) {
            skipped.push({
              sectionId: String(section._id),
              sectionName: section.name,
              day,
            });
            continue;
          }
          entries.push({
            _id: new mongoose.Types.ObjectId(),
            type: 'break',
            dayOfWeek: day,
            startTime,
            endTime,
            name,
          });
          added++;
        }
        await SectionTimetableModel.findOneAndUpdate(
          {
            organizationId,
            academicYearId: new mongoose.Types.ObjectId(academicYearId),
            sectionId: section._id,
          },
          { $set: { workingDays, entries } },
          {
            upsert: true,
            new: true,
            runValidators: true,
            setDefaultsOnInsert: true,
          },
        );
      }
      response.status(200).json({ added, skipped });
    }),
  );
  router.delete(
    base + '/section-timetables/:id',
    ...protect,
    csrfProtection,
    asyncHandler(async (request, response) => {
      const context = organizationContext(response);
      const removed = await SectionTimetableModel.findOneAndDelete({
        _id: new mongoose.Types.ObjectId(
          routeId(request.params.id!, 'Timetable'),
        ),
        organizationId: new mongoose.Types.ObjectId(context.organizationId),
      });
      if (!removed)
        throw new AppError(404, 'RESOURCE_NOT_FOUND', 'Timetable not found.');
      response.status(204).end();
    }),
  );

  router.get(
    `${base}/teacher-timetable/:staffId`,
    ...protect,
    asyncHandler(async (request, response) => {
      const context = organizationContext(response);
      const staffId = routeId(request.params.staffId!, 'Teacher');
      const records = (await SectionTimetableModel.find({
        organizationId: new mongoose.Types.ObjectId(context.organizationId),
        $or: [
          { 'entries.teacherStaffId': new mongoose.Types.ObjectId(staffId) },
          {
            'entries.additionalTeacherStaffId': new mongoose.Types.ObjectId(
              staffId,
            ),
          },
        ],
      })
        .populate('sectionId', 'name classId')
        .populate('academicYearId', 'name')
        .populate('entries.subjectId', 'name')
        .lean()) as unknown as SectionTimetableRecord[];
      const items = records.flatMap((record) =>
        (record.entries ?? [])
          .filter(
            (entry) =>
              (record.workingDays ?? []).includes(String(entry.dayOfWeek)) &&
              (String(entry.teacherStaffId ?? '') === staffId ||
                String(entry.additionalTeacherStaffId ?? '') === staffId),
          )
          .map((entry) => ({
            id: String(entry._id),
            teacherStaffId: staffId,
            teacherAssignmentId: '',
            dayOfWeek: String(entry.dayOfWeek),
            startTime: String(entry.startTime),
            endTime: String(entry.endTime),
            room: entry.room ? String(entry.room) : undefined,
            type: entry.type,
            subjectName:
              (entry.subjectId as { name?: string } | undefined)?.name ??
              entry.name ??
              'Scheduled period',
            sectionName:
              (record.sectionId as { name?: string }).name ?? 'Section',
            academicYearName:
              (record.academicYearId as { name?: string }).name ?? '',
            isAdditionalTeacher:
              String(entry.additionalTeacherStaffId ?? '') === staffId,
            createdAt: new Date(record.createdAt).toISOString(),
            updatedAt: new Date(record.updatedAt).toISOString(),
          })),
      );
      items.sort(
        (a, b) =>
          a.dayOfWeek.localeCompare(b.dayOfWeek) ||
          a.startTime.localeCompare(b.startTime),
      );
      response.status(200).json({ items });
    }),
  );
  router.post(
    `${base}/teacher-timetable`,
    ...protect,
    csrfProtection,
    asyncHandler(async (request, response) => {
      const context = organizationContext(response);
      const body = bodyObject(request.body);
      const teacherStaffId = routeId(
        requiredString(body, 'teacherStaffId', 24),
        'Teacher',
      );
      const teacherAssignmentId = routeId(
        requiredString(body, 'teacherAssignmentId', 24),
        'Teacher assignment',
      );
      const dayOfWeek = requiredString(body, 'dayOfWeek', 12);
      const startTime = requiredString(body, 'startTime', 5);
      const endTime = requiredString(body, 'endTime', 5);
      const room = optionalString(body, 'room', 80);
      const days = [
        'monday',
        'tuesday',
        'wednesday',
        'thursday',
        'friday',
        'saturday',
        'sunday',
      ];
      if (
        !days.includes(dayOfWeek) ||
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime) ||
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(endTime) ||
        startTime >= endTime
      ) {
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'Select a valid day and a time range where the end is after the start.',
        );
      }
      const assignment = await service.getTeacherAssignment(
        context,
        teacherAssignmentId,
      );
      if (assignment.teacherStaffId !== teacherStaffId) {
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'Choose an assignment belonging to this teacher.',
        );
      }
      const conflicts = await TeacherTimetableModel.find({
        organizationId: new mongoose.Types.ObjectId(context.organizationId),
        teacherStaffId: new mongoose.Types.ObjectId(teacherStaffId),
        dayOfWeek,
        startTime: { $lt: endTime },
        endTime: { $gt: startTime },
      }).lean();
      if (conflicts.length) {
        throw new AppError(
          409,
          'TIMETABLE_CONFLICT',
          'This teacher already has a timetable entry during that time.',
        );
      }
      const created = await TeacherTimetableModel.create({
        organizationId: new mongoose.Types.ObjectId(context.organizationId),
        teacherStaffId: new mongoose.Types.ObjectId(teacherStaffId),
        teacherAssignmentId: new mongoose.Types.ObjectId(teacherAssignmentId),
        dayOfWeek,
        startTime,
        endTime,
        room,
      });
      response.status(201).json({
        item: {
          id: String(created._id),
          teacherStaffId,
          teacherAssignmentId,
          dayOfWeek,
          startTime,
          endTime,
          room,
          createdAt: new Date(created.createdAt).toISOString(),
          updatedAt: new Date(created.updatedAt).toISOString(),
        },
      });
    }),
  );
  router.patch(
    `${base}/teacher-timetable/:id`,
    ...protect,
    csrfProtection,
    asyncHandler(async (request, response) => {
      const context = organizationContext(response);
      const id = routeId(request.params.id!, 'Timetable entry');
      const body = bodyObject(request.body);
      const teacherStaffId = routeId(
        requiredString(body, 'teacherStaffId', 24),
        'Teacher',
      );
      const teacherAssignmentId = routeId(
        requiredString(body, 'teacherAssignmentId', 24),
        'Teacher assignment',
      );
      const dayOfWeek = requiredString(body, 'dayOfWeek', 12);
      const startTime = requiredString(body, 'startTime', 5);
      const endTime = requiredString(body, 'endTime', 5);
      const room = optionalString(body, 'room', 80);
      const days = [
        'monday',
        'tuesday',
        'wednesday',
        'thursday',
        'friday',
        'saturday',
        'sunday',
      ];
      if (
        !days.includes(dayOfWeek) ||
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime) ||
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(endTime) ||
        startTime >= endTime
      ) {
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'Select a valid day and a time range where the end is after the start.',
        );
      }
      const assignment = await service.getTeacherAssignment(
        context,
        teacherAssignmentId,
      );
      if (assignment.teacherStaffId !== teacherStaffId) {
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'Choose an assignment belonging to this teacher.',
        );
      }
      const conflicts = await TeacherTimetableModel.find({
        organizationId: new mongoose.Types.ObjectId(context.organizationId),
        teacherStaffId: new mongoose.Types.ObjectId(teacherStaffId),
        dayOfWeek,
        _id: { $ne: new mongoose.Types.ObjectId(id) },
        startTime: { $lt: endTime },
        endTime: { $gt: startTime },
      }).lean();
      if (conflicts.length) {
        throw new AppError(
          409,
          'TIMETABLE_CONFLICT',
          'This teacher already has a timetable entry during that time.',
        );
      }
      const updated = await TeacherTimetableModel.findOneAndUpdate(
        {
          _id: new mongoose.Types.ObjectId(id),
          organizationId: new mongoose.Types.ObjectId(context.organizationId),
        },
        {
          $set: {
            teacherStaffId: new mongoose.Types.ObjectId(teacherStaffId),
            teacherAssignmentId: new mongoose.Types.ObjectId(
              teacherAssignmentId,
            ),
            dayOfWeek,
            startTime,
            endTime,
            room,
          },
        },
        { new: true, runValidators: true },
      ).lean();
      if (!updated)
        throw new AppError(
          404,
          'RESOURCE_NOT_FOUND',
          'Timetable entry not found.',
        );
      response.status(200).json({
        item: {
          id: String(updated._id),
          teacherStaffId,
          teacherAssignmentId,
          dayOfWeek,
          startTime,
          endTime,
          room,
          createdAt: new Date(updated.createdAt).toISOString(),
          updatedAt: new Date(updated.updatedAt).toISOString(),
        },
      });
    }),
  );
  router.delete(
    `${base}/teacher-timetable/:id`,
    ...protect,
    csrfProtection,
    asyncHandler(async (request, response) => {
      const context = organizationContext(response);
      const id = routeId(request.params.id!, 'Timetable entry');
      const removed = await TeacherTimetableModel.findOneAndDelete({
        _id: new mongoose.Types.ObjectId(id),
        organizationId: new mongoose.Types.ObjectId(context.organizationId),
      });
      if (!removed)
        throw new AppError(
          404,
          'RESOURCE_NOT_FOUND',
          'Timetable entry not found.',
        );
      response.status(204).end();
    }),
  );

  return router;
}

export const academicsRouter = createAcademicsRouter();
