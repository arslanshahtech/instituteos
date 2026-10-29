import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { AppError } from '../../errors/app-error.js';
import { asyncHandler } from '../../middleware/async-handler.js';
import { env } from '../../config/env.js';
import { AuthService } from '../auth/auth.service.js';
import { authEmailDelivery } from '../auth/auth.email.js';
import { MongoAuthRepository } from '../auth/auth.repository.js';
import { createAuthenticationMiddleware } from '../auth/auth.middleware.js';
import { requirePlatformRole } from '../tenancy/tenant-context.middleware.js';
import { MongoOrganizationAccessRepository } from '../tenancy/tenancy.repository.js';
import { DemoRequestModel } from './demo-request.model.js';

const publicRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
});

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

function textField(value: unknown, label: string, min: number, max: number) {
  if (
    typeof value !== 'string' ||
    value.trim().length < min ||
    value.trim().length > max
  ) {
    throw new AppError(400, 'VALIDATION_ERROR', `Enter a valid ${label}.`);
  }
  return value.trim();
}

function optionalText(value: unknown, label: string, max: number) {
  if (value === undefined || value === null || value === '') return undefined;
  return textField(value, label, 1, max);
}

export function createPublicDemoRequestRouter() {
  const router = Router();
  router.post(
    '/',
    publicRateLimit,
    asyncHandler(async (request, response) => {
      const body = request.body as Record<string, unknown>;
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'A valid request body is required.',
        );
      }
      const organizationName = textField(
        body.organizationName,
        'institute name',
        2,
        160,
      );
      const contactName = textField(body.contactName, 'contact name', 2, 120);
      const email = textField(
        body.email,
        'email address',
        3,
        254,
      ).toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'Enter a valid email address.',
        );
      }
      const plan = textField(body.plan, 'plan', 1, 20);
      if (!['Starter', 'Growth', 'Enterprise'].includes(plan)) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Choose a valid plan.');
      }
      const studentCountEstimate = Number(body.studentCountEstimate);
      if (
        !Number.isInteger(studentCountEstimate) ||
        studentCountEstimate < 1 ||
        studentCountEstimate > 100000
      ) {
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'Enter an estimated student count from 1 to 100,000.',
        );
      }
      await DemoRequestModel.create({
        organizationName,
        contactName,
        email,
        ...(optionalText(body.phone, 'phone number', 40)
          ? { phone: optionalText(body.phone, 'phone number', 40) }
          : {}),
        plan,
        studentCountEstimate,
        ...(optionalText(body.message, 'message', 1200)
          ? { message: optionalText(body.message, 'message', 1200) }
          : {}),
        status: 'new',
      });
      response
        .status(202)
        .json({ message: 'Your demo request has been received for review.' });
    }),
  );
  return router;
}

export function createPlatformDemoRequestRouter(
  authenticate = defaultAuthenticate(),
  accessRepository = new MongoOrganizationAccessRepository(),
) {
  const router = Router();
  router.get(
    '/',
    authenticate,
    requirePlatformRole(accessRepository, 'platform_super_admin'),
    asyncHandler(async (_request, response) => {
      const requests = await DemoRequestModel.find({})
        .select(
          '_id organizationName contactName email phone plan studentCountEstimate message status createdAt',
        )
        .sort({ createdAt: -1 })
        .limit(100)
        .lean();
      response.status(200).json({
        requests: requests.map((item) => ({
          id: String(item._id),
          organizationName: item.organizationName,
          contactName: item.contactName,
          email: item.email,
          phone: item.phone ?? null,
          plan: item.plan,
          studentCountEstimate: item.studentCountEstimate,
          message: item.message ?? '',
          status: item.status,
          createdAt: item.createdAt,
        })),
      });
    }),
  );
  return router;
}

export const publicDemoRequestRouter = createPublicDemoRequestRouter();
export const platformDemoRequestRouter = createPlatformDemoRequestRouter();
