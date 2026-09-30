import { fileURLToPath } from 'node:url';
import path from 'node:path';
import dotenv from 'dotenv';

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../',
);
export const environmentFilePath = path.join(repositoryRoot, '.env');
dotenv.config({ path: environmentFilePath });

function readInteger(
  value: string | undefined,
  fallback: number,
  name: string,
  maximum = Number.MAX_SAFE_INTEGER,
): number {
  if (value === undefined || value === '') return fallback;
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > maximum) {
    throw new Error(`${name} must be an integer between 1 and ${maximum}`);
  }
  return port;
}

export const env = {
  host: process.env.API_HOST ?? '127.0.0.1',
  port: readInteger(process.env.API_PORT, 4000, 'API_PORT', 65535),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  databaseUri:
    process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/instituteos',
  databaseServerSelectionTimeoutMs: readInteger(
    process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS,
    5000,
    'MONGODB_SERVER_SELECTION_TIMEOUT_MS',
  ),
  databaseRetryDelayMs: readInteger(
    process.env.MONGODB_RETRY_DELAY_MS,
    5000,
    'MONGODB_RETRY_DELAY_MS',
  ),
  corsOrigins: (
    process.env.CORS_ORIGINS ?? 'http://127.0.0.1:5173,http://localhost:5173'
  )
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  rateLimitWindowMs: readInteger(
    process.env.API_RATE_LIMIT_WINDOW_MS,
    15 * 60 * 1000,
    'API_RATE_LIMIT_WINDOW_MS',
  ),
  rateLimitMax: readInteger(
    process.env.API_RATE_LIMIT_MAX,
    120,
    'API_RATE_LIMIT_MAX',
  ),
  trustProxyHops: readInteger(
    process.env.API_TRUST_PROXY_HOPS,
    0,
    'API_TRUST_PROXY_HOPS',
  ),
  shutdownTimeoutMs: readInteger(
    process.env.API_SHUTDOWN_TIMEOUT_MS,
    10000,
    'API_SHUTDOWN_TIMEOUT_MS',
  ),
};
