import { Router } from 'express';
import { env } from '../../config/env.js';
import { AppError } from '../../errors/app-error.js';
import { asyncHandler } from '../../middleware/async-handler.js';
import { authEmailDelivery } from '../auth/auth.email.js';
import { createAuthenticationMiddleware } from '../auth/auth.middleware.js';
import { MongoAuthRepository } from '../auth/auth.repository.js';
import { AuthService } from '../auth/auth.service.js';
import { MongoOrganizationAccessRepository } from '../tenancy/tenancy.repository.js';
import type { OrganizationAccessRepository } from '../tenancy/tenancy.types.js';
import {
  createOrganizationContextMiddleware,
  requireOrganizationRole,
} from '../tenancy/tenant-context.middleware.js';
import { MongoSettingsRepository } from './settings.repository.js';
import { SettingsService } from './settings.service.js';
import type { OrganizationSettingsInput } from './settings.types.js';

const organizationManagers = [
  'organization_owner',
  'organization_admin',
] as const;
const optionalTextFields = [
  'logoUrl',
  'tagLine',
  'email',
  'phone',
  'address',
  'website',
];

function bodyObject(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'A valid JSON object is required.');
  }
  return value as Record<string, unknown>;
}

function parseSettingsInput(value: unknown): OrganizationSettingsInput {
  const body = bodyObject(value);
  const result: OrganizationSettingsInput = {};
  const definitions = {
    branding: ['logoUrl', 'primaryColor', 'tagLine'],
    contact: ['email', 'phone', 'address', 'website'],
    localization: ['timezone', 'currency', 'dateFormat'],
    notifications: ['emailAlerts', 'smsAlerts', 'autoAttendanceAlerts'],
  } as const;

  for (const [section, keys] of Object.entries(definitions)) {
    const rawSection = body[section];
    if (rawSection === undefined) continue;
    const values = bodyObject(rawSection);
    const parsed: Record<string, string | boolean> = {};
    for (const [key, item] of Object.entries(values)) {
      if (!(keys as readonly string[]).includes(key)) {
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'Settings contain an unsupported field.',
        );
      }
      if (section === 'notifications') {
        if (typeof item !== 'boolean') {
          throw new AppError(400, 'VALIDATION_ERROR', `Select a valid ${key}.`);
        }
        parsed[key] = item;
      } else {
        if (
          typeof item !== 'string' ||
          (item.trim().length === 0 && !optionalTextFields.includes(key))
        ) {
          throw new AppError(400, 'VALIDATION_ERROR', `Enter a valid ${key}.`);
        }
        if (key === 'tagLine' && item.trim().length > 160) {
          throw new AppError(400, 'VALIDATION_ERROR', 'Enter a valid tagLine.');
        }
        parsed[key] = item.trim();
      }
    }
    (result as Record<string, unknown>)[section] = parsed;
  }
  for (const key of Object.keys(body)) {
    if (!(key in definitions)) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Settings contain an unsupported section.',
      );
    }
  }
  return result;
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

export function createSettingsRouter(
  service = new SettingsService(new MongoSettingsRepository()),
  accessRepository: OrganizationAccessRepository =
    new MongoOrganizationAccessRepository(),
  authenticate = defaultAuthenticate(),
) {
  const router = Router();
  const resolveOrganization =
    createOrganizationContextMiddleware(accessRepository);
  const protect = [
    authenticate,
    resolveOrganization,
    requireOrganizationRole(organizationManagers),
  ] as const;

  router.get(
    '/:organizationId/settings',
    ...protect,
    asyncHandler(async (_request, response) => {
      const context = response.locals.organizationContext as {
        organizationId: string;
      };
      response.status(200).json({
        settings: await service.getSettings(context.organizationId),
      });
    }),
  );

  router.patch(
    '/:organizationId/settings',
    ...protect,
    asyncHandler(async (request, response) => {
      const context = response.locals.organizationContext as {
        organizationId: string;
        userId: string;
        role: string;
      };
      response.status(200).json({
        settings: await service.updateSettings(
          context.organizationId,
          parseSettingsInput(request.body),
          { userId: context.userId, role: context.role },
        ),
      });
    }),
  );

  return router;
}

export const settingsRouter = createSettingsRouter();
