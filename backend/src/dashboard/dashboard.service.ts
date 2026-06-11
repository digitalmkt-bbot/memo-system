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
    const conds: string[] = ["created_at >= date_trunc('month', now()) - interval '11 months'"];
    const params: any[] = [];
    const p = (v: any) => { params.push(v); return `$${params.length}`; };

    if (companyId) {
      conds.push(`company_id = ${p(parseInt(companyId, 10))}`);
    } else if (user.role === 'manager') {
      conds.push(`company_id = ${p(user.companyId)}`);
      conds.push(`department_id = ${p(user.departmentId ?? -1)}`);
    } else if (user.role === 'staff') {
      conds.push(`created_by = ${p(user.id)}`);
    }

    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') AS month,
              COUNT(*)::int AS count,
              COUNT(*) FILTER (WHERE status='approved')::int AS approved
       FROM memos WHERE ${conds.join(' AND ')}
       GROUP BY 1 ORDER BY 1`,
      ...params,
    );
    return rows;
  }

  async byCompany(user: JwtUser) {
    const where = this.scopeWhere(user);
    const grouped = await this.prisma.memo.groupBy({ by: ['companyId'], where, _count: { _all: true } });
    const companies = await this.prisma.company.findMany();
    const map = new Map(companies.map((c) => [c.id, c]));
    return grouped.map((g) => ({
      companyId: g.companyId,
      company: map.get(g.companyId)?.code,
      name: map.get(g.companyId)?.name,
      count: g._count._all,
    })).sort((a, b) => b.count - a.count);
  }

  async byDepartment(user: JwtUser) {
    const where = this.scopeWhere(user);
    const grouped = await this.prisma.memo.groupBy({ by: ['departmentId'], where, _count: { _all: true } });
    const depts = await this.prisma.department.findMany({ include: { company: { select: { code: true } } } });
    const map = new Map(depts.map((d) => [d.id, d]));
    return grouped.map((g) => ({
      departmentId: g.departmentId,
      department: map.get(g.departmentId)?.name,
      company: map.get(g.departmentId)?.company.code,
      count: g._count._all,
    })).sort((a, b) => b.count - a.count);
  }
}
