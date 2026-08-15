"""Review creation + rolling worker rating aggregation."""
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.database.models import Review, Booking, BookingStatus, WorkerProfile, CustomerProfile


def create_review(db: Session, customer: CustomerProfile, payload) -> Review:
    booking = db.query(Booking).filter(Booking.id == payload.booking_id, Booking.customer_id == customer.id).first()
    if not booking:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Booking not found")
    if booking.status != BookingStatus.COMPLETED:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "You can only review a completed booking")
    if booking.review:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This booking has already been reviewed")
    if not booking.worker_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No worker was assigned to this booking")

    review = Review(
        booking_id=booking.id, customer_id=customer.id, worker_id=booking.worker_id,
        rating=payload.rating, comment=payload.comment,
    )
    db.add(review)
    db.commit()
    db.refresh(review)

    _recompute_worker_rating(db, booking.worker_id)
    return review


def _recompute_worker_rating(db: Session, worker_id: str) -> None:
    worker = db.query(WorkerProfile).filter(WorkerProfile.id == worker_id).first()
    reviews = db.query(Review).filter(Review.worker_id == worker_id).all()
    if not reviews:
        return
    worker.rating_count = len(reviews)
    worker.rating_avg = round(sum(r.rating for r in reviews) / len(reviews), 2)
    db.commit()
