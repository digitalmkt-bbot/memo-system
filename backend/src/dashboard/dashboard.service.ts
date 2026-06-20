import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../db/prisma.service';
import { JwtUser } from '../auth/jwt.strategy';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  // executive/admin: all · manager: own department · staff: own memos
  private scopeWhere(user: JwtUser): any {
    if (user.role === 'admin' || user.role === 'executive') return {};
    if (user.role === 'manager') return { companyId: user.companyId, departmentId: user.departmentId ?? -1 };
    return { createdBy: user.id };
  }

  // raw-SQL scope conditions (aliased table m) + bound params
  private rawScope(user: JwtUser): { clause: string; params: any[] } {
    const conds: string[] = ['1=1'];
    const params: any[] = [];
    const p = (v: any) => { params.push(v); return `$${params.length}`; };
    if (user.role === 'manager') {
      conds.push(`m.company_id = ${p(user.companyId)}`);
      conds.push(`m.department_id = ${p(user.departmentId ?? -1)}`);
    } else if (user.role === 'staff') {
      conds.push(`m.created_by = ${p(user.id)}`);
    }
    return { clause: conds.join(' AND '), params };
  }

  async summary(user: JwtUser) {
    const where = this.scopeWhere(user);
    const grouped = await this.prisma.memo.groupBy({ by: ['status'], where, _count: { _all: true } });
    const out: Record<string, number> = {
      draft: 0, pending_manager: 0, pending_executive: 0, pending_hrmd: 0, pending_fc: 0, approved: 0, rejected: 0, cancelled: 0,
    };
    for (const g of grouped) out[g.status] = g._count._all;
    out.total = Object.values(out).reduce((a, b) => a + b, 0);
    out.inbox = await this.prisma.memo.count({
      where: { currentApproverId: user.id, status: { in: ['pending_manager', 'pending_hrmd', 'pending_fc', 'pending_executive'] } },
    });
    return out;
  }

  async monthly(user: JwtUser, companyId?: string) {
    const conds: string[] = ["m.created_at >= date_trunc('month', now()) - interval '11 months'"];
    const params: any[] = [];
    const p = (v: any) => { params.push(v); return `$${params.length}`; };

    if (companyId) {
      conds.push(`m.company_id = ${p(parseInt(companyId, 10))}`);
    } else if (user.role === 'manager') {
      conds.push(`m.company_id = ${p(user.companyId)}`);
      conds.push(`m.department_id = ${p(user.departmentId ?? -1)}`);
    } else if (user.role === 'staff') {
      conds.push(`m.created_by = ${p(user.id)}`);
    }

    return this.prisma.$queryRawUnsafe<any[]>(
      `SELECT to_char(date_trunc('month', m.created_at), 'YYYY-MM') AS month,
              COUNT(DISTINCT m.id)::int AS count,
              COUNT(DISTINCT m.id) FILTER (WHERE m.status='approved')::int AS approved,
              COUNT(DISTINCT m.id) FILTER (WHERE m.status='rejected')::int AS rejected,
              COALESCE(SUM(mi.qty * mi.unit_price), 0)::float AS amount
       FROM memos m LEFT JOIN memo_items mi ON mi.memo_id = m.id
       WHERE ${conds.join(' AND ')}
       GROUP BY 1 ORDER BY 1`,
      ...params,
    );
  }

  async byCompany(user: JwtUser) {
    const { clause, params } = this.rawScope(user);
    return this.prisma.$queryRawUnsafe<any[]>(
      `SELECT m.company_id AS "companyId", c.code AS company, c.name AS name,
              COUNT(DISTINCT m.id)::int AS count,
              COALESCE(SUM(mi.qty * mi.unit_price), 0)::float AS amount
       FROM memos m
       JOIN companies c ON c.id = m.company_id
       LEFT JOIN memo_items mi ON mi.memo_id = m.id
       WHERE ${clause}
       GROUP BY m.company_id, c.code, c.name
       ORDER BY count DESC`,
      ...params,
    );
  }

  async byDepartment(user: JwtUser) {
    const { clause, params } = this.rawScope(user);
    return this.prisma.$queryRawUnsafe<any[]>(
      `SELECT m.department_id AS "departmentId", d.name AS department, c.code AS company,
              COUNT(DISTINCT m.id)::int AS count,
              COALESCE(SUM(mi.qty * mi.unit_price), 0)::float AS amount
       FROM memos m
       JOIN departments d ON d.id = m.department_id
       JOIN companies c ON c.id = d.company_id
       LEFT JOIN memo_items mi ON mi.memo_id = m.id
       WHERE ${clause}
       GROUP BY m.department_id, d.name, c.code
       ORDER BY count DESC`,
      ...params,
    );
  }
  // continuous time-series with zero-filled buckets (for the dashboard line chart)
  async series(user: JwtUser, range = '30d') {
    const params: any[] = [];
    const p = (v: any) => { params.push(v); return `$${params.length}`; };
    const scope: string[] = [];
    if (user.role === 'manager') {
      scope.push(`m.company_id = ${p(user.companyId)}`);
      scope.push(`m.department_id = ${p(user.departmentId ?? -1)}`);
    } else if (user.role === 'staff') {
      scope.push(`m.created_by = ${p(user.id)}`);
    }
    const scopeClause = scope.length ? ' AND ' + scope.join(' AND ') : '';

    const dayMap: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90 };
    let bucketsCTE: string; let joinTrunc: string; let labelFmt: string;
    if (range === '12m') {
      bucketsCTE = `SELECT generate_series(date_trunc('month', now()) - interval '11 months', date_trunc('month', now()), interval '1 month') AS d`;
      joinTrunc = `date_trunc('month', m.created_at)`;
      labelFmt = `to_char(b.d, 'YYYY-MM')`;
    } else {
      const n = dayMap[range] ?? 30;
      bucketsCTE = `SELECT generate_series(date_trunc('day', now()) - ((${n} - 1) * interval '1 day'), date_trunc('day', now()), interval '1 day') AS d`;
      joinTrunc = `date_trunc('day', m.created_at)`;
      labelFmt = `to_char(b.d, 'DD Mon')`;
    }
    return this.prisma.$queryRawUnsafe<any[]>(
      `WITH b AS (${bucketsCTE})
       SELECT ${labelFmt} AS label,
              COUNT(DISTINCT m.id)::int AS count,
              COUNT(DISTINCT m.id) FILTER (WHERE m.status='approved')::int AS approved,
              COUNT(DISTINCT m.id) FILTER (WHERE m.status='rejected')::int AS rejected,
              COALESCE(SUM(mi.qty * mi.unit_price), 0)::float AS amount
       FROM b
       LEFT JOIN memos m ON ${joinTrunc} = b.d${scopeClause}
       LEFT JOIN memo_items mi ON mi.memo_id = m.id
       GROUP BY b.d ORDER BY b.d`,
      ...params,
    );
  }

  // filtered overview for the PR/PO-style dashboard (cards + total value + by-dept value + recent)
  async overview(user: JwtUser, from?: string, to?: string, status?: string) {
    const where: any = this.scopeWhere(user);
    const range: any = {};
    if (from) range.gte = new Date(from);
    if (to) { const d = new Date(to); d.setHours(23, 59, 59, 999); range.lte = d; }
    if (from || to) where.createdAt = range;
    if (status && status !== 'all') where.status = status;

    const grouped = await this.prisma.memo.groupBy({ by: ['status'], where, _count: { _all: true } });
    const counts: any = { draft: 0, pending_manager: 0, pending_executive: 0, pending_hrmd: 0, pending_fc: 0, approved: 0, rejected: 0, cancelled: 0 };
    for (const g of grouped) counts[g.status] = g._count._all;
    counts.total = Object.values(counts).reduce((a: any, b: any) => a + b, 0);
    counts.inbox = await this.prisma.memo.count({
      where: { currentApproverId: user.id, status: { in: ['pending_manager', 'pending_hrmd', 'pending_fc', 'pending_executive'] } },
    });

    // raw conditions (alias m) mirroring the same filters, for amount sums
    const params: any[] = [];
    const p = (v: any) => { params.push(v); return `$${params.length}`; };
    const conds: string[] = ['1=1'];
    if (user.role === 'manager') { conds.push(`m.company_id = ${p(user.companyId)}`); conds.push(`m.department_id = ${p(user.departmentId ?? -1)}`); }
    else if (user.role === 'staff') conds.push(`m.created_by = ${p(user.id)}`);
    if (from) conds.push(`m.created_at >= ${p(new Date(from))}`);
    if (to) { const d = new Date(to); d.setHours(23, 59, 59, 999); conds.push(`m.created_at <= ${p(d)}`); }
    if (status && status !== 'all') conds.push(`m.status = ${p(status)}`);
    const clause = conds.join(' AND ');

    const totalRow = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT COALESCE(SUM(mi.qty * mi.unit_price), 0)::float AS amount
       FROM memos m LEFT JOIN memo_items mi ON mi.memo_id = m.id WHERE ${clause}`, ...params);
    const totalAmount = totalRow[0]?.amount ?? 0;

    const byDept = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT d.name AS department, d.code AS code, COUNT(DISTINCT m.id)::int AS count,
              COALESCE(SUM(mi.qty * mi.unit_price), 0)::float AS amount
       FROM memos m JOIN departments d ON d.id = m.department_id
       LEFT JOIN memo_items mi ON mi.memo_id = m.id WHERE ${clause}
       GROUP BY d.name, d.code ORDER BY amount DESC, count DESC`, ...params);

    // recent list: only memos that have been issued a number (exclude drafts unless filtered explicitly)
    const recentWhere: any = { ...where };
    if (!recentWhere.status) recentWhere.status = { not: 'draft' };
    const recentRaw = await this.prisma.memo.findMany({
      where: recentWhere, orderBy: { createdAt: 'desc' }, take: 8,
      include: { department: { select: { name: true, code: true } }, items: true },
    });
    const recent = recentRaw.map((m: any) => ({
      id: m.id, memoNo: m.memoNo, subject: m.subject, status: m.status,
      department: m.department?.name ?? null, deptCode: m.department?.code ?? null,
      amount: (m.items || []).reduce((sum: number, it: any) => sum + (Number(it.qty) || 0) * (Number(it.unitPrice) || 0), 0),
      createdAt: m.createdAt,
    }));

    return { summary: counts, totalAmount, byDept, recent };
  }

  // demo data spread across the last ~3 months (admin only, idempotent on [DEMO] tag)
  async demoSeed(user: JwtUser) {
    if (user.role !== 'admin') throw new ForbiddenException('Admin only');
    await this.prisma.memo.deleteMany({ where: { subject: { startsWith: '[DEMO]' } } });

    const company = await this.prisma.company.findFirst();
    if (!company) return { created: 0 };
    const depts = await this.prisma.department.findMany({ where: { companyId: company.id } });
    const staff = await this.prisma.user.findFirst({ where: { role: 'staff' } });
    const mgr = await this.prisma.user.findFirst({ where: { role: 'manager' } });
    const exe = await this.prisma.user.findFirst({ where: { role: 'executive' } });
    const statuses = ['approved', 'approved', 'rejected', 'pending_executive', 'approved', 'pending_manager'];

    let created = 0;
    for (let i = 0; i < 36; i++) {
      const daysAgo = Math.floor(Math.random() * 95) + 1;
      const when = new Date(Date.now() - daysAgo * 86400000);
      const dep = depts[i % depts.length];
      const st = statuses[i % statuses.length];
      const price = (Math.floor(Math.random() * 25) + 1) * 5000;
      const qty = Math.floor(Math.random() * 3) + 1;
      const closed = st === 'approved' || st === 'rejected';
      await this.prisma.memo.create({
        data: {
          memoNo: `No.DEMO-${String(i + 1).padStart(3, '0')}`,
          companyId: company.id, departmentId: dep.id,
          date: when, createdAt: when,
          fromName: `ฝ่าย${dep.name}`, subject: `[DEMO] ${dep.name} #${i + 1}`,
          detail: 'ข้อมูลสาธิตย้อนหลังสำหรับกราฟ', status: st as any,
          createdBy: staff?.id ?? 1,
          currentApproverId: st === 'pending_manager' ? (mgr?.id ?? null) : st === 'pending_executive' ? (exe?.id ?? null) : null,
          submittedAt: when, closedAt: closed ? when : null,
          vat: i % 2 === 0,
          items: { create: [{ position: 0, name: 'รายการสาธิต', detail: dep.name, qty, unit: 'รายการ', unitPrice: price }] },
        },
      });
      created++;
    }
    return { created };
  }
}
