import mongoose from 'mongoose';
import { Router } from 'express';
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
import {
  createOrganizationContextMiddleware,
  requireOrganizationPermission,
  requireOrganizationRole,
} from '../tenancy/tenant-context.middleware.js';

import { EventHolidayModel as EventHoliday } from './events-holidays.model.js';
const managerRoles = [
  'organization_owner',
  'organization_admin',
  'campus_admin',
  'principal_director',
  'academic_coordinator',
] as const;
function authenticateDefault() {
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
function parseInput(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new AppError(400, 'VALIDATION_ERROR', 'A valid event is required.');
  const body = value as Record<string, unknown>;
  if (
    typeof body.title !== 'string' ||
    !body.title.trim() ||
    body.title.trim().length > 120
  )
    throw new AppError(400, 'VALIDATION_ERROR', 'Enter an event title.');
  if (body.type !== 'holiday' && body.type !== 'event')
    throw new AppError(400, 'VALIDATION_ERROR', 'Select a valid type.');
  const date = (value: unknown, label: string) => {
    if (
      typeof value !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      Number.isNaN(Date.parse(`${value}T00:00:00Z`))
    )
      throw new AppError(400, 'VALIDATION_ERROR', `Select a valid ${label}.`);
    return new Date(`${value}T00:00:00.000Z`);
  };
  const startDate = date(body.startDate, 'date');
  const endDate = date(body.endDate || body.startDate, 'end date');
  if (endDate < startDate)
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'End date must be on or after the start date.',
    );
  if (body.noClasses !== undefined && typeof body.noClasses !== 'boolean')
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'Select a valid class schedule option.',
    );
  if (
    body.remarks !== undefined &&
    (typeof body.remarks !== 'string' || body.remarks.length > 500)
  )
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'Remarks must be 500 characters or fewer.',
    );
  return {
    title: body.title.trim(),
    type: body.type,
    noClasses: body.noClasses === true,
    startDate,
    endDate,
    remarks: typeof body.remarks === 'string' ? body.remarks.trim() : '',
  };
}
function serialize(doc: {
  _id: mongoose.Types.ObjectId;
  title: string;
  type: 'holiday' | 'event';
  noClasses: boolean;
  startDate: Date;
  endDate: Date;
  remarks?: string;
  createdAt?: Date;
}) {
  return {
    id: String(doc._id),
    title: doc.title,
    type: doc.type,
    noClasses: doc.noClasses,
    startDate: new Date(doc.startDate).toISOString().slice(0, 10),
    endDate: new Date(doc.endDate).toISOString().slice(0, 10),
    remarks: doc.remarks ?? '',
    createdAt: doc.createdAt?.toISOString?.() ?? null,
  };
}
export function createEventsHolidaysRouter(
  authenticate = authenticateDefault(),
) {
  const router = Router();
  const resolve = createOrganizationContextMiddleware(
    new MongoOrganizationAccessRepository(),
  );
  const read = [
    authenticate,
    resolve,
    requireOrganizationPermission('examination.read'),
  ] as const;
  const manage = [
    authenticate,
    resolve,
    requireOrganizationPermission('examination.write'),
    requireOrganizationRole(managerRoles),
  ] as const;
  const base = '/:organizationId/events-holidays';
  router.get(
    base,
    ...read,
    asyncHandler(async (_request, response) => {
      const organizationId = response.locals.organizationContext.organizationId;
      const docs = await EventHoliday.find({ organizationId })
        .sort({ startDate: 1, title: 1 })
        .lean();
      const items = docs.map(serialize);
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      const upcoming = items.filter(
        (item) => new Date(`${item.endDate}T00:00:00Z`) >= today,
      );
      response.status(200).json({
        items,
        summary: {
          holidays: upcoming.filter((item) => item.type === 'holiday').length,
          events: upcoming.filter((item) => item.type === 'event').length,
          total: upcoming.length,
          past: items.length - upcoming.length,
        },
      });
    }),
  );
  router.post(
    base,
    ...manage,
    csrfProtection,
    asyncHandler(async (request, response) => {
      const context = response.locals.organizationContext;
      const doc = await EventHoliday.create({
        ...parseInput(request.body),
        organizationId: context.organizationId,
        createdBy: context.userId,
      });
      response.status(201).json({ item: serialize(doc) });
    }),
  );
  router.patch(
    `${base}/:eventId`,
    ...manage,
    csrfProtection,
    asyncHandler(async (request, response) => {
      if (!mongoose.isValidObjectId(request.params.eventId))
        throw new AppError(404, 'RESOURCE_NOT_FOUND', 'Event not found.');
      const doc = await EventHoliday.findOne({
        _id: request.params.eventId,
        organizationId: response.locals.organizationContext.organizationId,
      });
      if (!doc)
        throw new AppError(404, 'RESOURCE_NOT_FOUND', 'Event not found.');
      Object.assign(
        doc,
        parseInput({
          title: request.body?.title ?? doc.title,
          type: request.body?.type ?? doc.type,
          noClasses: request.body?.noClasses ?? doc.noClasses,
          startDate:
            request.body?.startDate ?? doc.startDate.toISOString().slice(0, 10),
          endDate:
            request.body?.endDate ?? doc.endDate.toISOString().slice(0, 10),
          remarks: request.body?.remarks ?? doc.remarks,
        }),
      );
      await doc.save();
      response.status(200).json({ item: serialize(doc) });
    }),
  );
  router.delete(
    `${base}/:eventId`,
    ...manage,
    csrfProtection,
    asyncHandler(async (request, response) => {
      if (!mongoose.isValidObjectId(request.params.eventId))
        throw new AppError(404, 'RESOURCE_NOT_FOUND', 'Event not found.');
      const result = await EventHoliday.deleteOne({
        _id: request.params.eventId,
        organizationId: response.locals.organizationContext.organizationId,
      });
      if (!result.deletedCount)
        throw new AppError(404, 'RESOURCE_NOT_FOUND', 'Event not found.');
      response.status(204).send();
    }),
  );
  return router;
}
export const eventsHolidaysRouter = createEventsHolidaysRouter();
