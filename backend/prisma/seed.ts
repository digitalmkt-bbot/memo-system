import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { readFileSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();

// canonical department list (order matters -> position)
const LOVE_DEPTS: [string, string][] = [
  ['SEC', 'SECRETARY'],
  ['HR', 'HUMAN RESOURCES'],
  ['ACC', 'ACCOUNTING & FINANCE'],
  ['PUR', 'PURCHASE'],
  ['MKT', 'MARKETING'],
  ['BD', 'BUSINESS DEVELOPMENT'],
  ['PR', 'PUBLIC RELATIONS'],
  ['GFX', 'GRAPHIC'],
  ['SA', 'SALES AGENT'],
  ['RSV', 'RESERVATION'],
  ['SONL', 'SALE ONLINE'],
  ['SRV', 'SERVICE'],
  ['MEC', 'MECHANIC'],
  ['PKTP', 'PHUKET PIER'],
  ['TLP', 'TAP LAMU PIER'],
  ['RNGP', 'RANONG PIER'],
  ['TLPS', 'TAP LAMU PIER SHOP'],
  ['SC', 'SALE COUNTER'],
];
// legacy code -> new code (rename in place to avoid duplicates)
const DEPT_RENAME: [string, string][] = [
  ['SAG', 'SA'], ['ONL', 'SONL'], ['SVC', 'SRV'],
  ['PKT', 'PKTP'], ['TLM', 'TLP'], ['RNG', 'RNGP'], ['TLS', 'TLPS'],
];

async function main() {
  // 1) install the atomic running-number function
  const fn = readFileSync(join(__dirname, 'functions.sql'), 'utf8');
  await prisma.$executeRawUnsafe(fn);

  // 2) companies
  const love = await prisma.company.upsert({
    where: { code: 'LOVE' }, update: {},
    create: { code: 'LOVE', name: 'LOVE ISLAND CO., LTD.' },
  });
  const andaman = await prisma.company.upsert({
    where: { code: 'ANDAMAN' }, update: {},
    create: { code: 'ANDAMAN', name: 'ANDAMAN SUNDAY CO., LTD.' },
  });
  const passion = await prisma.company.upsert({
    where: { code: 'PASSION' }, update: { name: 'ANDAMAN PASSION CO., LTD.' },
    create: { code: 'PASSION', name: 'ANDAMAN PASSION CO., LTD.' },
  });

  // 3) departments — first rename legacy codes in place (keeps memo/user references)
  for (const [oldCode, newCode] of DEPT_RENAME) {
    await prisma.department.updateMany({ where: { code: oldCode }, data: { code: newCode } });
  }
  const seedDepts = async (companyId: number, list: [string, string][]) => {
    for (let i = 0; i < list.length; i++) {
      const [code, name] = list[i];
      await prisma.department.upsert({
        where: { companyId_code: { companyId, code } },
        update: { name, position: i }, create: { companyId, code, name, position: i },
      });
    }
  };
  await seedDepts(love.id, LOVE_DEPTS);
  await seedDepts(andaman.id, LOVE_DEPTS);
  await seedDepts(passion.id, LOVE_DEPTS);

  const dept = async (companyId: number, code: string) =>
    (await prisma.department.findFirst({ where: { companyId, code } }))!.id;

  const adminPw = bcrypt.hashSync('admin123', 10);
  const demoPw = bcrypt.hashSync('Password123!', 10);

  // 4) users (LOVE) — admin + 3-tier workflow chain
  await prisma.user.upsert({
    where: { email: 'admin@loveandaman.com' }, update: {},
    create: { companyId: love.id, departmentId: await dept(love.id, 'SEC'),
      employeeCode: 'ADMIN', name: 'System Admin', email: 'admin@loveandaman.com',
      passwordHash: adminPw, role: 'admin' },
  });
  // 5) approvers MD, FC (emails overwritten with real data by the Name.csv import below)
  await prisma.user.upsert({
    where: { email: 'md@loveandaman.com' }, update: { role: 'md' },
    create: { companyId: love.id, departmentId: await dept(love.id, 'SEC'),
      employeeCode: 'MD001', name: 'Wichai (Managing Director)', email: 'md@loveandaman.com',
      passwordHash: demoPw, role: 'md' },
  });
  await prisma.user.upsert({
    where: { email: 'fc@loveandaman.com' }, update: { role: 'fc' },
    create: { companyId: love.id, departmentId: await dept(love.id, 'ACC'),
      employeeCode: 'FC001', name: 'Suda (Finance Controller)', email: 'fc@loveandaman.com',
      passwordHash: demoPw, role: 'fc' },
  });

  // 6) import real staff (LOVE) from Name.csv — Employee code auto-generated per department,
  //    default password "Password123!" (to be changed later). Upsert by email = idempotent,
  //    and won't overwrite an existing user's employee code / password.
  const IMPORT_USERS: [string, string, string, string][] = [
    ['นายต่อพงษ์ วงศ์เสถียรชัย', 'SEC', 'thaitornado@gmail.com', 'executive'],
    ['นายอรรควิชญ์ หาญนวโชค', 'SEC', 'md@loveandaman.com', 'md'],
    ['นายดิชยพงศ์ แก้วทา', 'HR', 'hr@loveandaman.com', 'hrm'],
    ['HUMAN RESOURCES STAFF', 'HR', 'hrd@loveandaman.com', 'staff'],
    ['นางสาวศริยา รัตนภูมิ', 'SRV', 'dsm@loveandaman.com', 'manager'],
    ['นางสาวปิยกมล คงพิรอด', 'SRV', 'dsa@loveandaman.com', 'manager'],
    ['นายอัมพรชัย สุวรรณสุทธิ์', 'GFX', 'graphic@loveandaman.com', 'staff'],
    ['นางสาวจุฑาทิพย์ จรุงจิตร', 'ACC', 'fc@loveandaman.com', 'fc'],
    ['ACCOUNTING & FINANCE STAFF', 'ACC', 'ac@loveandaman.com', 'staff'],
    ['นางสาวกรรณกนก เต็มสั้น', 'ACC', 'ar@loveandaman.com', 'staff'],
    ['นางสาวภัทราภรณ์ แว่นพิมาย', 'PUR', 'apm@loveandaman.com', 'manager'],
    ['นางสาวอาทิตยา รัตนบุรีนล', 'PUR', 'adminstorepk@loveandaman.com', 'staff'],
    ['นางสาวนนทิยา เนาว์สุวรรณ', 'MKT', 'digital.mkt@loveandaman.com', 'manager'],
    ['CONTENT CREATOR DEVELOPER STAFF', 'MKT', 'contentcreator@loveandaman.com', 'staff'],
    ['นางสาวปวีณา ฤทธยานนท์', 'SEC', 'marcom@loveandaman.com', 'manager'],
    ['นางสาวกฤติกา เพิ่ม', 'BD', 'asst_marcom@loveandaman.com', 'manager'],
    ['นายอาทิตย์ เคียมเค้า', 'BD', 'admin.mkt@loveandaman.com', 'manager'],
    ['นางสาวโสพิศ ส้มส้า', 'SA', 'dos@loveandaman.com', 'manager'],
    ['นางแสงสุนีย์ เพทรี', 'SA', 'sales.eu@loveandaman.com', 'staff'],
    ['นางสาวร่มธรรม ตั้นเส้ง', 'SA', 'salesexe@loveandaman.com', 'staff'],
    ['นางสาวณิชารัศม์ ธนาทรัพย์โศภิต', 'SA', 'salescounter@loveandaman.com', 'staff'],
    ['นายณัฐพัชร์ โชติจิราวราฉัตร', 'SA', 'sales.global@loveandaman.com', 'staff'],
    ['นายมิคาเอล มาร์ทูเอเซฟ', 'SA', 'sales.ru@loveandaman.com', 'staff'],
    ['นายสุนทร รายารักษ์', 'SONL', 'csm@loveandaman.com', 'manager'],
    ['SALE ONLINE STAFF', 'SONL', 'sale-fb@loveandaman.com', 'staff'],
    ['นางสาวกชวรรณ ครรินทร์', 'SONL', 'crs@loveandaman.com', 'staff'],
    ['นายอานนท์ ปินไชย', 'RSV', 'rm@loveandaman.com', 'manager'],
    ['RESERVATION STAFF', 'RSV', 'book@loveandaman.com', 'staff'],
    ['นางสาวนฤมน ซ้วนเซ่ง', 'PKTP', 'pier.phuket@loveandaman.com', 'manager'],
    ['นางสาวทัศน์วรรณ โต๊ะเดาะละ', 'TLP', 'pier.khaolak@loveandaman.com', 'manager'],
  ];
  const empSeq: Record<string, number> = {};
  for (const [name, deptCode, email, role] of IMPORT_USERS) {
    // executives (CEO / MD) do not belong to a department
    const noDept = role === 'executive' || role === 'md';
    const departmentId = noDept ? null : await dept(love.id, deptCode);
    empSeq[deptCode] = (empSeq[deptCode] || 0) + 1;
    const employeeCode = `${deptCode}${String(empSeq[deptCode]).padStart(2, '0')}`;
    try {
      await prisma.user.upsert({
        where: { email },
        update: { name, departmentId, role: role as any },
        create: { companyId: love.id, departmentId, employeeCode, name, email, passwordHash: demoPw, role: role as any },
      });
    } catch (e: any) {
      // never let one user (e.g. duplicate employee_code after admin edits) abort the seed/deploy
      console.warn(`seed: skip import for ${email} (${e?.code || e?.message})`);
    }
  }
  console.log(`Imported ${IMPORT_USERS.length} staff from Name.csv`);

  // 7) remove leftover MOCKUP/demo users (and any test data tied to them).
  //    Real staff use loveandaman.com emails; these demo accounts are no longer needed.
  const MOCK_EMAILS = ['ceo@loveandaman.com', 'ops.manager@loveandaman.com', 'ploy@loveandaman.com', 'hrm@loveandaman.com'];
  const mocks = await prisma.user.findMany({ where: { email: { in: MOCK_EMAILS } }, select: { id: true } });
  const mockIds = mocks.map((m) => m.id);
  if (mockIds.length) {
    const memos = await prisma.memo.findMany({ where: { createdBy: { in: mockIds } }, select: { id: true } });
    const memoIds = memos.map((m) => m.id);
    if (memoIds.length) {
      await prisma.approval.deleteMany({ where: { memoId: { in: memoIds } } });
      await prisma.memoItem.deleteMany({ where: { memoId: { in: memoIds } } });
      await prisma.attachment.deleteMany({ where: { memoId: { in: memoIds } } });
      await prisma.auditLog.deleteMany({ where: { memoId: { in: memoIds } } });
      await prisma.memo.deleteMany({ where: { id: { in: memoIds } } });
    }
    // remove their approvals / audit on OTHER memos, and unlink them as current approver / manager
    await prisma.approval.deleteMany({ where: { approvedBy: { in: mockIds } } });
    await prisma.auditLog.deleteMany({ where: { userId: { in: mockIds } } });
    await prisma.memo.updateMany({ where: { currentApproverId: { in: mockIds } }, data: { currentApproverId: null } });
    await prisma.user.updateMany({ where: { managerId: { in: mockIds } }, data: { managerId: null } });
    await prisma.user.deleteMany({ where: { id: { in: mockIds } } });
    console.log(`Removed ${mockIds.length} mockup users (+ their test data)`);
  }

  // 8) GO LIVE: wipe ALL memos/attachments/history + reset running numbers.
  //    Guarded by env flag so it never runs accidentally after launch.
  //    Set GO_LIVE_RESET=true once, deploy, then REMOVE the flag.
  if (process.env.GO_LIVE_RESET === 'true') {
    await prisma.approval.deleteMany({});
    await prisma.memoItem.deleteMany({});
    await prisma.attachment.deleteMany({});
    await prisma.auditLog.deleteMany({});
    await prisma.memo.deleteMany({});
    await prisma.memoRunning.deleteMany({});
    console.log('GO_LIVE_RESET: wiped all memos, attachments, history; running numbers reset to start fresh.');
  }

  // 9) Migrate existing memos to the current approval flow.
  //    New flow: HRM/MD approval = final (FC no longer approves, only acknowledges).
  //    Any memo still resting at the old "pending_fc" step is advanced to approved.
  //    Idempotent — new memos never enter pending_fc, so this is a no-op afterward.
  const migratedFc = await prisma.memo.updateMany({
    where: { status: 'pending_fc' as any },
    data: { status: 'approved' as any, currentApproverId: null, closedAt: new Date() },
  });
  if (migratedFc.count) console.log(`Migrated ${migratedFc.count} memo(s): pending_fc → approved (new flow)`);

  // 10) Undo the old "department head skips straight to MD" auto-approval and
  //     re-route each affected memo to its creator's CONFIGURED first approver
  //     (per-user managerId set in the backend). Targeted + idempotent: only
  //     memos still carrying the bogus auto-skip approval are touched; once fixed
  //     they no longer match, so re-runs leave them alone. Legitimately-progressed
  //     memos (real approvals) are never affected.
  const firstApprover = async (creator: any, companyId: number, departmentId: number | null) => {
    // a) explicit first approver configured for this user (must be active, not self)
    if (creator.managerId && creator.managerId !== creator.id) {
      const u = await prisma.user.findFirst({ where: { id: creator.managerId, active: true } });
      if (u) return u.id;
    }
    // b) the head of the memo's own department (excluding the creator)
    for (const role of ['manager', 'hrm', 'md']) {
      const u = await prisma.user.findFirst({
        where: { role: role as any, active: true, companyId, departmentId: departmentId ?? -1, id: { not: creator.id } },
        orderBy: { id: 'asc' },
      });
      if (u) return u.id;
    }
    // c) escalate to the company HR head, then the MD — never a random peer
    //    manager from an unrelated department.
    for (const role of ['hrm', 'md']) {
      const u = await prisma.user.findFirst({ where: { role: role as any, active: true, companyId, id: { not: creator.id } }, orderBy: { id: 'asc' } });
      if (u) return u.id;
    }
    return null;
  };
  const bogus = await prisma.approval.findMany({
    where: { step: 'manager', comment: { contains: 'ข้ามขั้น' } },
    select: { id: true, memoId: true },
  });
  let fixed = 0;
  for (const b of bogus) {
    const m = await prisma.memo.findUnique({ where: { id: b.memoId }, select: { id: true, companyId: true, departmentId: true, createdBy: true, status: true } });
    if (!m) { await prisma.approval.delete({ where: { id: b.id } }).catch(() => {}); continue; }
    if (['approved', 'rejected', 'cancelled'].includes(m.status as any)) continue; // already closed, leave history
    const creator = await prisma.user.findUnique({ where: { id: m.createdBy } });
    if (!creator) continue;
    const approverId = await firstApprover(creator, m.companyId, m.departmentId);
    if (!approverId) continue;
    await prisma.approval.delete({ where: { id: b.id } }).catch(() => {});
    await prisma.memo.update({ where: { id: m.id }, data: { status: 'pending_manager' as any, currentApproverId: approverId, closedAt: null } });
    fixed++;
  }
  if (fixed) console.log(`Re-routed ${fixed} memo(s) to their configured first approver`);

  // 11) Re-sync every memo still at the FIRST-approval stage to its creator's
  //     configured first approver. Fixes memos that were parked on a wrong
  //     fallback approver (e.g. a manager from another department) before the
  //     per-user "ผู้อนุมัติขั้นแรก" was set in the backend. Idempotent: a memo
  //     already sitting with the correct approver is left untouched.
  const atManager = await prisma.memo.findMany({
    where: { status: 'pending_manager' as any },
    select: { id: true, companyId: true, departmentId: true, createdBy: true, currentApproverId: true },
  });
  let resynced = 0;
  for (const m of atManager) {
    const creator = await prisma.user.findUnique({ where: { id: m.createdBy }, select: { id: true, managerId: true } });
    // Only re-sync to the creator's CONFIGURED first approver — never a guess.
    if (!creator?.managerId || creator.managerId === creator.id) continue;
    const approver = await prisma.user.findFirst({ where: { id: creator.managerId, active: true }, select: { id: true } });
    if (approver && approver.id !== m.currentApproverId) {
      await prisma.memo.update({ where: { id: m.id }, data: { currentApproverId: approver.id } });
      resynced++;
    }
  }
  if (resynced) console.log(`Re-synced ${resynced} pending memo(s) to configured first approver`);

  // 12) Finalize memos where the MD already approved but were wrongly routed
  //     onward for further approval (e.g. sent to HR after the MD signed).
  //     The Managing Director is the top authority — their approval is final.
  const mdApprovals = await prisma.approval.findMany({
    where: { status: 'approve' as any, approver: { role: 'md' as any } },
    select: { memoId: true },
  });
  const mdMemoIds = [...new Set(mdApprovals.map((a) => a.memoId).filter((x): x is number => x != null))];
  if (mdMemoIds.length) {
    const done = await prisma.memo.updateMany({
      where: { id: { in: mdMemoIds }, status: { in: ['pending_manager', 'pending_hrmd', 'pending_fc'] as any } },
      data: { status: 'approved' as any, currentApproverId: null, closedAt: new Date() },
    });
    if (done.count) console.log(`Finalized ${done.count} memo(s) already approved by the MD`);
  }

  // 13) Re-route memos wrongly sent to the HR head. Purchases go manager → MD;
  //     HR is not a purchase approver. Any memo waiting at an HRM (pending_hrmd,
  //     current approver role 'hrm') is moved to the MD instead.
  const hrmStuck = await prisma.memo.findMany({
    where: { status: 'pending_hrmd' as any, currentApprover: { role: 'hrm' as any } },
    select: { id: true, companyId: true },
  });
  let hrToMd = 0;
  for (const m of hrmStuck) {
    const md = (await prisma.user.findFirst({ where: { role: 'md' as any, active: true, companyId: m.companyId } }))
      ?? (await prisma.user.findFirst({ where: { role: 'md' as any, active: true } }));
    if (md) { await prisma.memo.update({ where: { id: m.id }, data: { currentApproverId: md.id } }); hrToMd++; }
  }
  if (hrToMd) console.log(`Re-routed ${hrToMd} memo(s) from HR to MD`);

  // 14) Re-open memos > 1,000 that were finalized by the HR head WITHOUT the MD.
  //     Over-1,000 must reach the MD — route them back to the MD for approval.
  const hrmFinal = await prisma.memo.findMany({
    where: {
      status: 'approved' as any,
      forwardedAt: null,
      approvals: { some: { status: 'approve', approver: { role: 'hrm' as any } }, none: { status: 'approve', approver: { role: 'md' as any } } },
    },
    select: { id: true, companyId: true },
  });
  let reopened = 0;
  for (const m of hrmFinal) {
    const items = await prisma.memoItem.findMany({ where: { memoId: m.id }, select: { qty: true, unitPrice: true } });
    const total = items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.unitPrice) || 0), 0);
    if (total <= 1000) continue;
    const md = (await prisma.user.findFirst({ where: { role: 'md' as any, active: true, companyId: m.companyId } }))
      ?? (await prisma.user.findFirst({ where: { role: 'md' as any, active: true } }));
    if (!md) continue;
    await prisma.memo.update({ where: { id: m.id }, data: { status: 'pending_hrmd' as any, currentApproverId: md.id, closedAt: null } });
    reopened++;
  }
  if (reopened) console.log(`Re-opened ${reopened} over-1,000 memo(s) finalized by HR → routed to MD`);

  // 15) Retro-flag BACKDATED requests on memos created before the "receipt date"
  //     field existed. Those memos have no expenseDate, so we compare the memo's
  //     own document date against the date it was actually submitted: submitted
  //     more than 1 day after the document date = backdated. Applies to every
  //     status, including already-approved memos, so history is auditable.
  const legacy = await prisma.memo.findMany({
    where: { expenseDate: null, backdated: false, submittedAt: { not: null } },
    select: { id: true, date: true, submittedAt: true },
  });
  const lateIds: number[] = [];
  for (const m of legacy) {
    if (!m.date || !m.submittedAt) continue;
    const gap = new Date(m.submittedAt).getTime() - new Date(m.date).getTime();
    if (gap > 24 * 60 * 60 * 1000) lateIds.push(m.id);
  }
  if (lateIds.length) {
    await prisma.memo.updateMany({ where: { id: { in: lateIds } }, data: { backdated: true } });
    console.log(`Retro-flagged ${lateIds.length} legacy memo(s) as backdated (doc date vs submitted date)`);
  }

  // 16) Repair attachment filenames stored as mojibake. Older uploads saved the
  //     latin1-decoded name, so Thai names became "à¸ˆà¸±à¸”…". Re-interpret the
  //     bytes as UTF-8 (round-trip guarded, so correct names are left alone).
  const decodeName = (name: string): string => {
    if (!name) return name;
    try {
      const utf8 = Buffer.from(name, 'latin1').toString('utf8');
      if (utf8.includes('�')) return name;
      if (Buffer.from(utf8, 'utf8').toString('latin1') === name) return utf8;
    } catch { /* noop */ }
    return name;
  };
  const atts = await prisma.attachment.findMany({ select: { id: true, filename: true } });
  let fixedNames = 0;
  for (const a of atts) {
    const fixed = decodeName(a.filename);
    if (fixed !== a.filename) {
      await prisma.attachment.update({ where: { id: a.id }, data: { filename: fixed } });
      fixedNames++;
    }
  }
  if (fixedNames) console.log(`Repaired ${fixedNames} attachment filename(s) (latin1 → UTF-8)`);

  console.log('Seed complete: 3 companies, departments seeded, demo + imported users.');
  console.log('  admin@loveandaman.com / admin123');
  console.log('  imported users default password: Password123!');
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
