/**
 * Worker Portal API client — deliberately separate from lib/api.ts's
 * customer token storage (different localStorage key) so a customer and a
 * worker session can never collide, and so a worker token is never usable
 * against customer-only endpoints or vice versa (also enforced server-side
 * by role checks on every endpoint).
 */
import { API_BASE_URL, ApiError } from "./api";

const WORKER_TOKEN_KEY = "maidkaro_worker_tokens";

export interface WorkerStoredTokens {
  accessToken: string;
  refreshToken: string;
  role: string;
  userId: string;
}

export function getWorkerTokens(): WorkerStoredTokens | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(WORKER_TOKEN_KEY);
    return raw ? (JSON.parse(raw) as WorkerStoredTokens) : null;
  } catch {
    return null;
  }
}

export function setWorkerTokens(tokens: WorkerStoredTokens) {
  window.localStorage.setItem(WORKER_TOKEN_KEY, JSON.stringify(tokens));
}

export function clearWorkerTokens() {
  window.localStorage.removeItem(WORKER_TOKEN_KEY);
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = await res.json();
      message = body.detail || message;
    } catch {
      // not JSON
    }
    throw new ApiError(res.status, typeof message === "string" ? message : JSON.stringify(message));
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

async function workerFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  return handle<T>(res);
}

let isWorkerRefreshing = false;
let workerRefreshPromise: Promise<string | null> | null = null;

async function tryRefreshWorkerTokens(tokens: WorkerStoredTokens): Promise<string | null> {
  if (isWorkerRefreshing && workerRefreshPromise) {
    return workerRefreshPromise;
  }
  isWorkerRefreshing = true;
  workerRefreshPromise = (async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: tokens.refreshToken }),
      });
      if (!res.ok) {
        clearWorkerTokens();
        return null;
      }
      const data = await res.json();
      const updated: WorkerStoredTokens = {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        role: data.role || tokens.role,
        userId: data.user_id || tokens.userId,
      };
      setWorkerTokens(updated);
      return updated.accessToken;
    } catch {
      clearWorkerTokens();
      return null;
    } finally {
      isWorkerRefreshing = false;
      workerRefreshPromise = null;
    }
  })();
  return workerRefreshPromise;
}

async function workerFetchAuthed<T>(path: string, options: RequestInit = {}): Promise<T> {
  const tokens = getWorkerTokens();
  if (!tokens) throw new ApiError(401, "Not logged in");

  let res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tokens.accessToken}`,
      ...(options.headers || {}),
    },
  });

  if (res.status === 401 && tokens.refreshToken) {
    const newAccessToken = await tryRefreshWorkerTokens(tokens);
    if (newAccessToken) {
      res = await fetch(`${API_BASE_URL}${path}`, {
        ...options,
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${newAccessToken}`,
          ...(options.headers || {}),
        },
      });
    } else {
      clearWorkerTokens();
    }
  }

  return handle<T>(res);
}

// ── Types ──────────────────────────────────────────────────────────

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: string;
  role: string;
  user_id: string;
  is_new_user: boolean;
}

export interface WorkerProfileMe {
  id: string;
  full_name: string;
  photo_url: string | null;
  bio: string | null;
  city_id: string;
  verification_status: string;
  rating_avg: number;
  rating_count: number;
  is_available_now: boolean;
  years_experience: number;
  languages: string[];
  phone: string;
}

export interface WorkerDashboardOverview {
  full_name: string;
  verification_status: string;
  rating_avg: number;
  rating_count: number;
  completed_jobs: number;
  upcoming_bookings: number;
  cancelled_or_rejected: number;
  total_lifetime_earnings: number;
  pending_earnings: number;
  available_balance: number;
  paid_out_total: number;
}

export interface WorkerBookingListItem {
  id: string;
  status: string;
  category_name: string | null;
  customer_first_name: string | null;
  scheduled_for: string | null;
  duration_hours: number;
  price_quoted: number;
  service_address_text: string | null;
  created_at: string;
}

export interface WorkerCalendarDay {
  date: string;
  bookings: WorkerBookingListItem[];
}

export interface WorkerEarningsLedgerEntry {
  id: string;
  booking_id: string;
  gross_amount: number;
  commission_amount: number;
  net_amount: number;
  is_paid_out: boolean;
  payout_id: string | null;
  created_at: string;
}

export interface WorkerEarningsSummary {
  gross_lifetime: number;
  commission_lifetime: number;
  net_lifetime: number;
  pending_payout: number;
  paid_out: number;
  entries: WorkerEarningsLedgerEntry[];
}

export interface WorkerPayout {
  id: string;
  amount: number;
  status: "REQUESTED" | "PROCESSING" | "PROCESSED" | "FAILED";
  requested_at: string;
  processed_at: string | null;
  razorpay_payout_id: string | null;
}

export interface WorkerKycDocument {
  id: string;
  type: string;
  status: string;
  file_url: string;
  reject_reason: string | null;
}

export interface WorkerKycProfile {
  guardian_name: string | null;
  date_of_birth: string | null;
  gender: string | null;
  address_line: string | null;
  kyc_city: string | null;
  kyc_state: string | null;
  kyc_pincode: string | null;
  qualification: string | null;
  previous_experience: string | null;
  verification_status: string;
  verification_note: string | null;
  kyc_submitted_at: string | null;
  documents: WorkerKycDocument[];
}

export interface ApiCity {
  id: string;
  name: string;
  state: string;
}

// ── Auth ──────────────────────────────────────────────────────────────

export const registerWorker = (payload: {
  full_name: string; email: string; phone: string; password: string; confirm_password: string;
  city_id: string; years_experience: number; languages: string[];
}) => workerFetch<TokenPair>("/auth/register/worker", { method: "POST", body: JSON.stringify(payload) });

export const loginWorker = (email: string, password: string) =>
  workerFetch<TokenPair>("/auth/login", { method: "POST", body: JSON.stringify({ email, password, role: "WORKER" }) });

export const forgotPasswordWorker = (email: string) =>
  workerFetch<{ message: string; dev_reset_token: string | null }>("/auth/forgot-password", {
    method: "POST", body: JSON.stringify({ email }),
  });

export const resetPasswordWorker = (token: string, new_password: string, confirm_password: string) =>
  workerFetch<{ message: string }>("/auth/reset-password", {
    method: "POST", body: JSON.stringify({ token, new_password, confirm_password }),
  });

export const getCitiesPublic = () => workerFetch<ApiCity[]>("/catalog/cities");

// ── Worker: profile ───────────────────────────────────────────────────

export const getMyWorkerProfile = () => workerFetchAuthed<WorkerProfileMe>("/workers/me");

export const setAvailableNow = (isAvailable: boolean) =>
  workerFetchAuthed<{ is_available_now: boolean }>("/workers/me/availability-now", { method: "POST", body: JSON.stringify({ is_available_now: isAvailable }) });

// ── Worker: dashboard, calendar, bookings ────────────────────────────

export const getWorkerDashboard = () => workerFetchAuthed<WorkerDashboardOverview>("/workers/me/dashboard");

export const getWorkerCalendar = (start: string, end: string) =>
  workerFetchAuthed<WorkerCalendarDay[]>(`/workers/me/calendar?start=${start}&end=${end}`);

export interface ApiBookingFlat {
  id: string;
  status: string;
  type: string;
  category_id: string;
  category_name: string | null;
  worker_id: string | null;
  worker_name: string | null;
  worker_photo_url: string | null;
  customer_first_name: string | null;
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

export const listWorkerBookings = (status?: string) =>
  workerFetchAuthed<ApiBookingFlat[]>(`/bookings${status ? `?status=${status}` : ""}`);

export const getWorkerBooking = (id: string) => workerFetchAuthed<ApiBookingFlat>(`/bookings/${id}`);

export const updateWorkerBookingStatus = (id: string, action: "ACCEPT" | "REJECT" | "START" | "COMPLETE" | "CANCEL", reason?: string) =>
  workerFetchAuthed<ApiBookingFlat>(`/bookings/${id}/status`, { method: "POST", body: JSON.stringify({ action, reason }) });

// ── Worker: earnings & payouts ───────────────────────────────────────

export const getWorkerEarnings = () => workerFetchAuthed<WorkerEarningsSummary>("/workers/me/earnings");

export const listWorkerPayouts = () => workerFetchAuthed<WorkerPayout[]>("/workers/me/payouts");

export const requestWorkerPayout = (note?: string) =>
  workerFetchAuthed<WorkerPayout>("/workers/me/payouts/request", { method: "POST", body: JSON.stringify({ note }) });

// ── Worker: KYC / verification ───────────────────────────────────────

export const getWorkerKycProfile = () => workerFetchAuthed<WorkerKycProfile>("/workers/me/kyc-profile");

export const updateWorkerKycProfile = (payload: {
  guardian_name?: string; date_of_birth?: string; gender?: string;
  address_line: string; kyc_city: string; kyc_state: string; kyc_pincode: string;
  qualification?: string; previous_experience?: string;
}) => workerFetchAuthed<WorkerKycProfile>("/workers/me/kyc-profile", { method: "PUT", body: JSON.stringify(payload) });

export const uploadFile = async (file: File): Promise<{ file_url: string }> => {
  const tokens = getWorkerTokens();
  if (!tokens) throw new ApiError(401, "Not logged in");
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_BASE_URL}/uploads`, {
    method: "POST",
    headers: { Authorization: `Bearer ${tokens.accessToken}` },
    body: formData,
  });
  return handle(res);
};

export const uploadWorkerKycDocument = (type: string, file_url: string) =>
  workerFetchAuthed<WorkerKycDocument>("/workers/me/kyc-documents", { method: "POST", body: JSON.stringify({ type, file_url }) });

export const submitWorkerKycForReview = () =>
  workerFetchAuthed<WorkerKycProfile>("/workers/me/kyc-profile/submit", { method: "POST" });

// ── Worker: complaints/disputes on their own bookings ────────────────

export interface WorkerComplaint {
  id: string;
  booking_id: string;
  type: "COMPLAINT" | "DISPUTE";
  status: "OPEN" | "IN_REVIEW" | "AWAITING_INFO" | "RESOLVED" | "CLOSED" | "DISMISSED";
  description: string;
  resolution_note: string | null;
  refund_issued: number | null;
  created_at: string;
  resolved_at: string | null;
}

export interface WorkerComplaintDetail extends WorkerComplaint {
  messages: Array<{
    id: string;
    sender_user_id: string;
    sender_role: "CUSTOMER" | "WORKER" | "STAFF";
    body: string;
    created_at: string;
  }>;
}

export const raiseWorkerComplaint = (payload: { booking_id: string; type: "COMPLAINT" | "DISPUTE"; description: string }) =>
  workerFetchAuthed<WorkerComplaint>("/safety/complaints", { method: "POST", body: JSON.stringify(payload) });

export const listWorkerComplaints = () =>
  workerFetchAuthed<WorkerComplaint[]>("/safety/complaints/me");

export const getWorkerComplaintDetail = (id: string) =>
  workerFetchAuthed<WorkerComplaintDetail>(`/safety/complaints/${id}`);

export const addWorkerComplaintMessage = (id: string, body: string) =>
  workerFetchAuthed<any>(`/safety/complaints/${id}/messages`, { method: "POST", body: JSON.stringify({ body }) });

// ── Worker: notifications ────────────────────────────────────────────

export interface WorkerNotification {
  id: string;
  title: string;
  body: string;
  channel: string;
  data?: Record<string, any> | null;
  read_at: string | null;
  created_at: string;
}

export interface WorkerNotificationList {
  items: WorkerNotification[];
  total: number;
  unread_count: number;
}

export const listWorkerNotifications = (page = 1, size = 20) =>
  workerFetchAuthed<WorkerNotificationList>(`/notifications?page=${page}&size=${size}`);

export const getWorkerUnreadNotificationCount = () =>
  workerFetchAuthed<{ unread_count: number }>("/notifications/unread-count");

export const markWorkerNotificationRead = (id: string) =>
  workerFetchAuthed<WorkerNotification>(`/notifications/${id}/read`, { method: "POST" });

export const markAllWorkerNotificationsRead = () =>
  workerFetchAuthed<{ unread_count: number }>("/notifications/read-all", { method: "POST" });

export { ApiError };
