from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.database.models import User, Role, Complaint, ComplaintRaisedBy, Booking, SafetyIncident
from app.security.deps import get_current_user, require_roles
from app.support.schemas import (
    TriggerSosIn, SafetyIncidentOut, RaiseComplaintIn, ComplaintOut, InitiateMaskedCallIn,
)
from app.support import service

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

    raised_by = ComplaintRaisedBy.CUSTOMER if user.role == Role.CUSTOMER else ComplaintRaisedBy.WORKER
    complaint = Complaint(
        booking_id=booking.id, raised_by=raised_by, raised_by_user_id=user.id,
        description=payload.description,
    )
    db.add(complaint)
    db.commit()
    db.refresh(complaint)
    return complaint


@router.get("/complaints/me", response_model=List[ComplaintOut])
def my_complaints(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(Complaint).filter(Complaint.raised_by_user_id == user.id).order_by(Complaint.created_at.desc()).all()


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
