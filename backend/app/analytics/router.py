from datetime import datetime, timedelta
from typing import List

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.database.models import User, Booking, Payment, PaymentStatus, WorkerProfile, ServiceCategory
from app.security.deps import get_current_admin

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get("/revenue-trend")
def revenue_trend(days: int = Query(14, ge=1, le=90), admin: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    since = datetime.utcnow() - timedelta(days=days)
    rows = (
        db.query(func.date(Payment.created_at).label("day"), func.sum(Payment.amount).label("total"))
        .filter(Payment.status == PaymentStatus.CAPTURED, Payment.created_at >= since)
        .group_by(func.date(Payment.created_at))
        .order_by(func.date(Payment.created_at))
        .all()
    )
    return [{"date": str(r.day), "revenue": float(r.total)} for r in rows]


@router.get("/bookings-by-category")
def bookings_by_category(admin: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    rows = (
        db.query(ServiceCategory.name, func.count(Booking.id))
        .join(Booking, Booking.category_id == ServiceCategory.id)
        .group_by(ServiceCategory.name)
        .all()
    )
    return [{"category": name, "bookings": count} for name, count in rows]


@router.get("/top-workers")
def top_workers(limit: int = Query(10, ge=1, le=50), admin: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    workers = (
        db.query(WorkerProfile)
        .filter(WorkerProfile.rating_count > 0)
        .order_by(WorkerProfile.rating_avg.desc(), WorkerProfile.rating_count.desc())
        .limit(limit)
        .all()
    )
    return [{"id": w.id, "full_name": w.full_name, "rating_avg": w.rating_avg, "rating_count": w.rating_count} for w in workers]
