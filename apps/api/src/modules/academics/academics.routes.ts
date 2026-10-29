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
import { MongoAcademicsRepository } from './academics.repository.js';
import { AcademicsService } from './academics.service.js';
import { TeacherTimetableModel } from './academics.model.js';
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
  const protect = [authenticate, resolveOrganization, authorize] as const;
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
  router.post(
    `${base}/academic-years`,
    ...protect,
    csrfProtection,
    asyncHandler(async (request, response) => {
      const body = bodyObject(request.body);
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
      const input: ClassInput = {
        name: requiredString(body, 'name', 100),
        code: requiredString(body, 'code', 30),
        campusId: requiredString(body, 'campusId', 24),
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
      const department = optionalString(body, 'department', 100);
      const input: SubjectInput = {
        name: requiredString(body, 'name', 120),
        code: requiredString(body, 'code', 30),
        ...(department ? { department } : {}),
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
        ...(body.department === undefined
          ? {}
          : {
              department:
                body.department === ''
                  ? ''
                  : requiredString(body, 'department', 100),
            }),
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

  router.get(
    `${base}/teacher-timetable/:staffId`,
    ...protect,
    asyncHandler(async (request, response) => {
      const context = organizationContext(response);
      const staffId = routeId(request.params.staffId!, 'Teacher');
      const items = await TeacherTimetableModel.find({
        organizationId: new mongoose.Types.ObjectId(context.organizationId),
        teacherStaffId: new mongoose.Types.ObjectId(staffId),
      })
        .sort({ dayOfWeek: 1, startTime: 1 })
        .lean();
      response.status(200).json({
        items: items.map((item) => ({
          id: String(item._id),
          teacherStaffId: String(item.teacherStaffId),
          teacherAssignmentId: String(item.teacherAssignmentId),
          dayOfWeek: String(item.dayOfWeek),
          startTime: String(item.startTime),
          endTime: String(item.endTime),
          room: item.room ? String(item.room) : undefined,
          createdAt: new Date(item.createdAt).toISOString(),
          updatedAt: new Date(item.updatedAt).toISOString(),
        })),
      });
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
