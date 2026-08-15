"""
Seeds a realistic, interconnected DEMO dataset on top of the base
launch seed (scripts/seed.py) — customers, workers, bookings across
every status, payments in INR, reviews, worker payouts, notifications,
and support complaints — so the Customer, Worker, and Admin surfaces
all have real data to render immediately in development.

Everything created here is clearly synthetic (see DEMO_MARKER_PHONE_PREFIX
and the platform_settings marker below) and is meant for local development
and demos only — it must never be mistaken for genuine production activity.
No real people's information and no real payment credentials are used.

Idempotent: safe to re-run. If demo data has already been seeded, it exits
immediately unless --force is passed, in which case it wipes previously
seeded demo rows (identified by the +9198xxxxxxx / +9197xxxxxxx demo phone
ranges) and recreates them from scratch.

Run:
  python scripts/seed_demo_data.py           # seed once
  python scripts/seed_demo_data.py --force    # wipe + reseed demo data
"""
import random
import sys
from datetime import datetime, timedelta
from pathlib import Path
from decimal import Decimal

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.database import SessionLocal, Base, engine
from app.database.models import (
    City, ServiceZone, Pincode, ServiceCategory, CityCategory,
    User, Role, AdminProfile, CustomerProfile, CustomerAddress,
    WorkerProfile, WorkerSkill, KycDocument, AvailabilitySlot,
    VerificationStatus, DocumentType, WeekDay,
    Booking, BookingType, BookingStatus, BookingStatusEvent,
    Payment, PaymentStatus, Review, PayoutLedgerEntry, Payout, PayoutStatus,
    Complaint, ComplaintStatus, ComplaintRaisedBy,
    Notification, NotificationChannel, PlatformSetting,
)
from app.security.security import hash_password
from scripts.seed import seed as seed_base

random.seed(42)  # reproducible demo data across re-runs

DEMO_SEED_MARKER_KEY = "demo_data_seeded_v1"

# Demo phone numbers are drawn from these prefixes only, so demo rows are
# always identifiable/removable and never collide with a real signup.
CUSTOMER_PHONE_PREFIX = "+9198"
WORKER_PHONE_PREFIX = "+9197"

SILIGURI_AREAS = [
    "Sevoke Road", "Hakimpara", "Pradhan Nagar", "Matigara",
    "Champasari", "Khalpara", "Sevoke More", "NJP", "Bagdogra Road", "Siliguri Junction",
]

CUSTOMER_NAMES = [
    "Ananya Bhattacharya", "Rohan Mukherjee", "Priya Das", "Arjun Roy",
    "Sneha Ghosh", "Vikram Chatterjee", "Ishita Sarkar", "Aditya Basu",
    "Meghna Sengupta", "Karan Dutta", "Riya Banerjee", "Siddharth Chakraborty",
]

# Predominantly female names (reflecting the real gender composition of
# domestic-work platforms in India), with a few male workers for elder-care
# and general-help roles.
WORKER_NAMES = [
    ("Lakshmi Devi", "F"), ("Kajal Oraon", "F"), ("Manju Rai", "F"),
    ("Sunita Toppo", "F"), ("Rekha Barman", "F"), ("Puja Lohar", "F"),
    ("Anita Minj", "F"), ("Shobha Adhikari", "F"), ("Kiran Chettri", "F"),
    ("Bimla Devi", "F"), ("Sarita Kujur", "F"), ("Gita Pradhan", "F"),
    ("Ramesh Oraon", "M"), ("Bipin Rai", "M"), ("Suresh Barman", "M"),
]

LANGUAGES_POOL = [["Bengali", "Hindi"], ["Bengali", "Hindi", "English"], ["Nepali", "Hindi"], ["Hindi"], ["Bengali"]]

REVIEW_COMMENTS = {
    5: [
        "Extremely punctual and thorough — my kitchen hasn't been this clean in months.",
        "Very trustworthy, worked carefully around my elderly mother. Highly recommend.",
        "Great with my kids, patient and warm. Will book again every week.",
        "Professional from start to finish, brought her own supplies too.",
    ],
    4: [
        "Good work overall, arrived a few minutes late but made up for it.",
        "Solid cleaning job, missed one corner of the bathroom but fixed it when I mentioned it.",
        "Friendly and efficient, would book again.",
    ],
    3: [
        "Average experience — the work was okay but not particularly detailed.",
        "Got the job done but I had to ask for a few spots to be redone.",
    ],
    2: [
        "Arrived quite late without any notice, work quality was below expectations.",
    ],
    1: [
        "Did not show up on time and left the job half-finished. Requested a refund.",
    ],
}

COMPLAINT_TEXTS = [
    "Worker arrived over an hour late and I had to rearrange my day.",
    "Payment was deducted twice for the same booking, please refund the extra charge.",
    "Worker was asked to leave early due to a family emergency, service was incomplete.",
    "Booking was confirmed but no worker was ever assigned, had to cancel.",
]

NOTIFICATION_TEMPLATES = [
    ("Booking confirmed", "Your {cat} booking on {date} has been confirmed."),
    ("Worker on the way", "{worker} is on the way to your address."),
    ("Payment received", "We've received your payment of ₹{amount} for booking #{bid}."),
    ("Booking completed", "Your {cat} service has been marked completed. Rate your experience!"),
    ("KYC update", "Your KYC documents have been reviewed. Status: {status}."),
]


def phone(prefix: str, i: int) -> str:
    # prefix is "+9198" or "+9197" ("+91" + one leading digit 9 + one more
    # fixed digit). Appending 8 more digits gives a full 10-digit Indian
    # mobile number after "+91", matching ^\+91[6-9]\d{9}$ used elsewhere.
    return f"{prefix}{10000000 + i:08d}"


def wipe_demo_data(db):
    """Bulk `.delete()` queries bypass SQLAlchemy's Python-side
    cascade="all, delete-orphan" (that only fires on session.delete(obj)),
    and this project's SQLite dev DB doesn't enforce FK ON DELETE CASCADE
    either — so every child table has to be deleted explicitly, in
    dependency order, or rows get orphaned instead of removed.
    """
    print("Wiping previously seeded demo data...")
    demo_users = db.query(User).filter(
        (User.phone.like(f"{CUSTOMER_PHONE_PREFIX}%"))
        | (User.phone.like(f"{WORKER_PHONE_PREFIX}%"))
        | (User.phone == "+919700000001")  # demo ops-admin
    ).all()
    demo_user_ids = [u.id for u in demo_users]
    if not demo_user_ids:
        return

    customer_ids = [c.id for c in db.query(CustomerProfile).filter(CustomerProfile.user_id.in_(demo_user_ids)).all()]
    worker_ids = [w.id for w in db.query(WorkerProfile).filter(WorkerProfile.user_id.in_(demo_user_ids)).all()]
    booking_ids = [b.id for b in db.query(Booking).filter(
        (Booking.customer_id.in_(customer_ids)) | (Booking.worker_id.in_(worker_ids))
    ).all()] if (customer_ids or worker_ids) else []

    def bulk_delete(query):
        query.delete(synchronize_session=False)

    if booking_ids:
        bulk_delete(db.query(Review).filter(Review.booking_id.in_(booking_ids)))
        bulk_delete(db.query(Payment).filter(Payment.booking_id.in_(booking_ids)))
        bulk_delete(db.query(BookingStatusEvent).filter(BookingStatusEvent.booking_id.in_(booking_ids)))
        bulk_delete(db.query(Complaint).filter(Complaint.booking_id.in_(booking_ids)))
        bulk_delete(db.query(PayoutLedgerEntry).filter(PayoutLedgerEntry.booking_id.in_(booking_ids)))
    if worker_ids:
        bulk_delete(db.query(Payout).filter(Payout.worker_id.in_(worker_ids)))
        bulk_delete(db.query(PayoutLedgerEntry).filter(PayoutLedgerEntry.worker_id.in_(worker_ids)))
        bulk_delete(db.query(WorkerSkill).filter(WorkerSkill.worker_id.in_(worker_ids)))
        bulk_delete(db.query(KycDocument).filter(KycDocument.worker_id.in_(worker_ids)))
        bulk_delete(db.query(AvailabilitySlot).filter(AvailabilitySlot.worker_id.in_(worker_ids)))
    if booking_ids:
        bulk_delete(db.query(Booking).filter(Booking.id.in_(booking_ids)))
    if customer_ids:
        bulk_delete(db.query(CustomerAddress).filter(CustomerAddress.customer_id.in_(customer_ids)))

    bulk_delete(db.query(Notification).filter(Notification.user_id.in_(demo_user_ids)))
    if worker_ids:
        bulk_delete(db.query(WorkerProfile).filter(WorkerProfile.id.in_(worker_ids)))
    if customer_ids:
        bulk_delete(db.query(CustomerProfile).filter(CustomerProfile.id.in_(customer_ids)))
    bulk_delete(db.query(AdminProfile).filter(AdminProfile.user_id.in_(demo_user_ids)))
    bulk_delete(db.query(User).filter(User.id.in_(demo_user_ids)))
    bulk_delete(db.query(PlatformSetting).filter(PlatformSetting.key == DEMO_SEED_MARKER_KEY))
    db.commit()
    print(f"  removed {len(demo_user_ids)} demo users and everything linked to them "
          f"({len(customer_ids)} customer profiles, {len(worker_ids)} worker profiles, {len(booking_ids)} bookings).")


def already_seeded(db) -> bool:
    return db.query(PlatformSetting).filter(PlatformSetting.key == DEMO_SEED_MARKER_KEY).first() is not None


def create_customers(db, city, pincodes):
    customers = []
    for i, name in enumerate(CUSTOMER_NAMES):
        ph = phone(CUSTOMER_PHONE_PREFIX, i)
        user = User(phone=ph, role=Role.CUSTOMER)
        db.add(user)
        db.flush()
        first = name.split()[0].lower()
        cust = CustomerProfile(
            user_id=user.id, full_name=name,
            email=f"{first}.demo@example.com",
        )
        db.add(cust)
        db.flush()

        num_addresses = random.choice([1, 1, 2])
        for a in range(num_addresses):
            area = random.choice(SILIGURI_AREAS)
            pincode = random.choice(pincodes)
            db.add(CustomerAddress(
                customer_id=cust.id,
                label="Home" if a == 0 else "Office",
                line1=f"{random.randint(1, 400)}, {area}",
                line2=f"Near {random.choice(['City Center', 'Vega Circle', 'Hong Kong Market', 'Bidhan Market', 'Deshbandhu Para'])}",
                pincode_id=pincode.id,
                latitude=26.7271 + random.uniform(-0.05, 0.05),
                longitude=88.3953 + random.uniform(-0.05, 0.05),
                is_default=(a == 0),
            ))
        customers.append(cust)
    db.flush()
    print(f"Created {len(customers)} demo customers with addresses.")
    return customers


def create_workers(db, city, zone, categories):
    workers = []
    statuses = (
        [VerificationStatus.APPROVED] * 10
        + [VerificationStatus.PENDING_REVIEW] * 2
        + [VerificationStatus.NEEDS_RESUBMISSION] * 2
        + [VerificationStatus.REJECTED] * 1
    )
    for i, (name, _gender) in enumerate(WORKER_NAMES):
        ph = phone(WORKER_PHONE_PREFIX, i)
        user = User(phone=ph, role=Role.WORKER)
        db.add(user)
        db.flush()

        status = statuses[i % len(statuses)]
        rating_count = random.randint(8, 60) if status == VerificationStatus.APPROVED else 0
        rating_avg = round(random.uniform(3.6, 5.0), 1) if rating_count else 0.0

        worker = WorkerProfile(
            user_id=user.id, full_name=name,
            bio=f"{name.split()[0]} has {random.randint(1, 9)} years of experience providing "
                f"reliable home services in Siliguri.",
            city_id=city.id, service_zone_id=zone.id,
            languages=random.choice(LANGUAGES_POOL),
            years_experience=random.randint(1, 9),
            verification_status=status,
            verification_note="Documents verified against government ID." if status == VerificationStatus.APPROVED
                else ("Address proof unclear, please resubmit a clearer copy." if status == VerificationStatus.NEEDS_RESUBMISSION
                else None),
            rating_avg=rating_avg,
            rating_count=rating_count,
            is_available_now=random.choice([True, True, False]) if status == VerificationStatus.APPROVED else False,
        )
        db.add(worker)
        db.flush()

        # 1-2 skills per worker
        skill_categories = random.sample(categories, k=random.choice([1, 2]))
        for cat in skill_categories:
            rate_override = None
            if random.random() < 0.3:
                rate_override = Decimal(str(float(cat.base_hourly_rate) + random.choice([-20, 0, 20, 40])))
            db.add(WorkerSkill(worker_id=worker.id, category_id=cat.id, hourly_rate=rate_override))

        # KYC documents
        doc_status = VerificationStatus.APPROVED if status == VerificationStatus.APPROVED else status
        db.add(KycDocument(
            worker_id=worker.id, type=DocumentType.GOVERNMENT_ID,
            file_url=f"s3://maidkaro-uploads/demo/kyc/{worker.id}-govt-id.jpg",
            status=doc_status,
        ))
        db.add(KycDocument(
            worker_id=worker.id, type=DocumentType.ADDRESS_PROOF,
            file_url=f"s3://maidkaro-uploads/demo/kyc/{worker.id}-address-proof.jpg",
            status=doc_status,
            reject_reason="Document image is blurry, please retake in good lighting." if status == VerificationStatus.NEEDS_RESUBMISSION else None,
        ))

        # Availability slots — a few weekdays, 9am-6pm typical
        for day in random.sample(list(WeekDay), k=random.randint(4, 6)):
            db.add(AvailabilitySlot(worker_id=worker.id, day=day, start_time="09:00", end_time="18:00"))

        workers.append(worker)
    db.flush()
    print(f"Created {len(workers)} demo workers with skills, KYC docs, and availability.")
    return workers


def create_bookings_and_downstream(db, customers, workers, categories, city, admin_user_id):
    approved_workers = [w for w in workers if w.verification_status == VerificationStatus.APPROVED]
    addresses_by_customer = {c.id: c.addresses for c in customers}

    # (status, count) distribution across a realistic booking lifecycle
    plan = [
        (BookingStatus.COMPLETED, 14),
        (BookingStatus.CONFIRMED, 3),
        (BookingStatus.PENDING, 2),
        (BookingStatus.IN_PROGRESS, 1),
        (BookingStatus.CANCELLED, 3),
        (BookingStatus.REJECTED, 2),
        (BookingStatus.EXPIRED, 2),
    ]

    bookings = []
    now = datetime.utcnow()

    for status, count in plan:
        for _ in range(count):
            customer = random.choice(customers)
            addresses = addresses_by_customer[customer.id]
            if not addresses:
                continue
            address = random.choice(addresses)
            category = random.choice(categories)
            worker = random.choice(approved_workers) if approved_workers and status != BookingStatus.PENDING else (
                random.choice(approved_workers) if approved_workers and random.random() < 0.5 else None
            )
            duration = Decimal(random.choice(["2.0", "3.0", "4.0", "1.5"]))
            price = (Decimal(str(category.base_hourly_rate)) * duration).quantize(Decimal("0.01"))
            booking_type = random.choice([BookingType.INSTANT, BookingType.SCHEDULED])

            created_at = now - timedelta(days=random.randint(1, 60), hours=random.randint(0, 23))
            scheduled_for = created_at + timedelta(hours=random.randint(2, 48)) if booking_type == BookingType.SCHEDULED else None

            booking = Booking(
                customer_id=customer.id,
                worker_id=worker.id if worker else None,
                category_id=category.id,
                address_id=address.id,
                type=booking_type,
                status=status,
                scheduled_for=scheduled_for,
                duration_hours=duration,
                price_quoted=price,
                notes=random.choice([None, "Please bring your own cleaning supplies.", "Gate code is 4521.", None]),
                cancel_reason="Customer requested reschedule and slot was unavailable." if status == BookingStatus.CANCELLED else
                              ("No worker available in the selected slot." if status == BookingStatus.EXPIRED else None),
                created_at=created_at,
                updated_at=created_at,
            )
            if status in (BookingStatus.CONFIRMED, BookingStatus.IN_PROGRESS, BookingStatus.COMPLETED):
                booking.confirmed_at = created_at + timedelta(minutes=15)
            if status in (BookingStatus.IN_PROGRESS, BookingStatus.COMPLETED):
                booking.started_at = created_at + timedelta(hours=1)
            if status == BookingStatus.COMPLETED:
                booking.completed_at = booking.started_at + timedelta(hours=float(duration))

            db.add(booking)
            db.flush()

            # Status event audit trail
            transitions = {
                BookingStatus.PENDING: [(None, BookingStatus.PENDING)],
                BookingStatus.CONFIRMED: [(None, BookingStatus.PENDING), (BookingStatus.PENDING, BookingStatus.CONFIRMED)],
                BookingStatus.IN_PROGRESS: [(None, BookingStatus.PENDING), (BookingStatus.PENDING, BookingStatus.CONFIRMED), (BookingStatus.CONFIRMED, BookingStatus.IN_PROGRESS)],
                BookingStatus.COMPLETED: [(None, BookingStatus.PENDING), (BookingStatus.PENDING, BookingStatus.CONFIRMED), (BookingStatus.CONFIRMED, BookingStatus.IN_PROGRESS), (BookingStatus.IN_PROGRESS, BookingStatus.COMPLETED)],
                BookingStatus.CANCELLED: [(None, BookingStatus.PENDING), (BookingStatus.PENDING, BookingStatus.CANCELLED)],
                BookingStatus.REJECTED: [(None, BookingStatus.PENDING), (BookingStatus.PENDING, BookingStatus.REJECTED)],
                BookingStatus.EXPIRED: [(None, BookingStatus.PENDING), (BookingStatus.PENDING, BookingStatus.EXPIRED)],
            }
            for from_s, to_s in transitions[status]:
                db.add(BookingStatusEvent(
                    booking_id=booking.id, from_status=from_s, to_status=to_s,
                    actor=worker.user_id if (worker and to_s == BookingStatus.CONFIRMED) else "SYSTEM",
                    created_at=created_at,
                ))

            # Payment
            if status in (BookingStatus.COMPLETED, BookingStatus.CONFIRMED, BookingStatus.IN_PROGRESS):
                pay_status = PaymentStatus.CAPTURED
            elif status == BookingStatus.PENDING:
                pay_status = PaymentStatus.CREATED
            elif status == BookingStatus.CANCELLED:
                pay_status = random.choice([PaymentStatus.REFUNDED, PaymentStatus.FAILED])
            else:
                pay_status = PaymentStatus.FAILED

            refunded = price if pay_status == PaymentStatus.REFUNDED else Decimal("0")
            db.add(Payment(
                booking_id=booking.id,
                razorpay_order_id=f"order_demo_{booking.id[:12]}",
                razorpay_payment_id=f"pay_demo_{booking.id[:12]}" if pay_status in (PaymentStatus.CAPTURED, PaymentStatus.REFUNDED) else None,
                amount=price, currency="INR", status=pay_status, refunded_amount=refunded,
                created_at=created_at,
            ))

            # Review + payout for completed bookings
            if status == BookingStatus.COMPLETED and worker:
                rating = random.choices([5, 4, 3, 2, 1], weights=[45, 30, 15, 7, 3])[0]
                db.add(Review(
                    booking_id=booking.id, customer_id=customer.id, worker_id=worker.id,
                    rating=rating, comment=random.choice(REVIEW_COMMENTS[rating]),
                    created_at=booking.completed_at,
                ))

                commission_pct = Decimal(str(category.commission_pct))
                commission_amount = (price * commission_pct / Decimal("100")).quantize(Decimal("0.01"))
                net_amount = price - commission_amount
                db.add(PayoutLedgerEntry(
                    worker_id=worker.id, booking_id=booking.id,
                    gross_amount=price, commission_amount=commission_amount, net_amount=net_amount,
                    is_paid_out=random.random() < 0.7,
                    created_at=booking.completed_at,
                ))

            bookings.append(booking)

    db.flush()
    print(f"Created {len(bookings)} demo bookings with payments, status history, reviews, and payout ledger entries.")
    return bookings


def create_payouts(db, workers):
    count = 0
    for worker in workers:
        entries = db.query(PayoutLedgerEntry).filter(
            PayoutLedgerEntry.worker_id == worker.id,
            PayoutLedgerEntry.is_paid_out.is_(True),
            PayoutLedgerEntry.payout_id.is_(None),
        ).all()
        if not entries:
            continue
        total = sum((e.net_amount for e in entries), Decimal("0"))
        payout = Payout(
            worker_id=worker.id, amount=total, status=PayoutStatus.PROCESSED,
            razorpay_payout_id=f"payout_demo_{worker.id[:12]}",
            requested_at=datetime.utcnow() - timedelta(days=random.randint(2, 20)),
            processed_at=datetime.utcnow() - timedelta(days=random.randint(0, 2)),
        )
        db.add(payout)
        db.flush()
        for e in entries:
            e.payout_id = payout.id
        count += 1

    # A couple of workers with a REQUESTED (still-pending) payout too
    for worker in random.sample(workers, k=min(2, len(workers))):
        pending_entries = db.query(PayoutLedgerEntry).filter(
            PayoutLedgerEntry.worker_id == worker.id,
            PayoutLedgerEntry.is_paid_out.is_(False),
        ).all()
        if pending_entries:
            total = sum((e.net_amount for e in pending_entries), Decimal("0"))
            db.add(Payout(worker_id=worker.id, amount=total, status=PayoutStatus.REQUESTED))
            count += 1

    db.flush()
    print(f"Created {count} demo payout records (processed + pending).")


def create_complaints(db, bookings):
    completed_or_cancelled = [b for b in bookings if b.status in (BookingStatus.COMPLETED, BookingStatus.CANCELLED)]
    if not completed_or_cancelled:
        return
    sample = random.sample(completed_or_cancelled, k=min(4, len(completed_or_cancelled)))
    statuses = [ComplaintStatus.OPEN, ComplaintStatus.IN_REVIEW, ComplaintStatus.RESOLVED, ComplaintStatus.DISMISSED]
    for i, booking in enumerate(sample):
        raised_by = ComplaintRaisedBy.CUSTOMER if random.random() < 0.75 else ComplaintRaisedBy.WORKER
        raiser_user_id = booking.customer.user_id if raised_by == ComplaintRaisedBy.CUSTOMER else (
            booking.worker.user_id if booking.worker else booking.customer.user_id
        )
        status = statuses[i % len(statuses)]
        db.add(Complaint(
            booking_id=booking.id, raised_by=raised_by, raised_by_user_id=raiser_user_id,
            description=COMPLAINT_TEXTS[i % len(COMPLAINT_TEXTS)],
            status=status,
            resolution_note="Refund processed and worker coached on punctuality." if status == ComplaintStatus.RESOLVED else (
                "Reviewed and found not to violate policy." if status == ComplaintStatus.DISMISSED else None
            ),
            refund_issued=Decimal(str(round(float(booking.price_quoted) * 0.5, 2))) if status == ComplaintStatus.RESOLVED else None,
            resolved_at=datetime.utcnow() - timedelta(days=random.randint(1, 10)) if status in (ComplaintStatus.RESOLVED, ComplaintStatus.DISMISSED) else None,
        ))
    db.flush()
    print(f"Created {len(sample)} demo complaints across OPEN/IN_REVIEW/RESOLVED/DISMISSED.")


def create_notifications(db, customers, workers, bookings):
    count = 0
    completed = [b for b in bookings if b.status == BookingStatus.COMPLETED][:8]
    for booking in completed:
        cat_name = booking.category.name
        db.add(Notification(
            user_id=booking.customer.user_id, channel=NotificationChannel.PUSH,
            title="Booking confirmed", body=f"Your {cat_name} booking has been confirmed.",
            read_at=datetime.utcnow() - timedelta(days=1), created_at=booking.created_at,
        ))
        db.add(Notification(
            user_id=booking.customer.user_id, channel=NotificationChannel.IN_APP,
            title="Payment received", body=f"We've received your payment of ₹{booking.price_quoted} for booking #{booking.id[:8]}.",
            created_at=booking.created_at,
        ))
        if booking.worker:
            db.add(Notification(
                user_id=booking.worker.user_id, channel=NotificationChannel.PUSH,
                title="New booking assigned", body=f"You've been assigned a {cat_name} booking.",
                read_at=booking.created_at, created_at=booking.created_at,
            ))
        count += 2

    for worker in [w for w in workers if w.verification_status != VerificationStatus.APPROVED][:4]:
        db.add(Notification(
            user_id=worker.user_id, channel=NotificationChannel.IN_APP,
            title="KYC update", body=f"Your KYC documents have been reviewed. Status: {worker.verification_status.value}.",
        ))
        count += 1

    db.flush()
    print(f"Created {count} demo notifications.")


def create_second_admin(db):
    email = "ops.admin@maidkaro.com"
    if db.query(AdminProfile).filter(AdminProfile.email == email).first():
        return
    user = User(phone="+919700000001", role=Role.ADMIN)
    db.add(user)
    db.flush()
    db.add(AdminProfile(
        user_id=user.id, full_name="Priyanka Ops Admin", email=email,
        password_hash=hash_password("ChangeMe123!"),
    ))
    print(f"Created ops admin: {email} / ChangeMe123! (CHANGE THIS IMMEDIATELY)")


def seed_demo(force: bool = False):
    Base.metadata.create_all(bind=engine)
    # Ensure the base launch data (city, categories, pincodes, super-admin) exists first.
    seed_base()

    db = SessionLocal()
    try:
        if already_seeded(db) and not force:
            print("Demo data already seeded (platform_settings.demo_data_seeded_v1 present). "
                  "Run with --force to wipe and reseed.")
            return
        if force:
            wipe_demo_data(db)

        city = db.query(City).filter(City.name == "Siliguri").first()
        zone = db.query(ServiceZone).filter(ServiceZone.city_id == city.id).first()
        pincodes = db.query(Pincode).filter(Pincode.service_zone_id == zone.id).all()
        categories = db.query(ServiceCategory).all()

        create_second_admin(db)
        customers = create_customers(db, city, pincodes)
        workers = create_workers(db, city, zone, categories)
        db.commit()

        admin = db.query(AdminProfile).filter(AdminProfile.email == "admin@maidkaro.com").first()
        bookings = create_bookings_and_downstream(db, customers, workers, categories, city, admin.user_id if admin else None)
        db.commit()

        create_payouts(db, workers)
        create_complaints(db, bookings)
        create_notifications(db, customers, workers, bookings)

        db.add(PlatformSetting(key=DEMO_SEED_MARKER_KEY, value=datetime.utcnow().isoformat()))
        db.commit()

        print("\nDemo dataset seeded successfully.")
        print(f"  {len(customers)} customers, {len(workers)} workers, {len(bookings)} bookings.")
        print("  All demo phone numbers use the +9198xxxxxxx (customers) / "
              "+9197xxxxxxx (workers) ranges — synthetic, not real numbers.")
        print("  Demo admin logins:")
        print("    admin@maidkaro.com / ChangeMe123!  (super admin)")
        print("    ops.admin@maidkaro.com / ChangeMe123!  (admin)")
    finally:
        db.close()


if __name__ == "__main__":
    seed_demo(force="--force" in sys.argv)
