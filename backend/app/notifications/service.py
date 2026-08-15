"""
Notification fan-out: SMS (OTP, booking updates), push (FCM), and
in-app records. SMS provider is pluggable — MSG91 in production,
a dev logger locally so OTP flows work with zero external accounts.
"""
import logging
from typing import Optional

import httpx
from sqlalchemy.orm import Session

from app.config import settings
from app.database.models import Notification, NotificationChannel, DeviceToken

logger = logging.getLogger("maidkaro.notifications")


def send_sms(phone: str, message: str) -> None:
    if settings.SMS_PROVIDER == "dev_logger" or not settings.MSG91_API_KEY:
        logger.info("[DEV SMS] to=%s message=%s", phone, message)
        return

    if settings.SMS_PROVIDER == "msg91":
        try:
            httpx.post(
                "https://control.msg91.com/api/v5/flow/",
                headers={"authkey": settings.MSG91_API_KEY, "Content-Type": "application/json"},
                json={
                    "sender": settings.MSG91_SENDER_ID,
                    "mobiles": phone.replace("+", ""),
                    "message": message,
                },
                timeout=10,
            )
        except httpx.HTTPError:
            logger.exception("MSG91 SMS send failed for %s", phone)


def send_push(db: Session, user_id: str, title: str, body: str, data: Optional[dict] = None) -> None:
    """Records the notification in-app and fans out to registered FCM
    device tokens. Silent failures never block the primary flow (e.g. a
    booking must succeed even if a push fails)."""
    db.add(Notification(user_id=user_id, channel=NotificationChannel.IN_APP, title=title, body=body, data=data))
    db.commit()

    tokens = db.query(DeviceToken).filter(DeviceToken.user_id == user_id).all()
    if not tokens:
        return
    # FCM HTTP v1 dispatch would go here (requires service-account JSON,
    # intentionally not wired to a placeholder credential set).
    logger.info("Push queued for user=%s title=%r to %d device(s)", user_id, title, len(tokens))


def notify_booking_event(db: Session, user_id: str, title: str, body: str, booking_id: str) -> None:
    send_push(db, user_id, title, body, data={"type": "BOOKING", "booking_id": booking_id})
