"""Local disk storage for KYC documents and photos; swap for S3/GCS in prod."""
import os
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status

from app.database.models import User
from app.security.deps import get_current_user
from app.config import settings

router = APIRouter(prefix="/uploads", tags=["File Uploads"])

ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp", "application/pdf"}
MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB

UPLOAD_DIR = Path(settings.UPLOAD_DIR)
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


@router.post("", status_code=status.HTTP_201_CREATED)
async def upload_file(file: UploadFile = File(...), user: User = Depends(get_current_user)):
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Unsupported file type: {file.content_type}")

    contents = await file.read()
    if len(contents) > MAX_UPLOAD_BYTES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "File too large (max 10 MB)")

    ext = Path(file.filename or "").suffix or {
        "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "application/pdf": ".pdf",
    }.get(file.content_type, "")
    # Isolated user folder with randomized UUID filename
    user_dir = UPLOAD_DIR / user.id
    user_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{uuid.uuid4().hex}{ext}"
    dest = user_dir / filename
    with open(dest, "wb") as f:
        f.write(contents)

    file_url = f"{settings.UPLOAD_URL_PREFIX}/{user.id}/{filename}"
    return {"file_url": file_url, "content_type": file.content_type, "size_bytes": len(contents)}
