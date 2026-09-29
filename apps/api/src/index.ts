import { createServer } from 'node:http';
import mongoose from 'mongoose';
import { app } from './app.js';
import { env } from './config/env.js';
import { connectDatabase, disconnectDatabase } from './database/connection.js';

const server = createServer(app);
let shuttingDown = false;
const databaseRetryController = new AbortController();

server.listen(env.port, env.host, () => {
  console.info(
    JSON.stringify({
      level: 'info',
      event: 'http.server.started',
      host: env.host,
      port: env.port,
      environment: env.nodeEnv,
    }),
  );
});

server.on('error', (error: NodeJS.ErrnoException) => {
  console.error(
    JSON.stringify({
      level: 'error',
      event: 'http.server.error',
      code: error.code ?? 'UNKNOWN',
    }),
  );
  process.exitCode = 1;
});

async function maintainDatabaseConnection(signal: AbortSignal): Promise<void> {
  let attempt = 0;

  while (!signal.aborted) {
    attempt += 1;
    try {
      await connectDatabase(
        env.databaseUri,
        env.databaseServerSelectionTimeoutMs,
      );
      console.info(
        JSON.stringify({
          level: 'info',
          event: 'database.connected',
          attempt,
        }),
      );
      return;
    } catch (error) {
      console.error(
        JSON.stringify({
          level: 'error',
          event: 'database.connection.failed',
          attempt,
          errorName: error instanceof Error ? error.name : 'UnknownError',
          message: 'Database connection failed; readiness remains unavailable.',
          retryDelayMs: env.databaseRetryDelayMs,
        }),
      );

      await waitForRetry(env.databaseRetryDelayMs, signal);
    }
  }
}

function waitForRetry(delayMs: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.resolve();

  return new Promise((resolve) => {
    const finish = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', finish);
      resolve();
    };
    const timer = setTimeout(finish, delayMs);
    signal.addEventListener('abort', finish, { once: true });
  });
}

mongoose.connection.on('disconnected', () => {
  console.warn(
    JSON.stringify({ level: 'warn', event: 'database.disconnected' }),
  );
});
mongoose.connection.on('error', (error: unknown) => {
  console.error(
    JSON.stringify({
      level: 'error',
      event: 'database.error',
      errorName: error instanceof Error ? error.name : 'UnknownError',
    }),
  );
});

void maintainDatabaseConnection(databaseRetryController.signal);

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  databaseRetryController.abort();

  console.info(
    JSON.stringify({ level: 'info', event: 'shutdown.started', signal }),
  );
  const forceCloseTimer = setTimeout(() => {
    console.error(
      JSON.stringify({ level: 'error', event: 'shutdown.timeout' }),
    );
    server.closeAllConnections();
  }, env.shutdownTimeoutMs);
  forceCloseTimer.unref();

  server.close(async (error) => {
    if (error) {
      console.error(
        JSON.stringify({
          level: 'error',
          event: 'http.server.close.failed',
          errorName: error.name,
        }),
      );
      process.exitCode = 1;
    }

    try {
      await disconnectDatabase();
      console.info(
        JSON.stringify({ level: 'info', event: 'shutdown.completed' }),
      );
    } catch (disconnectError) {
      console.error(
        JSON.stringify({
          level: 'error',
          event: 'database.disconnect.failed',
          errorName:
            disconnectError instanceof Error
              ? disconnectError.name
              : 'UnknownError',
        }),
      );
      process.exitCode = 1;
    } finally {
      clearTimeout(forceCloseTimer);
    }
  });

  server.closeIdleConnections();
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
