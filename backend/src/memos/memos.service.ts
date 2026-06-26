import {
  BadRequestException, ForbiddenException, Injectable, NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../db/prisma.service';
import { JwtUser } from '../auth/jwt.strategy';
import { CreateMemoDto, UpdateMemoDto } from './dto/memo.dto';
import { MailService } from '../mail/mail.service';

const INCLUDE = {
  creator: { select: { name: true } },
  department: { select: { code: true, name: true } },
  company: { select: { code: true, name: true } },
  currentApprover: { select: { name: true } },
  items: { orderBy: { position: 'asc' as const } },
};

@Injectable()
export class MemosService {
  constructor(private prisma: PrismaService, private mail: MailService) {}

  private shape(m: any) {
    if (!m) return m;
    const { creator, department, company, currentApprover, items: rawItems, ...rest } = m;
    const items = (rawItems ?? []).map((it: any) => ({
      ...it,
      lineTotal: (Number(it.qty) || 0) * (Number(it.unitPrice) || 0),
    }));
    const totalAmount = items.reduce((s: number, it: any) => s + it.lineTotal, 0);
    const vatAmount = rest.vat ? totalAmount * 0.07 : 0;
    const grandTotal = totalAmount + vatAmount;
    return {
      ...rest,
      items,
      totalAmount,
      vatAmount,
      grandTotal,
      creatorName: creator?.name ?? null,
      deptCode: department?.code ?? null,
      deptName: department?.name ?? null,
      companyCode: company?.code ?? null,
      companyName: company?.name ?? null,
      currentApproverName: currentApprover?.name ?? null,
    };
  }

  /** sanitize incoming line items (drop rows without a name) */
  private cleanItems(items: any): any[] {
    if (!Array.isArray(items)) return [];
    return items
      .filter((it) => it && String(it.name ?? '').trim())
      .map((it, i) => ({
        position: i,
        name: String(it.name).trim(),
        detail: it.detail ? String(it.detail).trim() : null,
        qty: Number(it.qty) || 0,
        unit: it.unit ? String(it.unit).trim() : null,
        unitPrice: Number(it.unitPrice) || 0,
      }));
  }

  private async audit(memoId: number | null, userId: number, action: string, detail?: string) {
    await this.prisma.auditLog.create({ data: { memoId, userId, action, detail: detail ?? null } });
  }

  private async pickManager(creatorId: number) {
    const creator = await this.prisma.user.findUnique({ where: { id: creatorId } });
    if (!creator) return null;
    // 1) explicit "first approver" assigned to this user (managerId) — admin's choice wins
    if (creator.managerId) {
      const m = await this.prisma.user.findFirst({ where: { id: creator.managerId, active: true, role: 'manager' } });
      if (m) return m.id;
    }
    // 2) manager of the SAME department (requester's department manager)
    const sameDept = await this.prisma.user.findFirst({
      where: { role: 'manager', active: true, companyId: creator.companyId, departmentId: creator.departmentId ?? -1 },
      orderBy: { id: 'asc' },
    });
    if (sameDept) return sameDept.id;
    // 3) any manager in the company (fallback)
    const fb = await this.prisma.user.findFirst({
      where: { role: 'manager', active: true, companyId: creator.companyId }, orderBy: { id: 'asc' },
    });
    return fb?.id ?? null;
  }

  private async pickByRole(role: string, companyId?: number) {
    const u = await this.prisma.user.findFirst({
      where: { role: role as any, active: true, ...(companyId ? { companyId } : {}) }, orderBy: { id: 'asc' },
    });
    return u?.id ?? null;
  }

  private canApprove(user: JwtUser, memo: any) {
    if (memo.currentApproverId !== user.id) return false;
    if (memo.status === 'pending_manager') return user.role === 'manager';
    if (memo.status === 'pending_hrmd') return user.role === 'hrm' || user.role === 'md';
    if (memo.status === 'pending_fc') return user.role === 'fc';
    if (memo.status === 'pending_executive') return user.role === 'executive'; // legacy
    return false;
  }

  /**
   * Department-level visibility:
   *  - executive / admin / hrm / md / fc : all memos
   *  - manager & staff : memos in their OWN department only (same company);
   *    other people's drafts are hidden (only own drafts are visible).
   */
  private visibilityScope(user: JwtUser): any {
    if (['admin', 'executive', 'hrm', 'md', 'fc'].includes(user.role)) return {};
    return {
      companyId: user.companyId,
      departmentId: user.departmentId ?? -1,
      OR: [{ status: { not: 'draft' } }, { createdBy: user.id }],
    };
  }

  async list(user: JwtUser, f: { box?: string; status?: string; companyId?: string; departmentId?: string; q?: string }) {
    const where: any = {};
    if (f.box === 'inbox') {
      where.currentApproverId = user.id;
      where.status = { in: ['pending_manager', 'pending_hrmd', 'pending_fc', 'pending_executive'] };
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
      ['admin', 'executive', 'hrm', 'md', 'fc'].includes(user.role) ||
      (['manager', 'staff'].includes(user.role) &&
        memo.companyId === user.companyId && memo.departmentId === user.departmentId &&
        (memo.status !== 'draft' || memo.createdBy === user.id));
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
    const items = this.cleanItems(dto.items);
    const memo = await this.prisma.memo.create({
      data: {
        companyId: dto.companyId, departmentId: dto.departmentId,
        fromName: dto.fromName.trim(), subject: dto.subject.trim(),
        attachment: dto.attachment?.trim() || null, detail: dto.detail.trim(),
        createdBy: user.id, status: 'draft',
        vat: !!dto.vat,
        category: dto.category?.trim() || null,
        categoryNote: dto.categoryNote?.trim() || null,
        neededDate: dto.neededDate ? new Date(dto.neededDate) : null,
        items: { create: items },
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
        vat: dto.vat ?? memo.vat,
        category: dto.category ?? memo.category,
        categoryNote: dto.categoryNote !== undefined ? (dto.categoryNote?.trim() || null) : memo.categoryNote,
        neededDate: dto.neededDate !== undefined ? (dto.neededDate ? new Date(dto.neededDate) : null) : memo.neededDate,
        ...(dto.items !== undefined
          ? { items: { deleteMany: {}, create: this.cleanItems(dto.items) } }
          : {}),
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
  async submit(user: JwtUser, id: number, next?: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const memo = await tx.memo.findUnique({ where: { id } });
      if (!memo) throw new NotFoundException('Memo not found');
      if (memo.createdBy !== user.id) throw new ForbiddenException('Not owner');
      if (memo.status !== 'draft') throw new BadRequestException('Memo is not a draft');

      let memoNo = memo.memoNo;
      if (!memoNo) {
        const r = await tx.$queryRaw<{ no: string }[]>`SELECT next_memo_no(${memo.companyId}::int) AS no`;
        memoNo = r[0].no;
      }

      // If the creator is the department manager of this memo's department,
      // skip the manager-approval step (no self-approval) and go straight to HRM/MD.
      const creator = await tx.user.findUnique({ where: { id: user.id } });
      const isDeptManager = creator?.role === 'manager'
        && memo.companyId === creator.companyId
        && memo.departmentId === creator.departmentId;

      let data: any; let detail: string;
      if (isDeptManager) {
        // creator is the department manager → skip the manager step and route
        // straight to the Managing Director (MD), regardless of `next`.
        const target = 'md';
        const nextId = (await this.pickByRole(target, memo.companyId)) ?? (await this.pickByRole(target));
        if (!nextId) throw new BadRequestException(`No ${target.toUpperCase()} approver available`);
        await tx.approval.create({ data: { memoId: id, step: 'manager', approvedBy: user.id, status: 'approve', comment: 'ผู้สร้างเป็นผู้จัดการแผนก (ข้ามขั้นอนุมัติหัวหน้า → ส่งตรงถึง MD)' } });
        data = { memoNo, status: 'pending_hrmd', currentApproverId: nextId, submittedAt: new Date() };
        detail = `Assigned ${memoNo}; creator is dept manager → routed to MD`;
      } else {
        const managerId = await this.pickManager(user.id);
        if (!managerId) throw new BadRequestException('No manager available to route to');
        data = { memoNo, status: 'pending_manager', currentApproverId: managerId, submittedAt: new Date() };
        detail = `Assigned ${memoNo}, routed to manager`;
      }

      const updated = await tx.memo.update({ where: { id }, data, include: INCLUDE });
      await tx.auditLog.create({ data: { memoId: id, userId: user.id, action: 'submitted', detail } });
      return this.shape(updated);
    });
    // notify the next approver (after commit, never blocks the flow)
    try { await this.mail.notifyPendingApprover(result); } catch { /* noop */ }
    return result;
  }

  async approve(user: JwtUser, id: number, comment?: string, next?: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const memo = await tx.memo.findUnique({ where: { id } });
      if (!memo) throw new NotFoundException('Memo not found');
      if (!this.canApprove(user, memo)) throw new ForbiddenException('Cannot approve at current step');

      const step = memo.status === 'pending_manager' ? 'manager'
        : memo.status === 'pending_hrmd' ? user.role
        : memo.status === 'pending_fc' ? 'fc' : 'executive';
      await tx.approval.create({ data: { memoId: id, step, approvedBy: user.id, status: 'approve', comment: comment ?? null } });

      let data: any; let action = 'approved';
      if (memo.status === 'pending_manager') {
        // department manager chooses HRM or MD as the next approver
        const target = next === 'md' ? 'md' : 'hrm';
        const nextId = (await this.pickByRole(target, memo.companyId)) ?? (await this.pickByRole(target));
        if (!nextId) throw new BadRequestException(`No ${target.toUpperCase()} approver available`);
        data = { status: 'pending_hrmd', currentApproverId: nextId };
        action = `approved_manager_to_${target}`;
      } else if (memo.status === 'pending_hrmd') {
        const fcId = (await this.pickByRole('fc', memo.companyId)) ?? (await this.pickByRole('fc'));
        if (!fcId) throw new BadRequestException('No FC approver available');
        data = { status: 'pending_fc', currentApproverId: fcId };
        action = `approved_${user.role}_to_fc`;
      } else {
        // pending_fc (or legacy pending_executive) -> final approval
        data = { status: 'approved', currentApproverId: null, closedAt: new Date() };
        action = 'approved_final';
      }
      const updated = await tx.memo.update({ where: { id }, data, include: INCLUDE });
      await tx.auditLog.create({ data: { memoId: id, userId: user.id, action, detail: comment ?? null } });
      return this.shape(updated);
    });
    // notify: creator on final approval, otherwise the next approver
    try {
      if (result.status === 'approved') await this.mail.notifyCreator(result, 'approved');
      else await this.mail.notifyPendingApprover(result);
    } catch { /* noop */ }
    return result;
  }

  async reject(user: JwtUser, id: number, comment?: string) {
    if (!comment || !comment.trim()) throw new BadRequestException('A reason is required to reject');
    const result = await this.prisma.$transaction(async (tx) => {
      const memo = await tx.memo.findUnique({ where: { id } });
      if (!memo) throw new NotFoundException('Memo not found');
      if (!this.canApprove(user, memo)) throw new ForbiddenException('Cannot reject at current step');
      const step = memo.status === 'pending_manager' ? 'manager'
        : memo.status === 'pending_hrmd' ? user.role
        : memo.status === 'pending_fc' ? 'fc' : 'executive';
      await tx.approval.create({ data: { memoId: id, step, approvedBy: user.id, status: 'reject', comment: comment.trim() } });
      const updated = await tx.memo.update({
        where: { id }, data: { status: 'rejected', currentApproverId: null, closedAt: new Date() }, include: INCLUDE,
      });
      await tx.auditLog.create({ data: { memoId: id, userId: user.id, action: 'rejected', detail: `${step} rejected: ${comment.trim()}` } });
      return this.shape(updated);
    });
    try { await this.mail.notifyCreator(result, 'rejected', comment.trim()); } catch { /* noop */ }
    return result;
  }

  // ---- Attachments (stored in Postgres as bytea) ----
  private async assertCanView(user: JwtUser, memo: any) {
    const ok =
      memo.createdBy === user.id || memo.currentApproverId === user.id ||
      ['admin', 'executive', 'hrm', 'md', 'fc'].includes(user.role) ||
      (['manager', 'staff'].includes(user.role) && memo.companyId === user.companyId && memo.departmentId === user.departmentId &&
        (memo.status !== 'draft' || memo.createdBy === user.id));
    if (ok) return;
    const ap = await this.prisma.approval.findFirst({ where: { memoId: memo.id, approvedBy: user.id } });
    if (!ap) throw new ForbiddenException('Not allowed');
  }

  async addAttachment(user: JwtUser, memoId: number, file: { originalname: string; mimetype: string; size: number; buffer: Buffer }) {
    if (!file) throw new BadRequestException('No file uploaded');
    const memo = await this.prisma.memo.findUnique({ where: { id: memoId } });
    if (!memo) throw new NotFoundException('Memo not found');
    if (memo.createdBy !== user.id && user.role !== 'admin') {
      throw new ForbiddenException('Only the creator can attach files');
    }
    const att = await this.prisma.attachment.create({
      data: {
        memoId,
        filename: file.originalname,
        mimeType: file.mimetype || 'application/octet-stream',
        size: file.size,
        data: file.buffer,
        uploadedBy: user.id,
      },
      select: { id: true, filename: true, mimeType: true, size: true, createdAt: true },
    });
    await this.audit(memoId, user.id, 'attachment_added', file.originalname);
    return att;
  }

  async listAttachments(user: JwtUser, memoId: number) {
    const memo = await this.prisma.memo.findUnique({ where: { id: memoId } });
    if (!memo) throw new NotFoundException('Memo not found');
    await this.assertCanView(user, memo);
    return this.prisma.attachment.findMany({
      where: { memoId },
      select: { id: true, filename: true, mimeType: true, size: true, createdAt: true },
      orderBy: { id: 'asc' },
    });
  }

  async getAttachment(user: JwtUser, memoId: number, attId: number) {
    const memo = await this.prisma.memo.findUnique({ where: { id: memoId } });
    if (!memo) throw new NotFoundException('Memo not found');
    await this.assertCanView(user, memo);
    const att = await this.prisma.attachment.findFirst({ where: { id: attId, memoId } });
    if (!att) throw new NotFoundException('Attachment not found');
    return att;
  }

  async deleteAttachment(user: JwtUser, memoId: number, attId: number) {
    const memo = await this.prisma.memo.findUnique({ where: { id: memoId } });
    if (!memo) throw new NotFoundException('Memo not found');
    if (memo.createdBy !== user.id && user.role !== 'admin') throw new ForbiddenException('Not allowed');
    await this.prisma.attachment.deleteMany({ where: { id: attId, memoId } });
    return { ok: true };
  }
}
