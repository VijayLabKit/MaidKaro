from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, field_validator
import re

PHONE_RE = re.compile(r"^\+91[6-9]\d{9}$")


class RequestOtpIn(BaseModel):
    phone: str = Field(..., examples=["+919812345678"])
    purpose: str = Field("LOGIN", pattern="^(LOGIN|SIGNUP)$")

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        if not PHONE_RE.match(v):
            raise ValueError("Phone must be a valid Indian E.164 number, e.g. +919812345678")
        return v


class RequestOtpOut(BaseModel):
    message: str
    expires_in_seconds: int
    # Only populated when SMS_PROVIDER=dev_logger, for local testing.
    dev_otp: Optional[str] = None


class VerifyOtpIn(BaseModel):
    phone: str
    code: str = Field(..., min_length=4, max_length=6)
    role: str = Field("CUSTOMER", pattern="^(CUSTOMER|WORKER)$")
    full_name: Optional[str] = None  # required on first-time signup


class TokenPairOut(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    role: str
    user_id: str
    is_new_user: bool = False


class RefreshTokenIn(BaseModel):
    refresh_token: str


class AdminLoginIn(BaseModel):
    email: str
    password: str


class AdminTokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    full_name: str
    email: str
