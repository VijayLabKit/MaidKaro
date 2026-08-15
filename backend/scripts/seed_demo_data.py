"""
Seeds a realistic, interconnected, scaled DEMO dataset on top of the base
launch seed (scripts/seed.py) — 50+ customers, 40+ workers, 160+ bookings across
every status (Completed, In Progress, Confirmed, Pending, Cancelled, Disputed),
payments in INR, worker payout ledgers, reviews, notifications, and support complaints.

Everything created here is synthetic and meant for local development and demos only.

Run:
  python scripts/seed_demo_data.py --force    # wipe + reseed full demo data
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
    Notification, NotificationChannel, PlatformSetting, OtpCode,
)
from app.security.security import hash_password
from scripts.seed import seed as seed_base

random.seed(42)  # reproducible demo data across re-runs

DEMO_SEED_MARKER_KEY = "demo_data_seeded_v1"

CUSTOMER_PHONE_PREFIX = "+9198"
WORKER_PHONE_PREFIX = "+9197"

SILIGURI_AREAS = [
    "Sevoke Road", "Hakimpara", "Pradhan Nagar", "Matigara", "Champasari",
    "Khalpara", "Sevoke More", "NJP Area", "Bagdogra Road", "Siliguri Junction",
    "Deshbandhu Para", "Subhas Pally", "Ashrampara", "College Para", "Milan Pally",
    "Burdwan Road", "Hill Cart Road", "Punjabi Para", "Gautam Nagar", "Janta Nagar"
]

CUSTOMER_NAMES = [
    "Ananya Bhattacharya", "Rohan Mukherjee", "Priya Das", "Arjun Roy",
    "Sneha Ghosh", "Vikram Chatterjee", "Ishita Sarkar", "Aditya Basu",
    "Meghna Sengupta", "Karan Dutta", "Riya Banerjee", "Siddharth Chakraborty",
    "Deblina Paul", "Sourav Ganguly", "Tanushree Mondal", "Abhishek Sen",
    "Rituparna Bose", "Deepak Agarwal", "Sarmistha Roy", "Subhashis Dey",
    "Pooja Singhal", "Manoj Tiwari", "Ankita Majumdar", "Rahul Verma",
    "Sayani Ghosh", "Ayan Bhowmick", "Swati Nandi", "Rajesh Sharma",
    "Nandita Guha", "Pinaki Biswas", "Tathagata Sen", "Rashmi Kothari",
    "Amrita Mukherjee", "Joydeep Das", "Paramita Kundu", "Bratati Roy",
    "Sudipta Mitra", "Indranil Mukherjee", "Madhurima Das", "Sanjay Jalan",
    "Rupa Roy", "Prabir Saha", "Alokita Ghosh", "Debabrata Pal",
    "Payel Banerjee", "Chiranjit Barman", "Soma Majumder", "Kaushik Chanda",
    "Sanchari Kar", "Avik Sengupta"
]

WORKER_NAMES = [
    ("Lakshmi Devi", "F"), ("Kajal Oraon", "F"), ("Manju Rai", "F"),
    ("Sunita Toppo", "F"), ("Rekha Barman", "F"), ("Puja Lohar", "F"),
    ("Anita Minj", "F"), ("Shobha Adhikari", "F"), ("Kiran Chettri", "F"),
    ("Bimla Devi", "F"), ("Sarita Kujur", "F"), ("Gita Pradhan", "F"),
    ("Mina Sharma", "F"), ("Poonam Thapa", "F"), ("Tara Gurung", "F"),
    ("Basanti Roy", "F"), ("Kusum Munda", "F"), ("Parbati Tamang", "F"),
    ("Rita Mangar", "F"), ("Mamata Sarkar", "F"), ("Suniti Das", "F"),
    ("Shanti Soren", "F"), ("Maya Lepcha", "F"), ("Champa Ghosh", "F"),
    ("Laxmi Barua", "F"), ("Kalpana Biswas", "F"), ("Jayanti Paul", "F"),
    ("Anima Mondal", "F"), ("Sushila Khatiwada", "F"), ("Phoolkumari Devi", "F"),
    ("Asha Subba", "F"), ("Durga Chettri", "F"), ("Kalyani Bhowmick", "F"),
    ("Menoka Adhikari", "F"), ("Rina Roy", "F"),
    ("Ramesh Oraon", "M"), ("Bipin Rai", "M"), ("Suresh Barman", "M"),
    ("Govind Sharma", "M"), ("Narayan Thapa", "M"), ("Pradeep Singh", "M"),
    ("Uttam Sarkar", "M"), ("Bikash Ghosh", "M"), ("Prakash Das", "M"),
    ("Dharmendra Prasad", "M"),
]

LANGUAGES_POOL = [
    ["Bengali", "Hindi"],
    ["Bengali", "Hindi", "English"],
    ["Nepali", "Hindi"],
    ["Hindi", "Bengali"],
    ["Bengali"],
    ["Nepali", "Bengali"],
]

REVIEW_COMMENTS = {
    5: [
        "Extremely punctual and thorough — my kitchen and living room haven't been this clean in months.",
        "Very trustworthy, worked carefully around my elderly mother. Highly recommend!",
        "Great with my kids, patient and warm. Will book again every week.",
        "Professional from start to finish, brought her own supplies and completed on time.",
        "Cooks authentic North Indian and Bengali dishes just like home. Absolutely wonderful.",
        "Amazing deep cleaning service! Bathrooms and balconies are spotless.",
    ],
    4: [
        "Good work overall, arrived a few minutes late but made up for it with quality.",
        "Solid cleaning job, missed one small corner under the sofa but fixed it cheerfully when asked.",
        "Friendly and efficient, will definitely consider booking again.",
        "Nice cooking, adjusted spices according to our taste preferences.",
    ],
    3: [
        "Average experience — the work was okay but not particularly detailed.",
        "Got the job done but had to ask for a few spots to be wiped down again.",
        "Decent work, slightly slow on completion.",
    ],
    2: [
        "Arrived 45 minutes late without any prior notice, work quality was below expectations.",
        "Did not follow instructions regarding fragile glassware. Would like a reassignment next time.",
    ],
    1: [
        "Did not show up on time and left the job half-finished. Requested a customer support refund.",
    ],
}

COMPLAINT_TEXTS = [
    "Worker arrived 45 minutes late and rushed through the last two rooms.",
    "Small chip on a kitchen ceramic mug during utensil washing — requesting incident report.",
    "Customer added 3 extra rooms and deep balcony scrubbing that were not in the booking scope.",
    "Worker was very polite but could not stay for the full duration due to a medical emergency.",
    "Service was completed well, but the customer requested a partial refund claiming missed timing.",
    "Wrong address landmark provided by customer, delayed arrival by 30 minutes.",
    "Floor cleaning liquid was not available at site despite prior confirmation.",
    "Worker completed full 3 hours of cooking, excellent quality, dispute dismissed.",
]


def phone(prefix: str, idx: int) -> str:
    return f"{prefix}{idx:08d}"


def bulk_delete(query):
    for obj in query.all():
        query.session.delete(obj)


def wipe_demo_data(db):
    print("Wiping existing demo data...")
    demo_customers = db.query(User).filter(User.phone.like(f"{CUSTOMER_PHONE_PREFIX}%")).all()
    demo_workers = db.query(User).filter(User.phone.like(f"{WORKER_PHONE_PREFIX}%")).all()
    demo_admins = db.query(User).filter(User.phone == "+919900000001").all()
    demo_users = demo_customers + demo_workers + demo_admins
    demo_user_ids = [u.id for u in demo_users]
    demo_phones = [u.phone for u in demo_users]

    customer_ids = [c.id for c in db.query(CustomerProfile).filter(CustomerProfile.user_id.in_(demo_user_ids)).all()]
    worker_ids = [w.id for w in db.query(WorkerProfile).filter(WorkerProfile.user_id.in_(demo_user_ids)).all()]

    bookings = []
    if customer_ids:
        bookings += db.query(Booking).filter(Booking.customer_id.in_(customer_ids)).all()
    if worker_ids:
        bookings += db.query(Booking).filter(Booking.worker_id.in_(worker_ids)).all()
    booking_ids = list({b.id for b in bookings})

    from app.database.models import ChatThread, ChatMessage, DeviceToken, EmergencyContact, FavoriteWorker, SafetyIncident, MaskedCallSession
    threads = db.query(ChatThread).filter(
        (ChatThread.created_by_user_id.in_(demo_user_ids)) |
        (ChatThread.booking_id.in_(booking_ids)) if booking_ids else (ChatThread.created_by_user_id.in_(demo_user_ids))
    ).all()
    thread_ids = [t.id for t in threads]
    if thread_ids:
        bulk_delete(db.query(ChatMessage).filter(ChatMessage.thread_id.in_(thread_ids)))
        bulk_delete(db.query(ChatThread).filter(ChatThread.id.in_(thread_ids)))

    if demo_user_ids:
        bulk_delete(db.query(SafetyIncident).filter(
            (SafetyIncident.triggered_by_user_id.in_(demo_user_ids)) |
            ((SafetyIncident.booking_id.in_(booking_ids)) if booking_ids else False)
        ))
        bulk_delete(db.query(MaskedCallSession).filter(
            (MaskedCallSession.initiated_by_user_id.in_(demo_user_ids)) |
            ((MaskedCallSession.booking_id.in_(booking_ids)) if booking_ids else False)
        ))
        bulk_delete(db.query(DeviceToken).filter(DeviceToken.user_id.in_(demo_user_ids)))
        bulk_delete(db.query(EmergencyContact).filter(EmergencyContact.user_id.in_(demo_user_ids)))

    if demo_phones:
        bulk_delete(db.query(OtpCode).filter(OtpCode.user_phone.in_(demo_phones)))

    if customer_ids:
        bulk_delete(db.query(FavoriteWorker).filter(FavoriteWorker.customer_id.in_(customer_ids)))

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
    print(f"  Removed demo records from database.")


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
            email=f"{first}.{i+1}@example.com",
        )
        db.add(cust)
        db.flush()

        num_addresses = random.choice([1, 2, 2, 3])
        for a in range(num_addresses):
            area = random.choice(SILIGURI_AREAS)
            pincode = random.choice(pincodes)
            db.add(CustomerAddress(
                customer_id=cust.id,
                label="Home" if a == 0 else ("Office" if a == 1 else "Parents Home"),
                line1=f"{random.randint(1, 450)}, {area}",
                line2=f"Near {random.choice(['City Center', 'Vega Circle', 'Hong Kong Market', 'Bidhan Market', 'Deshbandhu Para Park', 'Kanchenjunga Stadium'])}",
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
    # Mix of approved, pending verification, needs resubmission, and rejected workers
    statuses = (
        [VerificationStatus.APPROVED] * 32
        + [VerificationStatus.PENDING_REVIEW] * 6
        + [VerificationStatus.NEEDS_RESUBMISSION] * 4
        + [VerificationStatus.REJECTED] * 3
    )

    for i, (name, _gender) in enumerate(WORKER_NAMES):
        ph = phone(WORKER_PHONE_PREFIX, i)
        user = User(phone=ph, role=Role.WORKER)
        db.add(user)
        db.flush()

        status = statuses[i % len(statuses)]
        rating_count = random.randint(12, 120) if status == VerificationStatus.APPROVED else 0
        rating_avg = round(random.uniform(4.1, 5.0), 1) if rating_count else 0.0

        worker = WorkerProfile(
            user_id=user.id, full_name=name,
            bio=f"{name.split()[0]} has {random.randint(2, 12)} years of professional experience delivering "
                f"exceptional household help and domestic services in Siliguri.",
            city_id=city.id, service_zone_id=zone.id,
            languages=random.choice(LANGUAGES_POOL),
            years_experience=random.randint(2, 12),
            verification_status=status,
            verification_note="Aadhaar and police verification background verified successfully." if status == VerificationStatus.APPROVED
                else ("Address proof document is blurred. Please upload a clear photo of Voter ID or Aadhaar." if status == VerificationStatus.NEEDS_RESUBMISSION
                else ("Background check failed due to address mismatch." if status == VerificationStatus.REJECTED else None)),
            rating_avg=rating_avg,
            rating_count=rating_count,
            is_available_now=random.choice([True, True, True, False]) if status == VerificationStatus.APPROVED else False,
        )
        db.add(worker)
        db.flush()

        # Add 1-3 skills per worker
        assigned_cats = random.sample(categories, k=random.randint(1, min(3, len(categories))))
        for cat in assigned_cats:
            base = float(cat.base_hourly_rate)
            rate = Decimal(str(round(base * random.uniform(0.9, 1.3), 2)))
            db.add(WorkerSkill(
                worker_id=worker.id,
                category_id=cat.id,
                hourly_rate=rate,
            ))

        # Add KYC docs
        doc_types = [DocumentType.GOVERNMENT_ID, DocumentType.ADDRESS_PROOF, DocumentType.POLICE_VERIFICATION]
        for dt in doc_types:
            doc_status = (
                VerificationStatus.APPROVED if status == VerificationStatus.APPROVED else
                (VerificationStatus.PENDING_REVIEW if status == VerificationStatus.PENDING_REVIEW else
                 (VerificationStatus.NEEDS_RESUBMISSION if status == VerificationStatus.NEEDS_RESUBMISSION else VerificationStatus.REJECTED))
            )
            db.add(KycDocument(
                worker_id=worker.id, type=dt,
                file_url=f"https://maidkaro-assets.example.com/demo/kyc/{worker.id[:8]}_{dt.value.lower()}.jpg",
                status=doc_status,
            ))

        # Availability slots (Mon-Sat 8am-7pm)
        if status == VerificationStatus.APPROVED:
            for day in [WeekDay.MON, WeekDay.TUE, WeekDay.WED, WeekDay.THU, WeekDay.FRI, WeekDay.SAT]:
                db.add(AvailabilitySlot(
                    worker_id=worker.id, day=day,
                    start_time="08:00", end_time="19:00",
                ))

        workers.append(worker)

    db.flush()
    print(f"Created {len(workers)} demo workers with skills, KYC docs, and availability.")
    return workers


def create_bookings_and_downstream(db, customers, workers, categories, city, admin_user_id=None):
    approved_workers = [w for w in workers if w.verification_status == VerificationStatus.APPROVED]
    addresses_by_customer = {}
    for c in customers:
        addresses_by_customer[c.id] = db.query(CustomerAddress).filter(CustomerAddress.customer_id == c.id).all()

    # Rich distribution of bookings: 160 total
    plan = [
        (BookingStatus.COMPLETED, 90),
        (BookingStatus.IN_PROGRESS, 20),
        (BookingStatus.CONFIRMED, 25),
        (BookingStatus.PENDING, 15),
        (BookingStatus.CANCELLED, 10),
    ]

    bookings = []
    now = datetime.utcnow()

    for status, count in plan:
        for _ in range(count):
            customer = random.choice(customers)
            addresses = addresses_by_customer.get(customer.id, [])
            if not addresses:
                continue
            address = random.choice(addresses)
            category = random.choice(categories)
            worker = random.choice(approved_workers) if approved_workers and status != BookingStatus.PENDING else (
                random.choice(approved_workers) if approved_workers and random.random() < 0.5 else None
            )
            duration = Decimal(random.choice(["2.0", "3.0", "4.0", "5.0", "1.5"]))
            price = (Decimal(str(category.base_hourly_rate)) * duration).quantize(Decimal("0.01"))
            booking_type = random.choice([BookingType.INSTANT, BookingType.SCHEDULED])

            days_ago = random.randint(1, 75)
            created_at = now - timedelta(days=days_ago, hours=random.randint(0, 23))
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
                notes=random.choice([
                    "Please bring kitchen degreaser and floor mop.",
                    "Elderly parents at home, please be gentle and quiet.",
                    "Cook spicy North Indian dinner for 4 people.",
                    "Full apartment sweeping, mopping, and bathroom cleaning.",
                    None, None
                ]),
                cancel_reason="Customer had an unexpected travel schedule." if status == BookingStatus.CANCELLED else None,
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
                BookingStatus.COMPLETED: [(None, BookingStatus.PENDING), (BookingStatus.PENDING, BookingStatus.CONFIRMED), (BookingStatus.CONFIRMED, BookingStatus.IN_PROGRESS), (BookingStatus.COMPLETED, BookingStatus.COMPLETED)],
                BookingStatus.CANCELLED: [(None, BookingStatus.PENDING), (BookingStatus.PENDING, BookingStatus.CANCELLED)],
            }
            for from_s, to_s in transitions.get(status, [(None, status)]):
                db.add(BookingStatusEvent(
                    booking_id=booking.id, from_status=from_s, to_status=to_s,
                    actor=worker.user_id if (worker and to_s == BookingStatus.CONFIRMED) else "SYSTEM",
                    created_at=created_at,
                ))

            # Payment records
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

            # Review & Payout Ledger for completed bookings
            if status == BookingStatus.COMPLETED and worker:
                rating = random.choices([5, 4, 3, 2, 1], weights=[50, 30, 12, 5, 3])[0]
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
                    is_paid_out=random.random() < 0.8,
                    created_at=booking.completed_at,
                ))

            bookings.append(booking)

    db.flush()
    print(f"Created {len(bookings)} demo bookings with payments, reviews, and payout ledger entries.")
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
            requested_at=datetime.utcnow() - timedelta(days=random.randint(5, 30)),
            processed_at=datetime.utcnow() - timedelta(days=random.randint(0, 3)),
        )
        db.add(payout)
        db.flush()
        for e in entries:
            e.payout_id = payout.id
        count += 1

    # Pending payout requests
    for worker in random.sample(workers, k=min(6, len(workers))):
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
    sample = random.sample(completed_or_cancelled, k=min(18, len(completed_or_cancelled)))
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
            resolution_note="Refund processed and service guidelines reiterated to the worker." if status == ComplaintStatus.RESOLVED else (
                "Verified via audit trail and dismissed as policy-compliant." if status == ComplaintStatus.DISMISSED else None
            ),
            refund_issued=Decimal(str(round(float(booking.price_quoted) * 0.5, 2))) if status == ComplaintStatus.RESOLVED else None,
            resolved_at=datetime.utcnow() - timedelta(days=random.randint(1, 15)) if status in (ComplaintStatus.RESOLVED, ComplaintStatus.DISMISSED) else None,
        ))
    db.flush()
    print(f"Created {len(sample)} demo complaints across OPEN, IN_REVIEW, RESOLVED, and DISMISSED.")


def create_notifications(db, customers, workers, bookings):
    count = 0
    completed = [b for b in bookings if b.status == BookingStatus.COMPLETED][:20]
    for booking in completed:
        cat_name = booking.category.name
        db.add(Notification(
            user_id=booking.customer.user_id, channel=NotificationChannel.PUSH,
            title="Booking Confirmed", body=f"Your {cat_name} booking is confirmed.",
            read_at=datetime.utcnow() - timedelta(days=1), created_at=booking.created_at,
        ))
        db.add(Notification(
            user_id=booking.customer.user_id, channel=NotificationChannel.IN_APP,
            title="Payment Received", body=f"We've received your payment of ₹{booking.price_quoted} for booking #{booking.id[:8]}.",
            created_at=booking.created_at,
        ))
        if booking.worker:
            db.add(Notification(
                user_id=booking.worker.user_id, channel=NotificationChannel.PUSH,
                title="New Booking Assigned", body=f"You've been assigned a {cat_name} appointment.",
                read_at=booking.created_at, created_at=booking.created_at,
            ))
        count += 2

    for worker in [w for w in workers if w.verification_status != VerificationStatus.APPROVED][:8]:
        db.add(Notification(
            user_id=worker.user_id, channel=NotificationChannel.IN_APP,
            title="KYC Verification Update", body=f"Your KYC documents have been reviewed. Status: {worker.verification_status.value}.",
        ))
        count += 1

    db.flush()
    print(f"Created {count} demo notifications.")


def create_second_admin(db):
    email = "ops.admin@maidkaro.com"
    if db.query(AdminProfile).filter(AdminProfile.email == email).first():
        return
    user = User(phone="+919900000001", role=Role.ADMIN)
    db.add(user)
    db.flush()
    db.add(AdminProfile(
        user_id=user.id, full_name="Priyanka Ops Admin", email=email,
        password_hash=hash_password("ChangeMe123!"),
    ))
    print(f"Created ops admin: {email} / ChangeMe123!")


def seed_demo(force: bool = False):
    Base.metadata.create_all(bind=engine)
    seed_base()

    db = SessionLocal()
    try:
        if already_seeded(db) and not force:
            print("Demo data already seeded. Run with --force to wipe and reseed.")
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

        print("\n[SUCCESS] Large demo dataset seeded successfully!")
        print(f"  * {len(customers)} Customers with multiple addresses")
        print(f"  * {len(workers)} Workers across Approved, Pending, Resubmission, Rejected")
        print(f"  * {len(bookings)} Bookings (Completed, In-Progress, Confirmed, Pending, Cancelled)")
        print(f"  * {len(bookings)} Payment & Ledger records in INR")
        print("  * Demo admin logins:")
        print("    admin@maidkaro.com / ChangeMe123!  (super admin)")
        print("    ops.admin@maidkaro.com / ChangeMe123!  (admin)")
    finally:
        db.close()


if __name__ == "__main__":
    seed_demo(force="--force" in sys.argv)
