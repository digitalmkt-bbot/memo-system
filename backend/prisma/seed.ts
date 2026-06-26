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
    const departmentId = await dept(love.id, deptCode);
    empSeq[deptCode] = (empSeq[deptCode] || 0) + 1;
    const employeeCode = `${deptCode}${String(empSeq[deptCode]).padStart(2, '0')}`;
    await prisma.user.upsert({
      where: { email },
      update: { name, departmentId, role: role as any },
      create: { companyId: love.id, departmentId, employeeCode, name, email, passwordHash: demoPw, role: role as any },
    });
  }
  console.log(`Imported ${IMPORT_USERS.length} staff from Name.csv`);

  console.log('Seed complete: 3 companies, departments seeded, demo + imported users.');
  console.log('  admin@loveandaman.com / admin123');
  console.log('  imported users default password: Password123!');
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
