import { Router } from 'express';
import { env } from '../../config/env.js';
import { asyncHandler } from '../../middleware/async-handler.js';
import { AuthService } from '../auth/auth.service.js';
import { authEmailDelivery } from '../auth/auth.email.js';
import { createAuthenticationMiddleware } from '../auth/auth.middleware.js';
import { MongoAuthRepository } from '../auth/auth.repository.js';
import { MongoOrganizationAccessRepository } from './tenancy.repository.js';
import type { OrganizationAccessRepository } from './tenancy.types.js';
import { createOrganizationContextMiddleware } from './tenant-context.middleware.js';

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

export function createTenancyRouter(
  repository: OrganizationAccessRepository = new MongoOrganizationAccessRepository(),
  authenticate = createDefaultAuthenticationMiddleware(),
) {
  const router = Router();

  router.get(
    '/:organizationId/context',
    authenticate,
    createOrganizationContextMiddleware(repository),
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

  return router;
}

export const tenancyRouter = createTenancyRouter();
