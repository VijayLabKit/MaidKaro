from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class CreatePaymentOrderIn(BaseModel):
    booking_id: str


class PaymentOrderOut(BaseModel):
    payment_id: str
    razorpay_order_id: str
    razorpay_key_id: str
    amount_paise: int
    currency: str


class VerifyPaymentIn(BaseModel):
    booking_id: str
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


class PaymentOut(BaseModel):
    id: str
    booking_id: str
    amount: float
    currency: str
    status: str
    created_at: datetime

    class Config:
        from_attributes = True
