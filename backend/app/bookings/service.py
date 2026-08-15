"""
Booking lifecycle: creation + pricing, worker assignment (INSTANT vs
SCHEDULED), and the status state-machine with a full audit trail.

State machine:
  PENDING -> CONFIRMED -> IN_PROGRESS -> COMPLETED
  PENDING -> REJECTED / EXPIRED
  PENDING|CONFIRMED -> CANCELLED
"""
from datetime import datetime
from decimal import Decimal
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.database.models import (
    Booking, BookingStatus, BookingStatusEvent, BookingType,
    CustomerProfile, CustomerAddress, ServiceCategory, WorkerProfile,
    WorkerSkill, VerificationStatus,
)
from app.notifications.service import notify_booking_event
from app.chat.service import create_booking_chat_thread

VALID_TRANSITIONS = {
    BookingStatus.PENDING: {BookingStatus.CONFIRMED, BookingStatus.REJECTED, BookingStatus.CANCELLED, BookingStatus.EXPIRED},
    BookingStatus.CONFIRMED: {BookingStatus.IN_PROGRESS, BookingStatus.CANCELLED},
    BookingStatus.IN_PROGRESS: {BookingStatus.COMPLETED},
    BookingStatus.COMPLETED: set(),
    BookingStatus.CANCELLED: set(),
    BookingStatus.REJECTED: set(),
    BookingStatus.EXPIRED: set(),
}


def _quote_price(category: ServiceCategory, duration_hours: float, worker: Optional[WorkerProfile] = None) -> Decimal:
    rate = category.base_hourly_rate
    if worker:
        skill = next((s for s in worker.skills if s.category_id == category.id), None)
        if skill and skill.hourly_rate:
            rate = skill.hourly_rate
    return (Decimal(str(rate)) * Decimal(str(duration_hours))).quantize(Decimal("0.01"))


def _find_best_worker(db: Session, category_id: str, city_id: str, exclude_ids: Optional[list] = None) -> Optional[WorkerProfile]:
    """Simple, transparent matching: verified + available-now + serves
    this category + in-city, ranked by rating then experience. This is
    the deterministic baseline the AI recommender (app/ai) refines."""
    q = (
        db.query(WorkerProfile)
        .join(WorkerSkill, WorkerSkill.worker_id == WorkerProfile.id)
        .filter(
            WorkerSkill.category_id == category_id,
            WorkerProfile.city_id == city_id,
            WorkerProfile.verification_status == VerificationStatus.APPROVED,
            WorkerProfile.is_available_now.is_(True),
        )
    )
    if exclude_ids:
        q = q.filter(~WorkerProfile.id.in_(exclude_ids))
    return q.order_by(WorkerProfile.rating_avg.desc(), WorkerProfile.years_experience.desc()).first()


def create_booking(db: Session, customer: CustomerProfile, payload) -> Booking:
    category = db.query(ServiceCategory).filter(ServiceCategory.id == payload.category_id, ServiceCategory.is_active.is_(True)).first()
    if not category:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid or inactive service category")

    address = db.query(CustomerAddress).filter(CustomerAddress.id == payload.address_id, CustomerAddress.customer_id == customer.id).first()
    if not address:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Address not found")

    worker = None
    if payload.preferred_worker_id:
        worker = db.query(WorkerProfile).filter(
            WorkerProfile.id == payload.preferred_worker_id,
            WorkerProfile.verification_status == VerificationStatus.APPROVED,
        ).first()
        if not worker:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Preferred worker not available")
    elif payload.type == "INSTANT":
        worker = _find_best_worker(db, category.id, worker_city_id_from_address(db, address))

    price = _quote_price(category, payload.duration_hours, worker)

    booking = Booking(
        customer_id=customer.id,
        worker_id=worker.id if worker else None,
        category_id=category.id,
        address_id=address.id,
        type=BookingType(payload.type),
        status=BookingStatus.CONFIRMED if worker else BookingStatus.PENDING,
        scheduled_for=payload.scheduled_for,
        duration_hours=Decimal(str(payload.duration_hours)),
        price_quoted=price,
        notes=payload.notes,
        confirmed_at=datetime.utcnow() if worker else None,
    )
    db.add(booking)
    db.flush()

    db.add(BookingStatusEvent(
        booking_id=booking.id, from_status=None, to_status=booking.status,
        actor=customer.user_id, note="Booking created",
    ))
    db.commit()
    db.refresh(booking)

    if worker:
        create_booking_chat_thread(db, booking)
        notify_booking_event(db, worker.user_id, "New booking assigned",
                              f"You have a new {category.name} booking.", booking.id)
    notify_booking_event(db, customer.user_id, "Booking received",
                          f"Your {category.name} booking is {booking.status.value.lower()}.", booking.id)
    return booking


def worker_city_id_from_address(db: Session, address: CustomerAddress) -> str:
    """Resolves the city for matching purposes via the address's pincode -> zone -> city chain."""
    return address.pincode.service_zone.city_id


def transition_booking(db: Session, booking: Booking, action: str, actor_user_id: str, reason: Optional[str] = None) -> Booking:
    action_map = {
        "ACCEPT": BookingStatus.CONFIRMED,
        "REJECT": BookingStatus.REJECTED,
        "START": BookingStatus.IN_PROGRESS,
        "COMPLETE": BookingStatus.COMPLETED,
        "CANCEL": BookingStatus.CANCELLED,
    }
    new_status = action_map[action]
    if new_status not in VALID_TRANSITIONS.get(booking.status, set()):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Cannot move booking from {booking.status.value} to {new_status.value}")

    old_status = booking.status
    booking.status = new_status
    now = datetime.utcnow()
    if new_status == BookingStatus.CONFIRMED:
        booking.confirmed_at = now
        create_booking_chat_thread(db, booking)
    elif new_status == BookingStatus.IN_PROGRESS:
        booking.started_at = now
    elif new_status == BookingStatus.COMPLETED:
        booking.completed_at = now
    elif new_status == BookingStatus.CANCELLED:
        booking.cancel_reason = reason

    db.add(BookingStatusEvent(
        booking_id=booking.id, from_status=old_status, to_status=new_status,
        actor=actor_user_id, note=reason,
    ))
    db.commit()
    db.refresh(booking)

    recipient_user_id = booking.customer.user_id if actor_user_id != booking.customer.user_id else (
        booking.worker.user_id if booking.worker else None
    )
    if recipient_user_id:
        notify_booking_event(db, recipient_user_id, "Booking update",
                              f"Your booking is now {new_status.value.lower().replace('_', ' ')}.", booking.id)
    return booking
