import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { errorHandler } from './error-handler.js';

describe('central error handler', () => {
  afterEach(() => vi.restoreAllMocks());

  it('logs Mongo error codes and labels without logging the database message', async () => {
    const logSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const databaseError = Object.assign(new Error('private database details'), {
      name: 'MongoServerError',
      code: 251,
      codeName: 'NoSuchTransaction',
      errorLabels: ['TransientTransactionError'],
    });
    const app = express();
    app.use((_, response, next) => {
      response.locals.requestId = 'request-reference';
      next();
    });
    app.get('/failure', (_request, _response, next) => next(databaseError));
    app.use(errorHandler);

    const response = await request(app).get('/failure');

    expect(response.status).toBe(500);
    expect(response.body.error).toMatchObject({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred.',
      requestId: 'request-reference',
    });
    const logEntry = JSON.parse(String(logSpy.mock.calls[0]?.[0])) as Record<
      string,
      unknown
    >;
    expect(logEntry).toMatchObject({
      errorName: 'MongoServerError',
      databaseCode: 251,
      databaseCodeName: 'NoSuchTransaction',
      databaseErrorLabels: ['TransientTransactionError'],
    });
    expect(JSON.stringify(logEntry)).not.toContain('private database details');
  });
});
