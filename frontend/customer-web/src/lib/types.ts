export interface ServiceCategory {
  id: string;
  name: string;
  slug: string;
  description: string;
  iconKey: string;
  baseHourlyRate: number;
}

export interface WorkerSummary {
  id: string;
  fullName: string;
  photoUrl?: string;
  bio?: string;
  languages: string[];
  yearsExperience: number;
  ratingAvg: number;
  ratingCount: number;
  isAvailableNow: boolean;
  categorySlugs: string[];
  hourlyRate: number;
  city: string;
}

export interface Review {
  id: string;
  rating: number;
  comment?: string;
  customerName: string;
  createdAt: string;
}

export type BookingStatus =
  | "PENDING"
  | "CONFIRMED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED"
  | "REJECTED"
  | "EXPIRED";

export interface Booking {
  id: string;
  status: BookingStatus;
  type: string;
  priceQuoted: number;
  durationHours: number;
  createdAt: string;
  scheduledFor?: string;
  categoryName: string;
  workerName?: string;
  workerPhotoUrl?: string;
  address: string;
}

export interface Address {
  id: string;
  label: string;
  line1: string;
  city: string;
  pincode: string;
  isDefault?: boolean;
}

export interface AppUser {
  id: string;
  fullName: string;
  phone: string;
  email?: string;
}
