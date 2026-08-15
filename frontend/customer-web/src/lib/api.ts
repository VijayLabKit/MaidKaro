/**
 * Typed client for the MaidKaro FastAPI backend.
 *
 * Public/catalog endpoints (categories, cities, worker discovery, worker
 * profile, reviews) are called from server components with `fetch` and no
 * caching, so pages always render live backend data.
 *
 * Authenticated endpoints (OTP verify, my profile, addresses, bookings)
 * are called from client components using the JWT stored by AuthProvider
 * in localStorage.
 */

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api/v1";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = await res.json();
      message = body.detail || message;
    } catch {
      // response wasn't JSON — fall back to statusText
    }
    throw new ApiError(res.status, typeof message === "string" ? message : JSON.stringify(message));
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

/** Public fetch — no auth header, always fresh (no Next.js caching). */
export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  return handle<T>(res);
}

const TOKEN_KEY = "maidkaro_tokens";

export interface StoredTokens {
  accessToken: string;
  refreshToken: string;
  role: string;
  userId: string;
}

export function getStoredTokens(): StoredTokens | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(TOKEN_KEY);
    return raw ? (JSON.parse(raw) as StoredTokens) : null;
  } catch {
    return null;
  }
}

export function setStoredTokens(tokens: StoredTokens) {
  window.localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
}

export function clearStoredTokens() {
  window.localStorage.removeItem(TOKEN_KEY);
}

/** Authenticated fetch — attaches the Bearer token from localStorage. */
export async function apiFetchAuthed<T>(path: string, options: RequestInit = {}): Promise<T> {
  const tokens = getStoredTokens();
  if (!tokens) throw new ApiError(401, "Not logged in");
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tokens.accessToken}`,
      ...(options.headers || {}),
    },
  });
  if (res.status === 401) {
    clearStoredTokens();
  }
  return handle<T>(res);
}

// ── Types matching backend response shapes ──────────────────────────

export interface ApiServiceCategory {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon_url: string | null;
  base_hourly_rate: number;
  is_active: boolean;
}

export interface ApiCity {
  id: string;
  name: string;
  state: string;
}

export interface ApiWorkerSkill {
  category_id: string;
  category_slug: string;
  category_name: string;
  hourly_rate: number;
}

export interface ApiWorkerPublic {
  id: string;
  full_name: string;
  photo_url: string | null;
  bio: string | null;
  languages: string[];
  years_experience: number;
  verification_status: string;
  rating_avg: number;
  rating_count: number;
  is_available_now: boolean;
  city: string | null;
  skills: ApiWorkerSkill[];
}

export interface ApiReview {
  id: string;
  booking_id: string;
  worker_id: string;
  rating: number;
  comment: string | null;
  customer_name: string | null;
  created_at: string;
}

export interface ApiCustomerProfile {
  id: string;
  full_name: string;
  email: string | null;
  photo_url: string | null;
  phone: string;
}

export interface ApiAddress {
  id: string;
  label: string;
  line1: string;
  line2: string | null;
  latitude: number;
  longitude: number;
  is_default: boolean;
}

export interface ApiBooking {
  id: string;
  status: string;
  type: string;
  category_id: string;
  category_name: string | null;
  worker_id: string | null;
  worker_name: string | null;
  worker_photo_url: string | null;
  address_id: string;
  address_text: string | null;
  scheduled_for: string | null;
  duration_hours: number;
  price_quoted: number;
  created_at: string;
  confirmed_at: string | null;
  started_at: string | null;
  completed_at: string | null;
}

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: string;
  role: string;
  user_id: string;
  is_new_user: boolean;
}

// ── Public catalog ───────────────────────────────────────────────────

export const getCategories = (cityId?: string) =>
  apiFetch<ApiServiceCategory[]>(`/catalog/categories${cityId ? `?city_id=${cityId}` : ""}`);

export const getCities = () => apiFetch<ApiCity[]>("/catalog/cities");

export const getWorkers = (params: { categoryId?: string; cityId?: string; availableNow?: boolean } = {}) => {
  const qs = new URLSearchParams();
  if (params.categoryId) qs.set("category_id", params.categoryId);
  if (params.cityId) qs.set("city_id", params.cityId);
  if (params.availableNow) qs.set("available_now", "true");
  const query = qs.toString();
  return apiFetch<ApiWorkerPublic[]>(`/workers${query ? `?${query}` : ""}`);
};

export const getWorker = (id: string) => apiFetch<ApiWorkerPublic>(`/workers/${id}`);

export const getWorkerReviews = (workerId: string) => apiFetch<ApiReview[]>(`/reviews/worker/${workerId}`);

// ── Auth ──────────────────────────────────────────────────────────────

export const requestOtp = (phone: string, purpose: "LOGIN" | "SIGNUP" = "LOGIN") =>
  apiFetch<{ message: string; expires_in_seconds: number; dev_otp: string | null }>("/auth/otp/request", {
    method: "POST",
    body: JSON.stringify({ phone, purpose }),
  });

export const verifyOtp = (phone: string, code: string, fullName?: string) =>
  apiFetch<TokenPair>("/auth/otp/verify", {
    method: "POST",
    body: JSON.stringify({ phone, code, role: "CUSTOMER", full_name: fullName || undefined }),
  });

// ── Authenticated: profile & addresses ──────────────────────────────

export const getMyProfile = () => apiFetchAuthed<ApiCustomerProfile>("/users/me");

export const updateMyProfile = (payload: { full_name?: string; email?: string }) =>
  apiFetchAuthed<ApiCustomerProfile>("/users/me", { method: "PATCH", body: JSON.stringify(payload) });

export const getMyAddresses = () => apiFetchAuthed<ApiAddress[]>("/users/me/addresses");

export const addAddress = (payload: {
  label: string;
  line1: string;
  line2?: string;
  pincode_code: string;
  latitude: number;
  longitude: number;
  is_default?: boolean;
}) => apiFetchAuthed<ApiAddress>("/users/me/addresses", { method: "POST", body: JSON.stringify(payload) });

export const deleteAddress = (id: string) =>
  apiFetchAuthed<void>(`/users/me/addresses/${id}`, { method: "DELETE" });

// ── Authenticated: bookings ──────────────────────────────────────────

export const createBooking = (payload: {
  category_id: string;
  address_id: string;
  type: "INSTANT" | "SCHEDULED";
  scheduled_for?: string;
  duration_hours: number;
  notes?: string;
  preferred_worker_id?: string;
}) => apiFetchAuthed<ApiBooking>("/bookings", { method: "POST", body: JSON.stringify(payload) });

export const listBookings = (status?: string) =>
  apiFetchAuthed<ApiBooking[]>(`/bookings${status ? `?status=${status}` : ""}`);

export const getBooking = (id: string) => apiFetchAuthed<ApiBooking>(`/bookings/${id}`);

export const updateBookingStatus = (id: string, action: "CANCEL", reason?: string) =>
  apiFetchAuthed<ApiBooking>(`/bookings/${id}/status`, {
    method: "POST",
    body: JSON.stringify({ action, reason }),
  });

export const createReview = (payload: { booking_id: string; rating: number; comment?: string }) =>
  apiFetchAuthed<ApiReview>("/reviews", { method: "POST", body: JSON.stringify(payload) });
