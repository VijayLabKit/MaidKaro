from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.database.models import (
    User, Role, Complaint, ComplaintRaisedBy, ComplaintType, ComplaintStatus,
    ComplaintMessage, Booking, SafetyIncident,
)
from app.security.deps import get_current_user, require_roles
from app.support.schemas import (
    TriggerSosIn, SafetyIncidentOut, RaiseComplaintIn, ComplaintOut,
    ComplaintDetailOut, AddComplaintMessageIn, ComplaintMessageOut, InitiateMaskedCallIn,
)
from app.support import service
from app.notifications.service import send_push

router = APIRouter(prefix="/safety", tags=["Trust & Safety"])


@router.post("/sos", response_model=SafetyIncidentOut, status_code=status.HTTP_201_CREATED)
def trigger_sos(payload: TriggerSosIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """One-tap emergency escalation — available to both customers and
    workers at all times, not just during an active booking."""
    incident = service.trigger_sos(db, user, payload.booking_id, payload.lat, payload.lng, payload.notes)
    return incident


@router.post("/complaints", response_model=ComplaintOut, status_code=status.HTTP_201_CREATED)
def raise_complaint(payload: RaiseComplaintIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    booking = db.query(Booking).filter(Booking.id == payload.booking_id).first()
    if not booking:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Booking not found")

    is_party = (
        (user.role == Role.CUSTOMER and booking.customer and booking.customer.user_id == user.id) or
        (user.role == Role.WORKER and booking.worker and booking.worker.user_id == user.id)
    )
    if not is_party:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You can only raise a complaint on your own booking")

    raised_by = ComplaintRaisedBy.CUSTOMER if user.role == Role.CUSTOMER else ComplaintRaisedBy.WORKER
    complaint = Complaint(
        booking_id=booking.id, type=ComplaintType(payload.type), raised_by=raised_by, raised_by_user_id=user.id,
        description=payload.description,
    )
    db.add(complaint)
    db.commit()
    db.refresh(complaint)
    return complaint


@router.get("/complaints/me", response_model=List[ComplaintOut])
def my_complaints(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(Complaint).filter(Complaint.raised_by_user_id == user.id).order_by(Complaint.created_at.desc()).all()


def _get_owned_complaint(db: Session, complaint_id: str, user: User) -> Complaint:
    complaint = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Complaint not found")
    if complaint.raised_by_user_id != user.id and user.role not in (Role.ADMIN, Role.SUPER_ADMIN):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your complaint")
    return complaint


@router.get("/complaints/{complaint_id}", response_model=ComplaintDetailOut)
def get_complaint_detail(complaint_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Lets the customer/worker who raised it track status, see staff
    responses, and read the full conversation thread."""
    complaint = _get_owned_complaint(db, complaint_id, user)
    return ComplaintDetailOut(
        id=complaint.id, booking_id=complaint.booking_id, type=complaint.type.value, status=complaint.status.value,
        description=complaint.description, resolution_note=complaint.resolution_note,
        refund_issued=float(complaint.refund_issued) if complaint.refund_issued else None,
        created_at=complaint.created_at, resolved_at=complaint.resolved_at,
        messages=[ComplaintMessageOut.model_validate(m) for m in complaint.messages],
    )


@router.post("/complaints/{complaint_id}/messages", response_model=ComplaintMessageOut, status_code=status.HTTP_201_CREATED)
def add_complaint_info(
    complaint_id: str, payload: AddComplaintMessageIn,
    user: User = Depends(get_current_user), db: Session = Depends(get_db),
):
    """The customer/worker adding relevant information to an open
    complaint/dispute — moves AWAITING_INFO back to IN_REVIEW automatically
    since the thing support was waiting on has now arrived."""
    complaint = _get_owned_complaint(db, complaint_id, user)
    if complaint.status in (ComplaintStatus.RESOLVED, ComplaintStatus.CLOSED, ComplaintStatus.DISMISSED):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This complaint is already closed")

    sender_role = "CUSTOMER" if user.role == Role.CUSTOMER else ("WORKER" if user.role == Role.WORKER else "STAFF")
    msg = ComplaintMessage(complaint_id=complaint.id, sender_user_id=user.id, sender_role=sender_role, body=payload.body)
    db.add(msg)
    if complaint.status == ComplaintStatus.AWAITING_INFO:
        complaint.status = ComplaintStatus.IN_REVIEW
    db.commit()
    db.refresh(msg)
    return msg


@router.post("/masked-call", status_code=status.HTTP_201_CREATED)
def initiate_masked_call(payload: InitiateMaskedCallIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    booking = db.query(Booking).filter(Booking.id == payload.booking_id).first()
    if not booking:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Booking not found")
    session = service.initiate_masked_call(db, booking, user)
    return {
        "session_id": session.id,
        "virtual_number": session.virtual_number,
        "status": session.status,
    }
