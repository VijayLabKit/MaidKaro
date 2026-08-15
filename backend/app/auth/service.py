"""
Auth business logic: OTP request/verify, refresh-token rotation,
admin email/password login. Kept free of FastAPI request/response
concerns so it's independently unit-testable.
"""
from datetime import datetime, timedelta
from typing import Optional, Tuple

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.config import settings
from app.database.models import User, Role, OtpCode, RefreshToken, CustomerProfile, WorkerProfile, City
from app.security.security import (
    generate_otp, hash_otp, verify_otp_hash,
    create_access_token, generate_refresh_token, hash_refresh_token,
)
from app.notifications.service import send_sms


def request_otp(db: Session, phone: str, purpose: str) -> Tuple[str, int]:
    code = generate_otp()
    expires_at = datetime.utcnow() + timedelta(seconds=settings.OTP_EXPIRY_SECONDS)

    otp = OtpCode(
        user_phone=phone,
        code_hash=hash_otp(code),
        purpose=purpose,
        expires_at=expires_at,
    )
    db.add(otp)
    db.commit()

    send_sms(
        phone,
        f"{code} is your MaidKaro verification code. Valid for "
        f"{settings.OTP_EXPIRY_SECONDS // 60} minutes. Never share this code.",
    )

    dev_otp = code if settings.SMS_PROVIDER == "dev_logger" else None
    return dev_otp, settings.OTP_EXPIRY_SECONDS


def verify_otp_and_login(
    db: Session, phone: str, code: str, role: str, full_name: Optional[str] = None, email: Optional[str] = None
) -> Tuple[User, str, str, bool]:
    otp = (
        db.query(OtpCode)
        .filter(OtpCode.user_phone == phone, OtpCode.consumed_at.is_(None))
        .order_by(OtpCode.created_at.desc())
        .first()
    )
    if not otp:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No active OTP for this number. Request a new one.")
    if otp.expires_at < datetime.utcnow():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "OTP expired. Request a new one.")
    if otp.attempts >= settings.OTP_MAX_ATTEMPTS:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Too many incorrect attempts. Request a new OTP.")

    if not verify_otp_hash(code, otp.code_hash):
        otp.attempts += 1
        db.commit()
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Incorrect OTP")

    otp.consumed_at = datetime.utcnow()
    db.commit()

    user = db.query(User).filter(User.phone == phone).first()
    is_new_user = False

    if not user:
        is_new_user = True
        user = User(phone=phone, role=Role(role))
        db.add(user)
        db.flush()  # get user.id before creating the profile

        if role == "CUSTOMER":
            db.add(CustomerProfile(
                user_id=user.id,
                full_name=full_name or "MaidKaro Customer",
                email=email
            ))
        elif role == "WORKER":
            default_city = db.query(City).filter(City.is_active.is_(True)).first()
            if not default_city:
                raise HTTPException(status.HTTP_400_BAD_REQUEST, "No active city configured for worker signup")
            db.add(WorkerProfile(
                user_id=user.id,
                full_name=full_name or "MaidKaro Worker",
                city_id=default_city.id
            ))
        db.commit()
        db.refresh(user)
    elif not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This account has been deactivated. Contact support.")
    else:
        # If existing customer and email/name provided, update their profile
        if role == "CUSTOMER" and user.customer_profile:
            updated = False
            if email and not user.customer_profile.email:
                user.customer_profile.email = email
                updated = True
            if full_name and user.customer_profile.full_name == "MaidKaro Customer":
                user.customer_profile.full_name = full_name
                updated = True
            if updated:
                db.commit()
                db.refresh(user)

    access_token = create_access_token(subject=user.id, role=user.role.value)
    refresh_token = issue_refresh_token(db, user.id)
    return user, access_token, refresh_token, is_new_user


def issue_refresh_token(db: Session, user_id: str) -> str:
    raw_token = generate_refresh_token()
    db.add(RefreshToken(
        user_id=user_id,
        token_hash=hash_refresh_token(raw_token),
        expires_at=datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    ))
    db.commit()
    return raw_token


def rotate_refresh_token(db: Session, raw_token: str) -> Tuple[str, str]:
    """Verifies + revokes the presented refresh token and issues a new
    pair. Rotation on every use means a stolen-and-replayed token is
    immediately detectable (the legitimate client's next refresh will
    fail because the token was already revoked)."""
    token_hash = hash_refresh_token(raw_token)
    stored = db.query(RefreshToken).filter(RefreshToken.token_hash == token_hash).first()

    if not stored or stored.revoked_at is not None or stored.expires_at < datetime.utcnow():
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired refresh token")

    stored.revoked_at = datetime.utcnow()
    db.commit()

    user = db.query(User).filter(User.id == stored.user_id).first()
    if not user or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found or deactivated")

    new_access = create_access_token(subject=user.id, role=user.role.value)
    new_refresh = issue_refresh_token(db, user.id)
    return new_access, new_refresh
