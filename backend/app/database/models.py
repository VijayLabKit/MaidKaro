"""
SQLAlchemy models — the Python/FastAPI equivalent of the original
Prisma schema (backend/prisma/schema.prisma), extended with the
women-first trust & safety layer (chat, SOS, emergency contacts,
call masking) requested for this redesign.

Kept in one module deliberately: the domain graph is deeply
cross-referential (User -> CustomerProfile/WorkerProfile -> Booking
-> Payment/Review/Chat ...) and SQLAlchemy relationship() strings
resolve far more reliably from a single mapped registry than split
across 12 modules with circular imports. Each domain package
(app/users, app/bookings, ...) imports the slice it needs from here.
"""
import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean, Column, DateTime, Enum, Float, ForeignKey, Integer,
    JSON, Numeric, String, Text, UniqueConstraint, Index,
)
from sqlalchemy.orm import relationship

from app.database.session import Base


def gen_uuid() -> str:
    return str(uuid.uuid4())


# ─────────────────────────────────────────────────────────────────
# ENUMS
# ─────────────────────────────────────────────────────────────────

class Role(str, enum.Enum):
    CUSTOMER = "CUSTOMER"
    WORKER = "WORKER"
    ADMIN = "ADMIN"
    SUPER_ADMIN = "SUPER_ADMIN"


class VerificationStatus(str, enum.Enum):
    NOT_SUBMITTED = "NOT_SUBMITTED"
    PENDING_REVIEW = "PENDING_REVIEW"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    NEEDS_RESUBMISSION = "NEEDS_RESUBMISSION"


class DocumentType(str, enum.Enum):
    GOVERNMENT_ID = "GOVERNMENT_ID"
    ADDRESS_PROOF = "ADDRESS_PROOF"
    PROFILE_PHOTO = "PROFILE_PHOTO"
    POLICE_VERIFICATION = "POLICE_VERIFICATION"
    OTHER = "OTHER"


class BookingType(str, enum.Enum):
    INSTANT = "INSTANT"
    SCHEDULED = "SCHEDULED"


class BookingStatus(str, enum.Enum):
    PENDING = "PENDING"
    CONFIRMED = "CONFIRMED"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"
    REJECTED = "REJECTED"
    EXPIRED = "EXPIRED"


class PaymentStatus(str, enum.Enum):
    CREATED = "CREATED"
    AUTHORIZED = "AUTHORIZED"
    CAPTURED = "CAPTURED"
    FAILED = "FAILED"
    REFUNDED = "REFUNDED"
    PARTIALLY_REFUNDED = "PARTIALLY_REFUNDED"


class PayoutStatus(str, enum.Enum):
    REQUESTED = "REQUESTED"
    PROCESSING = "PROCESSING"
    PROCESSED = "PROCESSED"
    FAILED = "FAILED"


class ComplaintStatus(str, enum.Enum):
    OPEN = "OPEN"
    IN_REVIEW = "IN_REVIEW"
    RESOLVED = "RESOLVED"
    DISMISSED = "DISMISSED"


class ComplaintRaisedBy(str, enum.Enum):
    CUSTOMER = "CUSTOMER"
    WORKER = "WORKER"


class NotificationChannel(str, enum.Enum):
    PUSH = "PUSH"
    SMS = "SMS"
    IN_APP = "IN_APP"


class WeekDay(str, enum.Enum):
    MON = "MON"; TUE = "TUE"; WED = "WED"; THU = "THU"
    FRI = "FRI"; SAT = "SAT"; SUN = "SUN"


class ChatThreadType(str, enum.Enum):
    BOOKING = "BOOKING"       # customer <-> worker, scoped to one booking
    SUPPORT = "SUPPORT"       # customer/worker <-> support agent
    SAFETY = "SAFETY"         # SOS / safety escalation, always admin-routed


class ChatThreadStatus(str, enum.Enum):
    OPEN = "OPEN"
    ESCALATED = "ESCALATED"
    CLOSED = "CLOSED"


class SafetyIncidentStatus(str, enum.Enum):
    TRIGGERED = "TRIGGERED"
    ACKNOWLEDGED = "ACKNOWLEDGED"
    RESOLVED = "RESOLVED"
    FALSE_ALARM = "FALSE_ALARM"


# ─────────────────────────────────────────────────────────────────
# IDENTITY / AUTH
# ─────────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=gen_uuid)
    phone = Column(String, unique=True, nullable=False, index=True)  # E.164
    role = Column(Enum(Role), nullable=False, index=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    customer_profile = relationship("CustomerProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")
    worker_profile = relationship("WorkerProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")
    admin_profile = relationship("AdminProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")

    refresh_tokens = relationship("RefreshToken", back_populates="user", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")
    device_tokens = relationship("DeviceToken", back_populates="user", cascade="all, delete-orphan")
    emergency_contacts = relationship("EmergencyContact", back_populates="user", cascade="all, delete-orphan")


class OtpCode(Base):
    __tablename__ = "otp_codes"

    id = Column(String, primary_key=True, default=gen_uuid)
    user_phone = Column(String, index=True, nullable=False)
    code_hash = Column(String, nullable=False)
    purpose = Column(String, nullable=False)  # LOGIN | SIGNUP
    expires_at = Column(DateTime, nullable=False)
    consumed_at = Column(DateTime, nullable=True)
    attempts = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id = Column(String, primary_key=True, default=gen_uuid)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    token_hash = Column(String, unique=True, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    revoked_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="refresh_tokens")


# ─────────────────────────────────────────────────────────────────
# CUSTOMER
# ─────────────────────────────────────────────────────────────────

class CustomerProfile(Base):
    __tablename__ = "customer_profiles"

    id = Column(String, primary_key=True, default=gen_uuid)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    full_name = Column(String, nullable=False)
    email = Column(String, nullable=True)
    photo_url = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="customer_profile")
    addresses = relationship("CustomerAddress", back_populates="customer", cascade="all, delete-orphan")
    bookings = relationship("Booking", back_populates="customer")
    reviews = relationship("Review", back_populates="customer")
    favorites = relationship("FavoriteWorker", back_populates="customer", cascade="all, delete-orphan")


class CustomerAddress(Base):
    __tablename__ = "customer_addresses"

    id = Column(String, primary_key=True, default=gen_uuid)
    customer_id = Column(String, ForeignKey("customer_profiles.id", ondelete="CASCADE"), nullable=False)
    label = Column(String, nullable=False)  # "Home", "Office"
    line1 = Column(String, nullable=False)
    line2 = Column(String, nullable=True)
    pincode_id = Column(String, ForeignKey("pincodes.id"), index=True, nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    is_default = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    customer = relationship("CustomerProfile", back_populates="addresses")
    pincode = relationship("Pincode")
    bookings = relationship("Booking", back_populates="address")


class FavoriteWorker(Base):
    __tablename__ = "favorite_workers"
    __table_args__ = (UniqueConstraint("customer_id", "worker_id"),)

    id = Column(String, primary_key=True, default=gen_uuid)
    customer_id = Column(String, ForeignKey("customer_profiles.id", ondelete="CASCADE"), nullable=False)
    worker_id = Column(String, ForeignKey("worker_profiles.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    customer = relationship("CustomerProfile", back_populates="favorites")
    worker = relationship("WorkerProfile", back_populates="favorited_by")


# ─────────────────────────────────────────────────────────────────
# WORKER
# ─────────────────────────────────────────────────────────────────

class WorkerProfile(Base):
    __tablename__ = "worker_profiles"
    __table_args__ = (
        Index("ix_worker_city_status_available", "city_id", "verification_status", "is_available_now"),
    )

    id = Column(String, primary_key=True, default=gen_uuid)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    full_name = Column(String, nullable=False)
    photo_url = Column(String, nullable=True)
    bio = Column(Text, nullable=True)
    city_id = Column(String, ForeignKey("cities.id"), nullable=False)
    service_zone_id = Column(String, ForeignKey("service_zones.id"), nullable=True, index=True)
    languages = Column(JSON, default=list, nullable=False)  # ["Bengali","Hindi","English"]
    years_experience = Column(Integer, default=0, nullable=False)
    verification_status = Column(Enum(VerificationStatus), default=VerificationStatus.NOT_SUBMITTED, nullable=False)
    verification_note = Column(String, nullable=True)
    rating_avg = Column(Float, default=0.0, nullable=False)
    rating_count = Column(Integer, default=0, nullable=False)
    is_available_now = Column(Boolean, default=False, nullable=False)
    # Safety: live location, shared only while a booking is IN_PROGRESS
    last_lat = Column(Float, nullable=True)
    last_lng = Column(Float, nullable=True)
    last_location_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="worker_profile")
    city = relationship("City", back_populates="workers")
    service_zone = relationship("ServiceZone", back_populates="workers")
    skills = relationship("WorkerSkill", back_populates="worker", cascade="all, delete-orphan")
    documents = relationship("KycDocument", back_populates="worker", cascade="all, delete-orphan")
    availability = relationship("AvailabilitySlot", back_populates="worker", cascade="all, delete-orphan")
    bookings = relationship("Booking", back_populates="worker")
    reviews = relationship("Review", back_populates="worker")
    favorited_by = relationship("FavoriteWorker", back_populates="worker")
    payout_entries = relationship("PayoutLedgerEntry", back_populates="worker")
    payout_requests = relationship("Payout", back_populates="worker")


class WorkerSkill(Base):
    __tablename__ = "worker_skills"
    __table_args__ = (UniqueConstraint("worker_id", "category_id"),)

    id = Column(String, primary_key=True, default=gen_uuid)
    worker_id = Column(String, ForeignKey("worker_profiles.id", ondelete="CASCADE"), nullable=False)
    category_id = Column(String, ForeignKey("service_categories.id"), index=True, nullable=False)
    hourly_rate = Column(Numeric(10, 2), nullable=True)  # overrides category base rate if set

    worker = relationship("WorkerProfile", back_populates="skills")
    category = relationship("ServiceCategory", back_populates="worker_skills")


class KycDocument(Base):
    __tablename__ = "kyc_documents"

    id = Column(String, primary_key=True, default=gen_uuid)
    worker_id = Column(String, ForeignKey("worker_profiles.id", ondelete="CASCADE"), index=True, nullable=False)
    type = Column(Enum(DocumentType), nullable=False)
    file_url = Column(String, nullable=False)  # private object-storage key
    status = Column(Enum(VerificationStatus), default=VerificationStatus.PENDING_REVIEW, nullable=False)
    reviewed_by_id = Column(String, nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    reject_reason = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    worker = relationship("WorkerProfile", back_populates="documents")


class AvailabilitySlot(Base):
    __tablename__ = "availability_slots"

    id = Column(String, primary_key=True, default=gen_uuid)
    worker_id = Column(String, ForeignKey("worker_profiles.id", ondelete="CASCADE"), index=True, nullable=False)
    day = Column(Enum(WeekDay), nullable=False)
    start_time = Column(String, nullable=False)  # "09:00"
    end_time = Column(String, nullable=False)    # "18:00"

    worker = relationship("WorkerProfile", back_populates="availability")


# ─────────────────────────────────────────────────────────────────
# CATALOG (services, cities, zones)
# ─────────────────────────────────────────────────────────────────

class ServiceCategory(Base):
    __tablename__ = "service_categories"

    id = Column(String, primary_key=True, default=gen_uuid)
    name = Column(String, unique=True, nullable=False)
    slug = Column(String, unique=True, nullable=False)
    description = Column(Text, nullable=False)
    icon_url = Column(String, nullable=True)
    base_hourly_rate = Column(Numeric(10, 2), nullable=False)
    commission_pct = Column(Numeric(5, 2), default=15.00, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    sort_order = Column(Integer, default=0, nullable=False)

    worker_skills = relationship("WorkerSkill", back_populates="category")
    bookings = relationship("Booking", back_populates="category")
    city_availability = relationship("CityCategory", back_populates="category")


class City(Base):
    __tablename__ = "cities"

    id = Column(String, primary_key=True, default=gen_uuid)
    name = Column(String, unique=True, nullable=False)
    state = Column(String, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    launched_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    zones = relationship("ServiceZone", back_populates="city", cascade="all, delete-orphan")
    workers = relationship("WorkerProfile", back_populates="city")
    categories = relationship("CityCategory", back_populates="city", cascade="all, delete-orphan")


class CityCategory(Base):
    __tablename__ = "city_categories"
    __table_args__ = (UniqueConstraint("city_id", "category_id"),)

    id = Column(String, primary_key=True, default=gen_uuid)
    city_id = Column(String, ForeignKey("cities.id", ondelete="CASCADE"), nullable=False)
    category_id = Column(String, ForeignKey("service_categories.id", ondelete="CASCADE"), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    city = relationship("City", back_populates="categories")
    category = relationship("ServiceCategory", back_populates="city_availability")


class ServiceZone(Base):
    __tablename__ = "service_zones"

    id = Column(String, primary_key=True, default=gen_uuid)
    city_id = Column(String, ForeignKey("cities.id", ondelete="CASCADE"), index=True, nullable=False)
    name = Column(String, nullable=False)  # "Siliguri - Sevoke Road"
    is_active = Column(Boolean, default=True, nullable=False)

    city = relationship("City", back_populates="zones")
    pincodes = relationship("Pincode", back_populates="service_zone", cascade="all, delete-orphan")
    workers = relationship("WorkerProfile", back_populates="service_zone")


class Pincode(Base):
    __tablename__ = "pincodes"

    id = Column(String, primary_key=True, default=gen_uuid)
    code = Column(String, unique=True, nullable=False)  # "734001"
    service_zone_id = Column(String, ForeignKey("service_zones.id", ondelete="CASCADE"), index=True, nullable=False)

    service_zone = relationship("ServiceZone", back_populates="pincodes")


# ─────────────────────────────────────────────────────────────────
# BOOKINGS
# ─────────────────────────────────────────────────────────────────

class Booking(Base):
    __tablename__ = "bookings"
    __table_args__ = (
        Index("ix_booking_customer", "customer_id"),
        Index("ix_booking_worker", "worker_id"),
        Index("ix_booking_status", "status"),
    )

    id = Column(String, primary_key=True, default=gen_uuid)
    customer_id = Column(String, ForeignKey("customer_profiles.id"), nullable=False)
    worker_id = Column(String, ForeignKey("worker_profiles.id"), nullable=True)
    category_id = Column(String, ForeignKey("service_categories.id"), nullable=False)
    address_id = Column(String, ForeignKey("customer_addresses.id"), nullable=False)
    type = Column(Enum(BookingType), nullable=False)
    status = Column(Enum(BookingStatus), default=BookingStatus.PENDING, nullable=False)
    scheduled_for = Column(DateTime, nullable=True)
    duration_hours = Column(Numeric(4, 1), nullable=False)
    price_quoted = Column(Numeric(10, 2), nullable=False)
    notes = Column(Text, nullable=True)
    cancel_reason = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    confirmed_at = Column(DateTime, nullable=True)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)

    customer = relationship("CustomerProfile", back_populates="bookings")
    worker = relationship("WorkerProfile", back_populates="bookings")
    category = relationship("ServiceCategory", back_populates="bookings")
    address = relationship("CustomerAddress", back_populates="bookings")

    payment = relationship("Payment", back_populates="booking", uselist=False, cascade="all, delete-orphan")
    review = relationship("Review", back_populates="booking", uselist=False, cascade="all, delete-orphan")
    complaints = relationship("Complaint", back_populates="booking", cascade="all, delete-orphan")
    status_events = relationship("BookingStatusEvent", back_populates="booking", cascade="all, delete-orphan")
    chat_thread = relationship("ChatThread", back_populates="booking", uselist=False)


class BookingStatusEvent(Base):
    """Immutable audit trail of every status transition — trust & support tooling."""
    __tablename__ = "booking_status_events"

    id = Column(String, primary_key=True, default=gen_uuid)
    booking_id = Column(String, ForeignKey("bookings.id", ondelete="CASCADE"), index=True, nullable=False)
    from_status = Column(Enum(BookingStatus), nullable=True)
    to_status = Column(Enum(BookingStatus), nullable=False)
    actor = Column(String, nullable=False)  # userId or "SYSTEM"
    note = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    booking = relationship("Booking", back_populates="status_events")


# ─────────────────────────────────────────────────────────────────
# PAYMENTS
# ─────────────────────────────────────────────────────────────────

class Payment(Base):
    __tablename__ = "payments"

    id = Column(String, primary_key=True, default=gen_uuid)
    booking_id = Column(String, ForeignKey("bookings.id"), unique=True, nullable=False)
    razorpay_order_id = Column(String, unique=True, nullable=False)
    razorpay_payment_id = Column(String, nullable=True)
    amount = Column(Numeric(10, 2), nullable=False)
    currency = Column(String, default="INR", nullable=False)
    status = Column(Enum(PaymentStatus), default=PaymentStatus.CREATED, nullable=False, index=True)
    refunded_amount = Column(Numeric(10, 2), default=0, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    booking = relationship("Booking", back_populates="payment")


class PayoutLedgerEntry(Base):
    __tablename__ = "payout_ledger_entries"
    __table_args__ = (Index("ix_ledger_worker_paid", "worker_id", "is_paid_out"),)

    id = Column(String, primary_key=True, default=gen_uuid)
    worker_id = Column(String, ForeignKey("worker_profiles.id"), nullable=False)
    booking_id = Column(String, nullable=False)
    gross_amount = Column(Numeric(10, 2), nullable=False)
    commission_amount = Column(Numeric(10, 2), nullable=False)
    net_amount = Column(Numeric(10, 2), nullable=False)
    is_paid_out = Column(Boolean, default=False, nullable=False)
    payout_id = Column(String, ForeignKey("payouts.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    worker = relationship("WorkerProfile", back_populates="payout_entries")
    payout = relationship("Payout", back_populates="ledger_entries")


class Payout(Base):
    __tablename__ = "payouts"
    __table_args__ = (Index("ix_payout_worker_status", "worker_id", "status"),)

    id = Column(String, primary_key=True, default=gen_uuid)
    worker_id = Column(String, ForeignKey("worker_profiles.id"), nullable=False)
    amount = Column(Numeric(10, 2), nullable=False)
    status = Column(Enum(PayoutStatus), default=PayoutStatus.REQUESTED, nullable=False)
    razorpay_payout_id = Column(String, nullable=True)
    failure_reason = Column(String, nullable=True)
    requested_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    processed_at = Column(DateTime, nullable=True)

    worker = relationship("WorkerProfile", back_populates="payout_requests")
    ledger_entries = relationship("PayoutLedgerEntry", back_populates="payout")


# ─────────────────────────────────────────────────────────────────
# REVIEWS
# ─────────────────────────────────────────────────────────────────

class Review(Base):
    __tablename__ = "reviews"

    id = Column(String, primary_key=True, default=gen_uuid)
    booking_id = Column(String, ForeignKey("bookings.id"), unique=True, nullable=False)
    customer_id = Column(String, ForeignKey("customer_profiles.id"), nullable=False)
    worker_id = Column(String, ForeignKey("worker_profiles.id"), index=True, nullable=False)
    rating = Column(Integer, nullable=False)  # 1-5
    comment = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    booking = relationship("Booking", back_populates="review")
    customer = relationship("CustomerProfile", back_populates="reviews")
    worker = relationship("WorkerProfile", back_populates="reviews")


# ─────────────────────────────────────────────────────────────────
# SUPPORT / COMPLAINTS
# ─────────────────────────────────────────────────────────────────

class Complaint(Base):
    __tablename__ = "complaints"
    __table_args__ = (Index("ix_complaint_status", "status"),)

    id = Column(String, primary_key=True, default=gen_uuid)
    booking_id = Column(String, ForeignKey("bookings.id"), nullable=False)
    raised_by = Column(Enum(ComplaintRaisedBy), nullable=False)
    raised_by_user_id = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    status = Column(Enum(ComplaintStatus), default=ComplaintStatus.OPEN, nullable=False)
    resolution_note = Column(Text, nullable=True)
    refund_issued = Column(Numeric(10, 2), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    resolved_at = Column(DateTime, nullable=True)

    booking = relationship("Booking", back_populates="complaints")


# ─────────────────────────────────────────────────────────────────
# CHAT — "talk to any agent" (customer <-> worker, customer/worker <-> support,
# and the SOS/safety escalation channel). This is the core of the women-first
# trust layer requested for the redesign.
# ─────────────────────────────────────────────────────────────────

class ChatThread(Base):
    __tablename__ = "chat_threads"
    __table_args__ = (Index("ix_chat_status_type", "status", "type"),)

    id = Column(String, primary_key=True, default=gen_uuid)
    type = Column(Enum(ChatThreadType), nullable=False)
    booking_id = Column(String, ForeignKey("bookings.id"), nullable=True, unique=False, index=True)
    subject = Column(String, nullable=True)
    status = Column(Enum(ChatThreadStatus), default=ChatThreadStatus.OPEN, nullable=False)
    created_by_user_id = Column(String, ForeignKey("users.id"), nullable=False)
    assigned_admin_id = Column(String, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    closed_at = Column(DateTime, nullable=True)

    booking = relationship("Booking", back_populates="chat_thread")
    participants = relationship("ChatParticipant", back_populates="thread", cascade="all, delete-orphan")
    messages = relationship("ChatMessage", back_populates="thread", cascade="all, delete-orphan", order_by="ChatMessage.created_at")


class ChatParticipant(Base):
    __tablename__ = "chat_participants"
    __table_args__ = (UniqueConstraint("thread_id", "user_id"),)

    id = Column(String, primary_key=True, default=gen_uuid)
    thread_id = Column(String, ForeignKey("chat_threads.id", ondelete="CASCADE"), index=True, nullable=False)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    role_in_thread = Column(String, nullable=False)  # CUSTOMER | WORKER | SUPPORT_AGENT
    joined_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    last_read_at = Column(DateTime, nullable=True)

    thread = relationship("ChatThread", back_populates="participants")


class ChatMessage(Base):
    __tablename__ = "chat_messages"
    __table_args__ = (Index("ix_chatmsg_thread_created", "thread_id", "created_at"),)

    id = Column(String, primary_key=True, default=gen_uuid)
    thread_id = Column(String, ForeignKey("chat_threads.id", ondelete="CASCADE"), nullable=False)
    sender_id = Column(String, ForeignKey("users.id"), nullable=False)
    body = Column(Text, nullable=False)
    attachment_url = Column(String, nullable=True)
    is_system = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    thread = relationship("ChatThread", back_populates="messages")


# ─────────────────────────────────────────────────────────────────
# SAFETY — SOS, emergency contacts, call masking
# ─────────────────────────────────────────────────────────────────

class EmergencyContact(Base):
    __tablename__ = "emergency_contacts"

    id = Column(String, primary_key=True, default=gen_uuid)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    name = Column(String, nullable=False)
    phone = Column(String, nullable=False)
    relationship_label = Column(String, nullable=True)  # "Sister", "Husband", ...
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="emergency_contacts")


class SafetyIncident(Base):
    """Created the instant a user taps SOS. Independent of chat so it can
    never be silently lost inside a conversation thread."""
    __tablename__ = "safety_incidents"
    __table_args__ = (Index("ix_incident_status", "status"),)

    id = Column(String, primary_key=True, default=gen_uuid)
    triggered_by_user_id = Column(String, ForeignKey("users.id"), nullable=False)
    booking_id = Column(String, ForeignKey("bookings.id"), nullable=True)
    chat_thread_id = Column(String, ForeignKey("chat_threads.id"), nullable=True)
    lat = Column(Float, nullable=True)
    lng = Column(Float, nullable=True)
    status = Column(Enum(SafetyIncidentStatus), default=SafetyIncidentStatus.TRIGGERED, nullable=False)
    notes = Column(Text, nullable=True)
    acknowledged_by_admin_id = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    resolved_at = Column(DateTime, nullable=True)


class MaskedCallSession(Base):
    """Records a click-to-call session routed through a virtual number
    (e.g. Exotel) so customer and worker never see each other's real
    phone number."""
    __tablename__ = "masked_call_sessions"

    id = Column(String, primary_key=True, default=gen_uuid)
    booking_id = Column(String, ForeignKey("bookings.id"), nullable=False, index=True)
    initiated_by_user_id = Column(String, ForeignKey("users.id"), nullable=False)
    provider_call_id = Column(String, nullable=True)
    virtual_number = Column(String, nullable=True)
    status = Column(String, default="INITIATED", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


# ─────────────────────────────────────────────────────────────────
# NOTIFICATIONS
# ─────────────────────────────────────────────────────────────────

class Notification(Base):
    __tablename__ = "notifications"
    __table_args__ = (Index("ix_notification_user_read", "user_id", "read_at"),)

    id = Column(String, primary_key=True, default=gen_uuid)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    channel = Column(Enum(NotificationChannel), nullable=False)
    title = Column(String, nullable=False)
    body = Column(Text, nullable=False)
    data = Column(JSON, nullable=True)
    read_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="notifications")


class DeviceToken(Base):
    __tablename__ = "device_tokens"

    id = Column(String, primary_key=True, default=gen_uuid)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    token = Column(String, unique=True, nullable=False)
    platform = Column(String, nullable=False)  # "android" | "ios"
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="device_tokens")


# ─────────────────────────────────────────────────────────────────
# ADMIN
# ─────────────────────────────────────────────────────────────────

class AdminProfile(Base):
    __tablename__ = "admin_profiles"

    id = Column(String, primary_key=True, default=gen_uuid)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    full_name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False)
    password_hash = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="admin_profile")


class PlatformSetting(Base):
    __tablename__ = "platform_settings"

    key = Column(String, primary_key=True)  # "default_commission_pct", ...
    value = Column(String, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class AuditLog(Base):
    """OWASP-recommended audit trail for admin/security-sensitive actions."""
    __tablename__ = "audit_logs"
    __table_args__ = (Index("ix_audit_actor_created", "actor_user_id", "created_at"),)

    id = Column(String, primary_key=True, default=gen_uuid)
    actor_user_id = Column(String, nullable=True)
    action = Column(String, nullable=False)  # "WORKER_APPROVED", "REFUND_ISSUED", ...
    entity_type = Column(String, nullable=False)
    entity_id = Column(String, nullable=False)
    metadata_json = Column(JSON, nullable=True)
    ip_address = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
