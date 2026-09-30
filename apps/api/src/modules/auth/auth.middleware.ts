import { timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../../errors/app-error.js';
import { CSRF_COOKIE, readCookie, SESSION_COOKIE } from './auth.cookies.js';
import { AuthService, hashOpaqueToken } from './auth.service.js';

export function createAuthenticationMiddleware(service: AuthService) {
  return async (request: Request, _response: Response, next: NextFunction) => {
    const token = readCookie(request, SESSION_COOKIE);
    if (!token)
      return next(
        new AppError(401, 'AUTHENTICATION_REQUIRED', 'Sign in to continue.'),
      );
    try {
      const auth = await service.authenticate(token);
      if (!auth)
        return next(
          new AppError(401, 'AUTHENTICATION_REQUIRED', 'Sign in to continue.'),
        );
      _response.locals.auth = auth;
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

export function csrfProtection(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method.toUpperCase()))
    return next();
  const cookieToken = readCookie(request, CSRF_COOKIE);
  const headerToken = request.header('X-CSRF-Token');
  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return next(
      new AppError(
        403,
        'CSRF_VALIDATION_FAILED',
        'The request could not be validated.',
      ),
    );
  }
  const auth = response.locals.auth as
    { session: { csrfTokenHash: string } } | undefined;
  const expected = Buffer.from(auth?.session.csrfTokenHash ?? '', 'hex');
  const actual = Buffer.from(hashOpaqueToken(headerToken), 'hex');
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return next(
      new AppError(
        403,
        'CSRF_VALIDATION_FAILED',
        'The request could not be validated.',
      ),
    );
  }
  return next();
}
