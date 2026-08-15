from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.database.models import User, Role, Booking, CustomerProfile
from app.security.deps import require_roles
from app.config import settings
from app.payments.schemas import CreatePaymentOrderIn, PaymentOrderOut, VerifyPaymentIn, PaymentOut
from app.payments import service

router = APIRouter(prefix="/payments", tags=["Payments"])


@router.post("/orders", response_model=PaymentOrderOut, status_code=status.HTTP_201_CREATED)
def create_payment_order(payload: CreatePaymentOrderIn, user: User = Depends(require_roles(Role.CUSTOMER)), db: Session = Depends(get_db)):
    customer = db.query(CustomerProfile).filter(CustomerProfile.user_id == user.id).first()
    booking = db.query(Booking).filter(Booking.id == payload.booking_id, Booking.customer_id == customer.id).first()
    if not booking:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Booking not found")

    payment = service.create_order(db, booking)
    return PaymentOrderOut(
        payment_id=payment.id, razorpay_order_id=payment.razorpay_order_id,
        razorpay_key_id=settings.RAZORPAY_KEY_ID or "rzp_test_not_configured",
        amount_paise=int(float(payment.amount) * 100), currency=payment.currency,
    )


@router.post("/verify", response_model=PaymentOut)
def verify_payment(payload: VerifyPaymentIn, user: User = Depends(require_roles(Role.CUSTOMER)), db: Session = Depends(get_db)):
    customer = db.query(CustomerProfile).filter(CustomerProfile.user_id == user.id).first()
    booking = db.query(Booking).filter(Booking.id == payload.booking_id, Booking.customer_id == customer.id).first()
    if not booking or not booking.payment or booking.payment.razorpay_order_id != payload.razorpay_order_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Payment not found")

    payment = service.verify_and_capture(db, booking.payment, payload.razorpay_payment_id, payload.razorpay_signature)
    return payment
