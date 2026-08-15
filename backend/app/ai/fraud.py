"""
Lightweight fraud/abuse heuristics evaluated at key trust boundaries:
booking cancellation velocity, OTP brute-force patterns, and
new-worker instant-payout requests. Each function returns a risk
score in [0,1] plus the reasons, so admin tooling can show *why*
something was flagged instead of a bare number.
"""
from datetime import datetime, timedelta
from typing import Tuple, List

from sqlalchemy.orm import Session

from app.database.models import Booking, BookingStatus, OtpCode


def customer_cancellation_risk(db: Session, customer_id: str, window_days: int = 7) -> Tuple[float, List[str]]:
    since = datetime.utcnow() - timedelta(days=window_days)
    total = db.query(Booking).filter(Booking.customer_id == customer_id, Booking.created_at >= since).count()
    cancelled = db.query(Booking).filter(
        Booking.customer_id == customer_id, Booking.created_at >= since, Booking.status == BookingStatus.CANCELLED,
    ).count()

    reasons = []
    if total == 0:
        return 0.0, reasons
    rate = cancelled / total
    if rate > 0.6 and total >= 3:
        reasons.append(f"{cancelled}/{total} bookings cancelled in the last {window_days} days")
    return round(min(rate, 1.0), 2) if reasons else 0.0, reasons


def otp_brute_force_risk(db: Session, phone: str, window_minutes: int = 30) -> Tuple[float, List[str]]:
    since = datetime.utcnow() - timedelta(minutes=window_minutes)
    attempts = db.query(OtpCode).filter(OtpCode.user_phone == phone, OtpCode.created_at >= since).all()
    total_failed = sum(o.attempts for o in attempts)
    reasons = []
    if total_failed >= 10:
        reasons.append(f"{total_failed} failed OTP attempts for {phone} in {window_minutes} minutes")
        return 0.9, reasons
    if len(attempts) >= 8:
        reasons.append(f"{len(attempts)} OTP requests for {phone} in {window_minutes} minutes")
        return 0.6, reasons
    return 0.0, reasons
