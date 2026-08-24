# MaidKaro — Backend (FastAPI)

> **Built and architected under the leadership of Ishan Chowdhury and Team.**  
> Transforming India's $20B+ domestic work ecosystem through secure, scalable, and high-performance microservices.

---

## 1. Overview & Impact

The **MaidKaro Backend** is an enterprise-grade, asynchronous RESTful API platform built with **Python 3.12+**, **FastAPI**, **SQLAlchemy 2.0**, **PostgreSQL**, **Redis**, and **Celery**.

### Socio-Economic Vision & Women Empowerment
In India, domestic household work represents an informal market exceeding **$20 Billion USD**, heavily populated by women who have historically lacked institutional support, fair wage guarantees, and safety protections. 

MaidKaro empowers female domestic workers through:
- **Direct Financial Inclusion**: Integrated payout ledgers ensuring 100% transparent, direct bank/UPI payouts without extortionate middlemen.
- **Safety & Verification**: Multi-factor KYC verification (Aadhaar, Voter ID), police verification tracking, and safety response endpoints.
- **Dignity & Skill Recognition**: Standardized skills catalog, verified reviews, and merit-based rate progression.

---

## 2. Tech Stack

- **Framework**: FastAPI (High-performance ASGI with Uvicorn)
- **Database**: PostgreSQL 16 (psycopg2-binary / SQLAlchemy 2.0 ORM)
- **Migrations**: Alembic
- **Async Task Queue**: Celery 5.4 + Redis 7
- **Authentication**: JWT (HS256) with OAuth2 Password Bearer & OTP phone verification
- **Validation**: Pydantic v2 schemas
- **API Docs**: Swagger UI (`/docs`) & ReDoc (`/redoc`)

---

## 3. Directory Structure

```
backend/
├── app/
│   ├── admin/          # Admin operations, metrics & review APIs
│   ├── ai/             # AI match scoring & conversational dispatch
│   ├── analytics/      # Platform health & booking telemetry
│   ├── auth/           # OTP generation, JWT token issuance & verification
│   ├── bookings/       # Booking lifecycle, status state machine & assignment
│   ├── chat/           # Live messaging & channel sockets
│   ├── common/         # Global middleware, errors, utilities & pagination
│   ├── config/         # Pydantic Settings & environment loaders
│   ├── database/       # SQLAlchemy models (32+ tables), session & engine
│   ├── locations/      # Cities, zones, and pincode mapping
│   ├── notifications/  # Multi-channel notification pipeline (SMS, push, in-app)
│   ├── payments/       # Razorpay orders, webhooks & payout ledgers
│   ├── reviews/        # Customer-to-worker ratings and feedback
│   ├── security/       # Password hashing (bcrypt) & auth guards
│   ├── services/       # Service catalog, pricing models & commissions
│   ├── support/        # Complaints, dispute arbitration & resolution
│   ├── users/          # User profiles, customer addresses & roles
│   ├── workers/        # Worker skills, availability calendar & KYC verification
│   └── main.py         # Application entry point & CORS configuration
├── migrations/         # Alembic database migration scripts
├── scripts/
│   ├── seed.py             # Base system seeds (Cities, categories, admin)
│   └── seed_demo_data.py   # Comprehensive demo dataset generator
├── tests/              # Pytest test suite
├── .env.example        # Environment variables template
├── alembic.ini         # Alembic configuration
├── docker-compose.yml  # Multi-container orchestration
├── Dockerfile          # Production container recipe
└── requirements.txt    # Python dependencies
```

---

## 4. Quick Start (Local Setup)

### 4.1 Prerequisites
- Python 3.11 or 3.12+
- PostgreSQL 16+ (or SQLite for quick lightweight testing)
- Redis 7+ (for background Celery tasks)

### 4.2 Installation

```bash
# Navigate to backend directory
cd backend

# Create and activate virtual environment
python -m venv venv
# Windows:
venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 4.3 Configure Environment Variables

```bash
cp .env.example .env
```

Set your PostgreSQL connection string in `.env`:
```env
DATABASE_URL=postgresql+psycopg2://maidkaro:maidkaro@localhost:5432/maidkaro
SMS_PROVIDER=dev_logger   # Logs OTP to console and returns dev_otp in API response
```

### 4.4 Run Database Migrations

```bash
alembic upgrade head
```

### 4.5 Seed Demo Data

Run the comprehensive Indian demo seeder (creates realistic demo customers, workers with skills/KYC, bookings, payments, and admin accounts):

```bash
python scripts/seed_demo_data.py
```

*Demo Login Credentials:*
- **Super Admin**: `admin@maidkaro.com` / `ChangeMe123!`
- **Ops Admin**: `ops.admin@maidkaro.com` / `ChangeMe123!`

### 4.6 Start the API Server

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Interactive API documentation will be available at:
- **Swagger UI**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **ReDoc**: [http://localhost:8000/redoc](http://localhost:8000/redoc)

---

## 5. Docker Deployment

To launch the full backend suite (FastAPI, PostgreSQL, Redis, Celery Worker, Celery Beat) using Docker Compose:

```bash
docker compose up --build -d
docker compose exec api alembic upgrade head
docker compose exec api python scripts/seed_demo_data.py
```

---

## 6. Testing & Quality Assurance

Install dev dependencies and run the test suite:
```bash
pip install -r requirements-dev.txt
pytest tests/ -v
```

---

## 🔒 Legal & Copyright

Copyright © 2026 VijayLabKit & Ishan Chowdhury. All Rights Reserved.

This repository contains proprietary source code for the **MaidKaro** platform. 
* **No Replication:** Unauthorized copying, cloning, or distribution of this code is strictly prohibited.
* **Commercial Protection:** This architecture and business logic are protected for future commercial development.

