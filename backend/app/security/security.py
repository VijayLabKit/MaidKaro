"""
JWT issuing/verification, password hashing, and OTP hashing.
Access tokens are short-lived; refresh tokens are opaque random strings
whose hash is stored server-side so they can be revoked (rotation-safe).
"""
import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from jose import jwt, JWTError
from passlib.context import CryptContext

from app.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ── Password hashing (admin email/password login) ──────────────────
def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


# ── OTP hashing (never store raw OTP codes) ─────────────────────────
def generate_otp(length: int = 6) -> str:
    return "".join(secrets.choice("0123456789") for _ in range(length))


def hash_otp(code: str) -> str:
    # OTPs are short-lived + rate-limited, so a fast keyed hash is
    # appropriate (bcrypt is unnecessarily slow for a 6-digit space
    # already protected by expiry + attempt limits).
    return hashlib.sha256(f"{code}:{settings.JWT_SECRET_KEY}".encode()).hexdigest()


def verify_otp_hash(code: str, code_hash: str) -> bool:
    return secrets.compare_digest(hash_otp(code), code_hash)


# ── JWT access tokens ────────────────────────────────────────────────
def create_access_token(subject: str, role: str, secret: Optional[str] = None,
                         expires_minutes: Optional[int] = None) -> str:
    secret_key = secret or settings.JWT_SECRET_KEY
    expire_minutes = expires_minutes or settings.ACCESS_TOKEN_EXPIRE_MINUTES
    now = datetime.now(timezone.utc)
    payload = {
        "sub": subject,
        "role": role,
        "iat": now,
        "exp": now + timedelta(minutes=expire_minutes),
        "type": "access",
    }
    return jwt.encode(payload, secret_key, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str, secret: Optional[str] = None) -> Optional[dict]:
    secret_key = secret or settings.JWT_SECRET_KEY
    try:
        return jwt.decode(token, secret_key, algorithms=[settings.JWT_ALGORITHM])
    except JWTError:
        return None


# ── Refresh tokens (opaque, hashed at rest) ─────────────────────────
def generate_refresh_token() -> str:
    return secrets.token_urlsafe(48)


def hash_refresh_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()
