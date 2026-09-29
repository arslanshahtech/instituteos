const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '/api/v1').replace(
  /\/$/,
  '',
);

export interface ApiErrorBody {
  error?: {
    code?: string;
    message?: string;
    requestId?: string;
  };
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly requestId?: string,
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
  const response = await fetch(`${API_BASE_URL}${normalizedPath}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
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
    );
  }

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
