def _signup(client, phone, role, name):
    r = client.post("/api/v1/auth/otp/request", json={"phone": phone, "purpose": "SIGNUP"})
    assert r.status_code == 200
    otp = r.json()["dev_otp"]
    r = client.post("/api/v1/auth/otp/verify", json={"phone": phone, "code": otp, "role": role, "full_name": name})
    assert r.status_code == 200
    data = r.json()
    return data["access_token"], data["user_id"]


class TestAuth:
    def test_otp_signup_and_login(self, client):
        token, user_id = _signup(client, "+919000000001", "CUSTOMER", "Test Customer")
        assert token and user_id

    def test_wrong_otp_rejected(self, client):
        client.post("/api/v1/auth/otp/request", json={"phone": "+919000000002", "purpose": "SIGNUP"})
        r = client.post("/api/v1/auth/otp/verify", json={"phone": "+919000000002", "code": "000000", "role": "CUSTOMER"})
        assert r.status_code == 400

    def test_invalid_phone_rejected(self, client):
        r = client.post("/api/v1/auth/otp/request", json={"phone": "9812345678", "purpose": "SIGNUP"})
        assert r.status_code == 422

    def test_refresh_token_rotation(self, client):
        token, _ = _signup(client, "+919000000003", "CUSTOMER", "Rotation Test")
        r = client.post("/api/v1/auth/otp/request", json={"phone": "+919000000003", "purpose": "LOGIN"})
        otp = r.json()["dev_otp"]
        r = client.post("/api/v1/auth/otp/verify", json={"phone": "+919000000003", "code": otp, "role": "CUSTOMER"})
        refresh = r.json()["refresh_token"]

        r2 = client.post("/api/v1/auth/refresh", json={"refresh_token": refresh})
        assert r2.status_code == 200

        # Reusing a rotated (already-consumed) refresh token must fail.
        r3 = client.post("/api/v1/auth/refresh", json={"refresh_token": refresh})
        assert r3.status_code == 401


class TestBookingLifecycle:
    def test_full_booking_flow(self, client, seeded_catalog):
        cust_token, _ = _signup(client, "+919000000010", "CUSTOMER", "Booking Customer")
        worker_token, _ = _signup(client, "+919000000011", "WORKER", "Booking Worker")
        cust_h = {"Authorization": f"Bearer {cust_token}"}
        worker_h = {"Authorization": f"Bearer {worker_token}"}

        r = client.put("/api/v1/workers/me/skills",
                        json=[{"category_id": seeded_catalog["category_id"], "hourly_rate": 220}],
                        headers=worker_h)
        assert r.status_code == 200

        # Admin approves worker
        from app.database import SessionLocal
        from app.database.models import User, Role, AdminProfile, WorkerProfile
        from app.security.security import hash_password
        db = SessionLocal()
        admin_user = User(phone="+919999999901", role=Role.ADMIN)
        db.add(admin_user); db.flush()
        db.add(AdminProfile(user_id=admin_user.id, full_name="Admin", email="admin1@test.com", password_hash=hash_password("Pass1234!")))
        db.commit()
        worker_profile = db.query(WorkerProfile).filter(WorkerProfile.user_id.isnot(None)).order_by(WorkerProfile.created_at.desc()).first()
        db.close()

        r = client.post("/api/v1/auth/admin/login", json={"email": "admin1@test.com", "password": "Pass1234!"})
        admin_h = {"Authorization": f"Bearer {r.json()['access_token']}"}
        r = client.post(f"/api/v1/admin/workers/{worker_profile.id}/verification", json={"action": "APPROVE"}, headers=admin_h)
        assert r.status_code == 200

        client.post("/api/v1/workers/me/availability-now", json={"is_available_now": True}, headers=worker_h)

        r = client.post("/api/v1/users/me/addresses", json={
            "label": "Home", "line1": "1 Test St", "pincode_code": "700001",
            "latitude": 22.5, "longitude": 88.3, "is_default": True,
        }, headers=cust_h)
        address_id = r.json()["id"]

        r = client.post("/api/v1/bookings", json={
            "category_id": seeded_catalog["category_id"], "address_id": address_id,
            "type": "INSTANT", "duration_hours": 3,
        }, headers=cust_h)
        assert r.status_code == 201
        booking = r.json()
        assert booking["status"] == "CONFIRMED"
        assert booking["price_quoted"] == 660.0  # 220 * 3

        # Chat auto-created
        r = client.get("/api/v1/chat/threads", headers=cust_h)
        assert len(r.json()) == 1

        # Invalid transition rejected
        r = client.post(f"/api/v1/bookings/{booking['id']}/status", json={"action": "COMPLETE"}, headers=worker_h)
        assert r.status_code == 400  # can't complete before starting

        r = client.post(f"/api/v1/bookings/{booking['id']}/status", json={"action": "START"}, headers=worker_h)
        assert r.status_code == 200
        r = client.post(f"/api/v1/bookings/{booking['id']}/status", json={"action": "COMPLETE"}, headers=worker_h)
        assert r.status_code == 200

        r = client.post("/api/v1/reviews", json={"booking_id": booking["id"], "rating": 5}, headers=cust_h)
        assert r.status_code == 201


class TestSafety:
    def test_sos_creates_incident_and_thread(self, client):
        token, _ = _signup(client, "+919000000020", "CUSTOMER", "Safety Test")
        headers = {"Authorization": f"Bearer {token}"}
        r = client.post("/api/v1/safety/sos", json={"lat": 22.5, "lng": 88.3, "notes": "test alert"}, headers=headers)
        assert r.status_code == 201
        assert r.json()["status"] == "TRIGGERED"

    def test_emergency_contacts_capped_at_five(self, client):
        token, _ = _signup(client, "+919000000021", "CUSTOMER", "Contact Test")
        headers = {"Authorization": f"Bearer {token}"}
        for i in range(5):
            r = client.post("/api/v1/users/me/emergency-contacts",
                             json={"name": f"Contact {i}", "phone": f"+91900000003{i}"}, headers=headers)
            assert r.status_code == 201
        r = client.post("/api/v1/users/me/emergency-contacts",
                         json={"name": "Sixth", "phone": "+919000000099"}, headers=headers)
        assert r.status_code == 400
