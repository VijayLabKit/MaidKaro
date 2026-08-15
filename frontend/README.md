# MaidKaro — Frontend Applications

> **Built and designed under the leadership of Ishan Chowdhury and Team.**  
> Delivering consumer-first digital experiences and high-efficiency operational dashboards for India's household services ecosystem.

---

## 1. Overview

The `frontend` directory houses two dedicated **Next.js 16 (App Router)** applications powered by **TypeScript**, **Tailwind CSS**, and **shadcn/ui**, with unified MaidKaro navy and gold visual branding.

1. **`customer-web/`** — Consumer Web App (Port `3000`)
   - Complete booking lifecycle (Services catalog, worker browsing, slot scheduling, direct address management, order tracking, ratings & reviews).
   - Frictionless phone OTP login with localStorage JWT management.
2. **`admin-dashboard/`** — Operations & Trust Dashboard (Port `3001`)
   - Platform analytics, KYC verification queues, worker onboarding & skill approval, booking dispute resolution, payout tracking, and city/zone catalog management.

---

## 2. Tech Stack

- **Framework**: Next.js 16 (App Router + Turbopack)
- **Language**: TypeScript 5+
- **Styling**: Tailwind CSS & CSS Variables
- **UI Components**: shadcn/ui & Radix UI Primitives
- **Icons**: Lucide React
- **HTTP Client**: Native Fetch with typed API layers (`lib/api.ts`)

---

## 3. Directory Layout

```
frontend/
├── customer-web/            # Customer-facing web application
│   ├── public/              # Brand assets (logo-full-light.png, icon-gold.png, etc.)
│   ├── src/
│   │   ├── app/             # App router pages (Home, Services, Workers, Book, Bookings, Profile, Login)
│   │   ├── components/      # UI components, header, footer, dialogs
│   │   └── lib/             # API client, auth context, TypeScript mappers
│   ├── package.json
│   └── .env.local           # NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api/v1
│
└── admin-dashboard/         # Operations & admin console
    ├── public/              # Brand assets (logo.png, icon-gold.png, favicons)
    ├── src/
    │   ├── app/             # Dashboard, Workers, Bookings, Customers, Complaints, Categories, Cities, Login
    │   ├── components/      # Sidebar, layout wrappers, data tables
    │   └── lib/             # API client, admin auth context
    ├── package.json
    └── .env.local           # NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api/v1
```

---

## 4. Getting Started

### 4.1 Running Customer Web App

```bash
cd frontend/customer-web

# Install dependencies
npm install

# Start development server (Default: http://localhost:3000)
npm run dev
```

### 4.2 Running Admin Dashboard

```bash
cd frontend/admin-dashboard

# Install dependencies
npm install

# Start development server on Port 3001 (Default: http://localhost:3001)
npm run dev -- -p 3001
```

> **Admin Login Credentials**:
> - Email: `admin@maidkaro.com`
> - Password: `ChangeMe123!`

---

## 5. Build Verification

Both applications build cleanly for production using Next.js Turbopack:

```bash
# Customer Web
cd frontend/customer-web && npm run build

# Admin Dashboard
cd frontend/admin-dashboard && npm run build
```
