# Deploy to Railway

ระบบนี้ deploy เป็น 3 services บน Railway: **PostgreSQL**, **backend** (NestJS), **frontend** (React).
โครงสร้างเป็น monorepo — Railway ใช้ "Root Directory" แยกแต่ละ service จาก repo เดียวได้

> หมายเหตุ: ผมเตรียมไฟล์ config + workflow ให้ครบแล้ว ขั้นตอนกดจริงด้านล่างทำในบัญชี GitHub/Railway ของคุณเอง

---

## 1) ขึ้น GitHub

```bash
cd memo-system
git init
git add .
git commit -m "MEMO Management System"
git branch -M main
git remote add origin https://github.com/<you>/memo-system.git
git push -u origin main
```

หรือรันสคริปต์ที่เตรียมไว้ให้ในเครื่องคุณ (ผ่าน Git Bash / PowerShell / cmd):

```bash
bash scripts/init-git.sh https://github.com/<you>/memo-system.git
# Windows: scripts\init-git.bat https://github.com/<you>/memo-system.git
```

> หมายเหตุ: ผมรัน `git` ในแซนด์บ็อกซ์นี้ไม่ได้ (ระบบไฟล์ที่ mount ไม่รองรับ git lock) จึงเตรียมเป็นสคริปต์ให้รันบนเครื่องคุณแทน

---

## 2) สร้าง Project + PostgreSQL บน Railway

1. railway.app → **New Project** → **Deploy PostgreSQL**
2. คลิกที่ Postgres → แท็บ **Variables** → คัดลอกค่า `DATABASE_URL` (รูปแบบ `postgresql://...`)

---

## 3) Backend service

1. ใน Project เดิม → **New** → **GitHub Repo** → เลือก repo `memo-system`
2. แท็บ **Settings** → **Root Directory** = `backend`
   (Railway จะตรวจเจอ `backend/Dockerfile` + `backend/railway.json` อัตโนมัติ)
3. แท็บ **Variables** ตั้งค่า:

   | Key | Value |
   |---|---|
   | `DATABASE_URL` | `${{ Postgres.DATABASE_URL }}` (อ้างอิงจาก service Postgres) |
   | `JWT_SECRET` | สตริงสุ่มยาว ๆ |
   | `JWT_EXPIRES_IN` | `8h` |
   | `APP_URL` | URL ของ backend (เช่น `https://memo-backend.up.railway.app`) |
   | `NODE_ENV` | `production` |

4. Deploy. ตอน boot คอนเทนเนอร์จะรัน `prisma db push` + `prisma db seed` ให้อัตโนมัติ
   (สร้างตาราง + ฟังก์ชัน `next_memo_no` + seed บริษัท/แผนก/ผู้ใช้)
5. แท็บ **Settings → Networking → Generate Domain** เพื่อให้ backend มี public URL

---

## 4) Frontend service

1. **New** → **GitHub Repo** → repo เดิม
2. **Settings → Root Directory** = `frontend`
3. **Variables → Build-time**: ตั้ง `VITE_API_URL` = public URL ของ backend (จากข้อ 3.5)
   > สำคัญ: `VITE_API_URL` ถูกฝังตอน build จึงต้องตั้งก่อน deploy และ redeploy ถ้าเปลี่ยน
4. Deploy → **Generate Domain** เพื่อเปิดหน้าเว็บ

---

## 5) เปิด CI/CD (GitHub Actions → Railway) — ไม่บังคับ

ไฟล์ `.github/workflows/deploy.yml` จะ test (typecheck + build ทั้ง backend/frontend)
แล้ว deploy เข้า Railway ทุกครั้งที่ push `main`

ตั้งค่าใน GitHub repo → **Settings → Secrets and variables → Actions**:

- **Secrets**
  - `RAILWAY_TOKEN` — Railway → Account/Project Settings → **Tokens** → สร้าง token
  - `VITE_API_URL` — public URL ของ backend (ใช้ตอน build ใน CI)
- **Variables**
  - `RAILWAY_BACKEND_SERVICE` — ชื่อ service backend ใน Railway
  - `RAILWAY_FRONTEND_SERVICE` — ชื่อ service frontend ใน Railway

> ถ้าใช้ "Deploy from GitHub" ของ Railway อยู่แล้ว (auto-deploy on push) จะข้าม workflow นี้ก็ได้

---

## 6) หลัง deploy

- เข้า frontend URL → ล็อกอินด้วย `admin@loveandaman.com` / `admin123`
- **เปลี่ยนรหัส admin ทันที** และตั้ง `JWT_SECRET` ที่ปลอดภัย
- (production) แนะนำเปลี่ยน start ของ backend จาก `prisma db push` เป็น migration:
  สร้าง migration ด้วย `npx prisma migrate dev` ในเครื่อง แล้วใช้ `npx prisma migrate deploy` บน host

---

## หมายเหตุ AWS S3 (ไฟล์แนบ)

ตอนนี้ฟิลด์ Attachment เก็บเป็นข้อความ (ชื่อ/คำอธิบายไฟล์) หากต้องการอัปโหลดไฟล์จริง
ให้ตั้ง `AWS_ACCESS_KEY` / `AWS_SECRET_KEY` / `AWS_BUCKET` แล้วต่อ S3 ในขั้นถัดไป (Phase 2)
