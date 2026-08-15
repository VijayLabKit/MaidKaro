"""
Worker recommendation scoring — a transparent, explainable heuristic
baseline (rating, experience, past-affinity, availability) rather than
an opaque black box, which matters for a marketplace where customers
are trusting a stranger inside their home. This is the layer to swap
for a learned ranking model once enough booking-outcome data exists;
the function signature is the seam.
"""
from typing import List
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database.models import WorkerProfile, Booking, BookingStatus, VerificationStatus, WorkerSkill


def score_worker(worker: WorkerProfile, past_bookings_with_worker: int) -> float:
    rating_score = (worker.rating_avg / 5.0) * 0.5
    experience_score = min(worker.years_experience / 10.0, 1.0) * 0.2
    volume_score = min(worker.rating_count / 50.0, 1.0) * 0.15
    affinity_score = min(past_bookings_with_worker / 3.0, 1.0) * 0.15
    return round(rating_score + experience_score + volume_score + affinity_score, 4)


def recommend_workers(db: Session, customer_id: str, category_id: str, city_id: str, limit: int = 10) -> List[dict]:
    candidates = (
        db.query(WorkerProfile)
        .join(WorkerSkill, WorkerSkill.worker_id == WorkerProfile.id)
        .filter(
            WorkerSkill.category_id == category_id,
            WorkerProfile.city_id == city_id,
            WorkerProfile.verification_status == VerificationStatus.APPROVED,
        )
        .all()
    )

    past_counts = dict(
        db.query(Booking.worker_id, func.count(Booking.id))
        .filter(Booking.customer_id == customer_id, Booking.status == BookingStatus.COMPLETED)
        .group_by(Booking.worker_id)
        .all()
    )

    scored = [
        {"worker_id": w.id, "full_name": w.full_name, "score": score_worker(w, past_counts.get(w.id, 0))}
        for w in candidates
    ]
    scored.sort(key=lambda r: r["score"], reverse=True)
    return scored[:limit]
