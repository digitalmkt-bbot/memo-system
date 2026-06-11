# MEMO Management System

ระบบบริหารจัดการ MEMO ภายในองค์กร รองรับหลายบริษัท หลายแผนก พร้อมเลขรันนิ่งอัตโนมัติ
(race-safe), การอนุมัติ 3 ขั้น, การสร้าง PDF และ Dashboard สรุปข้อมูล

**Stack:** NestJS + Prisma + PostgreSQL (backend) · React 18 + Vite + TypeScript + TailwindCSS + React Hook Form + Axios (frontend) · Puppeteer (PDF)

---

## Quick start (Docker)

```bash
docker compose up --build
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:3000
- Postgres: localhost:5432 (`memo` / `memo_pass`)

Backend container runs `prisma db push` + `prisma db seed` on boot, which creates the schema,
installs `next_memo_no()`, and seeds:

- **LOVE ISLAND CO., LTD.** (code `LOVE`) — 14 departments
- **ANDAMAN SUNDAY CO., LTD.** (code `ANDAMAN`) — 4 departments
- Default admin: `admin@loveandaman.com` / `admin123` *(change immediately)*
- Demo 3-tier chain (password `Password123!`):

| Email | Role | Step |
|---|---|---|
| ploy@loveandaman.com | staff | สร้าง/ส่ง |
| ops.manager@loveandaman.com | manager | อนุมัติขั้น 1 |
| ceo@loveandaman.com | executive | อนุมัติขั้น 2 |

---

## Local dev (without Docker)

```bash
# Backend
cd backend
cp .env.example .env            # set DATABASE_URL, JWT_SECRET
npm install
npx prisma generate
npm run db:setup                # prisma db push + seed
npm run start:dev               # http://localhost:3000

# Frontend
cd ../frontend
npm install
npm run dev                     # http://localhost:5173
```

---

## Companies & departments

**LOVE ISLAND CO., LTD.** — Secretary, Human Resources, Accounting & Finance,
Business Development / Public Relations, Marketing, Sales Agent, Reservation,
Online, Service, Mechanic, Phuket Port, Tap Lamu Port, Ranong Port, Tap Lamu Port Shop.

**ANDAMAN SUNDAY CO., LTD.** — Sales Agent, Human Resources, Accounting & Finance, Service.

---

## MEMO fields

Company (dropdown) · Department (dynamic dropdown) · Date (auto today) ·
Memo Number (auto, on submit) · From · Subject · Attachment · Detail (≥9 lines).

## Workflow (3-tier)

```
Draft ──submit──> pending_manager ──approve──> pending_executive ──approve──> Approved ──> PDF
                       │                              │
                       └──reject──> Rejected          └──reject──> Rejected
```

`submit` assigns the running number (atomic) and routes to the creator's manager;
manager approve routes to an executive; executive approve closes as `approved`.
Reject at any step requires a reason. Every action is written to `audit_log`.

---

## Running number

Format `No.LOVE 2026-06-001` / `No.ANDAMAN 2026-06-001` — **separate per company, reset monthly,
incremented automatically, duplicate-proof via DB transaction.**

The `next_memo_no(company_id)` function (`backend/prisma/functions.sql`) uses
`INSERT ... ON CONFLICT (company_id, year, month) DO UPDATE ... RETURNING` against
`memo_running`, so concurrent submits to the same company+month are serialized — no gaps,
no duplicates. Called from `MemosService.submit()` inside a Prisma `$transaction`.

---

## API endpoints

| Method | Path | Auth |
|---|---|---|
| POST | /auth/login · /auth/register · /auth/logout | – / admin / jwt |
| GET | /companies · /departments?companyId= | jwt |
| GET/POST | /memos · /memos/:id | jwt |
| PUT/DELETE | /memos/:id | owner (draft) |
| POST | /memos/:id/submit · /approve · /reject | owner / approver |
| GET / POST | /memos/:id/pdf | jwt (GET inline · POST returns `{url}`) |
| GET | /dashboard/summary · /monthly · /company · /department | jwt |

Security: JWT auth, bcrypt password hashing, role-based access control, audit logs,
input validation (class-validator), rate limiting (`@nestjs/throttler`).

---

## Frontend pages

`/login` · `/dashboard` · `/memos` · `/memos/create` · `/memos/edit/:id` ·
`/memos/view/:id` · `/reports` · `/users` · `/settings`

---

## PDF layout (A4 portrait)

Header (company logo + name, "MEMO", memo number) · meta (Date, Department, From,
Subject, Attachment) · Detail (≥9 lines) · Signature section (Prepared By / Approved By / Date).

---

## Project layout

```
memo-system/
├── docker-compose.yml
├── backend/                      # NestJS + Prisma
│   ├── prisma/
│   │   ├── schema.prisma         # models
│   │   ├── functions.sql         # atomic next_memo_no()
│   │   └── seed.ts               # companies / departments / users
│   └── src/
│       ├── auth/ companies/ departments/ dashboard/
│       ├── memos/                # CRUD + workflow + pdf.service
│       └── db/prisma.service.ts
└── frontend/                     # React + Vite + Tailwind + RHF + Axios
    └── src/
        ├── api.ts (axios)  auth.tsx  ui.tsx  App.tsx
        └── pages/                # Login, Dashboard, Memos, MemoForm,
                                  # Create, Edit, View, Reports, Users, Settings
```

## Deploy (Railway)

Backend service `memo-backend` (env: `DATABASE_URL`, `JWT_SECRET`, `APP_URL`, optional `AWS_*`),
frontend service `memo-frontend` (env: `VITE_API_URL`), Railway PostgreSQL.
CI/CD: GitHub push → GitHub Actions → Railway deploy.

## Roadmap

Phase 1 (MVP): auth, create memo, running number, PDF, dashboard.
Phase 2: approval workflow, notifications, audit logs, user management.
Future: digital signature, email/LINE notification, mobile app, multi-language, versioning, OCR.
