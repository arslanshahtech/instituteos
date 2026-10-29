const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '/api/v1').replace(
  /\/$/,
  '',
);

export interface ApiErrorBody {
  error?: {
    code?: string;
    message?: string;
    requestId?: string;
    details?: { rows?: Array<{ row: number; field: string; message: string }> };
  };
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly requestId?: string,
    readonly details?: ApiErrorBody['error'] extends infer E
      ? E extends { details?: infer D }
        ? D
        : never
      : never,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const csrfToken = document.cookie
    .split('; ')
    .find((cookie) => cookie.startsWith('instituteos_csrf='))
    ?.slice('instituteos_csrf='.length);
  const method = init?.method?.toUpperCase() ?? 'GET';
  const response = await fetch(`${API_BASE_URL}${normalizedPath}`, {
    ...init,
    credentials: 'include',
    // Session and tenant-scoped API data must always be freshly validated.
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(csrfToken && !['GET', 'HEAD', 'OPTIONS'].includes(method)
        ? { 'X-CSRF-Token': decodeURIComponent(csrfToken) }
        : {}),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const errorBody = (await response
      .json()
      .catch(() => null)) as ApiErrorBody | null;
    throw new ApiError(
      errorBody?.error?.message ?? 'The request could not be completed.',
      response.status,
      errorBody?.error?.code,
      errorBody?.error?.requestId ??
        response.headers.get('x-request-id') ??
        undefined,
      errorBody?.error?.details,
    );
  }

  if (response.status === 204) return undefined as T;

  return (await response.json()) as T;
}

export interface ApiHealth {
  status: string;
  service: string;
  timestamp: string;
}

export function getApiHealth(): Promise<ApiHealth> {
  return apiRequest<ApiHealth>('/health');
}
