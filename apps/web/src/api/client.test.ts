import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from './client.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('apiRequest', () => {
  it('normalizes network failures into a retryable API error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new TypeError('Failed to fetch')),
    );

    await expect(apiRequest('/health')).rejects.toMatchObject({
      name: 'ApiError',
      status: 0,
      code: 'NETWORK_ERROR',
      message:
        'The API service could not be reached. Check the connection and try again.',
    });
  });

  it('preserves abort signals instead of reporting an API outage', async () => {
    const aborted = new DOMException('The request was aborted.', 'AbortError');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(aborted));

    await expect(apiRequest('/health')).rejects.toBe(aborted);
  });

  it('preserves structured server errors and request IDs', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: {
              code: 'RATE_LIMITED',
              message: 'Slow down.',
              requestId: 'req-123',
            },
          }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'x-request-id': 'req-123',
            },
          },
        ),
      ),
    );

    await expect(apiRequest('/health')).rejects.toMatchObject({
      name: 'ApiError',
      status: 429,
      code: 'RATE_LIMITED',
      requestId: 'req-123',
      message: 'Slow down.',
    });
  });
});
