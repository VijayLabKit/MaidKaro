from typing import List

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.database.models import User, Role, CustomerProfile, ServiceCategory
from app.security.deps import require_roles
from app.ai import recommendation, pricing

router = APIRouter(prefix="/ai", tags=["AI"])


@router.get("/recommend-workers")
def recommend_workers(
    category_id: str = Query(...), city_id: str = Query(...),
    user: User = Depends(require_roles(Role.CUSTOMER)), db: Session = Depends(get_db),
):
    customer = db.query(CustomerProfile).filter(CustomerProfile.user_id == user.id).first()
    return recommendation.recommend_workers(db, customer.id, category_id, city_id)


@router.get("/price-estimate")
def price_estimate(
    category_id: str = Query(...), city_id: str = Query(...), duration_hours: float = Query(2.0, gt=0, le=12),
    db: Session = Depends(get_db),
):
    category = db.query(ServiceCategory).filter(ServiceCategory.id == category_id).first()
    if not category:
        return {"error": "invalid category"}
    amount = pricing.quote_with_surge(db, category, duration_hours, city_id)
    multiplier = pricing.suggest_price_multiplier(db, city_id, category_id)
    return {"estimated_amount": float(amount), "surge_multiplier": multiplier, "currency": "INR"}
