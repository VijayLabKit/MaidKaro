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

let isAdminRefreshing = false;
let adminRefreshPromise: Promise<string | null> | null = null;

async function tryRefreshAdminToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  const refreshToken = localStorage.getItem('maidkaro_admin_refresh_token');
  if (!refreshToken) return null;

  if (isAdminRefreshing && adminRefreshPromise) {
    return adminRefreshPromise;
  }

  isAdminRefreshing = true;
  adminRefreshPromise = (async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      if (!res.ok) {
        localStorage.removeItem('maidkaro_admin_access_token');
        localStorage.removeItem('maidkaro_admin_refresh_token');
        return null;
      }
      const data = await res.json();
      if (data.access_token) {
        localStorage.setItem('maidkaro_admin_access_token', data.access_token);
        if (data.refresh_token) {
          localStorage.setItem('maidkaro_admin_refresh_token', data.refresh_token);
        }
        return data.access_token as string;
      }
      return null;
    } catch {
      return null;
    } finally {
      isAdminRefreshing = false;
      adminRefreshPromise = null;
    }
  })();

  return adminRefreshPromise;
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getAccessToken();

  let res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (res.status === 401 && path !== '/auth/admin/login' && path !== '/auth/refresh') {
    const newToken = await tryRefreshAdminToken();
    if (newToken) {
      res = await fetch(`${API_BASE_URL}${path}`, {
        ...options,
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${newToken}`,
          ...options.headers,
        },
      });
    } else {
      localStorage.removeItem('maidkaro_admin_access_token');
      localStorage.removeItem('maidkaro_admin_refresh_token');
      localStorage.removeItem('maidkaro_admin_user');
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
  }

  const raw = await res.json().catch(() => ({}));

  if (!res.ok) {
    const detail = (raw as { detail?: unknown }).detail;
    let message = res.statusText || 'Something went wrong';
    if (typeof detail === 'string') {
      message = detail;
    } else if (Array.isArray(detail)) {
      message = detail
        .map((err) => {
          if (typeof err === 'string') return err;
          const msg = err.msg || err.message || '';
          const cleanMsg = msg.replace(/^Value error,\s*/i, '');
          const field = Array.isArray(err.loc) ? err.loc[err.loc.length - 1] : '';
          return field && field !== 'body' ? `${field}: ${cleanMsg}` : cleanMsg;
        })
        .filter(Boolean)
        .join('. ');
    }
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
