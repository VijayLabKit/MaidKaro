import { ApiBooking, ApiServiceCategory, ApiWorkerPublic, ApiReview, ApiAddress } from "./api";
import { Booking, BookingStatus, ServiceCategory, WorkerSummary, Review, Address } from "./types";
import { getIconKeyForSlug } from "./icon-map";

export function toServiceCategory(c: ApiServiceCategory): ServiceCategory {
  return {
    id: c.id,
    name: c.name,
    slug: c.slug,
    description: c.description,
    iconKey: getIconKeyForSlug(c.slug),
    baseHourlyRate: c.base_hourly_rate,
  };
}

/** categorySlugs/hourlyRate come from the worker's cheapest listed skill
 * when no specific category is being viewed, since a worker can offer more
 * than one service at different rates. */
export function toWorkerSummary(w: ApiWorkerPublic): WorkerSummary {
  const cheapest = w.skills.reduce<ApiWorkerPublic["skills"][number] | null>((min, s) => {
    if (!min || s.hourly_rate < min.hourly_rate) return s;
    return min;
  }, null);
  return {
    id: w.id,
    fullName: w.full_name,
    photoUrl: w.photo_url || undefined,
    bio: w.bio || undefined,
    languages: w.languages,
    yearsExperience: w.years_experience,
    ratingAvg: w.rating_avg,
    ratingCount: w.rating_count,
    isAvailableNow: w.is_available_now,
    categorySlugs: w.skills.map((s) => s.category_slug),
    hourlyRate: cheapest?.hourly_rate ?? 0,
    city: w.city || "Siliguri",
  };
}

/** Rate to show for a worker on a specific category's page/booking flow. */
export function hourlyRateForCategory(w: ApiWorkerPublic, categorySlug?: string): number {
  if (categorySlug) {
    const match = w.skills.find((s) => s.category_slug === categorySlug);
    if (match) return match.hourly_rate;
  }
  return w.skills[0]?.hourly_rate ?? 0;
}

export function toReview(r: ApiReview): Review {
  return {
    id: r.id,
    rating: r.rating,
    comment: r.comment || undefined,
    customerName: r.customer_name || "MaidKaro Customer",
    createdAt: r.created_at,
  };
}

export function toAddress(a: ApiAddress, cityName = "Siliguri", pincode = ""): Address {
  return {
    id: a.id,
    label: a.label,
    line1: a.line2 ? `${a.line1}, ${a.line2}` : a.line1,
    city: cityName,
    pincode,
    isDefault: a.is_default,
  };
}

export function toBooking(b: ApiBooking): Booking {
  return {
    id: b.id,
    status: b.status as BookingStatus,
    type: b.type,
    priceQuoted: b.price_quoted,
    durationHours: b.duration_hours,
    createdAt: b.created_at,
    scheduledFor: b.scheduled_for || undefined,
    categoryName: b.category_name || "Service",
    workerName: b.worker_name || undefined,
    workerPhotoUrl: b.worker_photo_url || undefined,
    address: b.address_text || "",
  };
}
