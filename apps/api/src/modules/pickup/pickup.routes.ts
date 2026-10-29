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
import { MongoPickupRepository } from './pickup.repository.js';
import { PickupService } from './pickup.service.js';
import type {
  CreatePickupPersonInput,
  CreatePickupPassInput,
  VerifyPickupInput,
  ManualOverridePickupInput,
  PickupPersonRelationship,
} from './pickup.types.js';

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

function stringField(
  body: Record<string, unknown>,
  field: string,
  max: number,
  optional = false,
): string | undefined {
  const value = body[field];
  if (optional && value === undefined) return undefined;
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) {
    throw new AppError(400, 'VALIDATION_ERROR', `Enter a valid ${field}.`);
  }
  return value.trim();
}

function objectId(value: unknown, field: string): string {
  if (typeof value !== 'string' || !mongoose.isValidObjectId(value)) {
    throw new AppError(400, 'VALIDATION_ERROR', `Select a valid ${field}.`);
  }
  return value;
}

function organizationContext(response: {
  locals?: {
    organizationContext?: {
      organizationId: string;
      campusIds?: string[];
      role?: string;
    };
  };
}) {
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

const staffVerificationRoles = [
  'organization_owner',
  'organization_admin',
  'campus_admin',
  'principal_director',
  'teacher',
] as const;

export function createPickupRouter(
  service: PickupService = new PickupService(new MongoPickupRepository()),
  accessRepository: OrganizationAccessRepository = new MongoOrganizationAccessRepository(),
  authenticate = defaultAuthenticate(),
) {
  const router = Router();
  const resolveOrganization =
    createOrganizationContextMiddleware(accessRepository);

  const base = '/:organizationId/pickup';

  // 1. Authorized pickup persons list dekhna
  router.get(
    `${base}/students/:studentId/persons`,
    authenticate,
    resolveOrganization,
    requireOrganizationPermission('student.read'),
    asyncHandler(async (request, response) => {
      const { organizationId } = organizationContext(response);
      const studentId = objectId(request.params.studentId, 'student');
      const items = await service.listPickupPersons(organizationId, studentId);
      response.status(200).json({ items });
    }),
  );

  // 2. Naya authorized pickup person register karna
  router.post(
    `${base}/students/:studentId/persons`,
    authenticate,
    resolveOrganization,
    requireOrganizationPermission('student.update'),
    csrfProtection,
    asyncHandler(async (request, response) => {
      const { organizationId } = organizationContext(response);
      const studentId = objectId(request.params.studentId, 'student');
      const body = bodyObject(request.body);

      const input: CreatePickupPersonInput = {
        fullName: stringField(body, 'fullName', 120)!,
        relationship: stringField(
          body,
          'relationship',
          30,
        ) as PickupPersonRelationship,
        cnic: stringField(body, 'cnic', 20, true),
        phone: stringField(body, 'phone', 30)!,
        photoUrl: stringField(body, 'photoUrl', 500, true),
        notes: stringField(body, 'notes', 500, true),
      };

      const person = await service.registerPickupPerson(
        organizationId,
        studentId,
        input,
      );
      response.status(201).json({ person });
    }),
  );

  // 3. Pickup person ko activate ya suspend karna
  router.patch(
    `${base}/persons/:personId/status`,
    authenticate,
    resolveOrganization,
    requireOrganizationPermission('student.update'),
    csrfProtection,
    asyncHandler(async (request, response) => {
      const { organizationId } = organizationContext(response);
      const personId = objectId(request.params.personId, 'pickup person');
      const body = bodyObject(request.body);
      const status = stringField(body, 'status', 20)!;

      if (status !== 'active' && status !== 'suspended') {
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'Status must be active or suspended.',
        );
      }

      const person = await service.setPersonStatus(
        organizationId,
        personId,
        status,
      );
      response.status(200).json({ person });
    }),
  );

  // 4. Digital Gate-Pass generate karna
  router.post(
    `${base}/students/:studentId/passes`,
    authenticate,
    resolveOrganization,
    csrfProtection,
    asyncHandler(async (request, response) => {
      const { organizationId } = organizationContext(response);
      const studentId = objectId(request.params.studentId, 'student');
      const body = bodyObject(request.body);
      const userId = response.locals?.session?.userId ?? 'unknown';

      const input: CreatePickupPassInput = {
        pickupPersonId: objectId(body.pickupPersonId, 'pickup person'),
        validMinutes:
          typeof body.validMinutes === 'number' ? body.validMinutes : undefined,
      };

      const pass = await service.generateGatePass(
        organizationId,
        studentId,
        userId,
        input,
      );
      response.status(201).json({ pass });
    }),
  );

  // 5. Gatekeeper / Staff: Pass verify karke student release karna
  router.post(
    `${base}/verify-release`,
    authenticate,
    resolveOrganization,
    requireOrganizationRole(staffVerificationRoles),
    csrfProtection,
    asyncHandler(async (request, response) => {
      const { organizationId } = organizationContext(response);
      const body = bodyObject(request.body);
      const staffId = response.locals?.session?.userId ?? 'staff';

      const input: VerifyPickupInput = {
        passCode: stringField(body, 'passCode', 20)!,
        campusId: typeof body.campusId === 'string' ? body.campusId : undefined,
        notes: stringField(body, 'notes', 500, true),
      };

      const log = await service.verifyAndReleaseStudent(
        organizationId,
        staffId,
        input,
      );
      response
        .status(200)
        .json({ log, message: 'Student successfully released.' });
    }),
  );

  // 6. Manual Override Release (Emergency / Offline fallbacks ke liye)
  router.post(
    `${base}/manual-override`,
    authenticate,
    resolveOrganization,
    requireOrganizationRole(staffVerificationRoles),
    csrfProtection,
    asyncHandler(async (request, response) => {
      const { organizationId } = organizationContext(response);
      const body = bodyObject(request.body);
      const staffId = response.locals?.session?.userId ?? 'staff';

      const input: ManualOverridePickupInput = {
        studentId: objectId(body.studentId, 'student'),
        pickupPersonId:
          typeof body.pickupPersonId === 'string'
            ? body.pickupPersonId
            : undefined,
        campusId: typeof body.campusId === 'string' ? body.campusId : undefined,
        overrideReason: stringField(body, 'overrideReason', 500)!,
        notes: stringField(body, 'notes', 500, true),
      };

      const log = await service.manualOverrideRelease(
        organizationId,
        staffId,
        input,
      );
      response
        .status(200)
        .json({ log, message: 'Emergency release recorded.' });
    }),
  );

  // 7. Student ki handover history check karna
  router.get(
    `${base}/students/:studentId/history`,
    authenticate,
    resolveOrganization,
    requireOrganizationPermission('student.read'),
    asyncHandler(async (request, response) => {
      const { organizationId } = organizationContext(response);
      const studentId = objectId(request.params.studentId, 'student');
      const items = await service.getStudentPickupHistory(
        organizationId,
        studentId,
      );
      response.status(200).json({ items });
    }),
  );

  return router;
}

export const pickupRouter = createPickupRouter();
