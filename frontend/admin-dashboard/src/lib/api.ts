/**
 * Client for the MaidKaro FastAPI backend.
 *
 * The FastAPI backend uses snake_case JSON everywhere (matching Python
 * convention) and returns raw response bodies with errors shaped as
 * {"detail": "..."}. This admin UI was originally built assuming a
 * Node-style {data, error:{code,message}} envelope with camelCase keys, so
 * this client transparently bridges the two: it camelCases every response
 * body on the way in, and snake_cases every request body on the way out,
 * so the rest of the app can keep using fullName/baseHourlyRate/etc.
 * without every page needing to know about the backend's casing.
 */
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000/api/v1';

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

function getAccessToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('maidkaro_admin_access_token');
}

// Enum-style status dictionaries (e.g. bookingsByStatus: {PENDING: 3, ...})
// use ALL_CAPS keys that are values, not field names — never transform those.
const ALL_CAPS_KEY = /^[A-Z][A-Z0-9_]*$/;

function toCamel(key: string): string {
  if (ALL_CAPS_KEY.test(key)) return key;
  return key.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
}

function toSnake(key: string): string {
  if (ALL_CAPS_KEY.test(key)) return key;
  return key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

function transformKeys(value: unknown, transform: (k: string) => string): unknown {
  if (Array.isArray(value)) return value.map((v) => transformKeys(v, transform));
  if (value !== null && typeof value === 'object' && !(value instanceof Date)) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [transform(k), transformKeys(v, transform)]),
    );
  }
  return value;
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getAccessToken();

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  const raw = await res.json().catch(() => ({}));

  if (!res.ok) {
    const detail = (raw as { detail?: unknown }).detail;
    const message = typeof detail === 'string' ? detail : res.statusText || 'Something went wrong';
    throw new ApiError(res.status, String(res.status), message);
  }

  return transformKeys(raw, toCamel) as T;
}

export const fetcher = <T>(url: string): Promise<T> => apiFetch<T>(url);

export const api = {
  get: <T>(path: string) => apiFetch<T>(path),
  post: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: 'POST', body: JSON.stringify(transformKeys(body ?? {}, toSnake)) }),
  patch: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: 'PATCH', body: JSON.stringify(transformKeys(body ?? {}, toSnake)) }),
  delete: <T>(path: string) => apiFetch<T>(path, { method: 'DELETE' }),
};
