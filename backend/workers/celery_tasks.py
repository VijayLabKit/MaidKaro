"""
Background jobs run outside the request/response cycle:
- expiring stale PENDING bookings nobody accepted
- batching worker payouts from the ledger
- purging expired OTP rows
- async push/SMS dispatch so booking-creation latency never waits on a
  notification provider round-trip
"""
import logging
from datetime import datetime, timedelta

from workers.celery_app import celery_app
from app.database import SessionLocal
from app.database.models import (
    Booking, BookingStatus, BookingStatusEvent, OtpCode,
    PayoutLedgerEntry, Payout, PayoutStatus, WorkerProfile,
)
from app.notifications.service import send_sms, send_push

logger = logging.getLogger("maidkaro.celery")

PENDING_BOOKING_TIMEOUT_MINUTES = 15


@celery_app.task(name="workers.celery_tasks.expire_stale_pending_bookings")
def expire_stale_pending_bookings() -> int:
    """A PENDING booking nobody accepts within the timeout window is
    auto-expired so the customer isn't left waiting indefinitely."""
    db = SessionLocal()
    try:
        cutoff = datetime.utcnow() - timedelta(minutes=PENDING_BOOKING_TIMEOUT_MINUTES)
        stale = db.query(Booking).filter(Booking.status == BookingStatus.PENDING, Booking.created_at < cutoff).all()
        for booking in stale:
            booking.status = BookingStatus.EXPIRED
            db.add(BookingStatusEvent(
                booking_id=booking.id, from_status=BookingStatus.PENDING, to_status=BookingStatus.EXPIRED,
                actor="SYSTEM", note=f"No worker accepted within {PENDING_BOOKING_TIMEOUT_MINUTES} minutes",
            ))
            send_push(db, booking.customer.user_id, "Booking expired",
                      "No worker was available for your request. Please try again or choose a scheduled slot.")
        db.commit()
        logger.info("Expired %d stale pending bookings", len(stale))
        return len(stale)
    finally:
        db.close()


@celery_app.task(name="workers.celery_tasks.process_pending_payouts")
def process_pending_payouts() -> int:
    """Batches unpaid ledger entries per worker into a Payout request.
    Actual bank transfer requires RAZORPAY_KEY_ID/SECRET with Razorpay
    Payouts (RazorpayX) enabled — this task creates the payout record
    and marks ledger entries reconciled; the transfer leg is the seam
    where a live payout-provider call would be added."""
    db = SessionLocal()
    try:
        workers_with_dues = db.query(PayoutLedgerEntry.worker_id).filter(
            PayoutLedgerEntry.is_paid_out.is_(False)
        ).distinct().all()

        count = 0
        for (worker_id,) in workers_with_dues:
            entries = db.query(PayoutLedgerEntry).filter(
                PayoutLedgerEntry.worker_id == worker_id, PayoutLedgerEntry.is_paid_out.is_(False),
            ).all()
            total = sum(float(e.net_amount) for e in entries)
            if total <= 0:
                continue

            payout = Payout(worker_id=worker_id, amount=total, status=PayoutStatus.REQUESTED)
            db.add(payout)
            db.flush()
            for e in entries:
                e.is_paid_out = True
                e.payout_id = payout.id
            db.commit()

            worker = db.query(WorkerProfile).filter(WorkerProfile.id == worker_id).first()
            if worker:
                send_push(db, worker.user_id, "Payout initiated", f"₹{total:.2f} payout has been initiated to your account.")
            count += 1
        logger.info("Created %d payout batches", count)
        return count
    finally:
        db.close()


@celery_app.task(name="workers.celery_tasks.cleanup_expired_otps")
def cleanup_expired_otps() -> int:
    db = SessionLocal()
    try:
        cutoff = datetime.utcnow() - timedelta(hours=24)
        deleted = db.query(OtpCode).filter(OtpCode.created_at < cutoff).delete()
        db.commit()
        logger.info("Deleted %d expired OTP rows", deleted)
        return deleted
    finally:
        db.close()


@celery_app.task(name="workers.celery_tasks.send_sms_async")
def send_sms_async(phone: str, message: str) -> None:
    send_sms(phone, message)
