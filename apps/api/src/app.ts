import cors from 'cors';
import express from 'express';
import type { ErrorRequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import { env } from './config/env.js';
import { AppError } from './errors/app-error.js';
import { errorHandler } from './middleware/error-handler.js';
import { requestIdMiddleware } from './middleware/request-id.js';
import { requestLogger } from './middleware/request-logger.js';
import { v1Router } from './routes/v1/index.js';

type AppConfig = typeof env;

export function createApp(config: AppConfig = env) {
  const application = express();

  application.disable('x-powered-by');
  application.set('trust proxy', config.trustProxyHops);
  application.use(requestIdMiddleware);
  application.use(requestLogger);
  application.use(helmet());
  application.use(
    cors({
      origin(origin, callback) {
        callback(null, !origin || config.corsOrigins.includes(origin));
      },
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'X-Request-Id'],
      exposedHeaders: ['X-Request-Id'],
      maxAge: 600,
    }),
  );
  application.use(
    '/api/v1',
    rateLimit({
      windowMs: config.rateLimitWindowMs,
      limit: config.rateLimitMax,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      skip: (request) =>
        request.path === '/health' || request.path === '/ready',
      handler: (_request, response) => {
        response.status(429).json({
          error: {
            code: 'RATE_LIMITED',
            message: 'Too many requests. Please try again later.',
            requestId: response.locals.requestId,
          },
        });
      },
    }),
  );
  application.use(express.json({ limit: '1mb' }));
  application.use('/api/v1', v1Router);
  application.use((_request, _response, next) => {
    next(
      new AppError(404, 'NOT_FOUND', 'The requested resource was not found.'),
    );
  });

  application.use(errorHandler as ErrorRequestHandler);

  return application;
}

export const app = createApp();
