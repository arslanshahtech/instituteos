import { describe, expect, it, vi } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import request from 'supertest';
import { app, createApp } from './app.js';
import { environmentFilePath, env } from './config/env.js';

describe('API foundation', () => {
  it('loads environment configuration from the repository-root .env file', () => {
    const repositoryRoot = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      '../../../',
    );

    expect(environmentFilePath).toBe(path.join(repositoryRoot, '.env'));
  });

  it('reports health under the versioned API prefix', async () => {
    const response = await request(app).get('/api/v1/health');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      status: 'ok',
      service: 'instituteos-api',
    });
  });

  it('prevents caching API responses and does not return body-less 304 responses', async () => {
    const response = await request(app)
      .get('/api/v1/health')
      .set('If-None-Match', '"stale-browser-cache"');

    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toContain('no-store');
    expect(response.headers.pragma).toBe('no-cache');
    expect(response.headers.etag).toBeUndefined();
    expect(response.body.status).toBe('ok');
  });

  it('returns not ready while the database is disconnected', async () => {
    const response = await request(app).get('/api/v1/ready');

    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({
      status: 'not_ready',
      checks: { database: 'disconnected' },
    });
  });

  it('exposes the versioned API root', async () => {
    const response = await request(app).get('/api/v1');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok', version: 'v1' });
  });

  it('returns a structured response for unknown routes', async () => {
    const logSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const response = await request(app)
      .get('/api/v1/missing?token=must-not-be-logged')
      .set('X-Request-Id', 'phase01-test-123');

    expect(response.status).toBe(404);
    expect(response.body.error).toMatchObject({
      code: 'NOT_FOUND',
      requestId: 'phase01-test-123',
    });
    expect(response.headers['x-request-id']).toBe('phase01-test-123');
    expect(logSpy.mock.calls.flat().join(' ')).not.toContain(
      'must-not-be-logged',
    );
    logSpy.mockRestore();
  });

  it('routes malformed JSON through centralized error handling', async () => {
    const response = await request(app)
      .post('/api/v1/example')
      .set('Content-Type', 'application/json')
      .send('{invalid');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_JSON');
    expect(response.body.error.requestId).toBeTruthy();
  });

  it('applies configured CORS origins and security headers', async () => {
    const configuredApp = createApp({
      ...env,
      corsOrigins: ['https://portal.example.test'],
    });
    const response = await request(configuredApp)
      .get('/api/v1')
      .set('Origin', 'https://portal.example.test');

    expect(response.status).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBe(
      'https://portal.example.test',
    );
    expect(response.headers['x-content-type-options']).toBe('nosniff');
  });

  it('does not consume the broad API quota for automatic session bootstrap checks', async () => {
    const limitedApp = createApp({
      ...env,
      rateLimitMax: 2,
      rateLimitWindowMs: 60_000,
    });

    const first = await request(limitedApp).get('/api/v1/auth/me');
    const second = await request(limitedApp).get('/api/v1/auth/me');
    const third = await request(limitedApp).get('/api/v1/auth/me');
    const contextChecks = await Promise.all(
      Array.from({ length: 3 }, () =>
        request(limitedApp).get(
          '/api/v1/organizations/507f1f77bcf86cd799439011/context',
        ),
      ),
    );

    // Missing cookies must still fail authentication, but automatic session
    // and tenant-access bootstrap checks must not consume the broad API quota.
    expect(first.status).toBe(401);
    expect(second.status).toBe(401);
    expect(third.status).toBe(401);
    expect(third.body.error.code).toBe('AUTHENTICATION_REQUIRED');
    expect(contextChecks.map((response) => response.status)).toEqual([
      401, 401, 401,
    ]);

    const regularRequest = await request(limitedApp).get('/api/v1');
    expect(regularRequest.status).toBe(200);
  });

  it('returns a structured 429 response when the configured limit is exceeded', async () => {
    const limitedApp = createApp({
      ...env,
      rateLimitMax: 2,
      rateLimitWindowMs: 60_000,
    });

    await request(limitedApp).get('/api/v1');
    await request(limitedApp).get('/api/v1');
    const response = await request(limitedApp).get('/api/v1');

    expect(response.status).toBe(429);
    expect(response.body.error.code).toBe('RATE_LIMITED');
  });
});
