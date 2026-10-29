import type { CookieOptions, Request, Response } from 'express';
import { env } from '../../config/env.js';
import type { IssuedSession } from './auth.types.js';

export const SESSION_COOKIE = 'instituteos_session';
export const CSRF_COOKIE = 'instituteos_csrf';
const COOKIE_PATH = '/api/v1';

function cookieOptions(
  httpOnly: boolean,
  path: string,
  domain?: string,
): CookieOptions {
  return {
    httpOnly,
    secure: env.authCookieSecure,
    sameSite: 'strict',
    path,
    ...(domain ? { domain } : {}),
  };
}

export function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.cookie;
  if (!header) return undefined;
  for (const pair of header.split(';')) {
    const separator = pair.indexOf('=');
    if (separator < 0 || pair.slice(0, separator).trim() !== name) continue;
    try {
      return decodeURIComponent(pair.slice(separator + 1).trim());
    } catch {
      return undefined;
    }
  }
  return undefined;
}

export function setAuthCookies(
  response: Response,
  session: IssuedSession,
): void {
  const maxAge = env.authSessionTtlDays * 24 * 60 * 60 * 1000;
  response.cookie(SESSION_COOKIE, session.sessionToken, {
    ...cookieOptions(true, COOKIE_PATH),
    maxAge,
    expires: session.expiresAt,
  });
  response.cookie(CSRF_COOKIE, session.csrfToken, {
    ...cookieOptions(false, '/', env.authCsrfCookieDomain),
    maxAge,
    expires: session.expiresAt,
  });
}

export function clearAuthCookies(response: Response): void {
  response.clearCookie(SESSION_COOKIE, cookieOptions(true, COOKIE_PATH));
  response.clearCookie(
    CSRF_COOKIE,
    cookieOptions(false, '/', env.authCsrfCookieDomain),
  );
}
