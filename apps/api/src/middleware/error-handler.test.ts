import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { errorHandler } from './error-handler.js';

function createResponse() {
  const response = {
    locals: { requestId: 'request-test-123' },
    headersSent: false,
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return response as unknown as Response & {
    status: ReturnType<typeof vi.fn>;
    json: ReturnType<typeof vi.fn>;
  };
}

describe('central error handler', () => {
  it('returns a retryable 503 for database connection outages', () => {
    const response = createResponse();
    const next = vi.fn() as unknown as NextFunction;
    const error = new Error('Database server selection timed out.');
    error.name = 'MongoServerSelectionError';

    errorHandler(
      error,
      { method: 'GET', path: '/api/v1/ready' } as Request,
      response,
      next,
    );

    expect(response.status).toHaveBeenCalledWith(503);
    expect(response.json).toHaveBeenCalledWith({
      error: {
        code: 'DATA_SERVICE_UNAVAILABLE',
        message:
          'The data service is temporarily unavailable. Please try again.',
        requestId: 'request-test-123',
      },
    });
  });

  it('maps duplicate-key errors to a conflict instead of a permanent 500', () => {
    const response = createResponse();
    const next = vi.fn() as unknown as NextFunction;

    errorHandler(
      Object.assign(new Error('duplicate'), { code: 11000 }),
      { method: 'POST', path: '/api/v1/organizations' } as Request,
      response,
      next,
    );

    expect(response.status).toHaveBeenCalledWith(409);
    expect(response.json).toHaveBeenCalledWith({
      error: {
        code: 'RESOURCE_CONFLICT',
        message: 'A record with these details already exists.',
        requestId: 'request-test-123',
      },
    });
  });

  it('delegates errors when response headers have already been sent', () => {
    const response = createResponse();
    Object.defineProperty(response, 'headersSent', { value: true });
    const next = vi.fn();
    const error = new Error('stream already started');

    errorHandler(
      error,
      { method: 'GET', path: '/stream' } as Request,
      response,
      next,
    );

    expect(next).toHaveBeenCalledWith(error);
    expect(response.status).not.toHaveBeenCalled();
  });
});
