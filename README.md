# MaidKaro — Next-Gen Household Services Marketplace

> **Developed & Maintained under the leadership of Ishan Chowdhury and Team.**  
> *Transforming, Organizing, and Empowering India's $20B+ Household Services Ecosystem.*

---

## 🌟 Mission, Market Vision & Economic Impact

### 1. Re-architecting India's Domestic Work Market
The Indian domestic and household services sector is an estimated **$20 Billion to $30 Billion+ USD market**. Despite its massive scale, over 90% of this sector remains fragmented, unorganized, and governed by informal word-of-mouth networks with zero transparency.

**MaidKaro** solely expands this Indian market in a revolutionary, digital-first direction:
- **Formalizing the Informal Economy**: Transitioning unorganized domestic labor into a verified, structured, and technology-driven service industry.
- **Fair Market Pricing & Standardization**: Introducing transparent hourly and service-based rate cards, eliminating predatory practices.
- **Reliability & Trust Infrastructure**: Full-stack background checks, government ID verification (Aadhaar/Voter ID), police check records, and rating-backed accountability.

### 2. Women Empowerment & Financial Independence
Over 80% of India's domestic workforce comprises women from lower-income backgrounds who are frequently vulnerable to wage exploitation, erratic schedules, and middlemen deductions.

MaidKaro puts **women's dignity, safety, and financial freedom** at the core of the platform:
- **Direct Digital Payouts**: Automated payout ledgers ensuring 100% of earned wages are transferred directly to workers' bank accounts and UPI IDs without agent commissions.
- **Dignity of Labor & Safety**: SOS emergency protocols, strict customer verification, safety tracking, and dispute arbitration.
- **Skill Progression**: Tiered certifications, specialized training categories (e.g., Deep Cleaning, Infant Care, Elderly Support, Gourmet Cooking), and merit-based earnings growth.

---

## 🏗️ Architecture & Technology Stack

```
                              ┌─────────────────────────────────────────┐
                              │          Client Applications            │
                              ├────────────────────┬────────────────────┤
                              │    Customer Web    │  Admin Dashboard   │
                              │  (Next.js 16/App)  │ (Next.js 16/App)   │
                              │     Port 3000      │     Port 3001      │
                              └─────────┬──────────┴──────────┬─────────┘
                                        │                     │
                                        ▼                     ▼
                              ┌─────────────────────────────────────────┐
                              │          FastAPI Backend API            │
                              │       Python 3.12+ / Port 8000          │
                              │  (JWT Auth, Pydantic, SQLAlchemy 2.0)   │
                              └─────────┬─────────────────────┬─────────┘
                                        │                     │
                      ┌─────────────────┴───────┐   ┌─────────┴─────────────────┐
                      │                         │   │                           │
                      ▼                         ▼   ▼                           ▼
            ┌───────────────────┐     ┌───────────────────┐           ┌───────────────────┐
            │   PostgreSQL 16   │     │      Redis 7      │◄─────────►│   Celery Worker   │
            │  (32+ Relational  │     │   (Cache & Task   │           │    & Beat Sync    │
            │      Tables)      │     │      Broker)      │           │  (Async Actions)  │
            └───────────────────┘     └───────────────────┘           └───────────────────┘
```

- **Backend**: Python 3.12+, FastAPI, SQLAlchemy 2.0 ORM, Alembic Migrations, Uvicorn.
- **Database**: PostgreSQL 16 (relational schema covering bookings, ledgers, payouts, users, KYC, and chat).
- **Asynchronous Processing**: Celery 5.4 with Redis 7 message broker.
- **Customer Web App**: Next.js 16 (App Router), TypeScript, Tailwind CSS, shadcn/ui.
- **Admin Dashboard**: Next.js 16 (App Router), TypeScript, Tailwind CSS, Radix UI primitives.
- **Brand Identity**: Custom navy and gold color palette, official vector & high-resolution PNG assets.

---

## 📂 Repository Structure

```
maidkaro_delivery/
├── backend/                  # FastAPI Application
│   ├── app/                  # Modular backend packages (auth, bookings, workers, admin, etc.)
│   ├── migrations/           # Alembic database migration scripts
│   ├── scripts/              # Seed scripts (seed.py, seed_demo_data.py)
│   ├── .env.example          # Backend environment configuration
│   ├── requirements.txt      # Python dependencies
│   ├── docker-compose.yml    # Docker services orchestration
│   └── Dockerfile            # Container definition
│
├── frontend/
│   ├── customer-web/         # Customer web portal (Next.js 16, Port 3000)
│   │   ├── public/           # Official MaidKaro logos and favicons
│   │   ├── src/              # App router pages & components
│   │   └── package.json
│   │
│   └── admin-dashboard/      # Operations & trust console (Next.js 16, Port 3001)
│       ├── public/           # Official MaidKaro admin assets
│       ├── src/              # Admin dashboard pages & components
│       └── package.json
│
└── README.md                 # Project master guide
```

---

## 🚀 Quick Start Guide

### 1. Start the Backend (FastAPI)

```bash
# 1. Navigate to backend directory
cd backend

# 2. Setup virtual environment
python -m venv venv
# Windows:
venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Configure environment
cp .env.example .env

# 5. Run database migrations & seed comprehensive Indian demo data
alembic upgrade head
python scripts/seed_demo_data.py

# 6. Start the API server
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

- **Interactive API Documentation (Swagger)**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **Alternative Documentation (ReDoc)**: [http://localhost:8000/redoc](http://localhost:8000/redoc)

---

### 2. Start the Customer Web Application

```bash
# Navigate to customer-web
cd frontend/customer-web

# Install dependencies
npm install

# Start development server on Port 3000
npm run dev
```
- Open [http://localhost:3000](http://localhost:3000) in your browser.

---

### 3. Start the Admin Dashboard

```bash
# Navigate to admin-dashboard
cd frontend/admin-dashboard

# Install dependencies
npm install

# Start development server on Port 3001
npm run dev -- -p 3001
```
- Open [http://localhost:3001](http://localhost:3001) in your browser.

---

## 🔑 Default Credentials & Demo Access

The dataset seeded by `seed_demo_data.py` includes synthetic Indian profiles (Siliguri launch area) for testing:

| Role | Email / Login | Password | Purpose |
| :--- | :--- | :--- | :--- |
| **Super Admin** | `admin@maidkaro.com` | `ChangeMe123!` | Full platform administration, KYC approvals, commissions & analytics |
| **Ops Admin** | `ops.admin@maidkaro.com` | `ChangeMe123!` | Daily operations, booking dispatch, and customer support |
| **Demo Customers** | `+9198xxxxxxx` numbers | *OTP via console* | Browse workers, book appointments, make payments |
| **Demo Workers** | `+9197xxxxxxx` numbers | *OTP via console* | Verified workers across Cleaning, Cooking, Childcare |

*(In local dev mode, OTP is logged directly to the backend terminal and returned in the API response payload).*

---

## 🛡️ Security & Quality Highlights

- **Cryptographic Security**: Passwords hashed with `bcrypt`, access tokens issued as standard `HS256` signed JWTs with strict expiration cycles.
- **Cross-Origin Resource Sharing (CORS)**: Pre-configured to allow secure communication with both consumer (`:3000`) and administrative (`:3001`) origins.
- **Production Build Ready**: Both Next.js frontends have zero TypeScript or linting errors and compile cleanly with `npm run build`.

---

## 👥 Project Leadership

- **Project Lead & Architecture**: **Ishan Chowdhury and Team**
- **Core Engineering**: MaidKaro Platform Team
- **Website & Brand**: MaidKaro Household Services Pvt. Ltd.

---

## 🔒 Legal & Copyright

Copyright © 2026 VijayLabKit & Ishan Chowdhury. All Rights Reserved.

This repository contains proprietary source code for the **MaidKaro** platform. 
* **No Replication:** Unauthorized copying, cloning, or distribution of this code is strictly prohibited.
* **Commercial Protection:** This architecture and business logic are protected for future commercial development.

