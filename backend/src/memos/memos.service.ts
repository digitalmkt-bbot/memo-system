import {
  BadRequestException, ForbiddenException, Injectable, NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../db/prisma.service';
import { JwtUser } from '../auth/jwt.strategy';
import { CreateMemoDto, UpdateMemoDto } from './dto/memo.dto';

const INCLUDE = {
  creator: { select: { name: true } },
  department: { select: { code: true, name: true } },
  company: { select: { code: true, name: true } },
  currentApprover: { select: { name: true } },
};

@Injectable()
export class MemosService {
  constructor(private prisma: PrismaService) {}

  private shape(m: any) {
    if (!m) return m;
    const { creator, department, company, currentApprover, ...rest } = m;
    return {
      ...rest,
      creatorName: creator?.name ?? null,
      deptCode: department?.code ?? null,
      deptName: department?.name ?? null,
      companyCode: company?.code ?? null,
      companyName: company?.name ?? null,
      currentApproverName: currentApprover?.name ?? null,
    };
  }

  private async audit(memoId: number | null, userId: number, action: string, detail?: string) {
    await this.prisma.auditLog.create({ data: { memoId, userId, action, detail: detail ?? null } });
  }

  private async pickManager(creatorId: number) {
    const creator = await this.prisma.user.findUnique({ where: { id: creatorId } });
    if (!creator) return null;
    if (creator.managerId) {
      const m = await this.prisma.user.findFirst({
        where: { id: creator.managerId, active: true, role: 'manager' },
      });
      if (m) return m.id;
    }
    const fb = await this.prisma.user.findFirst({
      where: { role: 'manager', active: true, companyId: creator.companyId }, orderBy: { id: 'asc' },
    });
    return fb?.id ?? null;
  }

  private async pickExecutive(companyId: number) {
    const e = await this.prisma.user.findFirst({
      where: { role: 'executive', active: true, companyId }, orderBy: { id: 'asc' },
    });
    return e?.id ?? null;
  }

  private canApprove(user: JwtUser, memo: any) {
    if (memo.status === 'pending_manager') return user.role === 'manager' && memo.currentApproverId === user.id;
    if (memo.status === 'pending_executive') return user.role === 'executive' && memo.currentApproverId === user.id;
    return false;
  }

  /**
   * Department-level visibility:
   *  - executive / admin : all memos
   *  - manager           : memos in their own department (same company)
   *  - staff             : only memos they created
   */
  private visibilityScope(user: JwtUser): any {
    if (user.role === 'admin' || user.role === 'executive') return {};
    if (user.role === 'manager') return { companyId: user.companyId, departmentId: user.departmentId ?? -1 };
    return { createdBy: user.id };
  }

  async list(user: JwtUser, f: { box?: string; status?: string; companyId?: string; departmentId?: string; q?: string }) {
    const where: any = {};
    if (f.box === 'inbox') {
      where.currentApproverId = user.id;
      where.status = { in: ['pending_manager', 'pending_executive'] };
    } else if (f.box === 'sent') {
      where.createdBy = user.id;
    } else {
      Object.assign(where, this.visibilityScope(user));
    }
    if (f.status) where.status = f.status;
    if (f.companyId) where.companyId = parseInt(f.companyId, 10);
    if (f.departmentId) where.departmentId = parseInt(f.departmentId, 10);
    if (f.q) where.OR = [
      { subject: { contains: f.q, mode: 'insensitive' } },
      { detail: { contains: f.q, mode: 'insensitive' } },
      { memoNo: { contains: f.q, mode: 'insensitive' } },
    ];
    const rows = await this.prisma.memo.findMany({ where, include: INCLUDE, orderBy: { createdAt: 'desc' } });
    return rows.map((m) => this.shape(m));
  }

  async getOne(user: JwtUser, id: number) {
    const memo = await this.prisma.memo.findUnique({ where: { id }, include: INCLUDE });
    if (!memo) throw new NotFoundException('Memo not found');

    let participant =
      memo.createdBy === user.id || memo.currentApproverId === user.id ||
      user.role === 'admin' || user.role === 'executive' ||
      (user.role === 'manager' &&
        memo.companyId === user.companyId && memo.departmentId === user.departmentId);
    if (!participant) {
      const ap = await this.prisma.approval.findFirst({ where: { memoId: id, approvedBy: user.id } });
      if (!ap) throw new ForbiddenException('Not allowed');
    }

    const approvals = await this.prisma.approval.findMany({
      where: { memoId: id },
      include: { approver: { select: { name: true, role: true } } },
      orderBy: { approvedAt: 'asc' },
    });
    const audit = await this.prisma.auditLog.findMany({ where: { memoId: id }, orderBy: { createdAt: 'asc' } });

    return {
      memo: this.shape(memo),
      approvals: approvals.map((a) => ({ ...a, approverName: a.approver.name, approverRole: a.approver.role })),
      audit,
      canApprove: this.canApprove(user, memo),
    };
  }

  async create(user: JwtUser, dto: CreateMemoDto) {
    const memo = await this.prisma.memo.create({
      data: {
        companyId: dto.companyId, departmentId: dto.departmentId,
        fromName: dto.fromName.trim(), subject: dto.subject.trim(),
        attachment: dto.attachment?.trim() || null, detail: dto.detail.trim(),
        createdBy: user.id, status: 'draft',
      },
      include: INCLUDE,
    });
    await this.audit(memo.id, user.id, 'created', 'Draft created');
    return this.shape(memo);
  }

  async update(user: JwtUser, id: number, dto: UpdateMemoDto) {
    const memo = await this.prisma.memo.findUnique({ where: { id } });
    if (!memo) throw new NotFoundException('Memo not found');
    if (memo.createdBy !== user.id) throw new ForbiddenException('Not owner');
    if (memo.status !== 'draft') throw new BadRequestException('Only drafts can be edited');
    const updated = await this.prisma.memo.update({
      where: { id },
      data: {
        companyId: dto.companyId ?? memo.companyId,
        departmentId: dto.departmentId ?? memo.departmentId,
        fromName: dto.fromName ?? memo.fromName,
        subject: dto.subject ?? memo.subject,
        attachment: dto.attachment ?? memo.attachment,
        detail: dto.detail ?? memo.detail,
      },
      include: INCLUDE,
    });
    await this.audit(id, user.id, 'edited', 'Draft updated');
    return this.shape(updated);
  }

  async remove(user: JwtUser, id: number) {
    const memo = await this.prisma.memo.findUnique({ where: { id } });
    if (!memo) throw new NotFoundException('Memo not found');
    if (memo.createdBy !== user.id) throw new ForbiddenException('Not owner');
    if (memo.status !== 'draft') throw new BadRequestException('Only drafts can be deleted');
    await this.prisma.memo.delete({ where: { id } });
    return { ok: true };
  }

  /**
   * Submit a draft. The running number is generated ATOMICALLY by the
   * next_memo_no() DB function (INSERT ... ON CONFLICT DO UPDATE RETURNING),
   * executed inside a single interactive transaction.
   */
  async submit(user: JwtUser, id: number) {
    const managerId = await this.pickManager(user.id);
    if (!managerId) throw new BadRequestException('No manager available to route to');

    return this.prisma.$transaction(async (tx) => {
      const memo = await tx.memo.findUnique({ where: { id } });
      if (!memo) throw new NotFoundException('Memo not found');
      if (memo.createdBy !== user.id) throw new ForbiddenException('Not owner');
      if (memo.status !== 'draft') throw new BadRequestException('Memo is not a draft');

      let memoNo = memo.memoNo;
      if (!memoNo) {
        const r = await tx.$queryRaw<{ no: string }[]>`SELECT next_memo_no(${memo.companyId}) AS no`;
        memoNo = r[0].no;
      }
      const updated = await tx.memo.update({
        where: { id },
        data: { memoNo, status: 'pending_manager', currentApproverId: managerId, submittedAt: new Date() },
        include: INCLUDE,
      });
      await tx.auditLog.create({ data: { memoId: id, userId: user.id, action: 'submitted', detail: `Assigned ${memoNo}, routed to manager` } });
      return this.shape(updated);
    });
  }

  async approve(user: JwtUser, id: number, comment?: string) {
    return this.prisma.$transaction(async (tx) => {
      const memo = await tx.memo.findUnique({ where: { id } });
      if (!memo) throw new NotFoundException('Memo not found');
      if (!this.canApprove(user, memo)) throw new ForbiddenException('Cannot approve at current step');

      const step = memo.status === 'pending_manager' ? 'manager' : 'executive';
      await tx.approval.create({ data: { memoId: id, step, approvedBy: user.id, status: 'approve', comment: comment ?? null } });

      let updated;
      if (step === 'manager') {
        const execId = await this.pickExecutive(memo.companyId);
        if (!execId) throw new BadRequestException('No executive available');
        updated = await tx.memo.update({
          where: { id }, data: { status: 'pending_executive', currentApproverId: execId }, include: INCLUDE,
        });
        await tx.auditLog.create({ data: { memoId: id, userId: user.id, action: 'approved_manager', detail: 'Routed to executive' } });
      } else {
        updated = await tx.memo.update({
          where: { id }, data: { status: 'approved', currentApproverId: null, closedAt: new Date() }, include: INCLUDE,
        });
        await tx.auditLog.create({ data: { memoId: id, userId: user.id, action: 'approved_executive', detail: 'Memo approved' } });
      }
      return this.shape(updated);
    });
  }

  async reject(user: JwtUser, id: number, comment?: string) {
    if (!comment || !comment.trim()) throw new BadRequestException('A reason is required to reject');
    return this.prisma.$transaction(async (tx) => {
      const memo = await tx.memo.findUnique({ where: { id } });
      if (!memo) throw new NotFoundException('Memo not found');
      if (!this.canApprove(user, memo)) throw new ForbiddenException('Cannot reject at current step');
      const step = memo.status === 'pending_manager' ? 'manager' : 'executive';
      await tx.approval.create({ data: { memoId: id, step, approvedBy: user.id, status: 'reject', comment: comment.trim() } });
      const updated = await tx.memo.update({
        where: { id }, data: { status: 'rejected', currentApproverId: null, closedAt: new Date() }, include: INCLUDE,
      });
      await tx.auditLog.create({ data: { memoId: id, userId: user.id, action: 'rejected', detail: `${step} rejected: ${comment.trim()}` } });
      return this.shape(updated);
    });
  }
}
