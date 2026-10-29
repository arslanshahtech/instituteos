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
} from '../tenancy/tenant-context.middleware.js';
import { FinanceOperationsService } from './finance-operations.service.js';
import { MongoFinanceOperationsRepository } from './finance-operations.repository.js';
import type { FinanceOperationsContext } from './finance-operations.types.js';

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

function organizationContext(response: {
  locals?: {
    organizationContext?: {
      organizationId: string;
      campusIds?: string[];
      userId: string;
      role?: string;
    };
  };
}): FinanceOperationsContext {
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

export function createFinanceOperationsRouter(
  service = new FinanceOperationsService(
    new MongoFinanceOperationsRepository(),
  ),
  accessRepository: OrganizationAccessRepository = new MongoOrganizationAccessRepository(),
  authenticate = defaultAuthenticate(),
) {
  const router = Router();
  const base = '/:organizationId/finance';
  const resolveOrganization =
    createOrganizationContextMiddleware(accessRepository);
  const read = [
    authenticate,
    resolveOrganization,
    requireOrganizationPermission('finance.read'),
  ] as const;
  const write = [
    authenticate,
    resolveOrganization,
    requireOrganizationPermission('finance.write'),
  ] as const;

  router.get(
    `${base}/payments`,
    ...read,
    asyncHandler(async (request, response) => {
      response.status(200).json({
        items: await service.listPayments(
          organizationContext(response),
          request.query as Record<string, unknown>,
        ),
      });
    }),
  );

  router.get(
    `${base}/expenses`,
    ...read,
    asyncHandler(async (request, response) => {
      response.status(200).json({
        items: await service.listExpenses(
          organizationContext(response),
          request.query as Record<string, unknown>,
        ),
      });
    }),
  );

  router.get(
    `${base}/expenses/budgets`,
    ...read,
    asyncHandler(async (request, response) => {
      response.status(200).json({
        items: await service.listExpenseBudgets(
          organizationContext(response),
          request.query as Record<string, unknown>,
        ),
      });
    }),
  );

  router.post(
    `${base}/expenses/budgets`,
    ...write,
    csrfProtection,
    asyncHandler(async (request, response) => {
      const budget = await service.saveExpenseBudget(
        organizationContext(response),
        bodyObject(request.body),
      );
      response.status(200).json({ budget });
    }),
  );

  router.post(
    `${base}/expenses`,
    ...write,
    csrfProtection,
    asyncHandler(async (request, response) => {
      const expense = await service.createExpense(
        organizationContext(response),
        bodyObject(request.body),
      );
      response.status(201).json({ expense });
    }),
  );

  router.delete(
    `${base}/expenses/:expenseId`,
    ...write,
    csrfProtection,
    asyncHandler(async (request, response) => {
      const expenseId = String(request.params.expenseId ?? '');
      if (!mongoose.isValidObjectId(expenseId)) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Select a valid expense.');
      }
      await service.deleteExpense(organizationContext(response), expenseId);
      response.status(204).end();
    }),
  );

  router.get(
    `${base}/concessions`,
    ...read,
    asyncHandler(async (request, response) => {
      response.status(200).json({
        items: await service.listConcessions(
          organizationContext(response),
          request.query as Record<string, unknown>,
        ),
      });
    }),
  );

  return router;
}

export const financeOperationsRouter = createFinanceOperationsRouter();
