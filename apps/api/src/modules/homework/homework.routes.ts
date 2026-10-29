import { Router } from 'express';
import mongoose from 'mongoose';
import { env } from '../../config/env.js';
import { AppError } from '../../errors/app-error.js';
import { asyncHandler } from '../../middleware/async-handler.js';
import {
  AcademicClassModel,
  AcademicSectionModel,
  AcademicYearModel,
  SubjectModel,
  TeacherAssignmentModel,
} from '../academics/academics.model.js';
import { authEmailDelivery } from '../auth/auth.email.js';
import { AuthUserModel } from '../auth/auth.model.js';
import {
  createAuthenticationMiddleware,
  csrfProtection,
} from '../auth/auth.middleware.js';
import { MongoAuthRepository } from '../auth/auth.repository.js';
import { AuthService } from '../auth/auth.service.js';
import { StaffMemberModel } from '../people/people.model.js';
import {
  createOrganizationContextMiddleware,
  requireOrganizationPermission,
} from '../tenancy/tenant-context.middleware.js';
import { MongoOrganizationAccessRepository } from '../tenancy/tenancy.repository.js';
import type { OrganizationAccessRepository } from '../tenancy/tenancy.types.js';
import {
  HOMEWORK_TEST_STATUSES,
  HOMEWORK_TEST_TYPES,
  HomeworkTestModel,
} from './homework.model.js';

type Context = {
  organizationId: string;
  campusIds: string[];
  role: string;
  userId: string;
};
type WorkType = (typeof HOMEWORK_TEST_TYPES)[number];
type WorkStatus = (typeof HOMEWORK_TEST_STATUSES)[number];
const managerRoles = [
  'organization_owner',
  'organization_admin',
  'campus_admin',
  'principal_director',
  'academic_coordinator',
] as const;
const isManager = (context: Context) =>
  (managerRoles as readonly string[]).includes(context.role);

function contextOf(response: {
  locals?: { organizationContext?: Partial<Context> };
}): Context {
  const value = response.locals?.organizationContext;
  if (!value?.organizationId || !value.userId)
    throw new AppError(
      404,
      'ORGANIZATION_NOT_FOUND',
      'Organization not found.',
    );
  return {
    organizationId: value.organizationId,
    userId: value.userId,
    role: value.role ?? '',
    campusIds: value.campusIds ?? [],
  };
}
function bodyOf(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'A valid JSON object is required.',
    );
  return value as Record<string, unknown>;
}
function idOf(value: unknown, label: string): string {
  if (typeof value !== 'string' || !mongoose.isValidObjectId(value))
    throw new AppError(400, 'VALIDATION_ERROR', `Select a valid ${label}.`);
  return value;
}
function stringOf(
  value: unknown,
  label: string,
  max: number,
  allowEmpty = false,
): string {
  if (
    typeof value !== 'string' ||
    value.trim().length > max ||
    (!allowEmpty && !value.trim())
  )
    throw new AppError(400, 'VALIDATION_ERROR', `Enter a valid ${label}.`);
  return value.trim();
}
function typeOf(value: unknown): WorkType {
  if (
    typeof value !== 'string' ||
    !(HOMEWORK_TEST_TYPES as readonly string[]).includes(value)
  )
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'Type must be homework or test.',
    );
  return value as WorkType;
}
function statusOf(value: unknown): WorkStatus {
  if (
    typeof value !== 'string' ||
    !(HOMEWORK_TEST_STATUSES as readonly string[]).includes(value)
  )
    throw new AppError(400, 'VALIDATION_ERROR', 'Select a valid status.');
  return value as WorkStatus;
}
function dateOf(value: unknown): Date {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new AppError(400, 'VALIDATION_ERROR', 'Select a valid due date.');
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value)
    throw new AppError(400, 'VALIDATION_ERROR', 'Select a valid due date.');
  return date;
}
function authMiddleware() {
  return createAuthenticationMiddleware(
    new AuthService(new MongoAuthRepository(), authEmailDelivery, {
      sessionTtlDays: env.authSessionTtlDays,
      requireEmailVerification: env.authRequireEmailVerification,
      webAppUrl: env.authWebAppUrl,
    }),
  );
}
async function verifyTeacherScope(
  context: Context,
  input: {
    classId: string;
    sectionId: string;
    academicYearId: string;
    subjectId: string;
  },
) {
  if (context.role !== 'teacher') return;
  const user = await AuthUserModel.findById(context.userId)
    .select({ email: 1, status: 1 })
    .lean();
  if (user?.status !== 'active' || !user.email)
    throw new AppError(
      403,
      'TEACHER_ACCOUNT_UNLINKED',
      'Your active account is not linked to a teacher record.',
    );
  const staff = await StaffMemberModel.find({
    organizationId: context.organizationId,
    email: user.email.trim().toLowerCase(),
    status: 'active',
  })
    .select({ _id: 1 })
    .limit(2)
    .lean();
  if (staff.length !== 1)
    throw new AppError(
      403,
      'TEACHER_ACCOUNT_UNLINKED',
      'Your account must match exactly one active staff record.',
    );
  const assigned = await TeacherAssignmentModel.exists({
    organizationId: context.organizationId,
    teacherStaffId: staff[0]!._id,
    ...input,
  });
  if (!assigned)
    throw new AppError(
      403,
      'TEACHER_ASSIGNMENT_REQUIRED',
      'You can only manage homework and tests for your assigned class, section, subject, and academic year.',
    );
}
async function resolveTeacher(context: Context) {
  const user = await AuthUserModel.findById(context.userId)
    .select({ email: 1, status: 1 })
    .lean();
  if (user?.status !== 'active' || !user.email)
    throw new AppError(
      403,
      'TEACHER_ACCOUNT_UNLINKED',
      'Your active account is not linked to a teacher record.',
    );
  const staff = await StaffMemberModel.find({
    organizationId: context.organizationId,
    email: user.email.trim().toLowerCase(),
    status: 'active',
  })
    .select({ _id: 1 })
    .limit(2)
    .lean();
  if (staff.length !== 1)
    throw new AppError(
      403,
      'TEACHER_ACCOUNT_UNLINKED',
      'Your account must match exactly one active staff record.',
    );
  return staff[0]!._id;
}
type HomeworkTestRecord = {
  _id: { toString(): string };
  organizationId: { toString(): string };
  campusId: { toString(): string };
  academicYearId: { toString(): string };
  classId: { toString(): string };
  sectionId: { toString(): string };
  subjectId: { toString(): string };
  title: string;
  instructions?: string | null;
  type: WorkType;
  dueDate: Date | string;
  totalMarks?: number;
  status: WorkStatus;
  createdBy: { toString(): string };
  createdAt: Date | string;
  updatedAt: Date | string;
};

function present(
  item: HomeworkTestRecord,
  names: {
    classes: Map<string, string>;
    sections: Map<string, string>;
    subjects: Map<string, string>;
    years: Map<string, string>;
  },
) {
  return {
    id: String(item._id),
    organizationId: String(item.organizationId),
    campusId: String(item.campusId),
    academicYearId: String(item.academicYearId),
    classId: String(item.classId),
    sectionId: String(item.sectionId),
    subjectId: String(item.subjectId),
    title: item.title,
    instructions: item.instructions ?? '',
    type: item.type,
    dueDate: new Date(item.dueDate).toISOString().slice(0, 10),
    totalMarks: item.totalMarks,
    status: item.status,
    createdBy: String(item.createdBy),
    createdAt: new Date(item.createdAt).toISOString(),
    updatedAt: new Date(item.updatedAt).toISOString(),
    campusName: '',
    className: names.classes.get(String(item.classId)) ?? 'Class',
    sectionName: names.sections.get(String(item.sectionId)) ?? 'Section',
    subjectName: names.subjects.get(String(item.subjectId)) ?? 'Subject',
    academicYearName:
      names.years.get(String(item.academicYearId)) ?? 'Academic year',
  };
}

export function createHomeworkRouter(
  accessRepository: OrganizationAccessRepository = new MongoOrganizationAccessRepository(),
  authenticate = authMiddleware(),
) {
  const router = Router();
  const resolveOrganization =
    createOrganizationContextMiddleware(accessRepository);
  const read = [
    authenticate,
    resolveOrganization,
    requireOrganizationPermission('examination.read'),
  ] as const;
  const write = [
    authenticate,
    resolveOrganization,
    requireOrganizationPermission('examination.write'),
  ] as const;
  const base = '/:organizationId/homework-tests';

  router.get(
    base,
    ...read,
    asyncHandler(async (request, response) => {
      const context = contextOf(response);
      const filter: Record<string, unknown> = {
        organizationId: context.organizationId,
        ...(context.campusIds.length
          ? { campusId: { $in: context.campusIds } }
          : {}),
      };
      if (request.query.type !== undefined)
        filter.type = typeOf(request.query.type);
      if (request.query.classId !== undefined)
        filter.classId = idOf(request.query.classId, 'class');
      if (request.query.sectionId !== undefined)
        filter.sectionId = idOf(request.query.sectionId, 'section');
      if (request.query.academicYearId !== undefined)
        filter.academicYearId = idOf(
          request.query.academicYearId,
          'academic year',
        );
      if (!isManager(context)) {
        if (context.role !== 'teacher')
          throw new AppError(
            403,
            'HOMEWORK_ACCESS_DENIED',
            'Homework & tests are not available to this role.',
          );
        const staffId = await resolveTeacher(context);
        const assignments = await TeacherAssignmentModel.find({
          organizationId: context.organizationId,
          teacherStaffId: staffId,
        })
          .select({
            campusId: 1,
            classId: 1,
            sectionId: 1,
            academicYearId: 1,
            subjectId: 1,
          })
          .lean();
        if (!assignments.length) {
          response.status(200).json({ items: [] });
          return;
        }
        filter.$or = assignments.map((entry) => ({
          classId: entry.classId,
          sectionId: entry.sectionId,
          academicYearId: entry.academicYearId,
          subjectId: entry.subjectId,
        }));
      }
      const records = await HomeworkTestModel.find(filter)
        .sort({ dueDate: 1, createdAt: -1 })
        .limit(500)
        .lean();
      const ids = (values: unknown[]) => values.map(String);
      const [classes, sections, subjects, years] = await Promise.all([
        AcademicClassModel.find({
          organizationId: context.organizationId,
          _id: { $in: [...new Set(ids(records.map((x) => x.classId)))] },
        })
          .select({ name: 1 })
          .lean(),
        AcademicSectionModel.find({
          organizationId: context.organizationId,
          _id: { $in: [...new Set(ids(records.map((x) => x.sectionId)))] },
        })
          .select({ name: 1 })
          .lean(),
        SubjectModel.find({
          organizationId: context.organizationId,
          _id: { $in: [...new Set(ids(records.map((x) => x.subjectId)))] },
        })
          .select({ name: 1 })
          .lean(),
        AcademicYearModel.find({
          organizationId: context.organizationId,
          _id: { $in: [...new Set(ids(records.map((x) => x.academicYearId)))] },
        })
          .select({ name: 1 })
          .lean(),
      ]);
      const names = {
        classes: new Map(classes.map((x) => [String(x._id), x.name])),
        sections: new Map(sections.map((x) => [String(x._id), x.name])),
        subjects: new Map(subjects.map((x) => [String(x._id), x.name])),
        years: new Map(years.map((x) => [String(x._id), x.name])),
      };
      response
        .status(200)
        .json({ items: records.map((item) => present(item, names)) });
    }),
  );

  router.post(
    base,
    ...write,
    csrfProtection,
    asyncHandler(async (request, response) => {
      const context = contextOf(response);
      const body = bodyOf(request.body);
      const input = {
        campusId: idOf(body.campusId, 'campus'),
        academicYearId: idOf(body.academicYearId, 'academic year'),
        classId: idOf(body.classId, 'class'),
        sectionId: idOf(body.sectionId, 'section'),
        subjectId: idOf(body.subjectId, 'subject'),
        title: stringOf(body.title, 'title', 160),
        instructions: stringOf(
          body.instructions ?? '',
          'instructions',
          5000,
          true,
        ),
        type: typeOf(body.type),
        dueDate: dateOf(body.dueDate),
        ...(body.totalMarks === undefined || body.totalMarks === ''
          ? {}
          : { totalMarks: Number(body.totalMarks) }),
        status: statusOf(body.status ?? 'published'),
      };
      if (
        input.totalMarks !== undefined &&
        (!Number.isFinite(input.totalMarks) ||
          input.totalMarks < 0 ||
          input.totalMarks > 100000)
      )
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'Total marks must be between 0 and 100000.',
        );
      const [validClass, validSection, validSubject, validYear] =
        await Promise.all([
          AcademicClassModel.exists({
            _id: input.classId,
            organizationId: context.organizationId,
            campusId: input.campusId,
          }),
          AcademicSectionModel.exists({
            _id: input.sectionId,
            organizationId: context.organizationId,
            classId: input.classId,
          }),
          SubjectModel.exists({
            _id: input.subjectId,
            organizationId: context.organizationId,
          }),
          AcademicYearModel.exists({
            _id: input.academicYearId,
            organizationId: context.organizationId,
            status: 'active',
          }),
        ]);
      if (!validClass || !validSection || !validSubject || !validYear)
        throw new AppError(
          400,
          'INVALID_ACADEMIC_SCOPE',
          'Choose a campus, active academic year, class, section, and subject belonging to this college.',
        );
      if (
        context.campusIds.length &&
        !context.campusIds.includes(input.campusId)
      )
        throw new AppError(
          403,
          'CAMPUS_ACCESS_DENIED',
          'You do not have access to this campus.',
        );
      if (!isManager(context) && context.role !== 'teacher')
        throw new AppError(
          403,
          'HOMEWORK_ACCESS_DENIED',
          'This role cannot create homework or tests.',
        );
      if (context.role === 'teacher') await verifyTeacherScope(context, input);
      const created = await HomeworkTestModel.create({
        organizationId: context.organizationId,
        ...input,
        createdBy: context.userId,
      });
      const item = present(created, {
        classes: new Map(),
        sections: new Map(),
        subjects: new Map(),
        years: new Map(),
      });
      response.status(201).json({ item });
    }),
  );

  router.patch(
    '/:organizationId/homework-tests/:itemId/status',
    ...write,
    csrfProtection,
    asyncHandler(async (request, response) => {
      const context = contextOf(response);
      const itemId = idOf(request.params.itemId, 'homework item');
      const status = statusOf(bodyOf(request.body).status);
      const item = await HomeworkTestModel.findOne({
        _id: itemId,
        organizationId: context.organizationId,
      })
        .select({
          campusId: 1,
          classId: 1,
          sectionId: 1,
          academicYearId: 1,
          subjectId: 1,
        })
        .lean();
      if (!item)
        throw new AppError(
          404,
          'HOMEWORK_NOT_FOUND',
          'Homework or test not found.',
        );
      if (
        context.campusIds.length &&
        !context.campusIds.includes(String(item.campusId))
      )
        throw new AppError(
          403,
          'CAMPUS_ACCESS_DENIED',
          'You do not have access to this campus.',
        );
      if (!isManager(context) && context.role !== 'teacher')
        throw new AppError(
          403,
          'HOMEWORK_ACCESS_DENIED',
          'This role cannot manage homework or tests.',
        );
      if (context.role === 'teacher')
        await verifyTeacherScope(context, {
          classId: String(item.classId),
          sectionId: String(item.sectionId),
          academicYearId: String(item.academicYearId),
          subjectId: String(item.subjectId),
        });
      await HomeworkTestModel.updateOne(
        { _id: itemId, organizationId: context.organizationId },
        { $set: { status } },
      );
      response.status(200).json({ id: itemId, status });
    }),
  );

  router.delete(
    '/:organizationId/homework-tests/:itemId',
    ...write,
    csrfProtection,
    asyncHandler(async (request, response) => {
      const context = contextOf(response);
      const itemId = idOf(request.params.itemId, 'homework item');
      const item = await HomeworkTestModel.findOne({
        _id: itemId,
        organizationId: context.organizationId,
      })
        .select({
          campusId: 1,
          classId: 1,
          sectionId: 1,
          academicYearId: 1,
          subjectId: 1,
        })
        .lean();
      if (!item)
        throw new AppError(
          404,
          'HOMEWORK_NOT_FOUND',
          'Homework or test not found.',
        );
      if (
        context.campusIds.length &&
        !context.campusIds.includes(String(item.campusId))
      )
        throw new AppError(
          403,
          'CAMPUS_ACCESS_DENIED',
          'You do not have access to this campus.',
        );
      if (!isManager(context) && context.role !== 'teacher')
        throw new AppError(
          403,
          'HOMEWORK_ACCESS_DENIED',
          'This role cannot manage homework or tests.',
        );
      if (context.role === 'teacher')
        await verifyTeacherScope(context, {
          classId: String(item.classId),
          sectionId: String(item.sectionId),
          academicYearId: String(item.academicYearId),
          subjectId: String(item.subjectId),
        });
      await HomeworkTestModel.deleteOne({
        _id: itemId,
        organizationId: context.organizationId,
      });
      response.status(204).end();
    }),
  );
  return router;
}

export const homeworkRouter = createHomeworkRouter();
