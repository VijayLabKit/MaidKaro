from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class CreateReviewIn(BaseModel):
    booking_id: str
    rating: int = Field(..., ge=1, le=5)
    comment: Optional[str] = Field(None, max_length=1000)


class ReviewOut(BaseModel):
    id: str
    booking_id: str
    worker_id: str
    rating: int
    comment: Optional[str] = None
    customer_name: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
