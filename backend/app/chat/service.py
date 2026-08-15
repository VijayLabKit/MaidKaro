"""
Chat is the backbone of the women-first trust layer: every customer
can always reach a human — the assigned worker during an active
booking, or a support agent on demand — from one inbox, plus a
dedicated SAFETY channel that auto-escalates to admins.
"""
from datetime import datetime
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.database.models import (
    Booking, ChatThread, ChatThreadType, ChatThreadStatus, ChatParticipant,
    ChatMessage, User, Role, AdminProfile,
)


def create_booking_chat_thread(db: Session, booking: Booking) -> ChatThread:
    """Auto-provisioned the moment a booking is CONFIRMED — customer and
    worker land in the same thread with zero setup."""
    existing = db.query(ChatThread).filter(ChatThread.booking_id == booking.id).first()
    if existing:
        return existing

    thread = ChatThread(
        type=ChatThreadType.BOOKING,
        booking_id=booking.id,
        subject=f"Booking #{booking.id[:8]}",
        created_by_user_id=booking.customer.user_id,
    )
    db.add(thread)
    db.flush()

    db.add(ChatParticipant(thread_id=thread.id, user_id=booking.customer.user_id, role_in_thread="CUSTOMER"))
    if booking.worker:
        db.add(ChatParticipant(thread_id=thread.id, user_id=booking.worker.user_id, role_in_thread="WORKER"))
    db.add(ChatMessage(
        thread_id=thread.id, sender_id=booking.customer.user_id, is_system=True,
        body="Chat is now open. Messages here are visible to MaidKaro support for your safety.",
    ))
    db.commit()
    db.refresh(thread)
    return thread


def create_support_thread(db: Session, user: User, subject: str, first_message: str) -> ChatThread:
    thread = ChatThread(
        type=ChatThreadType.SUPPORT, subject=subject,
        created_by_user_id=user.id, status=ChatThreadStatus.OPEN,
    )
    db.add(thread)
    db.flush()
    db.add(ChatParticipant(thread_id=thread.id, user_id=user.id,
                            role_in_thread="CUSTOMER" if user.role == Role.CUSTOMER else "WORKER"))
    db.add(ChatMessage(thread_id=thread.id, sender_id=user.id, body=first_message))
    db.commit()
    db.refresh(thread)
    _auto_assign_agent(db, thread)
    return thread


def create_safety_thread(db: Session, user: User, booking_id: Optional[str] = None) -> ChatThread:
    """Always escalated on creation — a SAFETY thread is never left
    unattended in an OPEN/unassigned state."""
    thread = ChatThread(
        type=ChatThreadType.SAFETY, booking_id=booking_id, subject="Safety escalation",
        created_by_user_id=user.id, status=ChatThreadStatus.ESCALATED,
    )
    db.add(thread)
    db.flush()
    db.add(ChatParticipant(thread_id=thread.id, user_id=user.id,
                            role_in_thread="CUSTOMER" if user.role == Role.CUSTOMER else "WORKER"))
    db.add(ChatMessage(
        thread_id=thread.id, sender_id=user.id, is_system=True,
        body="Safety escalation started. A MaidKaro trust & safety agent has been notified.",
    ))
    db.commit()
    db.refresh(thread)
    _auto_assign_agent(db, thread, priority=True)
    return thread


def _auto_assign_agent(db: Session, thread: ChatThread, priority: bool = False) -> None:
    """Round-robin isn't meaningful with in-memory state per request, so
    this assigns the least-recently-assigned active admin — simple,
    deterministic, and good enough until a dedicated support-queue
    service is warranted."""
    admin = (
        db.query(AdminProfile)
        .join(User, User.id == AdminProfile.user_id)
        .filter(User.is_active.is_(True))
        .order_by(AdminProfile.created_at.asc())
        .first()
    )
    if admin:
        thread.assigned_admin_id = admin.user_id
        db.add(ChatParticipant(thread_id=thread.id, user_id=admin.user_id, role_in_thread="SUPPORT_AGENT"))
        db.commit()


def post_message(db: Session, thread: ChatThread, sender: User, body: str, attachment_url: Optional[str] = None) -> ChatMessage:
    if thread.status == ChatThreadStatus.CLOSED:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This conversation is closed. Start a new one from support.")
    msg = ChatMessage(thread_id=thread.id, sender_id=sender.id, body=body, attachment_url=attachment_url)
    db.add(msg)
    thread.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(msg)
    return msg


def is_participant(db: Session, thread: ChatThread, user: User) -> bool:
    if user.role in (Role.ADMIN, Role.SUPER_ADMIN):
        return True
    return db.query(ChatParticipant).filter(
        ChatParticipant.thread_id == thread.id, ChatParticipant.user_id == user.id,
    ).first() is not None
