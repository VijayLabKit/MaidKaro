from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.database.models import (
    User, Role, Booking, CustomerProfile, WorkerProfile, BookingStatus,
)
from app.security.deps import require_roles, get_current_user
from app.bookings.schemas import CreateBookingIn, BookingOut, UpdateBookingStatusIn
from app.bookings import service

router = APIRouter(prefix="/bookings", tags=["Bookings"])


def _booking_out(b: Booking) -> BookingOut:
    return BookingOut(
        id=b.id, status=b.status.value, type=b.type.value, category_id=b.category_id,
        category_name=b.category.name if b.category else None,
        worker_id=b.worker_id, worker_name=b.worker.full_name if b.worker else None,
        worker_photo_url=b.worker.photo_url if b.worker else None,
        address_id=b.address_id,
        address_text=(f"{b.address.line1}, {b.address.line2}" if b.address and b.address.line2 else (b.address.line1 if b.address else None)),
        scheduled_for=b.scheduled_for,
        duration_hours=float(b.duration_hours), price_quoted=float(b.price_quoted),
        created_at=b.created_at, confirmed_at=b.confirmed_at, started_at=b.started_at,
        completed_at=b.completed_at,
    )


@router.post("", response_model=BookingOut, status_code=status.HTTP_201_CREATED)
def create_booking(
    payload: CreateBookingIn,
    user: User = Depends(require_roles(Role.CUSTOMER)),
    db: Session = Depends(get_db),
):
    customer = db.query(CustomerProfile).filter(CustomerProfile.user_id == user.id).first()
    booking = service.create_booking(db, customer, payload)
    return _booking_out(booking)


@router.get("", response_model=List[BookingOut])
def list_my_bookings(
    status_filter: Optional[str] = Query(None, alias="status"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(Booking)
    if user.role == Role.CUSTOMER:
        customer = db.query(CustomerProfile).filter(CustomerProfile.user_id == user.id).first()
        q = q.filter(Booking.customer_id == customer.id)
    elif user.role == Role.WORKER:
        worker = db.query(WorkerProfile).filter(WorkerProfile.user_id == user.id).first()
        q = q.filter(Booking.worker_id == worker.id)
    else:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not applicable for this role")

    if status_filter:
        q = q.filter(Booking.status == BookingStatus(status_filter))
    bookings = q.order_by(Booking.created_at.desc()).limit(100).all()
    return [_booking_out(b) for b in bookings]


def _get_authorized_booking(db: Session, booking_id: str, user: User) -> Booking:
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Booking not found")

    is_owner = (
        (user.role == Role.CUSTOMER and booking.customer.user_id == user.id) or
        (user.role == Role.WORKER and booking.worker and booking.worker.user_id == user.id) or
        user.role in (Role.ADMIN, Role.SUPER_ADMIN)
    )
    if not is_owner:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your booking")
    return booking


@router.get("/{booking_id}", response_model=BookingOut)
def get_booking(booking_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    booking = _get_authorized_booking(db, booking_id, user)
    return _booking_out(booking)


@router.post("/{booking_id}/status", response_model=BookingOut)
def update_booking_status(
    booking_id: str,
    payload: UpdateBookingStatusIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    booking = _get_authorized_booking(db, booking_id, user)

    # Workers accept/reject/start/complete; customers may only cancel.
    worker_only = {"ACCEPT", "REJECT", "START", "COMPLETE"}
    if payload.action in worker_only and user.role != Role.WORKER:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the assigned worker can perform this action")
    if payload.action == "CANCEL" and user.role not in (Role.CUSTOMER, Role.WORKER, Role.ADMIN, Role.SUPER_ADMIN):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not allowed")

    updated = service.transition_booking(db, booking, payload.action, user.id, payload.reason)
    return _booking_out(updated)
