from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field


class DashboardStatsOut(BaseModel):
    total_customers: int
    total_workers: int
    workers_pending_verification: int
    total_bookings: int
    bookings_today: int
    active_bookings: int
    gross_revenue: float
    open_complaints: int
    open_safety_incidents: int


class WorkerVerificationActionIn(BaseModel):
    action: str = Field(..., pattern="^(APPROVE|REJECT|REQUEST_RESUBMISSION)$")
    note: Optional[str] = None


class AdminWorkerOut(BaseModel):
    id: str
    full_name: str
    phone: str
    verification_status: str
    city_id: str
    rating_avg: float
    created_at: datetime

    class Config:
        from_attributes = True


class AdminComplaintActionIn(BaseModel):
    status: str = Field(..., pattern="^(IN_REVIEW|RESOLVED|DISMISSED)$")
    resolution_note: Optional[str] = None
    refund_amount: Optional[float] = None


class CreateCategoryIn(BaseModel):
    name: str
    slug: str
    description: str
    base_hourly_rate: float
    commission_pct: float = 15.0
    icon_url: Optional[str] = None


class CreateCityIn(BaseModel):
    name: str
    state: str


# ── Admin console additions (paginated lists, joined/nested views for the
# admin dashboard's data tables) ────────────────────────────────────────

class PageMeta(BaseModel):
    items: List[dict]
    total: int


class AdminCustomerOut(BaseModel):
    id: str
    full_name: str
    email: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class AdminCustomerListOut(BaseModel):
    items: List[AdminCustomerOut]
    total: int


class _NamedRef(BaseModel):
    name: str


class _CustomerRef(BaseModel):
    full_name: str


class AdminBookingOut(BaseModel):
    id: str
    status: str
    type: str
    price_quoted: float
    duration_hours: float
    created_at: datetime
    scheduled_for: Optional[datetime] = None
    category: _NamedRef
    customer: _CustomerRef
    worker: Optional[_CustomerRef] = None

    class Config:
        from_attributes = True


class AdminBookingListOut(BaseModel):
    items: List[AdminBookingOut]
    total: int


class AnalyticsOverviewOut(BaseModel):
    total_customers: int
    total_workers: int
    pending_workers: int
    bookings_by_status: dict
    gross_revenue: float


class AdminSkillRef(BaseModel):
    category: _NamedRef


class AdminWorkerListItemOut(BaseModel):
    id: str
    full_name: str
    photo_url: Optional[str] = None
    city: _NamedRef
    verification_status: str
    years_experience: int
    languages: List[str] = []
    skills: List[AdminSkillRef] = []
    created_at: datetime


class AdminKycDocumentOut(BaseModel):
    id: str
    type: str
    status: str
    view_url: str
    reject_reason: Optional[str] = None


class AdminWorkerDetailOut(AdminWorkerListItemOut):
    documents: List[AdminKycDocumentOut] = []
    verification_note: Optional[str] = None


class WorkerReviewActionIn(BaseModel):
    action: str = Field(..., pattern="^(APPROVE|REJECT|REQUEST_RESUBMISSION)$")
    note: Optional[str] = None


class ComplaintResolveIn(BaseModel):
    status: str = Field(..., pattern="^(IN_REVIEW|RESOLVED|DISMISSED)$")
    resolution_note: Optional[str] = None
    refund_amount: Optional[float] = None


class AdminComplaintBookingRef(BaseModel):
    id: str
    price_quoted: float
    category: _NamedRef
    customer: _CustomerRef
    worker: Optional[_CustomerRef] = None


class AdminComplaintOut(BaseModel):
    id: str
    raised_by: str
    description: str
    status: str
    resolution_note: Optional[str] = None
    refund_issued: Optional[float] = None
    created_at: datetime
    booking: AdminComplaintBookingRef


class UpdateCommissionIn(BaseModel):
    commission_pct: float = Field(..., ge=0, le=50)


class AdminCategoryOut(BaseModel):
    id: str
    name: str
    slug: str
    description: str
    base_hourly_rate: float
    commission_pct: float
    is_active: bool

    class Config:
        from_attributes = True


class StaffMemberOut(BaseModel):
    id: str
    user_id: str
    full_name: str
    email: str
    phone: str
    role: str
    is_active: bool
    created_at: datetime


class CreateStaffIn(BaseModel):
    full_name: str
    email: str
    phone: str
    password: str
    role: str = Field("ADMIN", pattern="^(ADMIN|SUPER_ADMIN)$")


class ToggleStaffStatusIn(BaseModel):
    is_active: bool


class AdminPayoutOut(BaseModel):
    id: str
    worker_id: str
    worker_name: str
    worker_phone: str
    amount: float
    status: str
    requested_at: datetime
    processed_at: Optional[datetime] = None
    razorpay_payout_id: Optional[str] = None


class AdminAuditLogOut(BaseModel):
    id: str
    actor_user_id: Optional[str] = None
    actor_name: str = "System"
    action: str
    entity_type: str
    entity_id: str
    metadata_json: Optional[dict] = None
    ip_address: Optional[str] = None
    created_at: datetime


class PlatformSettingsOut(BaseModel):
    default_commission_pct: float
    surge_multiplier: float
    otp_expiry_seconds: int
    sos_emergency_phone: str
    sms_provider: str
    environment: str


class UpdatePlatformSettingsIn(BaseModel):
    default_commission_pct: Optional[float] = Field(None, ge=0, le=50)
    surge_multiplier: Optional[float] = Field(None, ge=1.0, le=5.0)
    sos_emergency_phone: Optional[str] = None
