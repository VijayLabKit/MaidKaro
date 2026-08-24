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
    full_name: Optional[str] = None  # optional on first-time signup
    email: Optional[str] = None      # optional email for invoices & receipts


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
    refresh_token: str
    token_type: str = "bearer"
    full_name: str
    email: str
    role: str
    staff_role: str


# ── Email/password auth (customer + worker) ─────────────────────────

class RegisterCustomerIn(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=120)
    email: str
    phone: str = Field(..., examples=["+919812345678"])
    password: str = Field(..., min_length=8)
    confirm_password: str = Field(..., min_length=8)

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        if not PHONE_RE.match(v):
            raise ValueError("Phone must be a valid Indian E.164 number, e.g. +919812345678")
        return v

    @field_validator("confirm_password")
    @classmethod
    def passwords_match(cls, v: str, info) -> str:
        if "password" in info.data and v != info.data["password"]:
            raise ValueError("Passwords do not match")
        return v


class RegisterWorkerSkillIn(BaseModel):
    category_id: str
    hourly_rate: Optional[float] = None


class RegisterWorkerIn(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=120)
    email: str
    phone: str = Field(..., examples=["+919812345678"])
    password: str = Field(..., min_length=8)
    confirm_password: str = Field(..., min_length=8)
    city_id: str
    years_experience: int = Field(0, ge=0, le=60)
    languages: list[str] = Field(default_factory=list)
    category_ids: list[str] = Field(default_factory=list)
    skills: list[RegisterWorkerSkillIn] = Field(default_factory=list)
    bio: Optional[str] = None

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        if not PHONE_RE.match(v):
            raise ValueError("Phone must be a valid Indian E.164 number, e.g. +919812345678")
        return v

    @field_validator("confirm_password")
    @classmethod
    def passwords_match(cls, v: str, info) -> str:
        if "password" in info.data and v != info.data["password"]:
            raise ValueError("Passwords do not match")
        return v


class LoginIn(BaseModel):
    email: str
    password: str
    role: str = Field(..., pattern="^(CUSTOMER|WORKER)$")


class ForgotPasswordIn(BaseModel):
    email: str


class ForgotPasswordOut(BaseModel):
    message: str
    # Only populated when EMAIL_PROVIDER=dev_logger, for local testing without an SMTP account.
    dev_reset_token: Optional[str] = None


class ResetPasswordIn(BaseModel):
    token: str
    new_password: str = Field(..., min_length=8)
    confirm_password: str = Field(..., min_length=8)

    @field_validator("confirm_password")
    @classmethod
    def passwords_match(cls, v: str, info) -> str:
        if "new_password" in info.data and v != info.data["new_password"]:
            raise ValueError("Passwords do not match")
        return v


class ResetPasswordOut(BaseModel):
    message: str


class MessageOut(BaseModel):
    message: str
