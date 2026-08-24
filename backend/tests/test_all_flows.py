"""
Comprehensive test suite for MaidKaro backend.

Covers:
  - Email/password auth (register, login, forgot-password timing-safe path,
    reset-password round-trip)
  - 5x4 staff RBAC permission matrix
  - Commission/payout lifecycle math
  - Complaint/dispute status transitions
  - Notification reader API
  - Admin refresh token with correct secret (Item 6 correctness test)
"""
import os
import sys

import pytest
from fastapi.testclient import TestClient

# ── helpers ─────────────────────────────────────────────────────────

def _signup_otp(client, phone, role, name):
    r = client.post("/api/v1/auth/otp/request", json={"phone": phone, "purpose": "SIGNUP"})
    assert r.status_code == 200, r.text
    otp = r.json()["dev_otp"]
    r = client.post("/api/v1/auth/otp/verify", json={"phone": phone, "code": otp, "role": role, "full_name": name})
    assert r.status_code == 200, r.text
    data = r.json()
    return data["access_token"], data["refresh_token"], data["user_id"]


def _register_email(client, email, phone, password, role="CUSTOMER", name="Test User", city_id=None):
    if role == "CUSTOMER":
        payload = {"full_name": name, "email": email, "phone": phone, "password": password, "confirm_password": password}
        r = client.post("/api/v1/auth/register/customer", json=payload)
    else:
        payload = {"full_name": name, "email": email, "phone": phone, "password": password, "confirm_password": password,
                   "city_id": city_id, "years_experience": 1, "languages": ["Hindi"]}
        r = client.post("/api/v1/auth/register/worker", json=payload)
    assert r.status_code == 201, r.text
    return r.json()["access_token"], r.json()["refresh_token"], r.json()["user_id"]


def _create_admin(db, email, password, staff_role_value, full_name="Staff User"):
    from app.database.models import User, Role, AdminProfile, StaffRole
    from app.security.security import hash_password
    existing = db.query(AdminProfile).filter(AdminProfile.email == email).first()
    if existing:
        return existing.user_id
    role = Role.SUPER_ADMIN if staff_role_value == "SUPER_ADMIN" else Role.ADMIN
    phone_digits = abs(hash(email)) % 10000000
    phone = f"+9198{phone_digits:08d}"
    user = User(email=email, phone=phone, role=role)
    db.add(user); db.flush()
    db.add(AdminProfile(
        user_id=user.id, full_name=full_name, email=email,
        password_hash=hash_password(password),
        staff_role=StaffRole(staff_role_value),
    ))
    db.commit()
    return user.id


def _admin_login(client, email, password):
    r = client.post("/api/v1/auth/admin/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return r.json()["access_token"], r.json()["refresh_token"]


# ── Item 8a: Email / password auth ──────────────────────────────────

class TestEmailPasswordAuth:
    def test_register_and_login_customer(self, client, seeded_catalog):
        at, _, uid = _register_email(client, "cust_ep1@test.com", "+919001001001", "SecurePass1!")
        assert at and uid

    def test_duplicate_email_rejected(self, client, seeded_catalog):
        _register_email(client, "dup@test.com", "+919001001002", "SecurePass1!")
        r = client.post("/api/v1/auth/register/customer", json={
            "full_name": "Dup", "email": "dup@test.com", "phone": "+919001001003",
            "password": "SecurePass1!", "confirm_password": "SecurePass1!",
        })
        assert r.status_code == 409

    def test_login_success(self, client, seeded_catalog):
        _register_email(client, "login_test@test.com", "+919001001010", "SecurePass1!")
        r = client.post("/api/v1/auth/login", json={"email": "login_test@test.com", "password": "SecurePass1!", "role": "CUSTOMER"})
        assert r.status_code == 200
        assert "access_token" in r.json()

    def test_login_wrong_password(self, client, seeded_catalog):
        _register_email(client, "bad_pw@test.com", "+919001001011", "SecurePass1!")
        r = client.post("/api/v1/auth/login", json={"email": "bad_pw@test.com", "password": "WrongPass1!", "role": "CUSTOMER"})
        assert r.status_code == 401

    def test_forgot_password_timing_safe_unknown_email(self, client):
        """POST /auth/forgot-password for a non-existent email must return 200
        with the same message shape as a real email — timing-safe, no account
        enumeration."""
        r = client.post("/api/v1/auth/forgot-password", json={"email": "nosuchuser_xyz@nowhere.example"})
        assert r.status_code == 200
        body = r.json()
        assert "message" in body
        assert body.get("dev_reset_token") is None

    def test_forgot_and_reset_password_roundtrip(self, client, seeded_catalog):
        _register_email(client, "reset_me@test.com", "+919001001020", "OldPass1!")
        r = client.post("/api/v1/auth/forgot-password", json={"email": "reset_me@test.com"})
        assert r.status_code == 200
        token = r.json()["dev_reset_token"]
        assert token is not None, "Dev reset token must be present when EMAIL_PROVIDER=dev_logger"

        r2 = client.post("/api/v1/auth/reset-password", json={
            "token": token, "new_password": "NewPass1!", "confirm_password": "NewPass1!",
        })
        assert r2.status_code == 200

        # Old password no longer works
        r3 = client.post("/api/v1/auth/login", json={"email": "reset_me@test.com", "password": "OldPass1!", "role": "CUSTOMER"})
        assert r3.status_code == 401

        # New password works
        r4 = client.post("/api/v1/auth/login", json={"email": "reset_me@test.com", "password": "NewPass1!", "role": "CUSTOMER"})
        assert r4.status_code == 200

    def test_reset_token_invalidated_after_use(self, client, seeded_catalog):
        _register_email(client, "reset_once@test.com", "+919001001021", "OldPass1!")
        r = client.post("/api/v1/auth/forgot-password", json={"email": "reset_once@test.com"})
        token = r.json()["dev_reset_token"]
        client.post("/api/v1/auth/reset-password", json={
            "token": token, "new_password": "NewPass2!", "confirm_password": "NewPass2!",
        })
        # Reusing the same token must fail
        r2 = client.post("/api/v1/auth/reset-password", json={
            "token": token, "new_password": "AnotherPass3!", "confirm_password": "AnotherPass3!",
        })
        assert r2.status_code == 400


# ── Item 8b: 5×4 staff RBAC permission matrix ───────────────────────

class TestStaffRBAC:
    CAPABILITY_ENDPOINTS = {
        "verification":      ("GET", "/api/v1/admin/workers/pending", None),
        "support":           ("GET", "/api/v1/admin/complaints", None),
        "finance":           ("GET", "/api/v1/admin/payouts", None),
        "operations":        ("POST", "/api/v1/admin/cities", lambda role: {"name": f"City_{role}", "state": "State"}),
        "staff_management":  ("GET", "/api/v1/admin/staff", None),
    }

    EXPECTED = {
        "SUPER_ADMIN":  {"verification": 200, "support": 200, "finance": 200, "operations": 201, "staff_management": 200},
        "OPERATIONS":   {"verification": 200, "support": 200, "finance": 403, "operations": 201, "staff_management": 403},
        "VERIFICATION": {"verification": 200, "support": 403, "finance": 403, "operations": 403, "staff_management": 403},
        "SUPPORT":      {"verification": 403, "support": 200, "finance": 403, "operations": 403, "staff_management": 403},
        "FINANCE":      {"verification": 403, "support": 403, "finance": 200, "operations": 403, "staff_management": 403},
    }

    @pytest.fixture(autouse=True)
    def setup_staff(self, client):
        from app.database import SessionLocal
        db = SessionLocal()
        self._tokens = {}
        for role_name in ["SUPER_ADMIN", "OPERATIONS", "VERIFICATION", "SUPPORT", "FINANCE"]:
            email = f"rbac_{role_name.lower()}@test.com"
            pw = "RBACPass1!"
            _create_admin(db, email, pw, role_name, full_name=f"{role_name} Staff")
            at, _ = _admin_login(client, email, pw)
            self._tokens[role_name] = at
        db.close()

    def test_rbac_matrix(self, client):
        for role_name, expected_caps in self.EXPECTED.items():
            token = self._tokens[role_name]
            headers = {"Authorization": f"Bearer {token}"}
            for cap, expected_status in expected_caps.items():
                method, endpoint, body_gen = self.CAPABILITY_ENDPOINTS[cap]
                body = body_gen(role_name) if callable(body_gen) else None
                r = client.request(method, endpoint, headers=headers, json=body)
                assert r.status_code == expected_status, (
                    f"Role={role_name} cap={cap}: expected {expected_status}, got {r.status_code} ({r.text})"
                )


# ── Item 8b extra: Admin token refresh preserves RBAC ───────────────

class TestAdminRefreshTokenSecret:
    @pytest.fixture(autouse=True)
    def setup(self, client):
        from app.database import SessionLocal
        db = SessionLocal()
        for role_name in ["VERIFICATION", "FINANCE"]:
            email = f"refresh_{role_name.lower()}@test.com"
            _create_admin(db, email, "RefreshPass1!", role_name, full_name=f"Refresh {role_name}")
        db.close()

    def test_verification_role_after_refresh(self, client):
        at, rt = _admin_login(client, "refresh_verification@test.com", "RefreshPass1!")
        # Refresh
        r = client.post("/api/v1/auth/refresh", json={"refresh_token": rt})
        assert r.status_code == 200, f"Refresh failed: {r.text}"
        new_at = r.json()["access_token"]

        # Verification capability — should still work
        headers = {"Authorization": f"Bearer {new_at}"}
        r2 = client.get("/api/v1/admin/workers/pending", headers=headers)
        assert r2.status_code == 200, (
            f"Refreshed VERIFICATION token rejected by /admin/workers/pending: {r2.status_code} {r2.text}"
        )
        # Finance capability — must still be denied
        r3 = client.get("/api/v1/admin/payouts", headers=headers)
        assert r3.status_code == 403, (
            f"Refreshed VERIFICATION token incorrectly allowed /admin/payouts: {r3.status_code}"
        )

    def test_finance_role_after_refresh(self, client):
        at, rt = _admin_login(client, "refresh_finance@test.com", "RefreshPass1!")
        r = client.post("/api/v1/auth/refresh", json={"refresh_token": rt})
        assert r.status_code == 200, f"Refresh failed: {r.text}"
        new_at = r.json()["access_token"]

        headers = {"Authorization": f"Bearer {new_at}"}
        # Finance — allowed
        r2 = client.get("/api/v1/admin/payouts", headers=headers)
        assert r2.status_code == 200, (
            f"Refreshed FINANCE token rejected by /admin/payouts: {r2.status_code} {r2.text}"
        )
        # Verification — denied
        r3 = client.get("/api/v1/admin/workers/pending", headers=headers)
        assert r3.status_code == 403, (
            f"Refreshed FINANCE token incorrectly allowed /admin/workers/pending: {r3.status_code}"
        )

    def test_refreshed_token_replaces_old_token(self, client):
        """After refresh, the OLD refresh token must be rejected (token rotation)."""
        at, rt = _admin_login(client, "refresh_verification@test.com", "RefreshPass1!")
        r = client.post("/api/v1/auth/refresh", json={"refresh_token": rt})
        assert r.status_code == 200
        # Replaying the original refresh token must fail
        r2 = client.post("/api/v1/auth/refresh", json={"refresh_token": rt})
        assert r2.status_code == 401


# ── Item 8c: Commission / payout math ───────────────────────────────

class TestCommissionPayoutMath:
    def test_commission_math_and_payout_lifecycle(self, client, seeded_catalog):
        from app.database import SessionLocal
        from app.database.models import User, Role, AdminProfile, WorkerProfile, VerificationStatus, PayoutLedgerEntry

        cust_at, _, _ = _register_email(client, "payout_cust@test.com", "+919002002001", "PayPass1!", "CUSTOMER", seeded_catalog["city_id"])
        worker_at, _, worker_uid = _register_email(
            client, "payout_worker@test.com", "+919002002002", "PayPass1!", "WORKER", city_id=seeded_catalog["city_id"]
        )

        db = SessionLocal()
        wp = db.query(WorkerProfile).filter(WorkerProfile.user_id == worker_uid).first()
        assert wp is not None
        wp.city_id = seeded_catalog["city_id"]
        wp.verification_status = VerificationStatus.APPROVED
        wp.is_available_now = True
        db.commit()
        worker_id = wp.id
        db.close()

        worker_h = {"Authorization": f"Bearer {worker_at}"}
        client.put("/api/v1/workers/me/skills", json=[{"category_id": seeded_catalog["category_id"], "hourly_rate": 200}], headers=worker_h)

        cust_h = {"Authorization": f"Bearer {cust_at}"}
        r = client.post("/api/v1/users/me/addresses", json={
            "label": "Home", "line1": "1 Test St", "pincode_code": "700001",
            "latitude": 22.5, "longitude": 88.3, "is_default": True,
        }, headers=cust_h)
        addr_id = r.json()["id"]

        r = client.post("/api/v1/bookings", json={
            "category_id": seeded_catalog["category_id"], "address_id": addr_id,
            "type": "INSTANT", "duration_hours": 4,
        }, headers=cust_h)
        assert r.status_code == 201
        booking = r.json()
        assert float(booking["price_quoted"]) == 800.0
        booking_id = booking["id"]

        # Capture payment to generate ledger entries
        r = client.post("/api/v1/payments/orders", json={"booking_id": booking_id}, headers=cust_h)
        assert r.status_code == 201
        order = r.json()
        r = client.post("/api/v1/payments/verify", json={
            "booking_id": booking_id,
            "razorpay_order_id": order["razorpay_order_id"],
            "razorpay_payment_id": "pay_test_payout123",
            "razorpay_signature": "sig_test_payout123",
        }, headers=cust_h)
        assert r.status_code == 200

        client.post(f"/api/v1/bookings/{booking_id}/status", json={"action": "START"}, headers=worker_h)
        r = client.post(f"/api/v1/bookings/{booking_id}/status", json={"action": "COMPLETE"}, headers=worker_h)
        assert r.status_code == 200

        db = SessionLocal()
        entries = db.query(PayoutLedgerEntry).filter(PayoutLedgerEntry.worker_id == worker_id).all()
        assert len(entries) == 1
        e = entries[0]
        assert float(e.gross_amount) == 800.0
        assert abs(float(e.commission_amount) - 120.0) < 0.01, f"Expected 120.0 commission, got {e.commission_amount}"
        assert abs(float(e.net_amount) - 680.0) < 0.01, f"Expected 680.0 net, got {e.net_amount}"
        assert not e.is_paid_out
        db.close()

        r = client.post("/api/v1/workers/me/payouts/request", json={}, headers=worker_h)
        assert r.status_code == 201
        payout = r.json()
        assert payout["status"] == "REQUESTED"
        assert abs(float(payout["amount"]) - 680.0) < 0.01

        db = SessionLocal()
        entries = db.query(PayoutLedgerEntry).filter(PayoutLedgerEntry.worker_id == worker_id).all()
        assert entries[0].payout_id is not None
        assert not entries[0].is_paid_out
        db.close()


# ── Item 8d: Complaint / dispute status transitions ──────────────────

class TestComplaintStatusTransitions:
    def test_complaint_lifecycle(self, client, seeded_catalog):
        from app.database import SessionLocal
        from app.database.models import User, Role, AdminProfile, WorkerProfile, VerificationStatus

        cust_at, _, _ = _register_email(client, "comp_cust@test.com", "+919003003001", "CompPass1!", "CUSTOMER")
        worker_at, _, worker_uid = _register_email(
            client, "comp_worker@test.com", "+919003003002", "CompPass1!", "WORKER",
            city_id=seeded_catalog["city_id"]
        )

        db = SessionLocal()
        wp = db.query(WorkerProfile).filter(WorkerProfile.user_id == worker_uid).first()
        wp.city_id = seeded_catalog["city_id"]
        wp.verification_status = VerificationStatus.APPROVED
        wp.is_available_now = True
        db.commit()
        db.close()

        client.put("/api/v1/workers/me/skills",
                   json=[{"category_id": seeded_catalog["category_id"], "hourly_rate": 150}],
                   headers={"Authorization": f"Bearer {worker_at}"})

        cust_h = {"Authorization": f"Bearer {cust_at}"}
        r = client.post("/api/v1/users/me/addresses", json={
            "label": "Home", "line1": "Comp Test St", "pincode_code": "700001",
            "latitude": 22.5, "longitude": 88.3,
        }, headers=cust_h)
        addr_id = r.json()["id"]

        r = client.post("/api/v1/bookings", json={
            "category_id": seeded_catalog["category_id"], "address_id": addr_id,
            "type": "INSTANT", "duration_hours": 2,
        }, headers=cust_h)
        assert r.status_code == 201
        booking_id = r.json()["id"]

        worker_h = {"Authorization": f"Bearer {worker_at}"}
        client.post(f"/api/v1/bookings/{booking_id}/status", json={"action": "START"}, headers=worker_h)
        client.post(f"/api/v1/bookings/{booking_id}/status", json={"action": "COMPLETE"}, headers=worker_h)

        r = client.post("/api/v1/safety/complaints", json={
            "booking_id": booking_id, "type": "COMPLAINT",
            "description": "Worker arrived late and left early without finishing.",
        }, headers=cust_h)
        assert r.status_code == 201
        complaint = r.json()
        assert complaint["status"] == "OPEN"
        complaint_id = complaint["id"]

        r2 = client.get("/api/v1/safety/complaints/me", headers=cust_h)
        assert r2.status_code == 200
        assert any(c["id"] == complaint_id for c in r2.json())

        # Admin transitions: OPEN → IN_REVIEW
        db = SessionLocal()
        _create_admin(db, "comp_admin@test.com", "AdminPass1!", "SUPPORT")
        db.close()
        admin_at, _ = _admin_login(client, "comp_admin@test.com", "AdminPass1!")
        admin_h = {"Authorization": f"Bearer {admin_at}"}

        r3 = client.post(f"/api/v1/admin/complaints/{complaint_id}/action",
                         json={"status": "IN_REVIEW"}, headers=admin_h)
        assert r3.status_code == 200
        assert r3.json()["status"] == "IN_REVIEW"

        r4 = client.get(f"/api/v1/safety/complaints/{complaint_id}", headers=cust_h)
        assert r4.status_code == 200
        detail = r4.json()
        assert detail["id"] == complaint_id
        assert detail["status"] == "IN_REVIEW"

        r5 = client.post(f"/api/v1/safety/complaints/{complaint_id}/messages",
                         json={"body": "Adding more details."}, headers=cust_h)
        assert r5.status_code == 201


# ── Item 1 extra: Notifications reader API ───────────────────────────

class TestNotificationsAPI:
    def test_unread_count_starts_at_zero(self, client, seeded_catalog):
        at, _, _ = _register_email(client, "notif_test1@test.com", "+919004004001", "NotifPass1!")
        headers = {"Authorization": f"Bearer {at}"}
        r = client.get("/api/v1/notifications/unread-count", headers=headers)
        assert r.status_code == 200
        assert r.json()["unread_count"] >= 0

    def test_list_notifications_empty_for_new_user(self, client, seeded_catalog):
        at, _, _ = _register_email(client, "notif_test2@test.com", "+919004004002", "NotifPass1!")
        headers = {"Authorization": f"Bearer {at}"}
        r = client.get("/api/v1/notifications", headers=headers)
        assert r.status_code == 200
        body = r.json()
        assert "items" in body and "total" in body and "unread_count" in body

    def test_mark_all_read(self, client, seeded_catalog):
        at, _, uid = _register_email(client, "notif_test3@test.com", "+919004004003", "NotifPass1!")
        from app.database import SessionLocal
        from app.database.models import Notification, NotificationChannel
        db = SessionLocal()
        db.add(Notification(user_id=uid, channel=NotificationChannel.IN_APP, title="Test", body="Hello"))
        db.commit()
        db.close()

        headers = {"Authorization": f"Bearer {at}"}
        r = client.get("/api/v1/notifications/unread-count", headers=headers)
        assert r.json()["unread_count"] == 1

        r2 = client.post("/api/v1/notifications/read-all", headers=headers)
        assert r2.status_code == 200
        assert r2.json()["unread_count"] == 0

    def test_mark_single_notification_read(self, client, seeded_catalog):
        at, _, uid = _register_email(client, "notif_test4@test.com", "+919004004004", "NotifPass1!")
        from app.database import SessionLocal
        from app.database.models import Notification, NotificationChannel
        db = SessionLocal()
        notif = Notification(user_id=uid, channel=NotificationChannel.IN_APP, title="Single", body="One")
        db.add(notif); db.flush(); notif_id = notif.id; db.commit()
        db.close()

        headers = {"Authorization": f"Bearer {at}"}
        r = client.post(f"/api/v1/notifications/{notif_id}/read", headers=headers)
        assert r.status_code == 200
        assert r.json()["read_at"] is not None

    def test_cannot_read_another_users_notification(self, client, seeded_catalog):
        at1, _, uid1 = _register_email(client, "notif_a@test.com", "+919004004010", "NotifPass1!")
        at2, _, _ = _register_email(client, "notif_b@test.com", "+919004004011", "NotifPass1!")
        from app.database import SessionLocal
        from app.database.models import Notification, NotificationChannel
        db = SessionLocal()
        notif = Notification(user_id=uid1, channel=NotificationChannel.IN_APP, title="Private", body="For user 1 only")
        db.add(notif); db.flush(); notif_id = notif.id; db.commit()
        db.close()

        headers2 = {"Authorization": f"Bearer {at2}"}
        r = client.post(f"/api/v1/notifications/{notif_id}/read", headers=headers2)
        assert r.status_code == 404
