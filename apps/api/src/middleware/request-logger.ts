import { performance } from 'node:perf_hooks';
import type { RequestHandler } from 'express';

export const requestLogger: RequestHandler = (request, response, next) => {
  const startedAt = performance.now();

  response.on('finish', () => {
    const routePath = request.route?.path;
    const path = routePath
      ? `${request.baseUrl}${String(routePath)}`
      : 'unmatched';

    console.info(
      JSON.stringify({
        level: 'info',
        event: 'http.request',
        requestId: response.locals.requestId,
        method: request.method,
        path,
        statusCode: response.statusCode,
        durationMs: Math.round(performance.now() - startedAt),
      }),
    );
  });

  next();
};
