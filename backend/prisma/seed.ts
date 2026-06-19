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
  ['SA', 'SALES AGENT'],
  ['RSV', 'RESERVATION'],
  ['SONL', 'SALE ONLINE'],
  ['SRV', 'SERVICE'],
  ['MEC', 'MECHANIC'],
  ['PKTP', 'PHUKET PIER'],
  ['TLP', 'TAP LAMU PIER'],
  ['RNGP', 'RANONG PIER'],
  ['TLPS', 'TAP LAMU PIER SHOP'],
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
  const exec = await prisma.user.upsert({
    where: { email: 'ceo@loveandaman.com' }, update: {},
    create: { companyId: love.id, departmentId: await dept(love.id, 'SEC'),
      employeeCode: 'EX001', name: 'Somchai (CEO)', email: 'ceo@loveandaman.com',
      passwordHash: demoPw, role: 'executive' },
  });
  const mgr = await prisma.user.upsert({
    where: { email: 'ops.manager@loveandaman.com' }, update: {},
    create: { companyId: love.id, departmentId: await dept(love.id, 'SRV'),
      employeeCode: 'MG001', name: 'Naree (Service Mgr)', email: 'ops.manager@loveandaman.com',
      passwordHash: demoPw, role: 'manager', managerId: exec.id },
  });
  await prisma.user.upsert({
    where: { email: 'ploy@loveandaman.com' }, update: {},
    create: { companyId: love.id, departmentId: await dept(love.id, 'RSV'),
      employeeCode: 'ST001', name: 'Ploy', email: 'ploy@loveandaman.com',
      passwordHash: demoPw, role: 'staff', managerId: mgr.id },
  });

  // 5) extra approvers for the 5-step chain: HRM, MD, FC
  await prisma.user.upsert({
    where: { email: 'hrm@loveandaman.com' }, update: { role: 'hrm' },
    create: { companyId: love.id, departmentId: await dept(love.id, 'HR'),
      employeeCode: 'HRM01', name: 'Kanya (HR Manager)', email: 'hrm@loveandaman.com',
      passwordHash: demoPw, role: 'hrm' },
  });
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

  console.log('Seed complete: 3 companies, departments seeded, 4 users.');
  console.log('  admin@loveandaman.com / admin123');
  console.log('  ceo@ / ops.manager@ / ploy@loveandaman.com  (Password123!)');
  console.log('  hrm@ / md@ / fc@loveandaman.com  (Password123!)');
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
