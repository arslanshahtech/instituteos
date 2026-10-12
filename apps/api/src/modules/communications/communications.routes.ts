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
  requireOrganizationRole,
} from '../tenancy/tenant-context.middleware.js';
import { MongoAnnouncementRepository } from './communications.repository.js';
import { CommunicationsService } from './communications.service.js';
import type {
  AnnouncementAudience,
  AnnouncementContext,
  AnnouncementQuery,
  AnnouncementStatus,
  CreateAnnouncementInput,
  UpdateAnnouncementInput,
} from './communications.types.js';

const announcementManagers = [
  'organization_owner',
  'organization_admin',
  'campus_admin',
  'principal_director',
  'academic_coordinator',
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
  if (typeof value !== 'string' || !audiences.includes(value as AnnouncementAudience)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Select a valid target audience.');
  }
  return value as AnnouncementAudience;
}

function status(value: unknown): AnnouncementStatus {
  if (typeof value !== 'string' || !statuses.includes(value as AnnouncementStatus)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Select a valid announcement status.');
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
    throw new AppError(404, 'ANNOUNCEMENT_NOT_FOUND', 'Announcement not found.');
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

function announcementQuery(
  query: Record<string, unknown>,
): AnnouncementQuery {
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

export function createCommunicationsRouter(
  service: CommunicationsService = new CommunicationsService(
    new MongoAnnouncementRepository(),
  ),
  accessRepository: OrganizationAccessRepository = new MongoOrganizationAccessRepository(),
  authenticate = defaultAuthenticate(),
) {
  const router = Router();
  const protect = [
    authenticate,
    createOrganizationContextMiddleware(accessRepository),
    requireOrganizationRole(announcementManagers),
  ] as const;
  const base = '/:organizationId/announcements';

  router.get(
    base,
    ...protect,
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
    base,
    ...protect,
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
    `${base}/:id`,
    ...protect,
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
    `${base}/:id`,
    ...protect,
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
    `${base}/:id`,
    ...protect,
    csrfProtection,
    asyncHandler(async (request, response) => {
      await service.deleteAnnouncement(
        organizationContext(response),
        routeId(request.params.id),
      );
      response.status(204).end();
    }),
  );

  return router;
}

export const communicationsRouter = createCommunicationsRouter();
