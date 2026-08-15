from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.database.models import User, Role, CustomerProfile, Review
from app.security.deps import require_roles
from app.reviews.schemas import CreateReviewIn, ReviewOut
from app.reviews import service

router = APIRouter(prefix="/reviews", tags=["Reviews"])


@router.post("", response_model=ReviewOut, status_code=201)
def create_review(payload: CreateReviewIn, user: User = Depends(require_roles(Role.CUSTOMER)), db: Session = Depends(get_db)):
    customer = db.query(CustomerProfile).filter(CustomerProfile.user_id == user.id).first()
    return service.create_review(db, customer, payload)


@router.get("/worker/{worker_id}", response_model=List[ReviewOut])
def list_worker_reviews(worker_id: str, db: Session = Depends(get_db)):
    reviews = db.query(Review).filter(Review.worker_id == worker_id).order_by(Review.created_at.desc()).limit(100).all()
    out = []
    for r in reviews:
        # First name only on the public worker profile — full customer
        # names aren't exposed to protect their privacy.
        first_name = r.customer.full_name.split()[0] if r.customer and r.customer.full_name else "MaidKaro Customer"
        out.append(ReviewOut(
            id=r.id, booking_id=r.booking_id, worker_id=r.worker_id, rating=r.rating,
            comment=r.comment, customer_name=first_name, created_at=r.created_at,
        ))
    return out
