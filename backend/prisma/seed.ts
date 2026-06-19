import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { readFileSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();

const LOVE_DEPTS: [string, string][] = [
  ['SEC', 'SECRETARY'],
  ['HR', 'HUMAN RESOURCES'],
  ['ACC', 'ACCOUNTING & FINANCE'],
  ['BD', 'BUSINESS DEVELOPMENT / PUBLIC RELATIONS'],
  ['MKT', 'MARKETING'],
  ['SAG', 'SALES AGENT'],
  ['RSV', 'RESERVATION'],
  ['ONL', 'ONLINE'],
  ['SVC', 'SERVICE'],
  ['MEC', 'MECHANIC'],
  ['PKT', 'PHUKET PORT'],
  ['TLM', 'TAP LAMU PORT'],
  ['RNG', 'RANONG PORT'],
  ['TLS', 'TAP LAMU PORT SHOP'],
];
const ANDAMAN_DEPTS: [string, string][] = [
  ['SAG', 'SALES AGENT'],
  ['HR', 'HUMAN RESOURCES'],
  ['ACC', 'ACCOUNTING & FINANCE'],
  ['SVC', 'SERVICE'],
];
const PASSION_DEPTS: [string, string][] = [
  ['SEC', 'SECRETARY'],
  ['ACC', 'ACCOUNTING & FINANCE'],
  ['MKT', 'MARKETING'],
  ['SAG', 'SALES AGENT'],
  ['RSV', 'RESERVATION'],
  ['ONL', 'ONLINE'],
  ['SVC', 'SERVICE'],
  ['HR', 'HUMAN RESOURCES'],
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

  // 3) departments
  for (const [code, name] of LOVE_DEPTS) {
    await prisma.department.upsert({
      where: { companyId_code: { companyId: love.id, code } },
      update: { name }, create: { companyId: love.id, code, name },
    });
  }
  for (const [code, name] of ANDAMAN_DEPTS) {
    await prisma.department.upsert({
      where: { companyId_code: { companyId: andaman.id, code } },
      update: { name }, create: { companyId: andaman.id, code, name },
    });
  }
  for (const [code, name] of PASSION_DEPTS) {
    await prisma.department.upsert({
      where: { companyId_code: { companyId: passion.id, code } },
      update: { name }, create: { companyId: passion.id, code, name },
    });
  }

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
    create: { companyId: love.id, departmentId: await dept(love.id, 'SVC'),
      employeeCode: 'MG001', name: 'Naree (Service Mgr)', email: 'ops.manager@loveandaman.com',
      passwordHash: demoPw, role: 'manager', managerId: exec.id },
  });
  await prisma.user.upsert({
    where: { email: 'ploy@loveandaman.com' }, update: {},
    create: { companyId: love.id, departmentId: await dept(love.id, 'RSV'),
      employeeCode: 'ST001', name: 'Ploy', email: 'ploy@loveandaman.com',
      passwordHash: demoPw, role: 'staff', managerId: mgr.id },
  });

  console.log('Seed complete: 3 companies, departments seeded, 4 users.');
  console.log('  admin@loveandaman.com / admin123');
  console.log('  ceo@ / ops.manager@ / ploy@loveandaman.com  (Password123!)');
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
