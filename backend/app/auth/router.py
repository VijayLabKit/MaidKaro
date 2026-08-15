from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.database.models import AdminProfile, User
from app.security.security import verify_password, create_access_token
from app.config import settings
from app.auth.schemas import (
    RequestOtpIn, RequestOtpOut, VerifyOtpIn, TokenPairOut, RefreshTokenIn,
    AdminLoginIn, AdminTokenOut,
)
from app.auth import service

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/otp/request", response_model=RequestOtpOut)
def request_otp(payload: RequestOtpIn, db: Session = Depends(get_db)):
    dev_otp, expires_in = service.request_otp(db, payload.phone, payload.purpose)
    return RequestOtpOut(
        message="OTP sent" if not dev_otp else "OTP generated (dev mode — see dev_otp field)",
        expires_in_seconds=expires_in,
        dev_otp=dev_otp,
    )


@router.post("/otp/verify", response_model=TokenPairOut)
def verify_otp(payload: VerifyOtpIn, db: Session = Depends(get_db)):
    user, access, refresh, is_new = service.verify_otp_and_login(
        db, payload.phone, payload.code, payload.role, payload.full_name, payload.email
    )
    return TokenPairOut(
        access_token=access, refresh_token=refresh,
        role=user.role.value, user_id=user.id, is_new_user=is_new,
    )


@router.post("/refresh", response_model=TokenPairOut)
def refresh_token(payload: RefreshTokenIn, db: Session = Depends(get_db)):
    new_access, new_refresh = service.rotate_refresh_token(db, payload.refresh_token)
    # sub is embedded in the access token; decode lightly for role/user_id in response
    from app.security.security import decode_access_token
    claims = decode_access_token(new_access)
    return TokenPairOut(
        access_token=new_access, refresh_token=new_refresh,
        role=claims["role"], user_id=claims["sub"],
    )


@router.post("/admin/login", response_model=AdminTokenOut)
def admin_login(payload: AdminLoginIn, db: Session = Depends(get_db)):
    admin = db.query(AdminProfile).filter(AdminProfile.email == payload.email).first()
    if not admin or not verify_password(payload.password, admin.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")

    user = db.query(User).filter(User.id == admin.user_id).first()
    if not user or not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Admin account deactivated")

    token = create_access_token(
        subject=user.id, role=user.role.value,
        secret=settings.ADMIN_JWT_SECRET_KEY,
    )
    return AdminTokenOut(access_token=token, full_name=admin.full_name, email=admin.email)
