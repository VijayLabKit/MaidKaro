"""Geo-matching utilities: haversine distance + nearby-worker ranking."""
import math
from typing import List

from sqlalchemy.orm import Session

from app.database.models import WorkerProfile, VerificationStatus, WorkerSkill


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlambda / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


def nearby_workers(db: Session, lat: float, lng: float, category_id: str, radius_km: float = 8.0, limit: int = 20) -> List[dict]:
    q = (
        db.query(WorkerProfile)
        .join(WorkerSkill, WorkerSkill.worker_id == WorkerProfile.id)
        .filter(
            WorkerSkill.category_id == category_id,
            WorkerProfile.verification_status == VerificationStatus.APPROVED,
            WorkerProfile.is_available_now.is_(True),
            WorkerProfile.last_lat.isnot(None),
            WorkerProfile.last_lng.isnot(None),
        )
    )
    results = []
    for worker in q.all():
        dist = haversine_km(lat, lng, worker.last_lat, worker.last_lng)
        if dist <= radius_km:
            results.append({
                "worker_id": worker.id, "full_name": worker.full_name,
                "rating_avg": worker.rating_avg, "distance_km": round(dist, 2),
                "is_available_now": worker.is_available_now,
            })
    results.sort(key=lambda r: (r["distance_km"], -r["rating_avg"]))
    return results[:limit]
