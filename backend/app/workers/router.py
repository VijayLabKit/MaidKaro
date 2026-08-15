from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.database.models import (
    User, Role, WorkerProfile, WorkerSkill, KycDocument, AvailabilitySlot,
    VerificationStatus, ServiceCategory, WeekDay,
)
from app.security.deps import require_roles, get_current_user
from app.workers.schemas import (
    WorkerProfileOut, UpdateWorkerProfileIn, SetAvailabilityNowIn,
    SkillIn, SkillOut, AvailabilitySlotIn, AvailabilitySlotOut,
    KycUploadIn, KycDocumentOut, LiveLocationIn, WorkerPublicOut, WorkerSkillPublicOut,
)

router = APIRouter(prefix="/workers", tags=["Workers"])


def _worker_public_out(worker: WorkerProfile) -> WorkerPublicOut:
    return WorkerPublicOut(
        id=worker.id, full_name=worker.full_name, photo_url=worker.photo_url,
        bio=worker.bio, languages=worker.languages or [], years_experience=worker.years_experience,
        verification_status=worker.verification_status.value, rating_avg=worker.rating_avg,
        rating_count=worker.rating_count, is_available_now=worker.is_available_now,
        city=worker.city.name if worker.city else None,
        skills=[
            WorkerSkillPublicOut(
                category_id=s.category_id, category_slug=s.category.slug,
                category_name=s.category.name,
                hourly_rate=float(s.hourly_rate if s.hourly_rate is not None else s.category.base_hourly_rate),
            )
            for s in worker.skills
        ],
    )


def _get_worker_profile(db: Session, user: User) -> WorkerProfile:
    profile = db.query(WorkerProfile).filter(WorkerProfile.user_id == user.id).first()
    if not profile:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Worker profile not found")
    return profile


@router.get("/me", response_model=WorkerProfileOut)
def get_my_worker_profile(user: User = Depends(require_roles(Role.WORKER)), db: Session = Depends(get_db)):
    p = _get_worker_profile(db, user)
    return WorkerProfileOut(
        id=p.id, full_name=p.full_name, photo_url=p.photo_url, bio=p.bio, city_id=p.city_id,
        languages=p.languages or [], years_experience=p.years_experience,
        verification_status=p.verification_status.value, rating_avg=p.rating_avg,
        rating_count=p.rating_count, is_available_now=p.is_available_now, phone=user.phone,
    )


@router.patch("/me", response_model=WorkerProfileOut)
def update_my_worker_profile(
    payload: UpdateWorkerProfileIn,
    user: User = Depends(require_roles(Role.WORKER)),
    db: Session = Depends(get_db),
):
    p = _get_worker_profile(db, user)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(p, field, value)
    db.commit()
    db.refresh(p)
    return WorkerProfileOut(
        id=p.id, full_name=p.full_name, photo_url=p.photo_url, bio=p.bio, city_id=p.city_id,
        languages=p.languages or [], years_experience=p.years_experience,
        verification_status=p.verification_status.value, rating_avg=p.rating_avg,
        rating_count=p.rating_count, is_available_now=p.is_available_now, phone=user.phone,
    )


@router.post("/me/availability-now")
def set_availability_now(
    payload: SetAvailabilityNowIn,
    user: User = Depends(require_roles(Role.WORKER)),
    db: Session = Depends(get_db),
):
    p = _get_worker_profile(db, user)
    if payload.is_available_now and p.verification_status != VerificationStatus.APPROVED:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You must complete KYC verification before going live")
    p.is_available_now = payload.is_available_now
    db.commit()
    return {"is_available_now": p.is_available_now}


@router.post("/me/location")
def update_live_location(
    payload: LiveLocationIn,
    user: User = Depends(require_roles(Role.WORKER)),
    db: Session = Depends(get_db),
):
    """Worker app pings this every ~15s while a booking is IN_PROGRESS so
    the customer can see live tracking (Rapido-style) and, if an SOS
    fires, responders have a last-known location."""
    p = _get_worker_profile(db, user)
    p.last_lat, p.last_lng, p.last_location_at = payload.lat, payload.lng, datetime.utcnow()
    db.commit()
    return {"ok": True}


# ── Skills ────────────────────────────────────────────────────────
@router.put("/me/skills", response_model=List[SkillOut])
def set_my_skills(payload: List[SkillIn], user: User = Depends(require_roles(Role.WORKER)), db: Session = Depends(get_db)):
    p = _get_worker_profile(db, user)
    valid_ids = {c.id for c in db.query(ServiceCategory.id).filter(
        ServiceCategory.id.in_([s.category_id for s in payload])).all()}
    if len(valid_ids) != len({s.category_id for s in payload}):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "One or more service categories are invalid")

    db.query(WorkerSkill).filter(WorkerSkill.worker_id == p.id).delete()
    new_skills = [WorkerSkill(worker_id=p.id, category_id=s.category_id, hourly_rate=s.hourly_rate) for s in payload]
    db.add_all(new_skills)
    db.commit()
    return db.query(WorkerSkill).filter(WorkerSkill.worker_id == p.id).all()


# ── Availability schedule ────────────────────────────────────────
@router.put("/me/availability-slots", response_model=List[AvailabilitySlotOut])
def set_availability_slots(
    payload: List[AvailabilitySlotIn],
    user: User = Depends(require_roles(Role.WORKER)),
    db: Session = Depends(get_db),
):
    p = _get_worker_profile(db, user)
    db.query(AvailabilitySlot).filter(AvailabilitySlot.worker_id == p.id).delete()
    slots = [AvailabilitySlot(worker_id=p.id, day=WeekDay(s.day), start_time=s.start_time, end_time=s.end_time) for s in payload]
    db.add_all(slots)
    db.commit()
    return db.query(AvailabilitySlot).filter(AvailabilitySlot.worker_id == p.id).all()


# ── KYC ───────────────────────────────────────────────────────────
@router.post("/me/kyc-documents", response_model=KycDocumentOut, status_code=status.HTTP_201_CREATED)
def upload_kyc_document(payload: KycUploadIn, user: User = Depends(require_roles(Role.WORKER)), db: Session = Depends(get_db)):
    p = _get_worker_profile(db, user)
    doc = KycDocument(worker_id=p.id, type=payload.type, file_url=payload.file_url)
    db.add(doc)
    if p.verification_status == VerificationStatus.NOT_SUBMITTED:
        p.verification_status = VerificationStatus.PENDING_REVIEW
    db.commit()
    db.refresh(doc)
    return doc


@router.get("/me/kyc-documents", response_model=List[KycDocumentOut])
def list_kyc_documents(user: User = Depends(require_roles(Role.WORKER)), db: Session = Depends(get_db)):
    p = _get_worker_profile(db, user)
    return p.documents


# ── Customer-facing discovery (no PII exposed) ──────────────────────
@router.get("", response_model=List[WorkerPublicOut])
def discover_workers(
    category_id: Optional[str] = Query(None),
    city_id: Optional[str] = Query(None),
    available_now: bool = Query(False),
    db: Session = Depends(get_db),
):
    q = db.query(WorkerProfile).filter(WorkerProfile.verification_status == VerificationStatus.APPROVED)
    if city_id:
        q = q.filter(WorkerProfile.city_id == city_id)
    if available_now:
        q = q.filter(WorkerProfile.is_available_now.is_(True))
    if category_id:
        q = q.join(WorkerSkill).filter(WorkerSkill.category_id == category_id)
    return [_worker_public_out(w) for w in q.order_by(WorkerProfile.rating_avg.desc()).limit(50).all()]


@router.get("/{worker_id}", response_model=WorkerPublicOut)
def get_worker_public_profile(worker_id: str, db: Session = Depends(get_db)):
    worker = db.query(WorkerProfile).filter(
        WorkerProfile.id == worker_id, WorkerProfile.verification_status == VerificationStatus.APPROVED,
    ).first()
    if not worker:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Worker not found")
    return _worker_public_out(worker)
