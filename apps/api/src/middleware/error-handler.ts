import type { ErrorRequestHandler } from 'express';
import { AppError } from '../errors/app-error.js';

function isMalformedJson(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'type' in error &&
    error.type === 'entity.parse.failed'
  );
}

function isOversizedBody(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'type' in error &&
    error.type === 'entity.too.large'
  );
}

export const errorHandler: ErrorRequestHandler = (
  error: unknown,
  _request,
  response,
  _next,
) => {
  void _next;
  const requestId = response.locals.requestId as string | undefined;
  const normalizedError = isMalformedJson(error)
    ? new AppError(
        400,
        'INVALID_JSON',
        'The request body contains invalid JSON.',
      )
    : isOversizedBody(error)
      ? new AppError(413, 'PAYLOAD_TOO_LARGE', 'The request body is too large.')
      : error;
  const appError = normalizedError instanceof AppError ? normalizedError : null;
  const statusCode = appError?.statusCode ?? 500;
  const code = appError?.code ?? 'INTERNAL_SERVER_ERROR';
  const message = appError?.message ?? 'An unexpected error occurred.';

  if (statusCode >= 500) {
    console.error(
      JSON.stringify({
        level: 'error',
        event: 'http.error',
        requestId,
        errorName:
          normalizedError instanceof Error
            ? normalizedError.name
            : 'UnknownError',
        code,
      }),
    );
  }

  response.status(statusCode).json({
    error: {
      code,
      message,
      ...(requestId ? { requestId } : {}),
    },
  });
};
