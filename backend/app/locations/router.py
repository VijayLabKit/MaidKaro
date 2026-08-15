from typing import List

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.locations.schemas import NearbyWorkerOut
from app.locations import service

router = APIRouter(prefix="/locations", tags=["Locations"])


@router.get("/nearby-workers", response_model=List[NearbyWorkerOut])
def nearby_workers(
    lat: float = Query(...), lng: float = Query(...), category_id: str = Query(...),
    radius_km: float = Query(8.0, gt=0, le=50),
    db: Session = Depends(get_db),
):
    return service.nearby_workers(db, lat, lng, category_id, radius_km)
