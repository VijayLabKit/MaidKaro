"""
Trust & safety operations: SOS escalation and call masking. These are
the two features most specific to a women-first home-services
marketplace — a customer or worker must always be able to raise an
alarm in one tap, and neither party should ever need to expose a
real phone number to the other.
"""
import logging
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.config import settings
from app.database.models import (
    SafetyIncident, SafetyIncidentStatus, User, Role, EmergencyContact,
    Booking, MaskedCallSession, AdminProfile,
)
from app.notifications.service import send_sms, send_push
from app.chat.service import create_safety_thread

logger = logging.getLogger("maidkaro.safety")


def trigger_sos(db: Session, user: User, booking_id: Optional[str], lat: Optional[float], lng: Optional[float], notes: Optional[str]) -> SafetyIncident:
    thread = create_safety_thread(db, user, booking_id)

    incident = SafetyIncident(
        triggered_by_user_id=user.id, booking_id=booking_id, chat_thread_id=thread.id,
        lat=lat, lng=lng, notes=notes, status=SafetyIncidentStatus.TRIGGERED,
    )
    db.add(incident)
    db.commit()
    db.refresh(incident)

    # Notify every admin immediately — safety alerts are never batched or delayed.
    admins = db.query(AdminProfile).join(User, User.id == AdminProfile.user_id).filter(User.is_active.is_(True)).all()
    for admin in admins:
        send_push(db, admin.user_id, "SOS TRIGGERED", f"Safety alert from a user{f' on booking {booking_id[:8]}' if booking_id else ''}. Respond immediately.")
    if settings.SAFETY_ESCALATION_PHONE:
        send_sms(settings.SAFETY_ESCALATION_PHONE, f"MaidKaro SOS: user {user.phone} triggered a safety alert. Incident {incident.id}.")

    # Notify the triggering user's own emergency contacts.
    contacts = db.query(EmergencyContact).filter(EmergencyContact.user_id == user.id).all()
    for contact in contacts:
        send_sms(contact.phone, f"MaidKaro Safety Alert: {user.phone.replace(user.phone[3:-2], '****')} triggered an SOS and MaidKaro support has been notified.")

    return incident


def acknowledge_incident(db: Session, incident: SafetyIncident, admin_user_id: str) -> SafetyIncident:
    incident.status = SafetyIncidentStatus.ACKNOWLEDGED
    incident.acknowledged_by_admin_id = admin_user_id
    db.commit()
    db.refresh(incident)
    return incident


def initiate_masked_call(db: Session, booking: Booking, initiator: User) -> MaskedCallSession:
    """Creates a call-masking session. Actual telephony (Exotel/Knowlarity
    click-to-call) requires provider credentials — this persists the
    session and returns the virtual number contract the frontend needs;
    wiring EXOTEL_SID/EXOTEL_TOKEN activates the live call leg."""
    if not booking.worker:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Booking has no assigned worker yet")

    session = MaskedCallSession(
        booking_id=booking.id, initiated_by_user_id=initiator.id,
        virtual_number=settings.EXOTEL_VIRTUAL_NUMBER or None,
        status="INITIATED" if settings.EXOTEL_SID else "PROVIDER_NOT_CONFIGURED",
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    if not settings.EXOTEL_SID:
        logger.warning("Masked call requested but EXOTEL_SID not configured — session recorded, no live call placed.")
    return session
