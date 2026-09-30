import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { errorHandler } from '../../middleware/error-handler.js';
import { createAuthRouter } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import {
  MemoryAuthEmailDelivery,
  MemoryAuthRepository,
} from './auth.test-helpers.js';

function makeTestApp(requireEmailVerification = false) {
  const repository = new MemoryAuthRepository();
  const emailDelivery = new MemoryAuthEmailDelivery();
  const service = new AuthService(repository, emailDelivery, {
    sessionTtlDays: 7,
    requireEmailVerification,
    webAppUrl: 'http://localhost:5173',
  });
  const app = express();
  app.use(express.json());
  app.use('/api/v1/auth', createAuthRouter(service));
  app.use(errorHandler);
  return { app, repository, emailDelivery };
}

function responseCookies(response: request.Response): string[] {
  const header = response.headers['set-cookie'];
  return !header ? [] : Array.isArray(header) ? header : [header];
}

function cookiePairs(response: request.Response): string {
  const cookies = responseCookies(response);
  return cookies.map((cookie) => cookie.split(';', 1)[0]).join('; ');
}

function cookieValue(response: request.Response, cookieName: string): string {
  const cookies = responseCookies(response);
  const prefix = `${cookieName}=`;
  const cookie = cookies.find((value) => value.startsWith(prefix));
  if (!cookie) throw new Error('Expected authentication cookie was not set.');
  return decodeURIComponent(cookie.slice(prefix.length).split(';', 1)[0]!);
}

describe('authentication HTTP routes', () => {
  it('registers, bootstraps the current user, and logs out using an HttpOnly session cookie plus CSRF protection', async () => {
    const { app } = makeTestApp();
    const registration = await request(app).post('/api/v1/auth/register').send({
      displayName: 'Institute User',
      email: 'person@example.test',
      password: 'a long test password',
    });

    expect(registration.status).toBe(202);
    expect(registration.body).not.toHaveProperty('user');
    expect(responseCookies(registration)).toHaveLength(0);
    const duplicateRegistration = await request(app)
      .post('/api/v1/auth/register')
      .send({
        displayName: 'Institute User',
        email: 'person@example.test',
        password: 'a long test password',
      });
    expect(duplicateRegistration.status).toBe(registration.status);
    expect(duplicateRegistration.body).toEqual(registration.body);

    const signedIn = await request(app).post('/api/v1/auth/login').send({
      email: 'person@example.test',
      password: 'a long test password',
    });
    expect(signedIn.status).toBe(200);
    expect(signedIn.body.user).not.toHaveProperty('passwordHash');
    expect(signedIn.body).not.toHaveProperty('sessionToken');
    const sessionCookie = responseCookies(signedIn).find((value) =>
      value.startsWith('instituteos_session='),
    );
    expect(sessionCookie).toContain('HttpOnly');
    const cookies = cookiePairs(signedIn);

    const currentUser = await request(app)
      .get('/api/v1/auth/me')
      .set('Cookie', cookies);
    expect(currentUser.status).toBe(200);
    expect(currentUser.body.user.email).toBe('person@example.test');

    const blockedLogout = await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', cookies);
    expect(blockedLogout.status).toBe(403);

    const csrfToken = cookieValue(signedIn, 'instituteos_csrf');
    const logout = await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', cookies)
      .set('X-CSRF-Token', csrfToken);
    expect(logout.status).toBe(204);
    expect(
      (await request(app).get('/api/v1/auth/me').set('Cookie', cookies)).status,
    ).toBe(401);
  });

  it('rejects invalid credentials with a generic response and does not set cookies', async () => {
    const { app } = makeTestApp();
    const response = await request(app).post('/api/v1/auth/login').send({
      email: 'unknown@example.test',
      password: 'incorrect password',
    });

    expect(response.status).toBe(401);
    expect(response.body.error).toMatchObject({
      code: 'INVALID_CREDENTIALS',
      message: 'Email or password is incorrect.',
    });
    expect(responseCookies(response)).toHaveLength(0);
    expect(JSON.stringify(response.body)).not.toMatch(
      /incorrect password|passwordHash|sessionToken|csrfToken/i,
    );
  });

  it('keeps verification credentials out of responses and activates accounts with a one-time email token', async () => {
    const { app, emailDelivery } = makeTestApp(true);
    const registration = await request(app).post('/api/v1/auth/register').send({
      displayName: 'Institute User',
      email: 'person@example.test',
      password: 'a long test password',
    });
    expect(registration.status).toBe(202);
    expect(registration.body.verificationRequired).toBe(true);
    expect(registration.body).not.toHaveProperty('user');
    expect(responseCookies(registration)).toHaveLength(0);
    expect(JSON.stringify(registration.body)).not.toMatch(
      /verificationToken|passwordHash/i,
    );

    const verified = await request(app)
      .post('/api/v1/auth/email/verify')
      .send({ token: emailDelivery.verificationTokens[0] });
    expect(verified.status).toBe(200);
    expect(verified.body.user.status).toBe('active');
    expect(responseCookies(verified).length).toBeGreaterThan(0);
  });

  it('completes password reset and invalidates previous sessions without exposing reset credentials', async () => {
    const { app, emailDelivery } = makeTestApp();
    await request(app).post('/api/v1/auth/register').send({
      displayName: 'Institute User',
      email: 'person@example.test',
      password: 'a long test password',
    });
    const signedIn = await request(app).post('/api/v1/auth/login').send({
      email: 'person@example.test',
      password: 'a long test password',
    });
    const priorCookies = cookiePairs(signedIn);
    const requestReset = await request(app)
      .post('/api/v1/auth/password/forgot')
      .send({ email: 'person@example.test' });
    expect(requestReset.status).toBe(202);
    expect(JSON.stringify(requestReset.body)).not.toMatch(
      /resetToken|passwordHash/i,
    );
    expect(JSON.stringify(requestReset.body)).not.toContain(
      emailDelivery.resetTokens[0],
    );

    const unknownEmailReset = await request(app)
      .post('/api/v1/auth/password/forgot')
      .send({ email: 'unknown@example.test' });
    expect(unknownEmailReset.status).toBe(requestReset.status);
    expect(unknownEmailReset.body).toEqual(requestReset.body);
    expect(emailDelivery.resetTokens).toHaveLength(1);

    const reset = await request(app).post('/api/v1/auth/password/reset').send({
      token: emailDelivery.resetTokens[0],
      newPassword: 'a different new password',
    });
    expect(reset.status).toBe(200);
    expect(
      (await request(app).get('/api/v1/auth/me').set('Cookie', priorCookies))
        .status,
    ).toBe(401);
    expect(
      (
        await request(app).post('/api/v1/auth/login').send({
          email: 'person@example.test',
          password: 'a different new password',
        })
      ).status,
    ).toBe(200);
  });

  it('rate limits login by requester IP before validation and does not reset for a new email', async () => {
    const { app } = makeTestApp();
    const firstTen = await Promise.all(
      Array.from({ length: 10 }, (_, index) =>
        request(app)
          .post('/api/v1/auth/login')
          .send({ email: `new-address-${index}@example.test` }),
      ),
    );
    expect(firstTen.every((response) => response.status === 400)).toBe(true);

    const limited = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'another-new-address@example.test' });
    expect(limited.status).toBe(429);
    expect(limited.body.error).toMatchObject({
      code: 'AUTH_RATE_LIMITED',
      message: 'Too many attempts. Please wait and try again.',
    });

    // Each router instance owns an isolated limiter store in tests.
    const isolatedApp = makeTestApp().app;
    const isolatedRequest = await request(isolatedApp)
      .post('/api/v1/auth/login')
      .send({ email: 'fresh-address@example.test' });
    expect(isolatedRequest.status).toBe(400);
  });
});
