"""
Dynamic pricing suggestion: a supply/demand multiplier on the category
base rate, computed from live bookings-in-progress vs. available
workers in a zone over a rolling window. Deliberately capped so a
demand spike can never more than double the base price.
"""
from datetime import datetime, timedelta
from decimal import Decimal

from sqlalchemy.orm import Session

from app.database.models import Booking, BookingStatus, WorkerProfile, VerificationStatus, ServiceCategory


def suggest_price_multiplier(db: Session, city_id: str, category_id: str, window_hours: int = 2) -> float:
    since = datetime.utcnow() - timedelta(hours=window_hours)
    active_demand = (
        db.query(Booking)
        .filter(
            Booking.category_id == category_id,
            Booking.status.in_([BookingStatus.PENDING, BookingStatus.CONFIRMED, BookingStatus.IN_PROGRESS]),
            Booking.created_at >= since,
        )
        .count()
    )
    available_supply = (
        db.query(WorkerProfile)
        .filter(
            WorkerProfile.city_id == city_id,
            WorkerProfile.verification_status == VerificationStatus.APPROVED,
            WorkerProfile.is_available_now.is_(True),
        )
        .count()
    )

    if available_supply == 0:
        ratio = 2.0 if active_demand > 0 else 1.0
    else:
        ratio = active_demand / available_supply

    # Map demand/supply ratio to a bounded multiplier: 1.0x (calm) to 1.8x (surge).
    multiplier = 1.0 + min(max(ratio - 0.5, 0), 0.8)
    return round(multiplier, 2)


def quote_with_surge(db: Session, category: ServiceCategory, duration_hours: float, city_id: str) -> Decimal:
    multiplier = suggest_price_multiplier(db, city_id, category.id)
    base = Decimal(str(category.base_hourly_rate)) * Decimal(str(duration_hours))
    return (base * Decimal(str(multiplier))).quantize(Decimal("0.01"))
