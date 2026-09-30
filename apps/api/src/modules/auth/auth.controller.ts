import { rateLimit } from 'express-rate-limit';
import { Router } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import { AppError } from '../../errors/app-error.js';
import { env } from '../../config/env.js';
import {
  clearAuthCookies,
  readCookie,
  SESSION_COOKIE,
  setAuthCookies,
} from './auth.cookies.js';
import { authEmailDelivery } from './auth.email.js';
import {
  createAuthenticationMiddleware,
  csrfProtection,
} from './auth.middleware.js';
import { MongoAuthRepository } from './auth.repository.js';
import { AuthService } from './auth.service.js';

function sensitiveLimit(limit: number) {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_request, response) => {
      response.status(429).json({
        error: {
          code: 'AUTH_RATE_LIMITED',
          message: 'Too many attempts. Please wait and try again.',
          requestId: response.locals.requestId,
        },
      });
    },
  });
}

function objectBody(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'A valid JSON object is required.',
    );
  }
  return value as Record<string, unknown>;
}

function requiredString(body: Record<string, unknown>, field: string): string {
  const value = body[field];
  if (typeof value !== 'string' || !value.trim()) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      `A valid ${field} is required.`,
    );
  }
  return value;
}

function emailField(body: Record<string, unknown>): string {
  const email = requiredString(body, 'email').trim();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Enter a valid email address.');
  }
  return email;
}

function passwordField(
  body: Record<string, unknown>,
  field = 'password',
): string {
  const password = requiredString(body, field);
  if (password.length < 12 || password.length > 128) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      `${field} must be 12 to 128 characters.`,
    );
  }
  return password;
}

export function createAuthRouter(
  service = new AuthService(new MongoAuthRepository(), authEmailDelivery, {
    sessionTtlDays: env.authSessionTtlDays,
    requireEmailVerification: env.authRequireEmailVerification,
    webAppUrl: env.authWebAppUrl,
  }),
) {
  const authenticate = createAuthenticationMiddleware(service);
  const router = Router();

  router.post(
    '/register',
    sensitiveLimit(5),
    asyncHandler(async (request, response) => {
      const body = objectBody(request.body);
      const displayName = requiredString(body, 'displayName').trim();
      if (displayName.length < 2 || displayName.length > 120) {
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'Display name must be 2 to 120 characters.',
        );
      }
      const result = await service.register({
        email: emailField(body),
        displayName,
        password: passwordField(body),
      });
      response.status(202).json({
        verificationRequired: result.verificationRequired,
        message: result.verificationRequired
          ? 'If the account can be verified, instructions will be sent to that address.'
          : 'If registration can be completed, you can continue by signing in.',
      });
    }),
  );

  router.post(
    '/login',
    sensitiveLimit(10),
    asyncHandler(async (request, response) => {
      const body = objectBody(request.body);
      const session = await service.login(
        emailField(body),
        requiredString(body, 'password'),
      );
      setAuthCookies(response, session);
      response.status(200).json({ user: session.user });
    }),
  );

  router.post(
    '/logout',
    authenticate,
    csrfProtection,
    asyncHandler(async (request, response) => {
      const token = readCookie(request, SESSION_COOKIE);
      if (token) await service.logout(token);
      clearAuthCookies(response);
      response.status(204).end();
    }),
  );

  router.get(
    '/me',
    authenticate,
    asyncHandler(async (request, response) => {
      response.status(200).json({ user: response.locals.auth.user });
    }),
  );

  router.post(
    '/password/forgot',
    sensitiveLimit(5),
    asyncHandler(async (request, response) => {
      const body = objectBody(request.body);
      await service.requestPasswordReset(emailField(body));
      response.status(202).json({
        message:
          'If an active account matches that address, reset instructions will be sent.',
      });
    }),
  );

  router.post(
    '/password/reset',
    sensitiveLimit(10),
    asyncHandler(async (request, response) => {
      const body = objectBody(request.body);
      await service.resetPassword(
        requiredString(body, 'token'),
        passwordField(body, 'newPassword'),
      );
      response.status(200).json({
        message: 'Password updated. Sign in using your new password.',
      });
    }),
  );

  router.post(
    '/password/change',
    authenticate,
    csrfProtection,
    sensitiveLimit(5),
    asyncHandler(async (request, response) => {
      const body = objectBody(request.body);
      const session = await service.changePassword(
        response.locals.auth.user.id,
        requiredString(body, 'currentPassword'),
        passwordField(body, 'newPassword'),
      );
      setAuthCookies(response, session);
      response.status(200).json({ user: session.user });
    }),
  );

  router.post(
    '/email/verify',
    sensitiveLimit(10),
    asyncHandler(async (request, response) => {
      const body = objectBody(request.body);
      const session = await service.verifyEmail(requiredString(body, 'token'));
      setAuthCookies(response, session);
      response.status(200).json({ user: session.user });
    }),
  );

  router.post(
    '/email/verification/resend',
    sensitiveLimit(5),
    asyncHandler(async (request, response) => {
      const body = objectBody(request.body);
      await service.resendVerification(emailField(body));
      response.status(202).json({
        message:
          'If the account needs verification, instructions will be sent to that address.',
      });
    }),
  );

  return router;
}

export const authRouter = createAuthRouter();
