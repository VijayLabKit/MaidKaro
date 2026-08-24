"""
Notifications reader-side API.

Notification rows are written by `app/notifications/service.send_push()` on
every domain event (booking confirmed, payout processed, KYC approved, etc).
This router adds the read side: list, unread count, mark-read (single + bulk).

All four endpoints are scoped to `get_current_user` which works for
CUSTOMER, WORKER, and ADMIN tokens — each user sees only their own rows.
"""
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.database.models import Notification, User
from app.security.deps import get_current_user

router = APIRouter(prefix="/notifications", tags=["Notifications"])


# ── Response schemas ────────────────────────────────────────────────

class NotificationOut(BaseModel):
    id: str
    title: str
    body: str
    channel: str
    data: Optional[dict] = None
    read_at: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class NotificationListOut(BaseModel):
    items: List[NotificationOut]
    total: int
    unread_count: int


class UnreadCountOut(BaseModel):
    unread_count: int


# ── Helpers ─────────────────────────────────────────────────────────

def _unread_count(db: Session, user_id: str) -> int:
    return db.query(func.count(Notification.id)).filter(
        Notification.user_id == user_id,
        Notification.read_at.is_(None),
    ).scalar() or 0


# ── Endpoints ────────────────────────────────────────────────────────

@router.get("", response_model=NotificationListOut)
def list_notifications(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Paginated list of the caller's notifications, most recent first.
    Includes an `unread_count` so the client can update its bell badge
    without a separate request."""
    offset = (page - 1) * size
    total = db.query(func.count(Notification.id)).filter(
        Notification.user_id == user.id
    ).scalar() or 0

    items = (
        db.query(Notification)
        .filter(Notification.user_id == user.id)
        .order_by(Notification.created_at.desc())
        .offset(offset)
        .limit(size)
        .all()
    )

    return NotificationListOut(
        items=[NotificationOut.model_validate(n) for n in items],
        total=total,
        unread_count=_unread_count(db, user.id),
    )


@router.get("/unread-count", response_model=UnreadCountOut)
def get_unread_count(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Lightweight endpoint for the bell badge poll (no items payload)."""
    return UnreadCountOut(unread_count=_unread_count(db, user.id))


@router.post("/{notification_id}/read", response_model=NotificationOut)
def mark_notification_read(
    notification_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Mark a single notification as read. Returns 404 if the notification
    doesn't belong to the caller so other users can't mark each other's
    notifications as read."""
    notif = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == user.id,
    ).first()
    if not notif:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Notification not found")
    if notif.read_at is None:
        notif.read_at = datetime.utcnow()
        db.commit()
        db.refresh(notif)
    return NotificationOut.model_validate(notif)


@router.post("/read-all", response_model=UnreadCountOut)
def mark_all_notifications_read(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Bulk-mark every unread notification for this user as read."""
    db.query(Notification).filter(
        Notification.user_id == user.id,
        Notification.read_at.is_(None),
    ).update({"read_at": datetime.utcnow()})
    db.commit()
    return UnreadCountOut(unread_count=0)
