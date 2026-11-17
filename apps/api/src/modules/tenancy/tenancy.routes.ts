import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { env } from '../../config/env.js';
import { AppError } from '../../errors/app-error.js';
import { asyncHandler } from '../../middleware/async-handler.js';
import { AuthService } from '../auth/auth.service.js';
import { authEmailDelivery } from '../auth/auth.email.js';
import {
  createAuthenticationMiddleware,
  csrfProtection,
} from '../auth/auth.middleware.js';
import { MongoAuthRepository } from '../auth/auth.repository.js';
import {
  ORGANIZATION_PERMISSIONS,
  permissionsForOrganizationRole,
} from './authorization.js';
import { OrganizationModel } from './tenancy.model.js';
import { MongoOrganizationAccessRepository } from './tenancy.repository.js';
import type {
  OrganizationAccessRepository,
  OrganizationRole,
} from './tenancy.types.js';
import { ORGANIZATION_ROLES } from './tenancy.types.js';
import {
  createOrganizationContextMiddleware,
  requireOrganizationRole,
} from './tenant-context.middleware.js';

function createDefaultAuthenticationMiddleware() {
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

const workspaceContextRateLimit = rateLimit({
  windowMs: 60_000,
  limit: 120,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (_request, response) => {
    response.status(429).json({
      error: {
        code: 'RATE_LIMITED',
        message:
          'Too many workspace verification requests. Please try again shortly.',
      },
    });
  },
});

export function createTenancyRouter(
  repository: OrganizationAccessRepository = new MongoOrganizationAccessRepository(),
  authenticate = createDefaultAuthenticationMiddleware(),
) {
  const router = Router();
  const resolveOrganization = createOrganizationContextMiddleware(repository);

  router.get(
    '/:organizationId/context',
    authenticate,
    workspaceContextRateLimit,
    resolveOrganization,
    asyncHandler(async (_request, response) => {
      const context = response.locals.organizationContext as {
        organizationId: string;
        role: string;
        permissions: readonly string[];
        campusIds: readonly string[];
      };
      response.status(200).json({
        organizationId: context.organizationId,
        role: context.role,
        permissions: context.permissions,
        campusIds: context.campusIds,
      });
    }),
  );

  router.get(
    '/:organizationId/role-permissions',
    authenticate,
    resolveOrganization,
    requireOrganizationRole(['organization_owner']),
    asyncHandler(async (_request, response) => {
      const context = response.locals.organizationContext as {
        organizationId: string;
      };
      const organization = await OrganizationModel.findById(
        context.organizationId,
      )
        .select('rolePermissions')
        .lean();
      if (!organization)
        throw new AppError(
          404,
          'ORGANIZATION_NOT_FOUND',
          'Organization not found.',
        );
      response.status(200).json({
        policies: organization.rolePermissions ?? {},
        defaults: Object.fromEntries(
          ORGANIZATION_ROLES.filter(
            (role) => role !== 'organization_owner',
          ).map((role) => [role, permissionsForOrganizationRole(role)]),
        ),
        roles: ORGANIZATION_ROLES.filter(
          (role) => role !== 'organization_owner',
        ),
        permissions: ORGANIZATION_PERMISSIONS,
      });
    }),
  );

  router.put(
    '/:organizationId/role-permissions/:role',
    authenticate,
    resolveOrganization,
    requireOrganizationRole(['organization_owner']),
    csrfProtection,
    asyncHandler(async (request, response) => {
      const context = response.locals.organizationContext as {
        organizationId: string;
      };
      const role = request.params.role as OrganizationRole;
      if (!ORGANIZATION_ROLES.includes(role) || role === 'organization_owner')
        throw new AppError(
          400,
          'INVALID_ROLE',
          'The selected role cannot be configured.',
        );
      const body = request.body as { permissions?: unknown };
      if (
        !body ||
        !Array.isArray(body.permissions) ||
        body.permissions.some(
          (item) =>
            typeof item !== 'string' ||
            !(ORGANIZATION_PERMISSIONS as readonly string[]).includes(item),
        )
      ) {
        throw new AppError(
          400,
          'INVALID_PERMISSIONS',
          'Select valid permissions for this role.',
        );
      }
      const permissions = [...new Set(body.permissions as string[])];
      const organization = await OrganizationModel.findOneAndUpdate(
        { _id: context.organizationId, status: 'active' },
        { $set: { [`rolePermissions.${role}`]: permissions } },
        { new: true, runValidators: true },
      )
        .select('rolePermissions')
        .lean();
      if (!organization)
        throw new AppError(
          404,
          'ORGANIZATION_NOT_FOUND',
          'Organization not found.',
        );
      response.status(200).json({
        role,
        permissions,
        policies: organization.rolePermissions ?? {},
      });
    }),
  );
  return router;
}

export const tenancyRouter = createTenancyRouter();
