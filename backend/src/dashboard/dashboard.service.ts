import { Injectable } from '@nestjs/common';
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
      draft: 0, pending_manager: 0, pending_executive: 0, approved: 0, rejected: 0, cancelled: 0,
    };
    for (const g of grouped) out[g.status] = g._count._all;
    out.total = Object.values(out).reduce((a, b) => a + b, 0);
    out.inbox = await this.prisma.memo.count({
      where: { currentApproverId: user.id, status: { in: ['pending_manager', 'pending_executive'] } },
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
}
