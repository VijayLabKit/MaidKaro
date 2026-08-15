from datetime import datetime
from typing import Optional
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
    description: str = Field(..., min_length=5, max_length=2000)


class ComplaintOut(BaseModel):
    id: str
    booking_id: str
    status: str
    description: str
    created_at: datetime

    class Config:
        from_attributes = True


class InitiateMaskedCallIn(BaseModel):
    booking_id: str
