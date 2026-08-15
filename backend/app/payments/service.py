"""
Razorpay integration: order creation, HMAC signature verification on
capture, and the worker payout ledger (commission split at booking
completion). Uses Razorpay's plain REST API via httpx rather than
their SDK to keep the dependency footprint small.
"""
import hashlib
import hmac
import uuid
from decimal import Decimal
from typing import Optional

import httpx
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.config import settings
from app.database.models import (
    Payment, PaymentStatus, Booking, BookingStatus, PayoutLedgerEntry, ServiceCategory,
)

RAZORPAY_BASE = "https://api.razorpay.com/v1"


def create_order(db: Session, booking: Booking) -> Payment:
    if booking.payment:
        return booking.payment

    amount_paise = int(Decimal(str(booking.price_quoted)) * 100)

    if settings.RAZORPAY_KEY_ID and settings.RAZORPAY_KEY_SECRET:
        resp = httpx.post(
            f"{RAZORPAY_BASE}/orders",
            auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET),
            json={"amount": amount_paise, "currency": "INR", "receipt": booking.id, "payment_capture": 1},
            timeout=15,
        )
        if resp.status_code >= 300:
            raise HTTPException(status.HTTP_502_BAD_GATEWAY, f"Razorpay order creation failed: {resp.text}")
        order_id = resp.json()["id"]
    else:
        # No live credentials configured — generate a locally-unique
        # order id so the flow is fully exercisable in dev/staging
        # without a Razorpay account, and clearly non-production.
        order_id = f"order_dev_{uuid.uuid4().hex[:16]}"

    payment = Payment(
        booking_id=booking.id, razorpay_order_id=order_id,
        amount=booking.price_quoted, currency="INR", status=PaymentStatus.CREATED,
    )
    db.add(payment)
    db.commit()
    db.refresh(payment)
    return payment


def verify_and_capture(db: Session, payment: Payment, razorpay_payment_id: str, razorpay_signature: str) -> Payment:
    expected_signature = hmac.new(
        settings.RAZORPAY_KEY_SECRET.encode(),
        f"{payment.razorpay_order_id}|{razorpay_payment_id}".encode(),
        hashlib.sha256,
    ).hexdigest()

    if settings.RAZORPAY_KEY_SECRET and not hmac.compare_digest(expected_signature, razorpay_signature):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Payment signature verification failed")

    payment.razorpay_payment_id = razorpay_payment_id
    payment.status = PaymentStatus.CAPTURED
    db.commit()
    db.refresh(payment)

    _create_payout_ledger_entry(db, payment)
    return payment


def _create_payout_ledger_entry(db: Session, payment: Payment) -> None:
    booking = payment.booking
    if not booking.worker_id:
        return
    category = db.query(ServiceCategory).filter(ServiceCategory.id == booking.category_id).first()
    commission_pct = Decimal(str(category.commission_pct)) if category else Decimal("15.00")
    gross = Decimal(str(payment.amount))
    commission = (gross * commission_pct / Decimal("100")).quantize(Decimal("0.01"))
    net = gross - commission

    db.add(PayoutLedgerEntry(
        worker_id=booking.worker_id, booking_id=booking.id,
        gross_amount=gross, commission_amount=commission, net_amount=net,
    ))
    db.commit()


def refund_payment(db: Session, payment: Payment, amount: Optional[Decimal] = None) -> Payment:
    refund_amount = amount or Decimal(str(payment.amount))

    if settings.RAZORPAY_KEY_ID and payment.razorpay_payment_id:
        resp = httpx.post(
            f"{RAZORPAY_BASE}/payments/{payment.razorpay_payment_id}/refund",
            auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET),
            json={"amount": int(refund_amount * 100)},
            timeout=15,
        )
        if resp.status_code >= 300:
            raise HTTPException(status.HTTP_502_BAD_GATEWAY, f"Razorpay refund failed: {resp.text}")

    payment.refunded_amount = Decimal(str(payment.refunded_amount)) + refund_amount
    payment.status = PaymentStatus.REFUNDED if payment.refunded_amount >= Decimal(str(payment.amount)) else PaymentStatus.PARTIALLY_REFUNDED
    db.commit()
    db.refresh(payment)
    return payment
