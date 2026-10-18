import { Router } from 'express';
import mongoose from 'mongoose';
import {
  AcademicClassModel,
  AcademicSectionModel,
  AcademicYearModel,
  TeacherAssignmentModel,
} from '../academics/academics.model.js';
import { StudentSectionPlacementModel } from '../attendance/attendance.model.js';
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
import { AuthUserModel } from '../auth/auth.model.js';
import {
  GuardianModel,
  StaffMemberModel,
  StudentGuardianLinkModel,
  StudentModel,
} from '../people/people.model.js';
import { MembershipModel } from '../tenancy/tenancy.model.js';
import { MongoOrganizationAccessRepository } from '../tenancy/tenancy.repository.js';
import type { OrganizationAccessRepository } from '../tenancy/tenancy.types.js';
import {
  createOrganizationContextMiddleware,
  requireOrganizationRole,
} from '../tenancy/tenant-context.middleware.js';
import {
  MongoAnnouncementRepository,
  MongoMessagingRepository,
} from './communications.repository.js';
import {
  CommunicationsService,
  MessagingService,
  type VerificationAdapters,
} from './communications.service.js';
import type {
  AnnouncementAudience,
  AnnouncementContext,
  AnnouncementQuery,
  AnnouncementStatus,
  CreateAnnouncementInput,
  UpdateAnnouncementInput,
  MessageSenderRole,
} from './communications.types.js';

const announcementManagers = [
  'organization_owner',
  'organization_admin',
  'campus_admin',
  'principal_director',
  'academic_coordinator',
] as const;

const messagingRoles = [
  'organization_owner',
  'organization_admin',
  'principal_director',
  'teacher',
  'parent_guardian',
] as const;

const audiences: readonly AnnouncementAudience[] = [
  'all',
  'staff',
  'students',
  'guardians',
];
const statuses: readonly AnnouncementStatus[] = [
  'draft',
  'published',
  'archived',
];

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

function text(value: unknown, field: string, max: number): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) {
    throw new AppError(400, 'VALIDATION_ERROR', `Enter a valid ${field}.`);
  }
  return value.trim();
}

function objectId(value: unknown, field: string): string {
  const id = text(value, field, 24);
  if (!mongoose.isValidObjectId(id)) {
    throw new AppError(400, 'VALIDATION_ERROR', `Select a valid ${field}.`);
  }
  return id;
}

function audience(value: unknown): AnnouncementAudience {
  if (
    typeof value !== 'string' ||
    !audiences.includes(value as AnnouncementAudience)
  ) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'Select a valid target audience.',
    );
  }
  return value as AnnouncementAudience;
}

function status(value: unknown): AnnouncementStatus {
  if (
    typeof value !== 'string' ||
    !statuses.includes(value as AnnouncementStatus)
  ) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'Select a valid announcement status.',
    );
  }
  return value as AnnouncementStatus;
}

function booleanValue(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') {
    throw new AppError(400, 'VALIDATION_ERROR', `Select a valid ${field}.`);
  }
  return value;
}

function organizationContext(response: {
  locals?: {
    organizationContext?: {
      organizationId: string;
      userId: string;
      campusIds?: string[];
      role?: string;
    };
  };
}): AnnouncementContext {
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
    userId: context.userId,
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

function routeId(value: string | string[] | undefined): string {
  const id = Array.isArray(value) ? value[0] : value;
  if (!id || !mongoose.isValidObjectId(id)) {
    throw new AppError(404, 'NOT_FOUND', 'Record not found.');
  }
  return id;
}

function createInput(body: Record<string, unknown>): CreateAnnouncementInput {
  return {
    title: text(body.title, 'title', 160),
    content: text(body.content, 'content', 5000),
    ...(body.campusId === undefined
      ? {}
      : { campusId: objectId(body.campusId, 'campus') }),
    ...(body.targetAudience === undefined
      ? {}
      : { targetAudience: audience(body.targetAudience) }),
    ...(body.status === undefined ? {} : { status: status(body.status) }),
    ...(body.publishDate === undefined
      ? {}
      : { publishDate: text(body.publishDate, 'publish date', 40) }),
    ...(body.isPinned === undefined
      ? {}
      : { isPinned: booleanValue(body.isPinned, 'pinned value') }),
  };
}

function updateInput(body: Record<string, unknown>): UpdateAnnouncementInput {
  const input: UpdateAnnouncementInput = {
    ...(body.title === undefined
      ? {}
      : { title: text(body.title, 'title', 160) }),
    ...(body.content === undefined
      ? {}
      : { content: text(body.content, 'content', 5000) }),
    ...(body.campusId === undefined
      ? {}
      : { campusId: objectId(body.campusId, 'campus') }),
    ...(body.targetAudience === undefined
      ? {}
      : { targetAudience: audience(body.targetAudience) }),
    ...(body.status === undefined ? {} : { status: status(body.status) }),
    ...(body.publishDate === undefined
      ? {}
      : { publishDate: text(body.publishDate, 'publish date', 40) }),
    ...(body.isPinned === undefined
      ? {}
      : { isPinned: booleanValue(body.isPinned, 'pinned value') }),
  };
  if (Object.keys(input).length === 0) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'Provide at least one announcement field to update.',
    );
  }
  return input;
}

function queryValue(value: unknown, field: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || value.length > 40) {
    throw new AppError(400, 'VALIDATION_ERROR', `Enter a valid ${field}.`);
  }
  return value || undefined;
}

function announcementQuery(query: Record<string, unknown>): AnnouncementQuery {
  const audienceValue = queryValue(query.targetAudience, 'target audience');
  const statusValue = queryValue(query.status, 'status');
  return {
    ...(statusValue ? { status: status(statusValue) } : {}),
    ...(audienceValue ? { targetAudience: audience(audienceValue) } : {}),
    ...(query.campusId === undefined
      ? {}
      : { campusId: objectId(query.campusId, 'campus') }),
    ...(query.dateFrom === undefined
      ? {}
      : { dateFrom: text(query.dateFrom, 'start date', 40) }),
    ...(query.dateTo === undefined
      ? {}
      : { dateTo: text(query.dateTo, 'end date', 40) }),
  };
}

const oid = (value: string) => new mongoose.Types.ObjectId(value);

const defaultVerificationAdapters: VerificationAdapters = {
  async isGuardianLinkedToStudent(organizationId, guardianUserId, studentId) {
    const organizationObjectId = oid(organizationId);
    const user = await AuthUserModel.findById(oid(guardianUserId))
      .select({ email: 1, status: 1 })
      .lean();
    if (user?.status !== 'active' || typeof user.email !== 'string') {
      return false;
    }

    const guardians = await GuardianModel.find({
      organizationId: organizationObjectId,
      email: user.email.trim().toLowerCase(),
    })
      .select({ _id: 1 })
      .limit(2)
      .lean();
    if (guardians.length !== 1) return false;
    const guardian = guardians[0]!;

    const studentFilter = {
      _id: oid(studentId),
      organizationId: organizationObjectId,
      status: 'active',
    };
    const [linkedRecord, legacyRecord] = await Promise.all([
      StudentGuardianLinkModel.exists({
        organizationId: organizationObjectId,
        studentId: oid(studentId),
        guardianId: guardian._id,
      }),
      StudentModel.exists({ ...studentFilter, guardianIds: guardian._id }),
    ]);
    return Boolean(linkedRecord || legacyRecord);
  },

  async isTeacherAssignedToStudent(organizationId, teacherUserId, studentId) {
    const organizationObjectId = oid(organizationId);
    const user = await AuthUserModel.findById(oid(teacherUserId))
      .select({ email: 1, status: 1 })
      .lean();
    if (user?.status !== 'active' || typeof user.email !== 'string') {
      return false;
    }

    const email = user.email.trim().toLowerCase();
    const teacherMembership = await MembershipModel.exists({
      organizationId: organizationObjectId,
      userId: oid(teacherUserId),
      role: 'teacher',
      status: 'active',
    });
    if (!teacherMembership) return false;

    const [staff, activeYears] = await Promise.all([
      StaffMemberModel.find({
        organizationId: organizationObjectId,
        email,
        status: 'active',
      })
        .select({ _id: 1 })
        .limit(2)
        .lean(),
      AcademicYearModel.find({
        organizationId: organizationObjectId,
        status: 'active',
      })
        .select({ _id: 1 })
        .lean(),
    ]);
    if (staff.length !== 1 || !activeYears.length) return false;

    const yearIds = activeYears.map((year) => year._id);
    const placements = await StudentSectionPlacementModel.find({
      organizationId: organizationObjectId,
      studentId: oid(studentId),
      status: 'active',
      academicYearId: { $in: yearIds },
    })
      .select({ classId: 1, sectionId: 1, academicYearId: 1 })
      .lean();
    if (!placements.length) return false;

    const assignment = await TeacherAssignmentModel.exists({
      organizationId: organizationObjectId,
      teacherStaffId: { $in: staff.map((member) => member._id) },
      academicYearId: { $in: yearIds },
      $or: placements.map((placement) => ({
        classId: placement.classId,
        sectionId: placement.sectionId,
        academicYearId: placement.academicYearId,
      })),
    });
    return Boolean(assignment);
  },
};

interface MessagingContactTeacher {
  userId: string;
  displayName: string;
}

interface MessagingContactStudent {
  studentId: string;
  studentName: string;
  className: string;
  sectionName: string;
  teachers: MessagingContactTeacher[];
}

async function listParentMessagingContacts(
  organizationId: string,
  userId: string,
): Promise<MessagingContactStudent[]> {
  const organizationObjectId = oid(organizationId);
  const user = await AuthUserModel.findById(oid(userId))
    .select({ email: 1, status: 1 })
    .lean();
  if (user?.status !== 'active' || typeof user.email !== 'string') {
    throw new AppError(
      403,
      'PORTAL_ACCOUNT_UNLINKED',
      'This account is not linked to an active guardian record.',
    );
  }
  const guardians = await GuardianModel.find({
    organizationId: organizationObjectId,
    email: user.email.trim().toLowerCase(),
  })
    .select({ _id: 1 })
    .limit(2)
    .lean();
  if (guardians.length !== 1) {
    throw new AppError(
      403,
      'PORTAL_ACCOUNT_UNLINKED',
      'Your account must match exactly one guardian record before messaging can be enabled.',
    );
  }

  const guardianId = guardians[0]!._id;
  const [linkedRecords, legacyStudents, activeYears] = await Promise.all([
    StudentGuardianLinkModel.find({
      organizationId: organizationObjectId,
      guardianId,
    })
      .select({ studentId: 1 })
      .lean(),
    StudentModel.find({
      organizationId: organizationObjectId,
      status: 'active',
      guardianIds: guardianId,
    })
      .select({ _id: 1, firstName: 1, lastName: 1 })
      .lean(),
    AcademicYearModel.find({
      organizationId: organizationObjectId,
      status: 'active',
    })
      .select({ _id: 1 })
      .lean(),
  ]);
  const linkedIds = [
    ...new Set([
      ...linkedRecords.map((link) => String(link.studentId)),
      ...legacyStudents.map((student) => String(student._id)),
    ]),
  ];
  if (!linkedIds.length) return [];

  const [students, placements] = await Promise.all([
    StudentModel.find({
      organizationId: organizationObjectId,
      status: 'active',
      _id: { $in: linkedIds.map(oid) },
    })
      .select({ _id: 1, firstName: 1, lastName: 1 })
      .sort({ lastName: 1, firstName: 1 })
      .lean(),
    activeYears.length
      ? StudentSectionPlacementModel.find({
          organizationId: organizationObjectId,
          studentId: { $in: linkedIds.map(oid) },
          status: 'active',
          academicYearId: { $in: activeYears.map((year) => year._id) },
        })
          .sort({ createdAt: -1 })
          .lean()
      : Promise.resolve([]),
  ]);
  const placementsByStudent = new Map<string, (typeof placements)[number]>();
  for (const placement of placements) {
    const studentKey = String(placement.studentId);
    if (!placementsByStudent.has(studentKey)) {
      placementsByStudent.set(studentKey, placement);
    }
  }
  const placementList = [...placementsByStudent.values()];
  const assignments = placementList.length
    ? await TeacherAssignmentModel.find({
        organizationId: organizationObjectId,
        $or: placementList.map((placement) => ({
          classId: placement.classId,
          sectionId: placement.sectionId,
          academicYearId: placement.academicYearId,
        })),
      })
        .select({
          teacherStaffId: 1,
          classId: 1,
          sectionId: 1,
          academicYearId: 1,
        })
        .lean()
    : [];
  const teacherStaffIds = [
    ...new Set(assignments.map((item) => String(item.teacherStaffId))),
  ];
  const staff = teacherStaffIds.length
    ? await StaffMemberModel.find({
        organizationId: organizationObjectId,
        _id: { $in: teacherStaffIds.map(oid) },
        status: 'active',
        email: { $exists: true, $ne: '' },
      })
        .select({ _id: 1, email: 1, firstName: 1, lastName: 1 })
        .lean()
    : [];
  const staffById = new Map(
    staff.map((member) => [String(member._id), member]),
  );
  const staffEmails = [
    ...new Set(
      staff.map((member) => String(member.email).trim().toLowerCase()),
    ),
  ];
  const teacherUsers = staffEmails.length
    ? await AuthUserModel.find({
        email: { $in: staffEmails },
        status: 'active',
      })
        .select({ _id: 1, email: 1, displayName: 1 })
        .lean()
    : [];
  const teacherUserByEmail = new Map(
    teacherUsers.map((teacher) => [
      String(teacher.email).toLowerCase(),
      teacher,
    ]),
  );
  const teacherUserIds = teacherUsers.map((teacher) => teacher._id);
  const teacherMemberships = teacherUserIds.length
    ? await MembershipModel.find({
        organizationId: organizationObjectId,
        userId: { $in: teacherUserIds },
        role: 'teacher',
        status: 'active',
      })
        .select({ userId: 1 })
        .lean()
    : [];
  const activeTeacherIds = new Set(
    teacherMemberships.map((membership) => String(membership.userId)),
  );
  const [classes, sections] = await Promise.all([
    AcademicClassModel.find({
      organizationId: organizationObjectId,
      _id: { $in: placementList.map((item) => item.classId) },
    })
      .select({ _id: 1, name: 1 })
      .lean(),
    AcademicSectionModel.find({
      organizationId: organizationObjectId,
      _id: { $in: placementList.map((item) => item.sectionId) },
    })
      .select({ _id: 1, name: 1 })
      .lean(),
  ]);
  const classNames = new Map(
    classes.map((item) => [String(item._id), String(item.name)]),
  );
  const sectionNames = new Map(
    sections.map((item) => [String(item._id), String(item.name)]),
  );

  return students.map((student) => {
    const studentId = String(student._id);
    const placement = placementsByStudent.get(studentId);
    const studentAssignments = placement
      ? assignments.filter(
          (item) =>
            String(item.classId) === String(placement.classId) &&
            String(item.sectionId) === String(placement.sectionId) &&
            String(item.academicYearId) === String(placement.academicYearId),
        )
      : [];
    const teachers = studentAssignments.flatMap((assignment) => {
      const member = staffById.get(String(assignment.teacherStaffId));
      const account = member?.email
        ? teacherUserByEmail.get(String(member.email).trim().toLowerCase())
        : undefined;
      if (!account || !activeTeacherIds.has(String(account._id))) return [];
      return [
        {
          userId: String(account._id),
          displayName: String(account.displayName),
        },
      ];
    });
    return {
      studentId,
      studentName: [student.firstName, student.lastName]
        .filter(Boolean)
        .join(' '),
      className: placement
        ? (classNames.get(String(placement.classId)) ?? 'Class not assigned')
        : 'Class not assigned',
      sectionName: placement
        ? (sectionNames.get(String(placement.sectionId)) ??
          'Section not assigned')
        : 'Section not assigned',
      teachers: [
        ...new Map(
          teachers.map((teacher) => [teacher.userId, teacher]),
        ).values(),
      ],
    };
  });
}

export function createCommunicationsRouter(
  service: CommunicationsService = new CommunicationsService(
    new MongoAnnouncementRepository(),
  ),
  messagingService: MessagingService = new MessagingService(
    new MongoMessagingRepository(),
    defaultVerificationAdapters,
  ),
  accessRepository: OrganizationAccessRepository = new MongoOrganizationAccessRepository(),
  authenticate = defaultAuthenticate(),
) {
  const router = Router();
  const baseAnnouncements = '/:organizationId/announcements';
  const baseMessaging = '/:organizationId/communications/threads';

  const protectAnnouncements = [
    authenticate,
    createOrganizationContextMiddleware(accessRepository),
    requireOrganizationRole(announcementManagers),
  ] as const;

  const protectMessaging = [
    authenticate,
    createOrganizationContextMiddleware(accessRepository),
    requireOrganizationRole(messagingRoles),
  ] as const;
  const protectParentMessaging = [
    authenticate,
    createOrganizationContextMiddleware(accessRepository),
    requireOrganizationRole(['parent_guardian']),
  ] as const;

  // Announcements Routes
  router.get(
    baseAnnouncements,
    ...protectAnnouncements,
    asyncHandler(async (request, response) => {
      response.status(200).json({
        items: await service.listAnnouncements(
          organizationContext(response),
          announcementQuery(request.query as Record<string, unknown>),
        ),
      });
    }),
  );

  router.post(
    baseAnnouncements,
    ...protectAnnouncements,
    csrfProtection,
    asyncHandler(async (request, response) => {
      response.status(201).json({
        announcement: await service.createAnnouncement(
          organizationContext(response),
          createInput(bodyObject(request.body)),
        ),
      });
    }),
  );

  router.get(
    `${baseAnnouncements}/:id`,
    ...protectAnnouncements,
    asyncHandler(async (request, response) => {
      response.status(200).json({
        announcement: await service.getAnnouncement(
          organizationContext(response),
          routeId(request.params.id),
        ),
      });
    }),
  );

  router.patch(
    `${baseAnnouncements}/:id`,
    ...protectAnnouncements,
    csrfProtection,
    asyncHandler(async (request, response) => {
      response.status(200).json({
        announcement: await service.updateAnnouncement(
          organizationContext(response),
          routeId(request.params.id),
          updateInput(bodyObject(request.body)),
        ),
      });
    }),
  );

  router.delete(
    `${baseAnnouncements}/:id`,
    ...protectAnnouncements,
    csrfProtection,
    asyncHandler(async (request, response) => {
      await service.deleteAnnouncement(
        organizationContext(response),
        routeId(request.params.id),
      );
      response.status(204).end();
    }),
  );

  // Parent-only contact directory: exposes only linked children and teachers assigned
  // to their active class sections. IDs are returned only after tenant and relationship checks.
  router.get(
    '/:organizationId/communications/contacts',
    ...protectParentMessaging,
    asyncHandler(async (_request, response) => {
      const ctx = organizationContext(response);
      response.status(200).json({
        items: await listParentMessagingContacts(
          ctx.organizationId,
          ctx.userId,
        ),
      });
    }),
  );

  // Phase D: Messaging Routes
  router.get(
    baseMessaging,
    ...protectMessaging,
    asyncHandler(async (_request, response) => {
      const ctx = organizationContext(response);
      const threads = await messagingService.listThreads(
        ctx.organizationId,
        ctx.userId,
        ctx.role,
      );
      response.status(200).json({ items: threads });
    }),
  );

  router.post(
    baseMessaging,
    ...protectMessaging,
    csrfProtection,
    asyncHandler(async (request, response) => {
      const ctx = organizationContext(response);
      if (ctx.role !== 'parent_guardian') {
        throw new AppError(
          403,
          'PARENT_ROLE_REQUIRED',
          'Only a linked parent or guardian can start a new parent-teacher conversation.',
        );
      }
      const body = bodyObject(request.body);
      const result = await messagingService.startConversation(
        ctx.organizationId,
        ctx.userId,
        {
          studentId: objectId(body.studentId, 'student'),
          teacherUserId: objectId(body.teacherUserId, 'teacher'),
          subjectTitle: text(body.subjectTitle, 'subject title', 120),
          initialMessage: text(body.initialMessage, 'initial message', 2000),
        },
        ctx.campusIds[0],
      );
      response.status(201).json(result);
    }),
  );

  router.get(
    `${baseMessaging}/:threadId`,
    ...protectMessaging,
    asyncHandler(async (request, response) => {
      const ctx = organizationContext(response);
      const result = await messagingService.getThreadMessages(
        ctx.organizationId,
        ctx.userId,
        ctx.role,
        routeId(request.params.threadId),
      );
      response.status(200).json(result);
    }),
  );

  router.post(
    `${baseMessaging}/:threadId/messages`,
    ...protectMessaging,
    csrfProtection,
    asyncHandler(async (request, response) => {
      const ctx = organizationContext(response);
      const body = bodyObject(request.body);

      // Map system role to allowed schema role
      const senderRole: MessageSenderRole =
        ctx.role === 'teacher'
          ? 'teacher'
          : ctx.role === 'parent_guardian'
            ? 'parent_guardian'
            : 'admin';

      const message = await messagingService.replyToThread(
        ctx.organizationId,
        ctx.userId,
        senderRole,
        routeId(request.params.threadId),
        { content: text(body.content, 'content', 2000) },
      );
      response.status(201).json({ message });
    }),
  );

  return router;
}

export const communicationsRouter = createCommunicationsRouter();
