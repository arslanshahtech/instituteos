import {
  getDatabaseState,
  isDatabaseReady,
} from '../../database/connection.js';

export function getLiveness() {
  return {
    status: 'ok',
    service: 'instituteos-api',
    timestamp: new Date().toISOString(),
  };
}

export function getReadiness() {
  const databaseReady = isDatabaseReady();

  return {
    ready: databaseReady,
    checks: {
      database: getDatabaseState(),
    },
  };
}
