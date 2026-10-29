import process from 'node:process';

const timeoutMs = 8_000;

function requiredOrigin(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable ${name}.`);
  }

  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be an absolute HTTP(S) URL.`);
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error(`${name} must use HTTP or HTTPS.`);
  }

  if (url.pathname !== '/' || url.search || url.hash) {
    throw new Error(`${name} must be an origin only, without a path or query.`);
  }

  return url.origin;
}

async function check(name, url, init = {}) {
  const response = await fetch(url, {
    ...init,
    redirect: 'follow',
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    throw new Error(`${name} failed with HTTP ${response.status}.`);
  }

  return response;
}

async function main() {
  const apiOrigin = requiredOrigin('API_ORIGIN');
  const webOrigin = requiredOrigin('WEB_ORIGIN');
  const results = [];

  const healthUrl = new URL('/api/v1/health', apiOrigin);
  const health = await check('API liveness', healthUrl, {
    headers: { Origin: webOrigin },
  });
  const healthBody = await health.json().catch(() => null);
  if (healthBody?.status !== 'ok') {
    throw new Error('API liveness endpoint did not return status=ok.');
  }
  results.push('PASS API liveness');

  if (
    health.headers.get('access-control-allow-origin') !== webOrigin ||
    health.headers.get('access-control-allow-credentials') !== 'true'
  ) {
    throw new Error(
      'API CORS did not allow the configured frontend origin with credentials.',
    );
  }
  results.push('PASS frontend-origin CORS and credentials');

  const readyUrl = new URL('/api/v1/ready', apiOrigin);
  const ready = await check('API readiness / database connectivity', readyUrl, {
    headers: { Origin: webOrigin },
  });
  const readyBody = await ready.json().catch(() => null);
  if (readyBody?.ready !== true) {
    throw new Error(
      'API readiness did not confirm database/index initialization.',
    );
  }
  results.push('PASS API readiness / database available');

  const webResponse = await check(
    'Frontend landing page',
    new URL('/', webOrigin),
  );
  if (!webResponse.headers.get('content-type')?.includes('text/html')) {
    throw new Error(
      'Frontend root did not return HTML; check the static-site publish directory.',
    );
  }
  results.push('PASS frontend HTTPS origin responds with HTML');

  for (const result of results) console.log(result);
  console.log(
    'Staging smoke checks passed. Authenticated writes and school workflows still require the manual checklist.',
  );
}

main().catch((error) => {
  console.error(
    `FAIL ${error instanceof Error ? error.message : 'Unknown smoke-test error'}`,
  );
  process.exitCode = 1;
});
