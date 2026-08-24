from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.database.models import (
    User, Role, CustomerProfile, WorkerProfile, VerificationStatus, Booking,
    BookingStatus, Payment, PaymentStatus, Complaint, ComplaintStatus, ComplaintType,
    ComplaintMessage, SafetyIncident, SafetyIncidentStatus, ServiceCategory, City, AuditLog,
    Payout, PayoutStatus, PayoutLedgerEntry, AdminProfile, PlatformSetting, StaffRole,
)
from app.security.deps import get_current_admin, require_staff_permission
from app.security.security import hash_password
from app.config import settings
from app.admin.schemas import (
    DashboardStatsOut, WorkerVerificationActionIn, AdminWorkerOut,
    AdminComplaintActionIn, CreateCategoryIn, CreateCityIn,
    AdminCustomerOut, AdminCustomerListOut, AdminBookingOut, AdminBookingListOut,
    AnalyticsOverviewOut, _NamedRef, _CustomerRef, AdminWorkerListItemOut,
    AdminWorkerDetailOut, AdminKycDocumentOut, AdminSkillRef, WorkerReviewActionIn,
    ComplaintResolveIn, AdminComplaintOut, AdminComplaintBookingRef, ComplaintMessageOut,
    AddComplaintMessageIn, UpdateCommissionIn, AdminCategoryOut,
    StaffMemberOut, CreateStaffIn, ToggleStaffStatusIn,
    AdminPayoutOut, ProcessPayoutIn, AdminAuditLogOut, PlatformSettingsOut, UpdatePlatformSettingsIn,
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
def pending_verifications(admin: User = Depends(require_staff_permission("verification")), db: Session = Depends(get_db)):
    workers = db.query(WorkerProfile).filter(WorkerProfile.verification_status == VerificationStatus.PENDING_REVIEW).all()
    return [AdminWorkerOut(
        id=w.id, full_name=w.full_name, phone=w.user.phone, verification_status=w.verification_status.value,
        city_id=w.city_id, rating_avg=w.rating_avg, created_at=w.created_at,
    ) for w in workers]


@router.post("/workers/{worker_id}/verification")
def act_on_worker_verification(
    worker_id: str, payload: WorkerVerificationActionIn,
    admin: User = Depends(require_staff_permission("verification")), db: Session = Depends(get_db),
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
def act_on_complaint(complaint_id: str, payload: AdminComplaintActionIn, admin: User = Depends(require_staff_permission("support")), db: Session = Depends(get_db)):
    complaint = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Complaint not found")

    complaint.status = ComplaintStatus(payload.status)
    complaint.resolution_note = payload.resolution_note
    complaint.assigned_staff_id = admin.id
    if payload.refund_amount:
        complaint.refund_issued = payload.refund_amount
        booking = complaint.booking
        if booking.payment:
            from app.payments.service import refund_payment
            from decimal import Decimal
            refund_payment(db, booking.payment, Decimal(str(payload.refund_amount)))
    if complaint.status in (ComplaintStatus.RESOLVED, ComplaintStatus.DISMISSED, ComplaintStatus.CLOSED):
        complaint.resolved_at = datetime.utcnow()
    db.commit()

    from app.notifications.service import send_push
    send_push(db, complaint.raised_by_user_id, "Complaint update",
              f"Your complaint is now {complaint.status.value.replace('_', ' ').title()}.")

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
def create_category(payload: CreateCategoryIn, admin: User = Depends(require_staff_permission("operations")), db: Session = Depends(get_db)):
    category = ServiceCategory(**payload.model_dump())
    db.add(category)
    db.commit()
    db.refresh(category)
    _audit(db, admin, "CATEGORY_CREATED", "ServiceCategory", category.id)
    return {"id": category.id, "name": category.name}


@router.post("/cities", status_code=status.HTTP_201_CREATED)
def create_city(payload: CreateCityIn, admin: User = Depends(require_staff_permission("operations")), db: Session = Depends(get_db)):
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
def list_pending_workers(admin: User = Depends(require_staff_permission("verification")), db: Session = Depends(get_db)):
    workers = db.query(WorkerProfile).filter(WorkerProfile.verification_status == VerificationStatus.PENDING_REVIEW).all()
    return [_worker_list_item(w) for w in workers]


@router.get("/workers/{worker_id}", response_model=AdminWorkerDetailOut)
def get_worker_detail(worker_id: str, admin: User = Depends(require_staff_permission("verification")), db: Session = Depends(get_db)):
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
        guardian_name=worker.guardian_name, date_of_birth=worker.date_of_birth, gender=worker.gender,
        address_line=worker.address_line, kyc_city=worker.kyc_city, kyc_state=worker.kyc_state,
        kyc_pincode=worker.kyc_pincode, qualification=worker.qualification,
        previous_experience=worker.previous_experience, kyc_submitted_at=worker.kyc_submitted_at,
        phone=worker.user.phone if worker.user else None,
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
def list_complaints_nested(
    status_filter: Optional[str] = Query(None, alias="status"),
    type_filter: Optional[str] = Query(None, alias="type"),
    admin: User = Depends(require_staff_permission("support")), db: Session = Depends(get_db),
):
    q = db.query(Complaint)
    if status_filter:
        q = q.filter(Complaint.status == ComplaintStatus(status_filter))
    if type_filter:
        q = q.filter(Complaint.type == ComplaintType(type_filter))
    complaints = q.order_by(Complaint.created_at.desc()).limit(200).all()
    return [
        AdminComplaintOut(
            id=c.id, type=c.type.value, raised_by=c.raised_by.value, description=c.description, status=c.status.value,
            resolution_note=c.resolution_note, refund_issued=float(c.refund_issued) if c.refund_issued else None,
            assigned_staff_id=c.assigned_staff_id, created_at=c.created_at,
            booking=AdminComplaintBookingRef(
                id=c.booking.id, price_quoted=float(c.booking.price_quoted),
                category=_NamedRef(name=c.booking.category.name),
                customer=_CustomerRef(full_name=c.booking.customer.full_name),
                worker=_CustomerRef(full_name=c.booking.worker.full_name) if c.booking.worker else None,
            ),
            messages=[ComplaintMessageOut.model_validate(m) for m in c.messages],
        )
        for c in complaints
    ]


@router.get("/complaints/{complaint_id}/messages", response_model=List[ComplaintMessageOut])
def list_complaint_messages(complaint_id: str, admin: User = Depends(require_staff_permission("support")), db: Session = Depends(get_db)):
    complaint = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Complaint not found")
    return complaint.messages


@router.post("/complaints/{complaint_id}/messages", response_model=ComplaintMessageOut, status_code=status.HTTP_201_CREATED)
def add_complaint_message_admin(
    complaint_id: str, payload: AddComplaintMessageIn,
    admin: User = Depends(require_staff_permission("support")), db: Session = Depends(get_db),
):
    complaint = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Complaint not found")
    msg = ComplaintMessage(complaint_id=complaint.id, sender_user_id=admin.id, sender_role="STAFF", body=payload.body)
    db.add(msg)
    if complaint.status == ComplaintStatus.AWAITING_INFO:
        complaint.status = ComplaintStatus.IN_REVIEW
    complaint.assigned_staff_id = admin.id
    db.commit()
    db.refresh(msg)

    from app.notifications.service import send_push
    send_push(db, complaint.raised_by_user_id, "Response to your complaint",
              "MaidKaro support has responded to your complaint. Tap to view.")
    return msg


@router.post("/complaints/{complaint_id}/resolve")
def resolve_complaint(complaint_id: str, payload: ComplaintResolveIn, admin: User = Depends(require_staff_permission("support")), db: Session = Depends(get_db)):
    """Same action as /complaints/{id}/action, under the path name the
    admin console's resolve screen calls."""
    return act_on_complaint(
        complaint_id,
        AdminComplaintActionIn(status=payload.status, resolution_note=payload.resolution_note, refund_amount=payload.refund_amount),
        admin, db,
    )


# ── Category commission (admin-only pricing lever) ──────────────
@router.patch("/categories/{category_id}/commission")
def update_category_commission(category_id: str, payload: UpdateCommissionIn, admin: User = Depends(require_staff_permission("finance")), db: Session = Depends(get_db)):
    category = db.query(ServiceCategory).filter(ServiceCategory.id == category_id).first()
    if not category:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Category not found")
    category.commission_pct = payload.commission_pct
    db.commit()
    _audit(db, admin, "CATEGORY_COMMISSION_UPDATED", "ServiceCategory", category.id, {"commission_pct": payload.commission_pct})
    return {"id": category.id, "commission_pct": float(category.commission_pct)}


# ── Super Admin: Staff Management ──────────────────────────────
@router.get("/staff", response_model=List[StaffMemberOut])
def list_staff(admin: User = Depends(require_staff_permission("staff_management")), db: Session = Depends(get_db)):
    profiles = db.query(AdminProfile).all()
    results = []
    for p in profiles:
        u = p.user
        results.append(StaffMemberOut(
            id=p.id,
            user_id=u.id,
            full_name=p.full_name,
            email=p.email,
            phone=u.phone,
            role=u.role.value,
            staff_role=p.staff_role.value,
            is_active=u.is_active,
            last_login_at=p.last_login_at,
            created_at=p.created_at,
        ))
    return results


@router.post("/staff", response_model=StaffMemberOut, status_code=status.HTTP_201_CREATED)
def create_staff_member(payload: CreateStaffIn, admin: User = Depends(require_staff_permission("staff_management")), db: Session = Depends(get_db)):
    existing_email = db.query(AdminProfile).filter(AdminProfile.email == payload.email).first()
    if existing_email:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "An admin with this email already exists.")

    existing_user = db.query(User).filter(User.phone == payload.phone).first()
    if existing_user:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "An account with this phone number already exists.")

    new_user = User(phone=payload.phone, email=payload.email.lower(), role=Role(payload.role), is_active=True)
    db.add(new_user)
    db.flush()

    new_profile = AdminProfile(
        user_id=new_user.id,
        full_name=payload.full_name,
        email=payload.email.strip().lower(),
        password_hash=hash_password(payload.password),
        staff_role=StaffRole(payload.staff_role),
    )
    db.add(new_profile)
    db.commit()
    db.refresh(new_profile)

    _audit(db, admin, f"STAFF_CREATED_{payload.role}", "AdminProfile", new_profile.id, {"email": payload.email})

    return StaffMemberOut(
        id=new_profile.id,
        user_id=new_user.id,
        full_name=new_profile.full_name,
        email=new_profile.email,
        phone=new_user.phone,
        role=new_user.role.value,
        staff_role=new_profile.staff_role.value,
        is_active=new_user.is_active,
        last_login_at=new_profile.last_login_at,
        created_at=new_profile.created_at,
    )


@router.patch("/staff/{staff_id}/status")
def toggle_staff_status(staff_id: str, payload: ToggleStaffStatusIn, admin: User = Depends(require_staff_permission("staff_management")), db: Session = Depends(get_db)):
    profile = db.query(AdminProfile).filter(AdminProfile.id == staff_id).first()
    if not profile:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Staff member not found.")

    if profile.user_id == admin.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "You cannot deactivate your own account.")

    profile.user.is_active = payload.is_active
    db.commit()
    _audit(db, admin, "STAFF_STATUS_UPDATED", "AdminProfile", profile.id, {"is_active": payload.is_active})
    return {"id": profile.id, "is_active": profile.user.is_active}


# ── Financials: Worker Payouts & Settlement ──────────────────
@router.get("/payouts", response_model=List[AdminPayoutOut])
def list_payouts(admin: User = Depends(require_staff_permission("finance")), db: Session = Depends(get_db)):
    payouts = db.query(Payout).order_by(Payout.requested_at.desc()).limit(200).all()
    results = []
    for p in payouts:
        w = p.worker
        results.append(AdminPayoutOut(
            id=p.id,
            worker_id=w.id if w else "—",
            worker_name=w.full_name if w else "Unknown",
            worker_phone=w.user.phone if w and w.user else "—",
            amount=float(p.amount),
            status=p.status.value,
            requested_at=p.requested_at,
            processed_at=p.processed_at,
            razorpay_payout_id=p.razorpay_payout_id,
        ))
    return results


@router.post("/payouts/{payout_id}/process")
def process_payout(payout_id: str, payload: ProcessPayoutIn, admin: User = Depends(require_staff_permission("finance")), db: Session = Depends(get_db)):
    """Pending (REQUESTED) -> Processing -> Paid (PROCESSED) / Failed.
    Marking paid also flips every ledger entry linked to this payout to
    is_paid_out=True — that's what the worker dashboard's pending/paid
    balances actually read from, so this is the one place money "really"
    moves in the demo system."""
    payout = db.query(Payout).filter(Payout.id == payout_id).first()
    if not payout:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Payout record not found.")

    from app.notifications.service import send_push

    if payload.action == "MARK_PROCESSING":
        if payout.status != PayoutStatus.REQUESTED:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Cannot move payout from {payout.status.value} to PROCESSING")
        payout.status = PayoutStatus.PROCESSING
        db.commit()
        _audit(db, admin, "PAYOUT_PROCESSING", "Payout", payout.id, {"amount": float(payout.amount)})

    elif payload.action == "MARK_PAID":
        if payout.status not in (PayoutStatus.REQUESTED, PayoutStatus.PROCESSING):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Cannot mark a {payout.status.value} payout as paid")
        payout.status = PayoutStatus.PROCESSED
        payout.processed_at = datetime.utcnow()
        payout.razorpay_payout_id = f"payout_sim_{payout.id[:12]}"
        db.query(PayoutLedgerEntry).filter(PayoutLedgerEntry.payout_id == payout.id).update({"is_paid_out": True})
        db.commit()
        if payout.worker and payout.worker.user_id:
            send_push(db, payout.worker.user_id, "Payout completed",
                      f"\u20b9{float(payout.amount):.2f} has been paid out to you.")
        _audit(db, admin, "PAYOUT_PROCESSED", "Payout", payout.id, {"amount": float(payout.amount)})

    elif payload.action == "MARK_FAILED":
        if payout.status == PayoutStatus.PROCESSED:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "This payout has already been paid and can't be marked failed.")
        payout.status = PayoutStatus.FAILED
        payout.failure_reason = payload.failure_reason
        # Free the ledger entries so the worker can retry the payout request.
        db.query(PayoutLedgerEntry).filter(PayoutLedgerEntry.payout_id == payout.id).update({"payout_id": None})
        db.commit()
        if payout.worker and payout.worker.user_id:
            send_push(db, payout.worker.user_id, "Payout failed",
                      f"Your payout of \u20b9{float(payout.amount):.2f} failed{f': {payload.failure_reason}' if payload.failure_reason else ''}. You can request it again.")
        _audit(db, admin, "PAYOUT_FAILED", "Payout", payout.id, {"reason": payload.failure_reason})

    return {"id": payout.id, "status": payout.status.value, "processed_at": payout.processed_at}


# ── Super Admin: Audit Logs ──────────────────────────────────
@router.get("/audit-logs", response_model=List[AdminAuditLogOut])
def list_audit_logs(admin: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    if admin.role != Role.SUPER_ADMIN:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Audit logs are restricted to Super Admins.")

    logs = db.query(AuditLog).order_by(AuditLog.created_at.desc()).limit(150).all()
    results = []
    for log in logs:
        actor_name = "System"
        if log.actor_user_id:
            profile = db.query(AdminProfile).filter(AdminProfile.user_id == log.actor_user_id).first()
            if profile:
                actor_name = profile.full_name
        results.append(AdminAuditLogOut(
            id=log.id,
            actor_user_id=log.actor_user_id,
            actor_name=actor_name,
            action=log.action,
            entity_type=log.entity_type,
            entity_id=log.entity_id,
            metadata_json=log.metadata_json,
            ip_address=log.ip_address,
            created_at=log.created_at,
        ))
    return results


# ── Platform Settings ────────────────────────────────────────
@router.get("/settings", response_model=PlatformSettingsOut)
def get_platform_settings(admin: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    comm = db.query(PlatformSetting).filter(PlatformSetting.key == "default_commission_pct").first()
    surge = db.query(PlatformSetting).filter(PlatformSetting.key == "surge_multiplier").first()
    sos = db.query(PlatformSetting).filter(PlatformSetting.key == "sos_emergency_phone").first()

    return PlatformSettingsOut(
        default_commission_pct=float(comm.value) if comm else 15.0,
        surge_multiplier=float(surge.value) if surge else 1.0,
        otp_expiry_seconds=settings.OTP_EXPIRY_SECONDS,
        sos_emergency_phone=sos.value if sos else "+911800123456",
        sms_provider=settings.SMS_PROVIDER,
        environment=settings.ENVIRONMENT,
    )


@router.patch("/settings")
def update_platform_settings(payload: UpdatePlatformSettingsIn, admin: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    if admin.role != Role.SUPER_ADMIN:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only Super Admins can update platform global settings.")

    if payload.default_commission_pct is not None:
        row = db.query(PlatformSetting).filter(PlatformSetting.key == "default_commission_pct").first()
        if not row:
            db.add(PlatformSetting(key="default_commission_pct", value=str(payload.default_commission_pct)))
        else:
            row.value = str(payload.default_commission_pct)

    if payload.surge_multiplier is not None:
        row = db.query(PlatformSetting).filter(PlatformSetting.key == "surge_multiplier").first()
        if not row:
            db.add(PlatformSetting(key="surge_multiplier", value=str(payload.surge_multiplier)))
        else:
            row.value = str(payload.surge_multiplier)

    if payload.sos_emergency_phone is not None:
        row = db.query(PlatformSetting).filter(PlatformSetting.key == "sos_emergency_phone").first()
        if not row:
            db.add(PlatformSetting(key="sos_emergency_phone", value=str(payload.sos_emergency_phone)))
        else:
            row.value = str(payload.sos_emergency_phone)

    db.commit()
    _audit(db, admin, "PLATFORM_SETTINGS_UPDATED", "PlatformSetting", "global", payload.model_dump(exclude_unset=True))
    return {"message": "Platform settings updated successfully"}
