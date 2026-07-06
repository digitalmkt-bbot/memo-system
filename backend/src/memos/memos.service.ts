import {
  BadRequestException, ForbiddenException, Injectable, NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../db/prisma.service';
import { JwtUser } from '../auth/jwt.strategy';
import { CreateMemoDto, UpdateMemoDto } from './dto/memo.dto';
import { MailService } from '../mail/mail.service';
import { PdfService } from './pdf.service';

const INCLUDE = {
  creator: { select: { name: true } },
  department: { select: { code: true, name: true } },
  company: { select: { code: true, name: true } },
  currentApprover: { select: { name: true } },
  items: { orderBy: { position: 'asc' as const } },
};

@Injectable()
export class MemosService {
  constructor(private prisma: PrismaService, private mail: MailService, private pdf: PdfService) {}

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

  /**
   * The head of a department = a role 'manager' in that dept, or (for depts
   * without a manager, e.g. HR headed by the HRM) the dept's 'hrm'/'md'.
   */
  private async deptHeadId(companyId: number, departmentId: number, excludeId?: number): Promise<number | null> {
    for (const role of ['manager', 'hrm', 'md']) {
      const u = await this.prisma.user.findFirst({
        where: { role: role as any, active: true, companyId, departmentId, ...(excludeId ? { id: { not: excludeId } } : {}) },
        orderBy: { id: 'asc' },
      });
      if (u) return u.id;
    }
    return null;
  }

  private async pickManager(creatorId: number, companyId?: number, departmentId?: number) {
    const creator = await this.prisma.user.findUnique({ where: { id: creatorId } });
    if (!creator) return null;
    // route by the MEMO's company/department (may differ from the creator's own)
    const coId = companyId ?? creator.companyId;
    const deptId = departmentId ?? creator.departmentId ?? -1;
    // 1) explicit "first approver" assigned to this user (managerId) — admin's choice wins.
    //    Any active user may be chosen as first approver (not only role=manager).
    if (creator.managerId) {
      const m = await this.prisma.user.findFirst({ where: { id: creator.managerId, active: true } });
      if (m) return m.id;
    }
    // 2) the head of the memo's OWN department (never cross-department)
    const head = await this.deptHeadId(coId, deptId, creatorId);
    if (head) return head;
    // 3) last resort: any manager in the company
    const fb = await this.prisma.user.findFirst({
      where: { role: 'manager', active: true, companyId: coId, id: { not: creatorId } }, orderBy: { id: 'asc' },
    });
    return fb?.id ?? null;
  }

  private async pickByRole(role: string, companyId?: number, excludeId?: number) {
    const u = await this.prisma.user.findFirst({
      where: { role: role as any, active: true, ...(companyId ? { companyId } : {}), ...(excludeId ? { id: { not: excludeId } } : {}) }, orderBy: { id: 'asc' },
    });
    return u?.id ?? null;
  }

  // Approval base = sum of line items (before VAT). Memos with no items = 0.
  private async memoTotal(db: any, memoId: number): Promise<number> {
    const items = await db.memoItem.findMany({ where: { memoId }, select: { qty: true, unitPrice: true } });
    return items.reduce((s: number, it: any) => s + (Number(it.qty) || 0) * (Number(it.unitPrice) || 0), 0);
  }
  // Memos with total ≤ this amount skip the MD approver entirely.
  private readonly SMALL_MAX = 1000;

  private canApprove(user: JwtUser, memo: any) {
    if (memo.currentApproverId !== user.id) return false;
    if (memo.status === 'pending_manager') return true; // assigned first approver (any role); currentApproverId already gates
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
    if (f.q) {
      const search = [
        { subject: { contains: f.q, mode: 'insensitive' } },
        { detail: { contains: f.q, mode: 'insensitive' } },
        { memoNo: { contains: f.q, mode: 'insensitive' } },
      ];
      // keep the visibility OR (draft restriction) intact when combined with search
      if (where.OR) { where.AND = [{ OR: where.OR }, { OR: search }]; delete where.OR; }
      else where.OR = search;
    }
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
    // The creator may delete their own memo (e.g. a keying mistake), any status.
    // Admin may delete any memo. No one else can.
    if (memo.createdBy !== user.id && user.role !== 'admin') {
      throw new ForbiddenException('เฉพาะผู้สร้างหรือผู้ดูแลระบบเท่านั้นที่ลบได้');
    }
    await this.prisma.$transaction([
      this.prisma.approval.deleteMany({ where: { memoId: id } }),
      this.prisma.memoItem.deleteMany({ where: { memoId: id } }),
      this.prisma.attachment.deleteMany({ where: { memoId: id } }),
      this.prisma.auditLog.deleteMany({ where: { memoId: id } }),
      this.prisma.memo.delete({ where: { id } }),
    ]);
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

      // The first approver is the HEAD of the memo's department (a 'manager', or
      // the dept's HRM/MD when it has no manager — e.g. HR headed by the HRM).
      // If the creator IS that head, skip the step (no self-approval):
      // small memos are approved outright, larger ones go straight to MD.
      const headId = await this.deptHeadId(memo.companyId, memo.departmentId);
      const isHead = headId != null && headId === user.id;

      let data: any; let detail: string;
      if (isHead) {
        const total = await this.memoTotal(tx, id);
        const small = total <= this.SMALL_MAX;
        await tx.approval.create({ data: { memoId: id, step: 'manager', approvedBy: user.id, status: 'approve', comment: small
          ? 'ผู้สร้างเป็นหัวหน้าแผนก · ยอด ≤ 1,000 → อนุมัติจบงานทันที'
          : 'ผู้สร้างเป็นหัวหน้าแผนก (ข้ามขั้นหัวหน้า → ส่งตรงถึง MD)' } });
        if (small) {
          data = { memoNo, status: 'approved', currentApproverId: null, submittedAt: new Date(), closedAt: new Date() };
          detail = `Assigned ${memoNo}; dept head, ≤1,000 → approved directly`;
        } else {
          const nextId = (await this.pickByRole('md', memo.companyId, user.id)) ?? (await this.pickByRole('md', undefined, user.id));
          if (!nextId) throw new BadRequestException('No MD approver available');
          data = { memoNo, status: 'pending_hrmd', currentApproverId: nextId, submittedAt: new Date() };
          detail = `Assigned ${memoNo}; creator is dept head → routed to MD`;
        }
      } else {
        const managerId = await this.pickManager(user.id, memo.companyId, memo.departmentId);
        if (!managerId) throw new BadRequestException('No manager available to route to');
        data = { memoNo, status: 'pending_manager', currentApproverId: managerId, submittedAt: new Date() };
        detail = `Assigned ${memoNo}, routed to manager`;
      }

      const updated = await tx.memo.update({ where: { id }, data, include: INCLUDE });
      await tx.auditLog.create({ data: { memoId: id, userId: user.id, action: 'submitted', detail } });
      return this.shape(updated);
    });
    // notify (after commit, never blocks the flow)
    try {
      if (result.status === 'approved') {
        await this.mail.notifyCreator(result, 'approved');
        await this.mail.notifyFcAcknowledge(result);
      } else {
        await this.mail.notifyPendingApprover(result);
      }
    } catch { /* noop */ }
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
        const total = await this.memoTotal(tx, id);
        if (total <= this.SMALL_MAX) {
          // small memo (≤ 1,000): no MD. Manager either finalizes, or forwards to HRM.
          if (next === 'hrm') {
            const nextId = (await this.pickByRole('hrm', memo.companyId, user.id)) ?? (await this.pickByRole('hrm', undefined, user.id));
            if (!nextId) throw new BadRequestException('No HRM approver available');
            data = { status: 'pending_hrmd', currentApproverId: nextId };
            action = 'approved_manager_to_hrm';
          } else {
            data = { status: 'approved', currentApproverId: null, closedAt: new Date() };
            action = 'approved_manager_final';
          }
        } else {
          // large memo: manager chooses HRM or MD as the next approver
          const target = next === 'md' ? 'md' : 'hrm';
          const nextId = (await this.pickByRole(target, memo.companyId, user.id)) ?? (await this.pickByRole(target, undefined, user.id));
          if (!nextId) throw new BadRequestException(`No ${target.toUpperCase()} approver available`);
          data = { status: 'pending_hrmd', currentApproverId: nextId };
          action = `approved_manager_to_${target}`;
        }
      } else if (memo.status === 'pending_hrmd') {
        // HRM or MD approval finalizes the memo. FC no longer approves —
        // they receive an acknowledgement email automatically (see below).
        data = { status: 'approved', currentApproverId: null, closedAt: new Date() };
        action = `approved_${user.role}_final`;
      } else {
        // legacy pending_fc / pending_executive -> final approval
        data = { status: 'approved', currentApproverId: null, closedAt: new Date() };
        action = 'approved_final';
      }
      data.onHold = false; // any decision clears a prior "on hold" mark
      const updated = await tx.memo.update({ where: { id }, data, include: INCLUDE });
      await tx.auditLog.create({ data: { memoId: id, userId: user.id, action, detail: comment ?? null } });
      return this.shape(updated);
    });
    // notify: creator on final approval, otherwise the next approver
    try {
      if (result.status === 'approved') {
        await this.mail.notifyCreator(result, 'approved');
        await this.mail.notifyFcAcknowledge(result); // FC receives it for acknowledgement only
      } else {
        await this.mail.notifyPendingApprover(result);
      }
    } catch { /* noop */ }
    return result;
  }

  /**
   * Final step: the creator forwards the approved memo (PDF + attachments)
   * to one or more archive mailboxes, which closes the job.
   */
  async forward(user: JwtUser, id: number, recipients: string[]) {
    const ALLOWED = ['ac@loveandaman.com', 'hr@loveandaman.com', 'apm@loveandaman.com'];
    const memo = await this.prisma.memo.findUnique({ where: { id }, include: INCLUDE });
    if (!memo) throw new NotFoundException('Memo not found');
    if (memo.createdBy !== user.id && user.role !== 'admin') throw new ForbiddenException('เฉพาะผู้สร้างเท่านั้นที่ส่งปิดงานได้');
    if (memo.status !== 'approved') throw new BadRequestException('ต้องอนุมัติสมบูรณ์ก่อนจึงจะส่งปิดงานได้');
    if (memo.forwardedAt) throw new BadRequestException('memo นี้ส่งปิดงานไปแล้ว');
    const to = Array.from(new Set((recipients || []).map((r) => String(r).trim().toLowerCase()))).filter((r) => ALLOWED.includes(r));
    if (!to.length) throw new BadRequestException('กรุณาเลือกปลายทางอย่างน้อย 1 ที่');

    const shaped = this.shape(memo);
    const approvals = await this.prisma.approval.findMany({
      where: { memoId: id }, include: { approver: { select: { name: true, role: true } } }, orderBy: { approvedAt: 'asc' },
    });
    const pdf = await this.pdf.render({ memo: shaped, approvals: approvals.map((a) => ({ ...a, approverName: a.approver.name, approverRole: a.approver.role })) });
    const files = await this.prisma.attachment.findMany({ where: { memoId: id } });

    const attachments = [
      { filename: `${shaped.memoNo || 'memo'}.pdf`, mimeType: 'application/pdf', base64: pdf.toString('base64') },
      ...files.map((f) => ({ filename: f.filename, mimeType: f.mimeType, base64: Buffer.from(f.data as any).toString('base64') })),
    ];

    const creator = await this.prisma.user.findUnique({ where: { id: memo.createdBy }, select: { email: true } });
    const cc = creator?.email ? [creator.email] : [];
    await this.mail.sendMemoForward(to, shaped, attachments, cc);
    const updated = await this.prisma.memo.update({
      where: { id }, data: { forwardedAt: new Date(), forwardedTo: to.join(', ') }, include: INCLUDE,
    });
    await this.audit(id, user.id, 'forwarded', `ส่งปิดงานถึง: ${to.join(', ')}`);
    return this.shape(updated);
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
        where: { id }, data: { status: 'rejected', currentApproverId: null, closedAt: new Date(), onHold: false }, include: INCLUDE,
      });
      await tx.auditLog.create({ data: { memoId: id, userId: user.id, action: 'rejected', detail: `${step} rejected: ${comment.trim()}` } });
      return this.shape(updated);
    });
    try { await this.mail.notifyCreator(result, 'rejected', comment.trim()); } catch { /* noop */ }
    return result;
  }

  /**
   * "รอพิจารณา" — the current approver marks the memo as on-hold (under
   * consideration) without deciding yet. It stays assigned to the same
   * approver, who can later approve or reject it.
   */
  async hold(user: JwtUser, id: number, comment?: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const memo = await tx.memo.findUnique({ where: { id } });
      if (!memo) throw new NotFoundException('Memo not found');
      if (!this.canApprove(user, memo)) throw new ForbiddenException('Cannot act at current step');
      const step = memo.status === 'pending_manager' ? 'manager'
        : memo.status === 'pending_hrmd' ? user.role
        : memo.status === 'pending_fc' ? 'fc' : 'executive';
      await tx.approval.create({ data: { memoId: id, step, approvedBy: user.id, status: 'hold', comment: comment?.trim() || null } });
      const updated = await tx.memo.update({ where: { id }, data: { onHold: true }, include: INCLUDE });
      await tx.auditLog.create({ data: { memoId: id, userId: user.id, action: 'held', detail: comment?.trim() || null } });
      return this.shape(updated);
    });
    try { await this.mail.notifyCreator(result, 'held', comment?.trim()); } catch { /* noop */ }
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
