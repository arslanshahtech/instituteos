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

function databaseErrorDetails(error: unknown): {
  databaseCode?: number | string;
  databaseCodeName?: string;
  databaseErrorLabels?: string[];
} {
  if (typeof error !== 'object' || error === null) return {};
  const details = error as {
    code?: unknown;
    codeName?: unknown;
    errorLabels?: unknown;
  };
  return {
    ...(typeof details.code === 'number' || typeof details.code === 'string'
      ? { databaseCode: details.code }
      : {}),
    ...(typeof details.codeName === 'string'
      ? { databaseCodeName: details.codeName }
      : {}),
    ...(Array.isArray(details.errorLabels) &&
    details.errorLabels.every((label) => typeof label === 'string')
      ? { databaseErrorLabels: details.errorLabels }
      : {}),
  };
}

export const errorHandler: ErrorRequestHandler = (
  error: unknown,
  request,
  response,
  next,
) => {
  const requestId = response.locals.requestId as string | undefined;
  const isDuplicateKey =
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 11000;
  const isMongooseValidation =
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    error.name === 'ValidationError';
  const isDatabaseUnavailable =
    error instanceof Error &&
    /Mongo(Network|ServerSelection|TopologyClosed)|MongooseServerSelection/i.test(
      error.name,
    );
  const normalizedError = isMalformedJson(error)
    ? new AppError(
        400,
        'INVALID_JSON',
        'The request body contains invalid JSON.',
      )
    : isOversizedBody(error)
      ? new AppError(413, 'PAYLOAD_TOO_LARGE', 'The request body is too large.')
      : isDuplicateKey
        ? new AppError(
            409,
            'RESOURCE_CONFLICT',
            'A record with these details already exists.',
          )
        : isMongooseValidation
          ? new AppError(
              400,
              'VALIDATION_ERROR',
              'The submitted data is not valid.',
            )
          : isDatabaseUnavailable
            ? new AppError(
                503,
                'DATA_SERVICE_UNAVAILABLE',
                'The data service is temporarily unavailable. Please try again.',
              )
            : error;
  if (response.headersSent) {
    next(normalizedError);
    return;
  }
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
        method: request.method,
        path: request.path,
        errorName: error instanceof Error ? error.name : 'UnknownError',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        ...(error instanceof Error && error.stack
          ? { stack: error.stack }
          : {}),
        ...databaseErrorDetails(error),
        code,
      }),
    );
  }

  response.status(statusCode).json({
    error: {
      code,
      message,
      ...(requestId ? { requestId } : {}),
      ...(appError?.details !== undefined ? { details: appError.details } : {}),
    },
  });
};
