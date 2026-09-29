import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

export const requestIdMiddleware: RequestHandler = (
  request,
  response,
  next,
) => {
  const suppliedId = request.get('x-request-id');
  const requestId =
    suppliedId && REQUEST_ID_PATTERN.test(suppliedId)
      ? suppliedId
      : randomUUID();

  response.locals.requestId = requestId;
  response.setHeader('X-Request-Id', requestId);
  next();
};
