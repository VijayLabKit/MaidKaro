from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.database.models import (
    User, Role, CustomerProfile, WorkerProfile, VerificationStatus, Booking,
    BookingStatus, Payment, PaymentStatus, Complaint, ComplaintStatus,
    SafetyIncident, SafetyIncidentStatus, ServiceCategory, City, AuditLog,
)
from app.security.deps import get_current_admin
from app.admin.schemas import (
    DashboardStatsOut, WorkerVerificationActionIn, AdminWorkerOut,
    AdminComplaintActionIn, CreateCategoryIn, CreateCityIn,
    AdminCustomerOut, AdminCustomerListOut, AdminBookingOut, AdminBookingListOut,
    AnalyticsOverviewOut, _NamedRef, _CustomerRef, AdminWorkerListItemOut,
    AdminWorkerDetailOut, AdminKycDocumentOut, AdminSkillRef, WorkerReviewActionIn,
    ComplaintResolveIn, AdminComplaintOut, AdminComplaintBookingRef,
    UpdateCommissionIn, AdminCategoryOut,
)
from app.notifications.service import send_push
from app.support.service import acknowledge_incident

router = APIRouter(prefix="/admin", tags=["Admin"])


def _audit(db: Session, admin: User, action: str, entity_type: str, entity_id: str, meta: Optional[dict] = None) -> None:
    db.add(AuditLog(actor_user_id=admin.id, action=action, entity_type=entity_type, entity_id=entity_id, metadata_json=meta))
    db.commit()


@router.get("/dashboard", response_model=DashboardStatsOut)
def dashboard_stats(admin: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    gross_revenue = db.query(func.coalesce(func.sum(Payment.amount), 0)).filter(Payment.status == PaymentStatus.CAPTURED).scalar()

    return DashboardStatsOut(
        total_customers=db.query(CustomerProfile).count(),
        total_workers=db.query(WorkerProfile).count(),
        workers_pending_verification=db.query(WorkerProfile).filter(WorkerProfile.verification_status == VerificationStatus.PENDING_REVIEW).count(),
        total_bookings=db.query(Booking).count(),
        bookings_today=db.query(Booking).filter(Booking.created_at >= today_start).count(),
        active_bookings=db.query(Booking).filter(Booking.status.in_([BookingStatus.CONFIRMED, BookingStatus.IN_PROGRESS])).count(),
        gross_revenue=float(gross_revenue),
        open_complaints=db.query(Complaint).filter(Complaint.status == ComplaintStatus.OPEN).count(),
        open_safety_incidents=db.query(SafetyIncident).filter(SafetyIncident.status.in_([SafetyIncidentStatus.TRIGGERED, SafetyIncidentStatus.ACKNOWLEDGED])).count(),
    )


# ── Worker verification queue ────────────────────────────────────
@router.get("/workers/pending-verification", response_model=List[AdminWorkerOut])
def pending_verifications(admin: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    workers = db.query(WorkerProfile).filter(WorkerProfile.verification_status == VerificationStatus.PENDING_REVIEW).all()
    return [AdminWorkerOut(
        id=w.id, full_name=w.full_name, phone=w.user.phone, verification_status=w.verification_status.value,
        city_id=w.city_id, rating_avg=w.rating_avg, created_at=w.created_at,
    ) for w in workers]


@router.post("/workers/{worker_id}/verification")
def act_on_worker_verification(
    worker_id: str, payload: WorkerVerificationActionIn,
    admin: User = Depends(get_current_admin), db: Session = Depends(get_db),
):
    worker = db.query(WorkerProfile).filter(WorkerProfile.id == worker_id).first()
    if not worker:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Worker not found")

    status_map = {
        "APPROVE": VerificationStatus.APPROVED,
        "REJECT": VerificationStatus.REJECTED,
        "REQUEST_RESUBMISSION": VerificationStatus.NEEDS_RESUBMISSION,
    }
    worker.verification_status = status_map[payload.action]
    worker.verification_note = payload.note
    db.commit()

    send_push(db, worker.user_id, "KYC update", f"Your verification status is now {worker.verification_status.value}.")
    _audit(db, admin, f"WORKER_{payload.action}", "WorkerProfile", worker.id, {"note": payload.note})
    return {"worker_id": worker.id, "verification_status": worker.verification_status.value}


@router.get("/workers", response_model=List[AdminWorkerOut])
def list_workers(
    verification_status: Optional[str] = Query(None),
    admin: User = Depends(get_current_admin), db: Session = Depends(get_db),
):
    q = db.query(WorkerProfile)
    if verification_status:
        q = q.filter(WorkerProfile.verification_status == VerificationStatus(verification_status))
    workers = q.order_by(WorkerProfile.created_at.desc()).limit(200).all()
    return [AdminWorkerOut(
        id=w.id, full_name=w.full_name, phone=w.user.phone, verification_status=w.verification_status.value,
        city_id=w.city_id, rating_avg=w.rating_avg, created_at=w.created_at,
    ) for w in workers]


# ── Complaints ────────────────────────────────────────────────────
# NOTE: the flat, un-nested GET /complaints handler that used to live here
# was removed — it shared this exact path with list_complaints_nested()
# below and, being registered first, silently shadowed it. The admin
# console's complaints screen needs the nested booking/category/customer
# view, so that's now the only handler for this path.


@router.post("/complaints/{complaint_id}/action")
def act_on_complaint(complaint_id: str, payload: AdminComplaintActionIn, admin: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    complaint = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Complaint not found")

    complaint.status = ComplaintStatus(payload.status)
    complaint.resolution_note = payload.resolution_note
    if payload.refund_amount:
        complaint.refund_issued = payload.refund_amount
        booking = complaint.booking
        if booking.payment:
            from app.payments.service import refund_payment
            from decimal import Decimal
            refund_payment(db, booking.payment, Decimal(str(payload.refund_amount)))
    if complaint.status in (ComplaintStatus.RESOLVED, ComplaintStatus.DISMISSED):
        complaint.resolved_at = datetime.utcnow()
    db.commit()
    _audit(db, admin, "COMPLAINT_ACTION", "Complaint", complaint.id, {"status": payload.status})
    return {"id": complaint.id, "status": complaint.status.value}


# ── Safety incidents ──────────────────────────────────────────────
@router.get("/safety-incidents")
def list_safety_incidents(admin: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    return db.query(SafetyIncident).order_by(SafetyIncident.created_at.desc()).limit(200).all()


@router.post("/safety-incidents/{incident_id}/acknowledge")
def acknowledge_safety_incident(incident_id: str, admin: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    incident = db.query(SafetyIncident).filter(SafetyIncident.id == incident_id).first()
    if not incident:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Incident not found")
    updated = acknowledge_incident(db, incident, admin.id)
    _audit(db, admin, "SAFETY_INCIDENT_ACKNOWLEDGED", "SafetyIncident", incident.id)
    return {"id": updated.id, "status": updated.status.value}


# ── Catalog management ─────────────────────────────────────────────
@router.post("/categories", status_code=status.HTTP_201_CREATED)
def create_category(payload: CreateCategoryIn, admin: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    category = ServiceCategory(**payload.model_dump())
    db.add(category)
    db.commit()
    db.refresh(category)
    _audit(db, admin, "CATEGORY_CREATED", "ServiceCategory", category.id)
    return {"id": category.id, "name": category.name}


@router.post("/cities", status_code=status.HTTP_201_CREATED)
def create_city(payload: CreateCityIn, admin: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    city = City(**payload.model_dump())
    db.add(city)
    db.commit()
    db.refresh(city)
    _audit(db, admin, "CITY_CREATED", "City", city.id)
    return {"id": city.id, "name": city.name}


# ── Customers ────────────────────────────────────────────────────
@router.get("/customers", response_model=AdminCustomerListOut)
def list_customers(
    page: int = Query(1, ge=1), page_size: int = Query(50, ge=1, le=200),
    admin: User = Depends(get_current_admin), db: Session = Depends(get_db),
):
    q = db.query(CustomerProfile).order_by(CustomerProfile.created_at.desc())
    total = q.count()
    rows = q.offset((page - 1) * page_size).limit(page_size).all()
    return AdminCustomerListOut(
        items=[AdminCustomerOut(id=c.id, full_name=c.full_name, email=c.email, created_at=c.created_at) for c in rows],
        total=total,
    )


# ── Bookings ─────────────────────────────────────────────────────
@router.get("/bookings", response_model=AdminBookingListOut)
def list_bookings(
    status_filter: Optional[str] = Query(None, alias="status"),
    page: int = Query(1, ge=1), page_size: int = Query(50, ge=1, le=200),
    admin: User = Depends(get_current_admin), db: Session = Depends(get_db),
):
    q = db.query(Booking)
    if status_filter:
        q = q.filter(Booking.status == BookingStatus(status_filter))
    q = q.order_by(Booking.created_at.desc())
    total = q.count()
    rows = q.offset((page - 1) * page_size).limit(page_size).all()
    items = [
        AdminBookingOut(
            id=b.id, status=b.status.value, type=b.type.value,
            price_quoted=float(b.price_quoted), duration_hours=float(b.duration_hours),
            created_at=b.created_at, scheduled_for=b.scheduled_for,
            category=_NamedRef(name=b.category.name),
            customer=_CustomerRef(full_name=b.customer.full_name),
            worker=_CustomerRef(full_name=b.worker.full_name) if b.worker else None,
        )
        for b in rows
    ]
    return AdminBookingListOut(items=items, total=total)


# ── Analytics overview (dashboard charts) ───────────────────────
@router.get("/analytics/overview", response_model=AnalyticsOverviewOut)
def analytics_overview(admin: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    gross_revenue = db.query(func.coalesce(func.sum(Payment.amount), 0)).filter(Payment.status == PaymentStatus.CAPTURED).scalar()
    status_counts = dict(
        db.query(Booking.status, func.count(Booking.id)).group_by(Booking.status).all()
    )
    bookings_by_status = {status.value: count for status, count in status_counts.items()}
    return AnalyticsOverviewOut(
        total_customers=db.query(CustomerProfile).count(),
        total_workers=db.query(WorkerProfile).count(),
        pending_workers=db.query(WorkerProfile).filter(WorkerProfile.verification_status == VerificationStatus.PENDING_REVIEW).count(),
        bookings_by_status=bookings_by_status,
        gross_revenue=float(gross_revenue),
    )


# ── Worker verification (nested view used by the review screen) ────
def _worker_list_item(w: WorkerProfile) -> AdminWorkerListItemOut:
    return AdminWorkerListItemOut(
        id=w.id, full_name=w.full_name, photo_url=w.photo_url,
        city=_NamedRef(name=w.city.name if w.city else "—"),
        verification_status=w.verification_status.value, years_experience=w.years_experience,
        languages=w.languages or [],
        skills=[AdminSkillRef(category=_NamedRef(name=s.category.name)) for s in w.skills],
        created_at=w.created_at,
    )


@router.get("/workers/pending", response_model=List[AdminWorkerListItemOut])
def list_pending_workers(admin: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    workers = db.query(WorkerProfile).filter(WorkerProfile.verification_status == VerificationStatus.PENDING_REVIEW).all()
    return [_worker_list_item(w) for w in workers]


@router.get("/workers/{worker_id}", response_model=AdminWorkerDetailOut)
def get_worker_detail(worker_id: str, admin: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    worker = db.query(WorkerProfile).filter(WorkerProfile.id == worker_id).first()
    if not worker:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Worker not found")
    base = _worker_list_item(worker)
    return AdminWorkerDetailOut(
        **base.model_dump(),
        documents=[
            AdminKycDocumentOut(
                id=d.id, type=d.type.value, status=d.status.value,
                # Private object-storage key — a real deployment would mint a
                # short-lived signed URL here instead of exposing it directly.
                view_url=d.file_url, reject_reason=d.reject_reason,
            )
            for d in worker.documents
        ],
        verification_note=worker.verification_note,
    )


@router.post("/workers/{worker_id}/review")
def review_worker(
    worker_id: str, payload: WorkerReviewActionIn,
    admin: User = Depends(get_current_admin), db: Session = Depends(get_db),
):
    """Same action as /workers/{id}/verification, under the path name the
    admin console's worker-review screen calls."""
    return act_on_worker_verification(
        worker_id, WorkerVerificationActionIn(action=payload.action, note=payload.note), admin, db,
    )


# ── Complaints: alias matching the admin console's resolve screen ──
@router.get("/complaints", response_model=List[AdminComplaintOut])
def list_complaints_nested(status_filter: Optional[str] = Query(None, alias="status"), admin: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    q = db.query(Complaint)
    if status_filter:
        q = q.filter(Complaint.status == ComplaintStatus(status_filter))
    complaints = q.order_by(Complaint.created_at.desc()).limit(200).all()
    return [
        AdminComplaintOut(
            id=c.id, raised_by=c.raised_by.value, description=c.description, status=c.status.value,
            resolution_note=c.resolution_note, refund_issued=float(c.refund_issued) if c.refund_issued else None,
            created_at=c.created_at,
            booking=AdminComplaintBookingRef(
                id=c.booking.id, price_quoted=float(c.booking.price_quoted),
                category=_NamedRef(name=c.booking.category.name),
                customer=_CustomerRef(full_name=c.booking.customer.full_name),
                worker=_CustomerRef(full_name=c.booking.worker.full_name) if c.booking.worker else None,
            ),
        )
        for c in complaints
    ]


@router.post("/complaints/{complaint_id}/resolve")
def resolve_complaint(complaint_id: str, payload: ComplaintResolveIn, admin: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    """Same action as /complaints/{id}/action, under the path name the
    admin console's resolve screen calls."""
    return act_on_complaint(
        complaint_id,
        AdminComplaintActionIn(status=payload.status, resolution_note=payload.resolution_note, refund_amount=payload.refund_amount),
        admin, db,
    )


# ── Category commission (admin-only pricing lever) ──────────────
@router.patch("/categories/{category_id}/commission")
def update_category_commission(category_id: str, payload: UpdateCommissionIn, admin: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    category = db.query(ServiceCategory).filter(ServiceCategory.id == category_id).first()
    if not category:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Category not found")
    category.commission_pct = payload.commission_pct
    db.commit()
    _audit(db, admin, "CATEGORY_COMMISSION_UPDATED", "ServiceCategory", category.id, {"commission_pct": payload.commission_pct})
    return {"id": category.id, "commission_pct": float(category.commission_pct)}
