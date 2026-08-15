from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, field_validator


class CreateBookingIn(BaseModel):
    category_id: str
    address_id: str
    type: str = Field(..., pattern="^(INSTANT|SCHEDULED)$")
    scheduled_for: Optional[datetime] = None
    duration_hours: float = Field(..., gt=0, le=12)
    notes: Optional[str] = None
    preferred_worker_id: Optional[str] = None

    @field_validator("scheduled_for")
    @classmethod
    def validate_schedule(cls, v, info):
        if info.data.get("type") == "SCHEDULED" and v is None:
            raise ValueError("scheduled_for is required for SCHEDULED bookings")
        return v


class BookingOut(BaseModel):
    id: str
    status: str
    type: str
    category_id: str
    category_name: Optional[str] = None
    worker_id: Optional[str] = None
    worker_name: Optional[str] = None
    worker_photo_url: Optional[str] = None
    address_id: str
    address_text: Optional[str] = None
    scheduled_for: Optional[datetime] = None
    duration_hours: float
    price_quoted: float
    created_at: datetime
    confirmed_at: Optional[datetime] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class UpdateBookingStatusIn(BaseModel):
    action: str = Field(..., pattern="^(ACCEPT|REJECT|START|COMPLETE|CANCEL)$")
    reason: Optional[str] = None
