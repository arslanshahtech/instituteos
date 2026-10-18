import { Router } from 'express';
import { Types } from 'mongoose';
import { env } from '../../config/env.js';
import { AppError } from '../../errors/app-error.js';
import { asyncHandler } from '../../middleware/async-handler.js';
import {
  AcademicClassModel,
  AcademicSectionModel,
  AcademicYearModel,
} from '../academics/academics.model.js';
import { authEmailDelivery } from '../auth/auth.email.js';
import { AuthUserModel } from '../auth/auth.model.js';
import { createAuthenticationMiddleware } from '../auth/auth.middleware.js';
import { MongoAuthRepository } from '../auth/auth.repository.js';
import { AuthService } from '../auth/auth.service.js';
import {
  StudentAttendanceModel,
  StudentSectionPlacementModel,
} from '../attendance/attendance.model.js';
import { StudentInvoiceModel } from '../finance/finance.model.js';
import {
  GuardianModel,
  StudentGuardianLinkModel,
  StudentModel,
} from '../people/people.model.js';
import { CampusModel } from '../tenancy/tenancy.model.js';
import { MongoOrganizationAccessRepository } from '../tenancy/tenancy.repository.js';
import type { OrganizationAccessRepository } from '../tenancy/tenancy.types.js';
import {
  createOrganizationContextMiddleware,
  requireOrganizationRole,
} from '../tenancy/tenant-context.middleware.js';

type PortalRole = 'student' | 'parent_guardian';
const oid = (id: string) => new Types.ObjectId(id);

function numeric(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (value && typeof value === 'object' && 'toString' in value) {
    const parsed = Number(String(value));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function dateOnly(value: unknown): string | null {
  if (!(value instanceof Date) && typeof value !== 'string') return null;
  const parsed = new Date(value instanceof Date ? value.getTime() : value);
  return Number.isNaN(parsed.getTime())
    ? null
    : parsed.toISOString().slice(0, 10);
}

async function activeStudentIdsForAccount(
  organizationId: string,
  userId: string,
  role: PortalRole,
): Promise<string[]> {
  if (
    !Types.ObjectId.isValid(organizationId) ||
    !Types.ObjectId.isValid(userId)
  ) {
    throw new AppError(
      404,
      'ORGANIZATION_NOT_FOUND',
      'Organization not found.',
    );
  }

  const organizationObjectId = oid(organizationId);
  const user = await AuthUserModel.findById(oid(userId))
    .select({ email: 1, status: 1 })
    .lean();
  const email =
    typeof user?.email === 'string' ? user.email.trim().toLowerCase() : '';
  if (!user || user.status !== 'active' || !email) {
    throw new AppError(
      403,
      'PORTAL_ACCOUNT_UNLINKED',
      'This account is not linked to an active student or guardian record.',
    );
  }

  if (role === 'student') {
    const students = await StudentModel.find({
      organizationId: organizationObjectId,
      status: 'active',
      contactEmail: email,
    })
      .select({ _id: 1 })
      .limit(2)
      .lean();
    if (students.length !== 1) {
      throw new AppError(
        403,
        'PORTAL_ACCOUNT_UNLINKED',
        'Your account must match exactly one active student record. Please contact the college office.',
      );
    }
    return [String(students[0]!._id)];
  }

  const guardians = await GuardianModel.find({
    organizationId: organizationObjectId,
    email,
  })
    .select({ _id: 1 })
    .limit(2)
    .lean();
  if (guardians.length !== 1) {
    throw new AppError(
      403,
      'PORTAL_ACCOUNT_UNLINKED',
      'Your account must match exactly one guardian record. Please contact the college office.',
    );
  }

  const guardianId = guardians[0]!._id;
  const [links, legacyLinkedStudents] = await Promise.all([
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
      .select({ _id: 1 })
      .lean(),
  ]);
  return [
    ...new Set([
      ...links.map((link) => String(link.studentId)),
      ...legacyLinkedStudents.map((student) => String(student._id)),
    ]),
  ];
}

async function studentPortalRecord(organizationId: string, studentId: string) {
  const organizationObjectId = oid(organizationId);
  const studentObjectId = oid(studentId);
  const startOfMonth = new Date();
  startOfMonth.setUTCHours(0, 0, 0, 0);
  startOfMonth.setUTCDate(1);

  const [student, attendance, invoices, activeYear] = await Promise.all([
    StudentModel.findOne({
      _id: studentObjectId,
      organizationId: organizationObjectId,
      status: 'active',
    }).lean(),
    StudentAttendanceModel.find({
      organizationId: organizationObjectId,
      studentId: studentObjectId,
      date: { $gte: startOfMonth },
    })
      .sort({ date: -1 })
      .limit(100)
      .lean(),
    StudentInvoiceModel.find({
      organizationId: organizationObjectId,
      studentId: studentObjectId,
    })
      .sort({ dueDate: -1 })
      .limit(100)
      .lean(),
    AcademicYearModel.findOne({
      organizationId: organizationObjectId,
      status: 'active',
    })
      .sort({ startDate: -1 })
      .lean(),
  ]);
  if (!student) return null;

  const placement = await StudentSectionPlacementModel.findOne({
    organizationId: organizationObjectId,
    studentId: studentObjectId,
    status: 'active',
    ...(activeYear ? { academicYearId: activeYear._id } : {}),
  })
    .sort({ createdAt: -1 })
    .lean();

  const [campus, academicClass, section] = placement
    ? await Promise.all([
        CampusModel.findOne({
          _id: placement.campusId,
          organizationId: organizationObjectId,
        })
          .select({ name: 1 })
          .lean(),
        AcademicClassModel.findOne({
          _id: placement.classId,
          organizationId: organizationObjectId,
        })
          .select({ name: 1 })
          .lean(),
        AcademicSectionModel.findOne({
          _id: placement.sectionId,
          organizationId: organizationObjectId,
          classId: placement.classId,
        })
          .select({ name: 1 })
          .lean(),
      ])
    : [null, null, null];

  const present = attendance.filter(
    (record) => record.status === 'present',
  ).length;
  const absent = attendance.filter(
    (record) => record.status === 'absent',
  ).length;
  const leave = attendance.filter((record) => record.status === 'leave').length;
  const totalMarked = present + absent + leave;
  const attendancePercentage = totalMarked
    ? Math.round((present / totalMarked) * 1000) / 10
    : null;

  const feeItems = invoices.map((invoice) => {
    // totalAmount is the net payable amount after concessions; currentAmount
    // represents the pre-concession fee and must not be used as the balance basis.
    const totalAmount = numeric(invoice.totalAmount);
    const paidAmount = numeric(invoice.paidAmount);
    const arrearsAmount = numeric(invoice.arrearsAmount);
    return {
      id: String(invoice._id),
      invoiceNumber: String(invoice.invoiceNumber),
      billingCycle: String(invoice.billingCycle),
      dueDate: dateOnly(invoice.dueDate),
      totalAmount,
      paidAmount,
      outstandingAmount: Math.max(0, totalAmount - paidAmount) + arrearsAmount,
      status: String(invoice.status),
    };
  });

  // ExamMark currently has no publication/visibility flag. Do not expose draft marks
  // to students or guardians until the result-publishing workflow is implemented.
  return {
    id: String(student._id),
    firstName: String(student.firstName),
    lastName: String(student.lastName),
    displayName: [student.firstName, student.lastName]
      .filter(Boolean)
      .join(' '),
    status: String(student.status),
    campusName: campus?.name ? String(campus.name) : 'Campus not assigned',
    className: academicClass?.name
      ? String(academicClass.name)
      : 'Class not assigned',
    sectionName: section?.name ? String(section.name) : 'Section not assigned',
    attendance: {
      totalMarked,
      present,
      absent,
      leave,
      percentage: attendancePercentage,
      records: attendance.slice(0, 12).map((record) => ({
        date: dateOnly(record.date),
        status: String(record.status),
        remarks: record.remarks ? String(record.remarks) : '',
      })),
    },
    fees: {
      totalOutstanding:
        Math.round(
          feeItems.reduce((sum, fee) => sum + fee.outstandingAmount, 0) * 100,
        ) / 100,
      invoices: feeItems.slice(0, 12),
    },
    results: [],
    resultsAvailable: false,
  };
}

async function getPortalMe(
  organizationId: string,
  userId: string,
  role: PortalRole,
) {
  const studentIds = await activeStudentIdsForAccount(
    organizationId,
    userId,
    role,
  );
  const students = (
    await Promise.all(
      studentIds.map((studentId) =>
        studentPortalRecord(organizationId, studentId),
      ),
    )
  ).filter((student) => student !== null);
  return { role, students };
}

export function createPortalRouter(
  accessRepository: OrganizationAccessRepository = new MongoOrganizationAccessRepository(),
  authenticate = (() => {
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
  })(),
) {
  const router = Router();
  const resolveOrganization =
    createOrganizationContextMiddleware(accessRepository);
  const protectedPortal = [
    authenticate,
    resolveOrganization,
    requireOrganizationRole(['parent_guardian', 'student']),
  ] as const;

  router.get(
    '/:organizationId/portal/me',
    ...protectedPortal,
    asyncHandler(async (_request, response) => {
      const context = response.locals.organizationContext as
        | {
            organizationId: string;
            userId: string;
            role: string;
          }
        | undefined;
      if (
        !context?.userId ||
        (context.role !== 'student' && context.role !== 'parent_guardian')
      ) {
        throw new AppError(
          403,
          'PORTAL_ACCOUNT_UNLINKED',
          'This account cannot access the student portal.',
        );
      }
      response
        .status(200)
        .json(
          await getPortalMe(
            context.organizationId,
            context.userId,
            context.role,
          ),
        );
    }),
  );
  return router;
}

export const portalRouter = createPortalRouter();
