from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.database.models import (
    User, Role, WorkerProfile, WorkerSkill, KycDocument, AvailabilitySlot,
    VerificationStatus, ServiceCategory, WeekDay, Booking, BookingStatus,
    PayoutLedgerEntry, Payout, PayoutStatus,
)
from app.security.deps import require_roles, get_current_user
from app.workers.schemas import (
    WorkerProfileOut, UpdateWorkerProfileIn, SetAvailabilityNowIn,
    SkillIn, SkillOut, AvailabilitySlotIn, AvailabilitySlotOut,
    KycUploadIn, KycDocumentOut, LiveLocationIn, WorkerPublicOut, WorkerSkillPublicOut,
    WorkerKycProfileIn, WorkerKycProfileOut, WorkerDashboardOverviewOut,
    WorkerBookingListItemOut, WorkerCalendarDayOut, WorkerEarningsLedgerEntryOut,
    WorkerEarningsSummaryOut, WorkerPayoutRequestOut, RequestPayoutIn,
)
from app.notifications.service import send_push

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
    """Registered -> Documents Submitted. Uploading a document alone does
    NOT move the worker into the review queue — that's a separate, explicit
    step (POST /me/kyc-profile/submit) once all required docs + personal
    info are on file, matching the spec's distinct 'documents submitted'
    vs 'verification pending' stages."""
    p = _get_worker_profile(db, user)
    if p.verification_status not in (VerificationStatus.NOT_SUBMITTED, VerificationStatus.NEEDS_RESUBMISSION, VerificationStatus.REJECTED):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Documents can only be uploaded before or during resubmission")
    existing_doc = db.query(KycDocument).filter(KycDocument.worker_id == p.id, KycDocument.type == payload.type).first()
    if existing_doc:
        existing_doc.file_url = payload.file_url
        existing_doc.status = VerificationStatus.PENDING_REVIEW
        existing_doc.reject_reason = None
        doc = existing_doc
    else:
        doc = KycDocument(worker_id=p.id, type=payload.type, file_url=payload.file_url)
        db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc


@router.get("/me/kyc-documents", response_model=List[KycDocumentOut])
def list_kyc_documents(user: User = Depends(require_roles(Role.WORKER)), db: Session = Depends(get_db)):
    p = _get_worker_profile(db, user)
    return p.documents


# ── KYC: personal + professional profile & submission ───────────────
REQUIRED_KYC_DOC_TYPES = {"GOVERNMENT_ID", "ADDRESS_PROOF"}


@router.get("/me/kyc-profile", response_model=WorkerKycProfileOut)
def get_my_kyc_profile(user: User = Depends(require_roles(Role.WORKER)), db: Session = Depends(get_db)):
    p = _get_worker_profile(db, user)
    return WorkerKycProfileOut(
        guardian_name=p.guardian_name, date_of_birth=p.date_of_birth, gender=p.gender,
        address_line=p.address_line, kyc_city=p.kyc_city, kyc_state=p.kyc_state, kyc_pincode=p.kyc_pincode,
        qualification=p.qualification, previous_experience=p.previous_experience,
        verification_status=p.verification_status.value, verification_note=p.verification_note,
        kyc_submitted_at=p.kyc_submitted_at, documents=p.documents,
    )


@router.put("/me/kyc-profile", response_model=WorkerKycProfileOut)
def update_my_kyc_profile(
    payload: WorkerKycProfileIn, user: User = Depends(require_roles(Role.WORKER)), db: Session = Depends(get_db),
):
    p = _get_worker_profile(db, user)
    if p.verification_status in (VerificationStatus.PENDING_REVIEW, VerificationStatus.APPROVED):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Your profile is already submitted or approved and can't be edited. Contact support for changes.")

    for field, value in payload.model_dump().items():
        setattr(p, field, value)
    db.commit()
    db.refresh(p)
    return WorkerKycProfileOut(
        guardian_name=p.guardian_name, date_of_birth=p.date_of_birth, gender=p.gender,
        address_line=p.address_line, kyc_city=p.kyc_city, kyc_state=p.kyc_state, kyc_pincode=p.kyc_pincode,
        qualification=p.qualification, previous_experience=p.previous_experience,
        verification_status=p.verification_status.value, verification_note=p.verification_note,
        kyc_submitted_at=p.kyc_submitted_at, documents=p.documents,
    )


@router.post("/me/kyc-profile/submit", response_model=WorkerKycProfileOut)
def submit_kyc_for_review(user: User = Depends(require_roles(Role.WORKER)), db: Session = Depends(get_db)):
    p = _get_worker_profile(db, user)
    if p.verification_status not in (VerificationStatus.NOT_SUBMITTED, VerificationStatus.NEEDS_RESUBMISSION, VerificationStatus.REJECTED):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Cannot submit for review from status {p.verification_status.value}")

    missing_fields = [f for f in ("address_line", "kyc_city", "kyc_state", "kyc_pincode") if not getattr(p, f)]
    if missing_fields:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Complete your profile before submitting: missing {', '.join(missing_fields)}")

    submitted_doc_types = {d.type.value for d in p.documents}
    missing_docs = REQUIRED_KYC_DOC_TYPES - submitted_doc_types
    if missing_docs:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Upload required documents before submitting: {', '.join(sorted(missing_docs))}")

    p.verification_status = VerificationStatus.PENDING_REVIEW
    p.verification_note = None
    p.kyc_submitted_at = datetime.utcnow()
    for doc in p.documents:
        doc.status = VerificationStatus.PENDING_REVIEW
        doc.reject_reason = None
    db.commit()
    db.refresh(p)

    send_push(db, user.id, "Verification submitted",
              "Your documents are now under review by the MaidKaro verification team.")

    return WorkerKycProfileOut(
        guardian_name=p.guardian_name, date_of_birth=p.date_of_birth, gender=p.gender,
        address_line=p.address_line, kyc_city=p.kyc_city, kyc_state=p.kyc_state, kyc_pincode=p.kyc_pincode,
        qualification=p.qualification, previous_experience=p.previous_experience,
        verification_status=p.verification_status.value, verification_note=p.verification_note,
        kyc_submitted_at=p.kyc_submitted_at, documents=p.documents,
    )


# ── Worker dashboard: overview ───────────────────────────────────────
@router.get("/me/dashboard", response_model=WorkerDashboardOverviewOut)
def get_worker_dashboard(user: User = Depends(require_roles(Role.WORKER)), db: Session = Depends(get_db)):
    p = _get_worker_profile(db, user)

    completed_jobs = db.query(Booking).filter(Booking.worker_id == p.id, Booking.status == BookingStatus.COMPLETED).count()
    upcoming = db.query(Booking).filter(
        Booking.worker_id == p.id, Booking.status.in_([BookingStatus.CONFIRMED, BookingStatus.IN_PROGRESS]),
    ).count()
    cancelled_or_rejected = db.query(Booking).filter(
        Booking.worker_id == p.id, Booking.status.in_([BookingStatus.CANCELLED, BookingStatus.REJECTED]),
    ).count()

    entries = db.query(PayoutLedgerEntry).filter(PayoutLedgerEntry.worker_id == p.id).all()
    lifetime = sum(float(e.net_amount) for e in entries)
    pending = sum(float(e.net_amount) for e in entries if not e.is_paid_out)
    paid = lifetime - pending

    return WorkerDashboardOverviewOut(
        full_name=p.full_name, verification_status=p.verification_status.value,
        rating_avg=p.rating_avg, rating_count=p.rating_count,
        completed_jobs=completed_jobs, upcoming_bookings=upcoming, cancelled_or_rejected=cancelled_or_rejected,
        total_lifetime_earnings=round(lifetime, 2), pending_earnings=round(pending, 2),
        available_balance=round(pending, 2), paid_out_total=round(paid, 2),
    )


def _booking_list_item(b: Booking) -> WorkerBookingListItemOut:
    addr = b.address
    addr_text = f"{addr.line1}, {addr.line2}" if addr and addr.line2 else (addr.line1 if addr else None)
    return WorkerBookingListItemOut(
        id=b.id, status=b.status.value, category_name=b.category.name if b.category else None,
        customer_first_name=(b.customer.full_name.split()[0] if b.customer and b.customer.full_name else None),
        scheduled_for=b.scheduled_for, duration_hours=float(b.duration_hours), price_quoted=float(b.price_quoted),
        service_address_text=addr_text, created_at=b.created_at,
    )


# ── Worker calendar ───────────────────────────────────────────────
@router.get("/me/calendar", response_model=List[WorkerCalendarDayOut])
def get_worker_calendar(
    start: str = Query(..., description="YYYY-MM-DD, inclusive"),
    end: str = Query(..., description="YYYY-MM-DD, inclusive"),
    user: User = Depends(require_roles(Role.WORKER)), db: Session = Depends(get_db),
):
    """Dynamically populated from real booking records — scheduled bookings
    are grouped by their scheduled_for date; instant bookings with no
    scheduled_for are grouped by created_at date instead so nothing that
    happened is left off the calendar."""
    try:
        start_dt = datetime.strptime(start, "%Y-%m-%d")
        end_dt = datetime.strptime(end, "%Y-%m-%d").replace(hour=23, minute=59, second=59)
    except ValueError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "start/end must be YYYY-MM-DD")
    if end_dt < start_dt:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "end must not be before start")

    p = _get_worker_profile(db, user)
    bookings = db.query(Booking).filter(
        Booking.worker_id == p.id,
        Booking.status != BookingStatus.PENDING,
        ((Booking.scheduled_for.isnot(None)) & (Booking.scheduled_for >= start_dt) & (Booking.scheduled_for <= end_dt))
        | ((Booking.scheduled_for.is_(None)) & (Booking.created_at >= start_dt) & (Booking.created_at <= end_dt)),
    ).order_by(Booking.scheduled_for.asc().nulls_last(), Booking.created_at.asc()).all()

    by_day: dict = {}
    for b in bookings:
        day_key = (b.scheduled_for or b.created_at).strftime("%Y-%m-%d")
        by_day.setdefault(day_key, []).append(_booking_list_item(b))

    return [WorkerCalendarDayOut(date=day, bookings=items) for day, items in sorted(by_day.items())]


# ── Worker earnings & payouts ───────────────────────────────────────
@router.get("/me/earnings", response_model=WorkerEarningsSummaryOut)
def get_worker_earnings(user: User = Depends(require_roles(Role.WORKER)), db: Session = Depends(get_db)):
    p = _get_worker_profile(db, user)
    entries = db.query(PayoutLedgerEntry).filter(PayoutLedgerEntry.worker_id == p.id).order_by(PayoutLedgerEntry.created_at.desc()).all()

    gross = sum(float(e.gross_amount) for e in entries)
    commission = sum(float(e.commission_amount) for e in entries)
    net = sum(float(e.net_amount) for e in entries)
    pending = sum(float(e.net_amount) for e in entries if not e.is_paid_out)
    paid = net - pending

    return WorkerEarningsSummaryOut(
        gross_lifetime=round(gross, 2), commission_lifetime=round(commission, 2), net_lifetime=round(net, 2),
        pending_payout=round(pending, 2), paid_out=round(paid, 2), entries=entries,
    )


@router.get("/me/payouts", response_model=List[WorkerPayoutRequestOut])
def list_my_payouts(user: User = Depends(require_roles(Role.WORKER)), db: Session = Depends(get_db)):
    p = _get_worker_profile(db, user)
    return db.query(Payout).filter(Payout.worker_id == p.id).order_by(Payout.requested_at.desc()).all()


@router.post("/me/payouts/request", response_model=WorkerPayoutRequestOut, status_code=status.HTTP_201_CREATED)
def request_payout(payload: RequestPayoutIn, user: User = Depends(require_roles(Role.WORKER)), db: Session = Depends(get_db)):
    """Rolls up every unassigned, unpaid ledger entry into a single new
    Payout at REQUESTED ('Pending'). Admin then moves it through
    Processing -> Paid/Failed from the finance console."""
    p = _get_worker_profile(db, user)
    if p.verification_status != VerificationStatus.APPROVED:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only verified workers can request a payout")

    unassigned = db.query(PayoutLedgerEntry).filter(
        PayoutLedgerEntry.worker_id == p.id,
        PayoutLedgerEntry.is_paid_out.is_(False),
        PayoutLedgerEntry.payout_id.is_(None),
    ).all()
    if not unassigned:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No available earnings to pay out right now")

    total = sum(float(e.net_amount) for e in unassigned)
    payout = Payout(worker_id=p.id, amount=round(total, 2), status=PayoutStatus.REQUESTED)
    db.add(payout)
    db.flush()
    for e in unassigned:
        e.payout_id = payout.id
    db.commit()
    db.refresh(payout)

    send_push(db, user.id, "Payout requested", f"Your payout request for \u20b9{payout.amount:.2f} has been submitted.")
    return payout


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
