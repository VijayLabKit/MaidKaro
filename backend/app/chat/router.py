from typing import List

from fastapi import APIRouter, Depends, HTTPException, status, WebSocket, WebSocketDisconnect, Query
from sqlalchemy.orm import Session

from app.database import get_db, SessionLocal
from app.database.models import User, ChatThread, ChatMessage, ChatParticipant
from app.security.deps import get_current_user
from app.security.security import decode_access_token
from app.chat.schemas import CreateSupportThreadIn, ChatThreadOut, SendMessageIn, ChatMessageOut
from app.chat import service
from app.chat.connection_manager import manager

router = APIRouter(prefix="/chat", tags=["Chat"])


@router.get("/threads", response_model=List[ChatThreadOut])
def list_my_threads(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """One inbox: booking chats, support tickets, and safety escalations
    the user is a participant in — exactly the 'talk to any agent in one
    place' experience requested for the redesign."""
    thread_ids = [p.thread_id for p in db.query(ChatParticipant).filter(ChatParticipant.user_id == user.id).all()]
    threads = db.query(ChatThread).filter(ChatThread.id.in_(thread_ids)).order_by(ChatThread.updated_at.desc()).all()
    return threads


@router.post("/support", response_model=ChatThreadOut, status_code=status.HTTP_201_CREATED)
def open_support_thread(payload: CreateSupportThreadIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return service.create_support_thread(db, user, payload.subject, payload.first_message)


def _get_authorized_thread(db: Session, thread_id: str, user: User) -> ChatThread:
    thread = db.query(ChatThread).filter(ChatThread.id == thread_id).first()
    if not thread:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Conversation not found")
    if not service.is_participant(db, thread, user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You are not part of this conversation")
    return thread


@router.get("/threads/{thread_id}/messages", response_model=List[ChatMessageOut])
def get_messages(thread_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    thread = _get_authorized_thread(db, thread_id, user)
    return thread.messages


@router.post("/threads/{thread_id}/messages", response_model=ChatMessageOut, status_code=status.HTTP_201_CREATED)
async def send_message(thread_id: str, payload: SendMessageIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    thread = _get_authorized_thread(db, thread_id, user)
    msg = service.post_message(db, thread, user, payload.body, payload.attachment_url)
    await manager.broadcast(thread_id, {
        "id": msg.id, "thread_id": thread_id, "sender_id": msg.sender_id,
        "body": msg.body, "is_system": msg.is_system,
        "created_at": msg.created_at.isoformat(),
    })
    return msg


@router.websocket("/ws/{thread_id}")
async def chat_websocket(websocket: WebSocket, thread_id: str, token: str = Query(...)):
    """Real-time delivery. Auth is via `?token=<access_token>` since
    browsers/mobile WebSocket clients can't set arbitrary headers on the
    handshake request."""
    payload = decode_access_token(token)
    if not payload or payload.get("type") != "access":
        await websocket.close(code=4401)
        return

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == payload["sub"]).first()
        thread = db.query(ChatThread).filter(ChatThread.id == thread_id).first()
        if not user or not thread or not service.is_participant(db, thread, user):
            await websocket.close(code=4403)
            return

        await manager.connect(thread_id, websocket)
        try:
            while True:
                data = await websocket.receive_json()
                body = (data.get("body") or "").strip()
                if not body:
                    continue
                msg = service.post_message(db, thread, user, body, data.get("attachment_url"))
                await manager.broadcast(thread_id, {
                    "id": msg.id, "thread_id": thread_id, "sender_id": msg.sender_id,
                    "body": msg.body, "is_system": msg.is_system,
                    "created_at": msg.created_at.isoformat(),
                })
        except WebSocketDisconnect:
            manager.disconnect(thread_id, websocket)
    finally:
        db.close()
