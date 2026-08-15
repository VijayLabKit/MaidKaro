from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field


class WorkerProfileOut(BaseModel):
    id: str
    full_name: str
    photo_url: Optional[str] = None
    bio: Optional[str] = None
    city_id: str
    languages: List[str] = []
    years_experience: int
    verification_status: str
    rating_avg: float
    rating_count: int
    is_available_now: bool
    phone: str

    class Config:
        from_attributes = True


class UpdateWorkerProfileIn(BaseModel):
    full_name: Optional[str] = None
    bio: Optional[str] = None
    photo_url: Optional[str] = None
    languages: Optional[List[str]] = None
    years_experience: Optional[int] = None


class SetAvailabilityNowIn(BaseModel):
    is_available_now: bool


class SkillIn(BaseModel):
    category_id: str
    hourly_rate: Optional[float] = None


class SkillOut(SkillIn):
    id: str

    class Config:
        from_attributes = True


class WorkerSkillPublicOut(BaseModel):
    """A category a worker offers, with its slug/name/rate — needed by the
    customer app to show what a worker does and filter/link by category."""
    category_id: str
    category_slug: str
    category_name: str
    hourly_rate: float

    class Config:
        from_attributes = True


class AvailabilitySlotIn(BaseModel):
    day: str = Field(..., pattern="^(MON|TUE|WED|THU|FRI|SAT|SUN)$")
    start_time: str = Field(..., pattern="^([01]\\d|2[0-3]):[0-5]\\d$")
    end_time: str = Field(..., pattern="^([01]\\d|2[0-3]):[0-5]\\d$")


class AvailabilitySlotOut(AvailabilitySlotIn):
    id: str

    class Config:
        from_attributes = True


class KycUploadIn(BaseModel):
    type: str = Field(..., pattern="^(GOVERNMENT_ID|ADDRESS_PROOF|PROFILE_PHOTO|POLICE_VERIFICATION|OTHER)$")
    file_url: str


class KycDocumentOut(BaseModel):
    id: str
    type: str
    status: str
    reject_reason: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class LiveLocationIn(BaseModel):
    lat: float
    lng: float


class WorkerPublicOut(BaseModel):
    """What a customer is allowed to see about a worker — no phone number,
    no address; trust signals only."""
    id: str
    full_name: str
    photo_url: Optional[str] = None
    bio: Optional[str] = None
    languages: List[str] = []
    years_experience: int
    verification_status: str
    rating_avg: float
    rating_count: int
    is_available_now: bool
    city: Optional[str] = None
    skills: List[WorkerSkillPublicOut] = []

    class Config:
        from_attributes = True
