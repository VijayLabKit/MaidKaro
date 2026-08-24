from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field


class TriggerSosIn(BaseModel):
    booking_id: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    notes: Optional[str] = None


class SafetyIncidentOut(BaseModel):
    id: str
    status: str
    booking_id: Optional[str] = None
    chat_thread_id: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class RaiseComplaintIn(BaseModel):
    booking_id: str
    type: str = Field("COMPLAINT", pattern="^(COMPLAINT|DISPUTE)$")
    description: str = Field(..., min_length=5, max_length=2000)


class ComplaintOut(BaseModel):
    id: str
    booking_id: str
    type: str
    status: str
    description: str
    resolution_note: Optional[str] = None
    refund_issued: Optional[float] = None
    created_at: datetime
    resolved_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ComplaintMessageOut(BaseModel):
    id: str
    sender_user_id: str
    sender_role: str
    body: str
    created_at: datetime

    class Config:
        from_attributes = True


class ComplaintDetailOut(ComplaintOut):
    messages: List[ComplaintMessageOut] = []


class AddComplaintMessageIn(BaseModel):
    body: str = Field(..., min_length=1, max_length=2000)


class InitiateMaskedCallIn(BaseModel):
    booking_id: str
