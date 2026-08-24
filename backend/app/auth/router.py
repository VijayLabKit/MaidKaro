from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.database.models import AdminProfile, User
from app.security.security import verify_password, create_access_token
from app.config import settings
from app.auth.schemas import (
    RequestOtpIn, RequestOtpOut, VerifyOtpIn, TokenPairOut, RefreshTokenIn,
    AdminLoginIn, AdminTokenOut,
    RegisterCustomerIn, RegisterWorkerIn, LoginIn,
    ForgotPasswordIn, ForgotPasswordOut, ResetPasswordIn, ResetPasswordOut,
)
from app.auth import service

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register/customer", response_model=TokenPairOut, status_code=status.HTTP_201_CREATED)
def register_customer(payload: RegisterCustomerIn, db: Session = Depends(get_db)):
    user, access, refresh = service.register_customer(
        db, payload.full_name, payload.email, payload.phone, payload.password
    )
    return TokenPairOut(
        access_token=access, refresh_token=refresh,
        role=user.role.value, user_id=user.id, is_new_user=True,
    )


@router.post("/register/worker", response_model=TokenPairOut, status_code=status.HTTP_201_CREATED)
def register_worker(payload: RegisterWorkerIn, db: Session = Depends(get_db)):
    user, access, refresh = service.register_worker(
        db, payload.full_name, payload.email, payload.phone, payload.password,
        payload.city_id, payload.years_experience, payload.languages,
        payload.category_ids, payload.skills,
    )
    return TokenPairOut(
        access_token=access, refresh_token=refresh,
        role=user.role.value, user_id=user.id, is_new_user=True,
    )


@router.post("/login", response_model=TokenPairOut)
def login(payload: LoginIn, db: Session = Depends(get_db)):
    user, access, refresh = service.login_with_password(db, payload.email, payload.password, payload.role)
    return TokenPairOut(
        access_token=access, refresh_token=refresh,
        role=user.role.value, user_id=user.id, is_new_user=False,
    )


@router.post("/forgot-password", response_model=ForgotPasswordOut)
def forgot_password(payload: ForgotPasswordIn, request: Request, db: Session = Depends(get_db)):
    dev_token = service.request_password_reset(db, payload.email, requested_ip=request.client.host if request.client else None)
    return ForgotPasswordOut(
        message="If an account exists for this email, a password reset link has been sent.",
        dev_reset_token=dev_token,
    )


@router.post("/reset-password", response_model=ResetPasswordOut)
def reset_password(payload: ResetPasswordIn, db: Session = Depends(get_db)):
    service.reset_password(db, payload.token, payload.new_password)
    return ResetPasswordOut(message="Password reset successful. You can now log in with your new password.")


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
    user, new_access, new_refresh = service.rotate_refresh_token(db, payload.refresh_token)
    return TokenPairOut(
        access_token=new_access, refresh_token=new_refresh,
        role=user.role.value, user_id=user.id,
    )


@router.post("/admin/login", response_model=AdminTokenOut)
def admin_login(payload: AdminLoginIn, db: Session = Depends(get_db)):
    admin = db.query(AdminProfile).filter(AdminProfile.email == payload.email.strip().lower()).first()
    if not admin or not verify_password(payload.password, admin.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")

    user = db.query(User).filter(User.id == admin.user_id).first()
    if not user or not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Admin account deactivated")

    from datetime import datetime
    admin.last_login_at = datetime.utcnow()
    db.commit()

    token = create_access_token(
        subject=user.id, role=user.role.value,
        secret=settings.ADMIN_JWT_SECRET_KEY,
    )
    refresh = service.issue_refresh_token(db, user.id)
    return AdminTokenOut(
        access_token=token, refresh_token=refresh,
        full_name=admin.full_name, email=admin.email, role=user.role.value,
        staff_role=admin.staff_role.value,
    )
