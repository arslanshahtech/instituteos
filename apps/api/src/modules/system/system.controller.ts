import type { RequestHandler } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import { getLiveness, getReadiness } from './system.service.js';

export const healthController: RequestHandler = (_request, response) => {
  response.status(200).json(getLiveness());
};

export const readinessController: RequestHandler = asyncHandler(
  async (_request, response) => {
    const readiness = getReadiness();
    response.status(readiness.ready ? 200 : 503).json({
      status: readiness.ready ? 'ready' : 'not_ready',
      checks: readiness.checks,
    });
  },
);
