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
from app.database.models import (
    User, Role, OtpCode, RefreshToken, CustomerProfile, WorkerProfile, City,
    PasswordResetToken, WorkerSkill, ServiceCategory,
)
from app.security.security import (
    generate_otp, hash_otp, verify_otp_hash,
    create_access_token, generate_refresh_token, hash_refresh_token,
    hash_password, verify_password, validate_password_strength,
    generate_reset_token, hash_reset_token,
)
from app.notifications.service import send_sms, send_email

# dummy hash so unknown-email and wrong-password take the same time (prevents enumeration)
_DUMMY_HASH_FOR_TIMING_SAFETY = "$2b$12$o/EnMVCB8Itbif91tObfsePBKoo/LsKz2sjzXXKFD0PeaEtqdKnJ."


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


def rotate_refresh_token(db: Session, raw_token: str) -> Tuple[User, str, str]:
    """Rotates refresh token and issues a new pair; branches secret for admin vs user."""
    token_hash = hash_refresh_token(raw_token)
    stored = db.query(RefreshToken).filter(RefreshToken.token_hash == token_hash).first()

    if not stored or stored.revoked_at is not None or stored.expires_at < datetime.utcnow():
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired refresh token")

    stored.revoked_at = datetime.utcnow()
    db.commit()

    user = db.query(User).filter(User.id == stored.user_id).first()
    if not user or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found or deactivated")

    # Use the admin-specific secret for ADMIN/SUPER_ADMIN so the refreshed
    # access token continues to pass get_current_admin()'s strict secret check.
    signing_secret = (
        settings.ADMIN_JWT_SECRET_KEY
        if user.role in (Role.ADMIN, Role.SUPER_ADMIN)
        else None
    )
    new_access = create_access_token(subject=user.id, role=user.role.value, secret=signing_secret)
    new_refresh = issue_refresh_token(db, user.id)
    return user, new_access, new_refresh


# ─────────────────────────────────────────────────────────────────
# EMAIL / PASSWORD AUTH — customer + worker registration & login
# ─────────────────────────────────────────────────────────────────

def _assert_email_and_phone_free(db: Session, email: str, phone: str) -> None:
    if db.query(User).filter(User.email == email.lower()).first():
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists")
    if db.query(User).filter(User.phone == phone).first():
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this phone number already exists")


def register_customer(
    db: Session, full_name: str, email: str, phone: str, password: str
) -> Tuple[User, str, str]:
    weakness = validate_password_strength(password)
    if weakness:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, weakness)

    email_norm = email.strip().lower()
    _assert_email_and_phone_free(db, email_norm, phone)

    user = User(
        email=email_norm,
        phone=phone,
        role=Role.CUSTOMER,
        password_hash=hash_password(password),
    )
    db.add(user)
    db.flush()

    db.add(CustomerProfile(user_id=user.id, full_name=full_name.strip(), email=email_norm))
    db.commit()
    db.refresh(user)

    send_email(
        email_norm,
        "Welcome to MaidKaro",
        f"Hi {full_name},\n\nYour MaidKaro customer account has been created successfully. "
        f"You can now log in with your email and password to book trusted home-service professionals.\n\n"
        f"— Team MaidKaro",
    )

    access_token = create_access_token(subject=user.id, role=user.role.value)
    refresh_token = issue_refresh_token(db, user.id)
    return user, access_token, refresh_token


def register_worker(
    db: Session, full_name: str, email: str, phone: str, password: str,
    city_id: str, years_experience: int = 0, languages: Optional[list] = None,
    category_ids: Optional[list] = None,
    skills: Optional[list] = None,
) -> Tuple[User, str, str]:
    weakness = validate_password_strength(password)
    if weakness:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, weakness)

    email_norm = email.strip().lower()
    _assert_email_and_phone_free(db, email_norm, phone)

    city = db.query(City).filter(City.id == city_id, City.is_active.is_(True)).first()
    if not city:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid or inactive city")

    user = User(
        email=email_norm,
        phone=phone,
        role=Role.WORKER,
        password_hash=hash_password(password),
    )
    db.add(user)
    db.flush()

    worker_profile = WorkerProfile(
        user_id=user.id,
        full_name=full_name.strip(),
        city_id=city.id,
        years_experience=years_experience,
        languages=languages or [],
    )
    db.add(worker_profile)
    db.flush()

    skills_map: dict[str, Optional[float]] = {}
    if skills:
        for s in skills:
            cat_id = s.category_id if hasattr(s, "category_id") else s.get("category_id")
            rate = s.hourly_rate if hasattr(s, "hourly_rate") else s.get("hourly_rate")
            if cat_id:
                skills_map[cat_id] = rate
    if category_ids:
        for cat_id in category_ids:
            if cat_id not in skills_map:
                skills_map[cat_id] = None

    for cat_id, rate in skills_map.items():
        cat = db.query(ServiceCategory).filter(ServiceCategory.id == cat_id).first()
        if cat:
            db.add(WorkerSkill(
                worker_id=worker_profile.id,
                category_id=cat.id,
                hourly_rate=rate if rate is not None else cat.base_hourly_rate
            ))

    db.commit()
    db.refresh(user)

    send_email(
        email_norm,
        "Welcome to MaidKaro — complete your verification",
        f"Hi {full_name},\n\nYour MaidKaro worker account has been created. Before you can start "
        f"receiving service requests, please complete your profile and submit your verification "
        f"documents from the worker dashboard.\n\n— Team MaidKaro",
    )

    access_token = create_access_token(subject=user.id, role=user.role.value)
    refresh_token = issue_refresh_token(db, user.id)
    return user, access_token, refresh_token


def login_with_password(db: Session, email: str, password: str, role: str) -> Tuple[User, str, str]:
    user = db.query(User).filter(User.email == email.strip().lower()).first()

    # Constant-shape response for unknown email vs wrong password — don't
    # leak account existence. verify_password against a dummy hash keeps
    # the timing profile similar to the real-user path.
    if not user or not user.password_hash:
        verify_password(password, _DUMMY_HASH_FOR_TIMING_SAFETY)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")

    if not verify_password(password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")

    if user.role.value != role:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")

    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This account has been deactivated. Contact support.")

    access_token = create_access_token(subject=user.id, role=user.role.value)
    refresh_token = issue_refresh_token(db, user.id)
    return user, access_token, refresh_token


def request_password_reset(db: Session, email: str, requested_ip: Optional[str] = None) -> Optional[str]:
    """Always returns success to the caller regardless of whether the email
    exists (prevents account enumeration). Returns the raw dev token only
    when EMAIL_PROVIDER=dev_logger, for local testing."""
    user = db.query(User).filter(User.email == email.strip().lower()).first()
    if not user:
        return None

    active_count = (
        db.query(PasswordResetToken)
        .filter(PasswordResetToken.user_id == user.id, PasswordResetToken.used_at.is_(None))
        .count()
    )
    if active_count >= settings.PASSWORD_RESET_MAX_ACTIVE_TOKENS:
        # Quietly no-op rather than erroring — an attacker shouldn't learn
        # anything from a difference in response.
        return None

    raw_token = generate_reset_token()
    db.add(PasswordResetToken(
        user_id=user.id,
        token_hash=hash_reset_token(raw_token),
        expires_at=datetime.utcnow() + timedelta(minutes=settings.PASSWORD_RESET_TOKEN_EXPIRE_MINUTES),
        requested_ip=requested_ip,
    ))
    db.commit()

    base_url = settings.WORKER_WEB_BASE_URL if user.role == Role.WORKER else settings.CUSTOMER_WEB_BASE_URL
    reset_link = f"{base_url}/reset-password?token={raw_token}"

    display_name = (
        (user.customer_profile.full_name if user.customer_profile else None)
        or (user.worker_profile.full_name if user.worker_profile else None)
        or "there"
    )
    send_email(
        user.email,
        "Reset your MaidKaro password",
        f"Hi {display_name},\n\nWe received a request to reset your MaidKaro password. "
        f"This link is valid for {settings.PASSWORD_RESET_TOKEN_EXPIRE_MINUTES} minutes:\n\n"
        f"{reset_link}\n\n"
        f"If you didn't request this, you can safely ignore this email — your password won't change.\n\n"
        f"— Team MaidKaro",
    )

    dev_token = raw_token if settings.EMAIL_PROVIDER == "dev_logger" else None
    return dev_token


def reset_password(db: Session, raw_token: str, new_password: str) -> None:
    weakness = validate_password_strength(new_password)
    if weakness:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, weakness)

    token_hash = hash_reset_token(raw_token)
    stored = db.query(PasswordResetToken).filter(PasswordResetToken.token_hash == token_hash).first()

    if not stored or stored.used_at is not None or stored.expires_at < datetime.utcnow():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This reset link is invalid or has expired. Request a new one.")

    user = db.query(User).filter(User.id == stored.user_id).first()
    if not user or not user.is_active:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This reset link is invalid or has expired. Request a new one.")

    user.password_hash = hash_password(new_password)
    stored.used_at = datetime.utcnow()

    # Invalidate every other still-active reset token for this user, and every
    # refresh token, so a stolen session can't survive a password reset.
    db.query(PasswordResetToken).filter(
        PasswordResetToken.user_id == user.id,
        PasswordResetToken.used_at.is_(None),
    ).update({"used_at": datetime.utcnow()})
    db.query(RefreshToken).filter(
        RefreshToken.user_id == user.id,
        RefreshToken.revoked_at.is_(None),
    ).update({"revoked_at": datetime.utcnow()})
    db.commit()

    display_name = (
        (user.customer_profile.full_name if user.customer_profile else None)
        or (user.worker_profile.full_name if user.worker_profile else None)
        or "there"
    )
    send_email(
        user.email,
        "Your MaidKaro password was changed",
        f"Hi {display_name},\n\nYour MaidKaro account password was just changed. "
        f"If this wasn't you, contact MaidKaro support immediately.\n\n— Team MaidKaro",
    )
