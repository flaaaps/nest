import type { NestConfig } from '@nest/shared';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, { ...init, credentials: 'same-origin' });
  } catch {
    throw new ApiError('Could not reach the NEST server.', 0, 'network');
  }

  let body: unknown = null;
  const text = await response.text();
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
  }

  if (!response.ok) {
    const details = (body ?? {}) as { error?: string; message?: string };
    throw new ApiError(details.message ?? `Request failed (${response.status}).`, response.status, details.error ?? 'error');
  }
  return body as T;
}

export const api = {
  getConfig: () => request<NestConfig>('/api/config'),
  saveConfig: (config: NestConfig) =>
    request<NestConfig>('/api/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    }),
};
