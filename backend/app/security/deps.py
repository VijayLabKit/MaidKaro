"""
FastAPI dependencies for pulling the authenticated user (and enforcing
role) out of the Authorization header on every protected route.
"""
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.database import get_db
from app.database.models import User, Role
from app.security.security import decode_access_token
from app.config import settings

bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing bearer token")

    payload = decode_access_token(credentials.credentials)
    if not payload or payload.get("type") != "access":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token")

    user = db.query(User).filter(User.id == payload["sub"]).first()
    if not user or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found or deactivated")
    return user


def require_roles(*roles: Role):
    def _checker(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Insufficient permissions")
        return user
    return _checker


def get_current_admin(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    """Admin tokens are signed with ADMIN_JWT_SECRET_KEY to prevent token replay."""
    if credentials is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing bearer token")

    payload = decode_access_token(credentials.credentials, secret=settings.ADMIN_JWT_SECRET_KEY)
    if not payload or payload.get("type") != "access":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired admin token")

    user = db.query(User).filter(User.id == payload["sub"]).first()
    if not user or user.role not in (Role.ADMIN, Role.SUPER_ADMIN) or not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not an admin account")
    return user


def require_staff_permission(capability: str):
    """RBAC guard for admin console endpoints based on AdminProfile.staff_role."""
    from app.database.models import AdminProfile, StaffRole, STAFF_PERMISSIONS

    def _checker(admin: User = Depends(get_current_admin), db: Session = Depends(get_db)) -> User:
        profile = db.query(AdminProfile).filter(AdminProfile.user_id == admin.id).first()
        if not profile:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "No staff profile associated with this account")
        if profile.staff_role == StaffRole.SUPER_ADMIN:
            return admin
        allowed = STAFF_PERMISSIONS.get(capability, ())
        if profile.staff_role not in allowed:
            raise HTTPException(status.HTTP_403_FORBIDDEN, f"Your role ({profile.staff_role.value}) doesn't have '{capability}' access")
        return admin
    return _checker
