from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field


class CreateSupportThreadIn(BaseModel):
    subject: str
    first_message: str


class ChatThreadOut(BaseModel):
    id: str
    type: str
    status: str
    subject: Optional[str] = None
    booking_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SendMessageIn(BaseModel):
    body: str = Field(..., min_length=1, max_length=4000)
    attachment_url: Optional[str] = None


class ChatMessageOut(BaseModel):
    id: str
    thread_id: str
    sender_id: str
    body: str
    attachment_url: Optional[str] = None
    is_system: bool
    created_at: datetime

    class Config:
        from_attributes = True
