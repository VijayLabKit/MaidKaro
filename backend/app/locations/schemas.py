from typing import Optional
from pydantic import BaseModel


class NearbyWorkerOut(BaseModel):
    worker_id: str
    full_name: str
    rating_avg: float
    distance_km: float
    is_available_now: bool

    class Config:
        from_attributes = True
