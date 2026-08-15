import { Address, Booking, Review, ServiceCategory, WorkerSummary } from "./types";

export const CATEGORIES: ServiceCategory[] = [
  {
    id: "cat-1",
    name: "Home Cleaning",
    slug: "home-cleaning",
    description: "Sweeping, mopping, dusting and kitchen/bathroom deep clean.",
    iconKey: "sparkles",
    baseHourlyRate: 180,
  },
  {
    id: "cat-2",
    name: "Cooking",
    slug: "cooking",
    description: "Daily meals, tiffin prep and full-course cooking help.",
    iconKey: "cooking-pot",
    baseHourlyRate: 220,
  },
  {
    id: "cat-3",
    name: "Baby Care",
    slug: "baby-care",
    description: "Trained nannies for infants and toddlers, day or night.",
    iconKey: "baby",
    baseHourlyRate: 250,
  },
  {
    id: "cat-4",
    name: "Elderly Care",
    slug: "elderly-care",
    description: "Companionship, mobility support and medication reminders.",
    iconKey: "heart-handshake",
    baseHourlyRate: 260,
  },
  {
    id: "cat-5",
    name: "Laundry & Ironing",
    slug: "laundry-ironing",
    description: "Washing, drying, folding and ironing done at your home.",
    iconKey: "shirt",
    baseHourlyRate: 150,
  },
  {
    id: "cat-6",
    name: "Deep Cleaning",
    slug: "deep-cleaning",
    description: "Move-in/move-out or seasonal deep clean of the full house.",
    iconKey: "spray-can",
    baseHourlyRate: 300,
  },
];

export const WORKERS: WorkerSummary[] = [
  {
    id: "w-1",
    fullName: "Rekha Devi",
    photoUrl: "https://i.pravatar.cc/200?img=47",
    bio: "8 years experience in home cleaning and kitchen upkeep across Siliguri households.",
    languages: ["Hindi", "Bengali"],
    yearsExperience: 8,
    ratingAvg: 4.8,
    ratingCount: 132,
    isAvailableNow: true,
    categorySlugs: ["home-cleaning", "deep-cleaning"],
    hourlyRate: 190,
    city: "Siliguri",
  },
  {
    id: "w-2",
    fullName: "Sunita Rai",
    photoUrl: "https://i.pravatar.cc/200?img=32",
    bio: "Specialist in North Indian and Bengali home-style cooking for families.",
    languages: ["Hindi", "Nepali"],
    yearsExperience: 5,
    ratingAvg: 4.6,
    ratingCount: 84,
    isAvailableNow: true,
    categorySlugs: ["cooking"],
    hourlyRate: 230,
    city: "Siliguri",
  },
  {
    id: "w-3",
    fullName: "Meena Kumari",
    photoUrl: "https://i.pravatar.cc/200?img=45",
    bio: "Certified infant care attendant, gentle and patient with newborns.",
    languages: ["Hindi", "Bengali", "English"],
    yearsExperience: 6,
    ratingAvg: 4.9,
    ratingCount: 61,
    isAvailableNow: false,
    categorySlugs: ["baby-care"],
    hourlyRate: 260,
    city: "Siliguri",
  },
  {
    id: "w-4",
    fullName: "Kamla Tamang",
    photoUrl: "https://i.pravatar.cc/200?img=44",
    bio: "Compassionate elder companion with basic first-aid training.",
    languages: ["Nepali", "Hindi"],
    yearsExperience: 10,
    ratingAvg: 4.7,
    ratingCount: 47,
    isAvailableNow: true,
    categorySlugs: ["elderly-care"],
    hourlyRate: 270,
    city: "Siliguri",
  },
  {
    id: "w-5",
    fullName: "Anita Oraon",
    photoUrl: "https://i.pravatar.cc/200?img=48",
    bio: "Fast, thorough, and detail-oriented — regulars love her ironing finish.",
    languages: ["Hindi", "Bengali"],
    yearsExperience: 4,
    ratingAvg: 4.5,
    ratingCount: 39,
    isAvailableNow: true,
    categorySlugs: ["laundry-ironing"],
    hourlyRate: 150,
    city: "Siliguri",
  },
  {
    id: "w-6",
    fullName: "Puja Chettri",
    photoUrl: "https://i.pravatar.cc/200?img=49",
    bio: "Full-home deep clean specialist — bathrooms, kitchens, and everything between.",
    languages: ["Hindi", "Nepali", "Bengali"],
    yearsExperience: 7,
    ratingAvg: 4.9,
    ratingCount: 98,
    isAvailableNow: false,
    categorySlugs: ["deep-cleaning", "home-cleaning"],
    hourlyRate: 310,
    city: "Siliguri",
  },
];

export const REVIEWS: Record<string, Review[]> = {
  "w-1": [
    { id: "r1", rating: 5, comment: "Extremely thorough and always on time.", customerName: "Ananya S.", createdAt: "2026-07-02" },
    { id: "r2", rating: 5, comment: "Best cleaning help we've had in years.", customerName: "Rohit K.", createdAt: "2026-06-18" },
    { id: "r3", rating: 4, comment: "Great work, occasionally runs a bit late.", customerName: "Priya M.", createdAt: "2026-05-30" },
  ],
  "w-2": [
    { id: "r4", rating: 5, comment: "Her dal makhani is unbelievable.", customerName: "Vikram T.", createdAt: "2026-07-10" },
    { id: "r5", rating: 4, comment: "Reliable and hygienic, my kids love her food.", customerName: "Neha D.", createdAt: "2026-06-01" },
  ],
};

export const ADDRESSES: Address[] = [
  { id: "addr-1", label: "Home", line1: "204, Sevoke Road, Near City Mall", city: "Siliguri", pincode: "734001", isDefault: true },
  { id: "addr-2", label: "Office", line1: "3rd Floor, Bhanu Sarani", city: "Siliguri", pincode: "734005" },
];

export const BOOKINGS: Booking[] = [
  {
    id: "bk-1001",
    status: "CONFIRMED",
    type: "One-time",
    priceQuoted: 570,
    durationHours: 3,
    createdAt: "2026-08-09T10:15:00Z",
    scheduledFor: "2026-08-14T09:00:00Z",
    categoryName: "Home Cleaning",
    workerName: "Rekha Devi",
    workerPhotoUrl: "https://i.pravatar.cc/200?img=47",
    address: "204, Sevoke Road, Near City Mall, Siliguri 734001",
  },
  {
    id: "bk-1000",
    status: "COMPLETED",
    type: "Recurring",
    priceQuoted: 690,
    durationHours: 3,
    createdAt: "2026-08-01T06:40:00Z",
    scheduledFor: "2026-08-05T08:00:00Z",
    categoryName: "Cooking",
    workerName: "Sunita Rai",
    workerPhotoUrl: "https://i.pravatar.cc/200?img=32",
    address: "204, Sevoke Road, Near City Mall, Siliguri 734001",
  },
  {
    id: "bk-0998",
    status: "CANCELLED",
    type: "One-time",
    priceQuoted: 300,
    durationHours: 2,
    createdAt: "2026-07-20T12:00:00Z",
    scheduledFor: "2026-07-22T14:00:00Z",
    categoryName: "Laundry & Ironing",
    workerName: "Anita Oraon",
    workerPhotoUrl: "https://i.pravatar.cc/200?img=48",
    address: "3rd Floor, Bhanu Sarani, Siliguri 734005",
  },
];

export function getWorkersForCategory(slug: string): WorkerSummary[] {
  return WORKERS.filter((w) => w.categorySlugs.includes(slug));
}

export function getCategoryBySlug(slug: string): ServiceCategory | undefined {
  return CATEGORIES.find((c) => c.slug === slug);
}

export function getWorkerById(id: string): WorkerSummary | undefined {
  return WORKERS.find((w) => w.id === id);
}
