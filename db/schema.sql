-- ============================================================
-- MEMO Management System — PostgreSQL schema
-- Multi-company (LOVE / ANDAMAN), multi-department,
-- race-safe running number, 3-tier approval workflow.
-- Auto-applied by the Postgres container on first boot.
-- ============================================================

BEGIN;

-- ---------- Reference data ----------
CREATE TABLE IF NOT EXISTS companies (
  id          SERIAL PRIMARY KEY,
  code        TEXT UNIQUE NOT NULL,            -- LOVE / ANDAMAN
  name        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS departments (
  id          SERIAL PRIMARY KEY,
  company_id  INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  code        TEXT NOT NULL,                   -- MGT / ACC / OPS / SAL / IT
  name        TEXT NOT NULL,
  UNIQUE (company_id, code)
);

-- ---------- Users ----------
CREATE TABLE IF NOT EXISTS users (
  id             SERIAL PRIMARY KEY,
  company_id     INT NOT NULL REFERENCES companies(id),
  department_id  INT REFERENCES departments(id),
  employee_code  TEXT UNIQUE NOT NULL,
  name           TEXT NOT NULL,
  email          TEXT UNIQUE NOT NULL,
  password_hash  TEXT NOT NULL,
  role           TEXT NOT NULL CHECK (role IN ('staff','manager','executive','admin')),
  manager_id     INT REFERENCES users(id),
  active         BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- Memos ----------
CREATE TABLE IF NOT EXISTS memos (
  id                  SERIAL PRIMARY KEY,
  memo_no             TEXT UNIQUE,             -- assigned atomically on submit
  company_id          INT NOT NULL REFERENCES companies(id),
  department_id       INT NOT NULL REFERENCES departments(id),
  title               TEXT NOT NULL,
  body                TEXT NOT NULL,
  category            TEXT NOT NULL DEFAULT 'general',
  priority            TEXT NOT NULL DEFAULT 'normal'
                      CHECK (priority IN ('low','normal','high','urgent')),
  amount              NUMERIC(14,2),
  creator_id          INT NOT NULL REFERENCES users(id),
  status              TEXT NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft','pending_manager','pending_executive','approved','rejected','cancelled')),
  current_approver_id INT REFERENCES users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_at        TIMESTAMPTZ,
  closed_at           TIMESTAMPTZ
);

-- ---------- Approval history ----------
CREATE TABLE IF NOT EXISTS approvals (
  id           SERIAL PRIMARY KEY,
  memo_id      INT NOT NULL REFERENCES memos(id) ON DELETE CASCADE,
  step         TEXT NOT NULL CHECK (step IN ('manager','executive')),
  approver_id  INT NOT NULL REFERENCES users(id),
  action       TEXT NOT NULL CHECK (action IN ('approve','reject')),
  comment      TEXT,
  acted_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- Audit log ----------
CREATE TABLE IF NOT EXISTS audit_log (
  id          SERIAL PRIMARY KEY,
  memo_id     INT REFERENCES memos(id) ON DELETE CASCADE,
  user_id     INT REFERENCES users(id),
  action      TEXT NOT NULL,
  detail      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- Running-number counter ----------
-- One row per (company, YYYY-MM). The atomic UPSERT below takes a row lock,
-- so concurrent submits to the same company+month are fully serialized.
CREATE TABLE IF NOT EXISTS memo_counters (
  company_id  INT NOT NULL REFERENCES companies(id),
  period      TEXT NOT NULL,                   -- 'YYYY-MM'
  last_seq    INT NOT NULL DEFAULT 0,
  PRIMARY KEY (company_id, period)
);

-- ============================================================
-- next_memo_no(company_id) -> e.g. 'No.LOVE 2026-05-001'
-- Atomic via INSERT ... ON CONFLICT DO UPDATE ... RETURNING.
-- ============================================================
CREATE OR REPLACE FUNCTION next_memo_no(p_company_id INT)
RETURNS TEXT AS $$
DECLARE
  v_period TEXT := to_char(now(), 'YYYY-MM');
  v_code   TEXT;
  v_seq    INT;
BEGIN
  SELECT code INTO v_code FROM companies WHERE id = p_company_id;
  IF v_code IS NULL THEN
    RAISE EXCEPTION 'Unknown company_id %', p_company_id;
  END IF;

  INSERT INTO memo_counters (company_id, period, last_seq)
    VALUES (p_company_id, v_period, 1)
  ON CONFLICT (company_id, period)
    DO UPDATE SET last_seq = memo_counters.last_seq + 1
  RETURNING last_seq INTO v_seq;

  RETURN 'No.' || v_code || ' ' || v_period || '-' || lpad(v_seq::text, 3, '0');
END;
$$ LANGUAGE plpgsql;

-- ---------- Indexes ----------
CREATE INDEX IF NOT EXISTS idx_memos_company   ON memos(company_id);
CREATE INDEX IF NOT EXISTS idx_memos_dept      ON memos(department_id);
CREATE INDEX IF NOT EXISTS idx_memos_creator   ON memos(creator_id);
CREATE INDEX IF NOT EXISTS idx_memos_approver  ON memos(current_approver_id);
CREATE INDEX IF NOT EXISTS idx_memos_status    ON memos(status);
CREATE INDEX IF NOT EXISTS idx_memos_created   ON memos(created_at);
CREATE INDEX IF NOT EXISTS idx_approvals_memo  ON approvals(memo_id);
CREATE INDEX IF NOT EXISTS idx_audit_memo      ON audit_log(memo_id);

-- ============================================================
-- Seeds (idempotent)
-- ============================================================
INSERT INTO companies (code, name) VALUES
  ('LOVE', 'Love Andaman Co., Ltd.'),
  ('ANDAMAN', 'Andaman Travel Group')
ON CONFLICT (code) DO NOTHING;

INSERT INTO departments (company_id, code, name)
SELECT c.id, d.code, d.name
FROM companies c
CROSS JOIN (VALUES
  ('MGT','Management'),
  ('ACC','Accounting'),
  ('OPS','Operations'),
  ('SAL','Sales'),
  ('IT','Information Technology')
) AS d(code, name)
ON CONFLICT (company_id, code) DO NOTHING;

-- Default admin (password: admin123 — CHANGE IMMEDIATELY)
INSERT INTO users (company_id, department_id, employee_code, name, email, password_hash, role)
SELECT c.id, dpt.id, 'ADMIN', 'System Admin', 'admin@loveandaman.com',
       '$2b$10$6akMEswWoOTYNEOiBpSju.V1OwgnHgd6miR/mT8qWd0SS92.HBzsu', 'admin'
FROM companies c JOIN departments dpt ON dpt.company_id = c.id AND dpt.code = 'IT'
WHERE c.code = 'LOVE'
ON CONFLICT (email) DO NOTHING;

-- Demo workflow users for LOVE (password for all: Password123!)
INSERT INTO users (company_id, department_id, employee_code, name, email, password_hash, role, manager_id)
SELECT c.id, dpt.id, v.ecode, v.fullname, v.email,
       '$2b$10$R.6boCZ.o/LWB2.ykRcJaOp2tR1R4C5SaBN/xWp1u06XhjwnbYKKi', v.role, NULL
FROM companies c
JOIN departments dpt ON dpt.company_id = c.id AND dpt.code = v.dept
CROSS JOIN (VALUES
  ('EX001','Somchai (CEO)','ceo@loveandaman.com','executive','MGT'),
  ('MG001','Naree (Ops Mgr)','ops.manager@loveandaman.com','manager','OPS'),
  ('ST001','Ploy','ploy@loveandaman.com','staff','OPS')
) AS v(ecode, fullname, email, role, dept)
WHERE c.code = 'LOVE'
ON CONFLICT (email) DO NOTHING;

-- Wire staff -> manager -> executive reporting line (LOVE)
UPDATE users SET manager_id = (SELECT id FROM users WHERE email='ops.manager@loveandaman.com')
  WHERE email='ploy@loveandaman.com';
UPDATE users SET manager_id = (SELECT id FROM users WHERE email='ceo@loveandaman.com')
  WHERE email='ops.manager@loveandaman.com';

COMMIT;
