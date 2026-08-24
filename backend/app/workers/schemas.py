from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field


class WorkerProfileOut(BaseModel):
    id: str
    full_name: str
    photo_url: Optional[str] = None
    bio: Optional[str] = None
    city_id: str
    languages: List[str] = []
    years_experience: int
    verification_status: str
    rating_avg: float
    rating_count: int
    is_available_now: bool
    phone: str

    class Config:
        from_attributes = True


class UpdateWorkerProfileIn(BaseModel):
    full_name: Optional[str] = None
    bio: Optional[str] = None
    photo_url: Optional[str] = None
    languages: Optional[List[str]] = None
    years_experience: Optional[int] = None


class SetAvailabilityNowIn(BaseModel):
    is_available_now: bool


class SkillIn(BaseModel):
    category_id: str
    hourly_rate: Optional[float] = None


class SkillOut(SkillIn):
    id: str

    class Config:
        from_attributes = True


class WorkerSkillPublicOut(BaseModel):
    """A category a worker offers, with its slug/name/rate — needed by the
    customer app to show what a worker does and filter/link by category."""
    category_id: str
    category_slug: str
    category_name: str
    hourly_rate: float

    class Config:
        from_attributes = True


class AvailabilitySlotIn(BaseModel):
    day: str = Field(..., pattern="^(MON|TUE|WED|THU|FRI|SAT|SUN)$")
    start_time: str = Field(..., pattern="^([01]\\d|2[0-3]):[0-5]\\d$")
    end_time: str = Field(..., pattern="^([01]\\d|2[0-3]):[0-5]\\d$")


class AvailabilitySlotOut(AvailabilitySlotIn):
    id: str

    class Config:
        from_attributes = True


class KycUploadIn(BaseModel):
    type: str = Field(..., pattern="^(GOVERNMENT_ID|ADDRESS_PROOF|PROFILE_PHOTO|POLICE_VERIFICATION|OTHER)$")
    file_url: str


class KycDocumentOut(BaseModel):
    id: str
    type: str
    status: str
    reject_reason: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class LiveLocationIn(BaseModel):
    lat: float
    lng: float


class WorkerPublicOut(BaseModel):
    """What a customer is allowed to see about a worker — no phone number,
    no address; trust signals only."""
    id: str
    full_name: str
    photo_url: Optional[str] = None
    bio: Optional[str] = None
    languages: List[str] = []
    years_experience: int
    verification_status: str
    rating_avg: float
    rating_count: int
    is_available_now: bool
    city: Optional[str] = None
    skills: List[WorkerSkillPublicOut] = []

    class Config:
        from_attributes = True


# ── KYC: personal + professional information ─────────────────────────

class WorkerKycProfileIn(BaseModel):
    guardian_name: Optional[str] = None
    date_of_birth: Optional[str] = Field(None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    gender: Optional[str] = Field(None, pattern="^(Female|Male|Other)$")
    address_line: str = Field(..., min_length=5, max_length=300)
    kyc_city: str = Field(..., min_length=2, max_length=100)
    kyc_state: str = Field(..., min_length=2, max_length=100)
    kyc_pincode: str = Field(..., pattern=r"^\d{6}$")
    qualification: Optional[str] = Field(None, max_length=150)
    previous_experience: Optional[str] = Field(None, max_length=2000)


class WorkerKycProfileOut(BaseModel):
    guardian_name: Optional[str] = None
    date_of_birth: Optional[str] = None
    gender: Optional[str] = None
    address_line: Optional[str] = None
    kyc_city: Optional[str] = None
    kyc_state: Optional[str] = None
    kyc_pincode: Optional[str] = None
    qualification: Optional[str] = None
    previous_experience: Optional[str] = None
    verification_status: str
    verification_note: Optional[str] = None
    kyc_submitted_at: Optional[datetime] = None
    documents: List[KycDocumentOut] = []

    class Config:
        from_attributes = True


# ── Worker dashboard: overview, earnings, calendar, payouts ─────────

class WorkerDashboardOverviewOut(BaseModel):
    full_name: str
    verification_status: str
    rating_avg: float
    rating_count: int
    completed_jobs: int
    upcoming_bookings: int
    cancelled_or_rejected: int
    total_lifetime_earnings: float
    pending_earnings: float          # earned, not yet paid out
    available_balance: float          # alias of pending_earnings — what can be requested as a payout right now
    paid_out_total: float


class WorkerBookingListItemOut(BaseModel):
    id: str
    status: str
    category_name: Optional[str] = None
    customer_first_name: Optional[str] = None
    scheduled_for: Optional[datetime] = None
    duration_hours: float
    price_quoted: float
    service_address_text: Optional[str] = None
    created_at: datetime


class WorkerCalendarDayOut(BaseModel):
    date: str  # "YYYY-MM-DD"
    bookings: List[WorkerBookingListItemOut]


class WorkerEarningsLedgerEntryOut(BaseModel):
    id: str
    booking_id: str
    gross_amount: float
    commission_amount: float
    net_amount: float
    is_paid_out: bool
    payout_id: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class WorkerEarningsSummaryOut(BaseModel):
    gross_lifetime: float
    commission_lifetime: float
    net_lifetime: float
    pending_payout: float
    paid_out: float
    entries: List[WorkerEarningsLedgerEntryOut]


class WorkerPayoutRequestOut(BaseModel):
    id: str
    amount: float
    status: str
    requested_at: datetime
    processed_at: Optional[datetime] = None
    razorpay_payout_id: Optional[str] = None

    class Config:
        from_attributes = True


class RequestPayoutIn(BaseModel):
    note: Optional[str] = Field(None, max_length=300)
