import {
  BadRequestException, ForbiddenException, Injectable, NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../db/prisma.service';
import { JwtUser } from '../auth/jwt.strategy';
import { CreateMemoDto, UpdateMemoDto } from './dto/memo.dto';
import { MailService } from '../mail/mail.service';
import { PdfService } from './pdf.service';

const INCLUDE = {
  creator: { select: { name: true, role: true } },
  department: { select: { code: true, name: true } },
  company: { select: { code: true, name: true } },
  currentApprover: { select: { name: true, role: true } },
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
      creatorRole: creator?.role ?? null,
      deptCode: department?.code ?? null,
      deptName: department?.name ?? null,
      companyCode: company?.code ?? null,
      companyName: company?.name ?? null,
      currentApproverName: currentApprover?.name ?? null,
      currentApproverRole: currentApprover?.role ?? null,
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
    // 3) escalate to the company HR head, then the MD — never grab a random
    //    manager from an unrelated department.
    for (const role of ['hrm', 'md']) {
      const u = await this.prisma.user.findFirst({
        where: { role: role as any, active: true, companyId: coId, id: { not: creatorId } }, orderBy: { id: 'asc' },
      });
      if (u) return u.id;
    }
    return null;
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
    } else if (f.box === 'received') {
      // memos that were "ส่งปิดงาน" (forwarded to close) to THIS user's email
      const me = await this.prisma.user.findUnique({ where: { id: user.id }, select: { email: true } });
      where.forwardedTo = { contains: (me?.email || '__no_recipient__').toLowerCase(), mode: 'insensitive' };
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
    if (!participant && (memo as any).forwardedTo) {
      // a recipient of "ส่งปิดงาน" may open the memo
      const me = await this.prisma.user.findUnique({ where: { id: user.id }, select: { email: true } });
      if (me?.email && String((memo as any).forwardedTo).toLowerCase().includes(me.email.toLowerCase())) participant = true;
    }
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
    // Editable while still a draft, OR after submit but BEFORE the first approval
    // (status pending_manager = the first approver has not acted yet).
    if (memo.status !== 'draft' && memo.status !== 'pending_manager')
      throw new BadRequestException('แก้ไขได้เฉพาะก่อนการอนุมัติขั้นแรกเท่านั้น');
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

  /** Active users the creator may choose as an approver (everyone but themselves). */
  async approvers(user: JwtUser) {
    const users = await this.prisma.user.findMany({
      where: { active: true, id: { not: user.id } },
      orderBy: [{ companyId: 'asc' }, { departmentId: 'asc' }, { name: 'asc' }],
      select: {
        id: true, name: true, role: true,
        company: { select: { code: true } },
        department: { select: { code: true, name: true } },
      },
    });
    return users.map((u) => ({
      id: u.id, name: u.name, role: u.role,
      companyCode: u.company?.code ?? null,
      deptCode: u.department?.code ?? null,
      deptName: u.department?.name ?? null,
    }));
  }

  /**
   * Submit a draft. The running number is generated ATOMICALLY by the
   * next_memo_no() DB function (INSERT ... ON CONFLICT DO UPDATE RETURNING),
   * executed inside a single interactive transaction.
   */
  async submit(user: JwtUser, id: number, approverId?: number) {
    const result = await this.prisma.$transaction(async (tx) => {
      const memo = await tx.memo.findUnique({ where: { id } });
      if (!memo) throw new NotFoundException('Memo not found');
      if (memo.createdBy !== user.id) throw new ForbiddenException('Not owner');
      if (memo.status !== 'draft') throw new BadRequestException('Memo is not a draft');

      // Resolve the FIRST approver. NEVER auto-guess:
      //  1) the per-user "ผู้อนุมัติขั้นแรก" (managerId) configured in the backend, or
      //  2) an approver the creator explicitly picked when submitting.
      // If neither exists, ask the creator to choose (frontend catches CHOOSE_APPROVER).
      const creator = await tx.user.findUnique({ where: { id: user.id }, select: { managerId: true } });
      let approver: number | null = null;
      if (creator?.managerId && creator.managerId !== user.id) {
        const m = await tx.user.findFirst({ where: { id: creator.managerId, active: true }, select: { id: true } });
        if (m) approver = m.id;
      }
      if (!approver && approverId) {
        const chosen = await tx.user.findFirst({ where: { id: approverId, active: true }, select: { id: true } });
        if (!chosen) throw new BadRequestException('ผู้อนุมัติที่เลือกไม่ถูกต้องหรือถูกปิดใช้งาน');
        if (chosen.id === user.id) throw new BadRequestException('เลือกตัวเองเป็นผู้อนุมัติไม่ได้');
        approver = chosen.id;
      }
      if (!approver) throw new BadRequestException('CHOOSE_APPROVER');

      let memoNo = memo.memoNo;
      if (!memoNo) {
        const r = await tx.$queryRaw<{ no: string }[]>`SELECT next_memo_no(${memo.companyId}::int) AS no`;
        memoNo = r[0].no;
      }
      const data: any = { memoNo, status: 'pending_manager', currentApproverId: approver, submittedAt: new Date() };
      const detail = `Assigned ${memoNo}, routed to first approver #${approver}`;

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
      if (user.role === 'md') {
        // The Managing Director is the highest authority — their approval is
        // ALWAYS final, at any step. Never route onward to HR after the MD signs.
        data = { status: 'approved', currentApproverId: null, closedAt: new Date() };
        action = 'approved_md_final';
      } else if (user.role === 'hrm' && memo.status === 'pending_manager') {
        // The HR head is the first approver — their approval is final, unless
        // they explicitly escalate to the MD. (Never route to "another HRM".)
        const md = next === 'md'
          ? ((await this.pickByRole('md', memo.companyId, user.id)) ?? (await this.pickByRole('md', undefined, user.id)))
          : null;
        if (md) { data = { status: 'pending_hrmd', currentApproverId: md }; action = 'approved_hrm_to_md'; }
        else { data = { status: 'approved', currentApproverId: null, closedAt: new Date() }; action = 'approved_hrm_final'; }
      } else if (memo.status === 'pending_manager') {
        const total = await this.memoTotal(tx, id);
        if (total <= this.SMALL_MAX && next !== 'hrm' && next !== 'md') {
          // small memo (≤ 1,000): the first approver finalizes.
          data = { status: 'approved', currentApproverId: null, closedAt: new Date() };
          action = 'approved_manager_final';
        } else {
          // forward to a higher approver; resilient — if the chosen role has no
          // available person, fall back to the other high role, else finalize.
          const target = next === 'md' ? 'md' : 'hrm';
          const alt = target === 'md' ? 'hrm' : 'md';
          const nextId =
            (await this.pickByRole(target, memo.companyId, user.id)) ?? (await this.pickByRole(target, undefined, user.id)) ??
            (await this.pickByRole(alt, memo.companyId, user.id)) ?? (await this.pickByRole(alt, undefined, user.id));
          if (nextId) { data = { status: 'pending_hrmd', currentApproverId: nextId }; action = `approved_manager_to_${target}`; }
          else { data = { status: 'approved', currentApproverId: null, closedAt: new Date() }; action = 'approved_manager_final'; }
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
    if (memo.category === 'budget' && memo.actualAmount == null)
      throw new BadRequestException('ประเภทงบประมาณการ: กรุณากรอกยอดใช้จริงก่อนส่งปิดงาน');
    const to = Array.from(new Set((recipients || []).map((r) => String(r).trim().toLowerCase()))).filter((r) => ALLOWED.includes(r));
    if (!to.length) throw new BadRequestException('กรุณาเลือกปลายทางอย่างน้อย 1 ที่');

    const shaped = this.shape(memo);
    const approvals = await this.prisma.approval.findMany({
      where: { memoId: id }, include: { approver: { select: { name: true, role: true } } }, orderBy: { approvedAt: 'asc' },
    });
    const pdf = await this.pdf.render({ memo: shaped, approvals: approvals.map((a) => ({ ...a, approverName: a.approver.name, approverRole: a.approver.role })) });
    const files = await this.prisma.attachment.findMany({ where: { memoId: id } });

    // Keep e-mail attachment names safe for the mail API, and don't let a huge
    // file cause the whole message (incl. other attachments) to be rejected —
    // oversized files are listed instead and downloaded from the system.
    const safeName = (name: string) => (String(name || 'file').replace(/[\\/:*?"<>|\r\n\t]+/g, '_').replace(/\s+/g, ' ').trim() || 'file');
    const EMAIL_MAX = 7 * 1024 * 1024; // per-file cap for e-mail attachments
    const attachments: { filename: string; mimeType: string; base64: string }[] = [
      { filename: `${safeName(shaped.memoNo || 'memo')}.pdf`, mimeType: 'application/pdf', base64: pdf.toString('base64') },
    ];
    const skipped: string[] = [];
    for (const f of files) {
      const buf = Buffer.from(f.data as any);
      if (buf.length > EMAIL_MAX) { skipped.push(f.filename); continue; }
      attachments.push({ filename: safeName(f.filename), mimeType: f.mimeType || 'application/octet-stream', base64: buf.toString('base64') });
    }

    const creator = await this.prisma.user.findUnique({ where: { id: memo.createdBy }, select: { email: true } });
    const cc = creator?.email ? [creator.email] : [];
    await this.mail.sendMemoForward(to, shaped, attachments, cc, skipped);
    const updated = await this.prisma.memo.update({
      where: { id }, data: { forwardedAt: new Date(), forwardedTo: to.join(', ') }, include: INCLUDE,
    });
    await this.audit(id, user.id, 'forwarded', `ส่งปิดงานถึง: ${to.join(', ')}`);
    return this.shape(updated);
  }

  /**
   * Record the ACTUAL amount used for a budget-estimate memo (ประเภทงบประมาณการ)
   * after it has been approved. The system reconciles against the approved
   * estimate automatically:
   *   - actual ≤ estimate  → stays approved; the difference is a refund (คืนเงิน).
   *   - actual > estimate  → the excess must be approved: the memo is routed back
   *                          to the MD/HRM for a quick "approve the over-budget"
   *                          before it can be closed.
   */
  async settle(user: JwtUser, id: number, actualAmount: number) {
    const memo = await this.prisma.memo.findUnique({ where: { id }, include: INCLUDE });
    if (!memo) throw new NotFoundException('Memo not found');
    if (memo.createdBy !== user.id && user.role !== 'admin') throw new ForbiddenException('เฉพาะผู้สร้างเท่านั้นที่กรอกยอดใช้จริงได้');
    if (memo.category !== 'budget') throw new BadRequestException('กรอกยอดใช้จริงได้เฉพาะประเภทงบประมาณการ');
    if (memo.status !== 'approved') throw new BadRequestException('ต้องอนุมัติก่อนจึงจะกรอกยอดใช้จริงได้');
    if (memo.forwardedAt) throw new BadRequestException('memo นี้ส่งปิดงานไปแล้ว');
    const actual = Number(actualAmount);
    if (!isFinite(actual) || actual < 0) throw new BadRequestException('ยอดใช้จริงไม่ถูกต้อง');

    const estimate = this.shape(memo).grandTotal as number;
    if (actual > estimate) {
      // over budget → route the excess to the MD (or HRM) for re-approval
      const approverId =
        (await this.pickByRole('md', memo.companyId, user.id)) ?? (await this.pickByRole('md', undefined, user.id)) ??
        (await this.pickByRole('hrm', memo.companyId, user.id)) ?? (await this.pickByRole('hrm', undefined, user.id));
      if (!approverId) throw new BadRequestException('ไม่พบผู้อนุมัติสำหรับส่วนเกินงบ');
      const updated = await this.prisma.memo.update({
        where: { id },
        data: { actualAmount: actual, settledAt: new Date(), overBudget: true, status: 'pending_hrmd', currentApproverId: approverId, closedAt: null },
        include: INCLUDE,
      });
      await this.audit(id, user.id, 'settle_over', `ยอดใช้จริง ${actual} เกินงบ ${estimate} → ขออนุมัติเพิ่ม ${actual - estimate}`);
      try { await this.mail.notifyPendingApprover(this.shape(updated)); } catch { /* noop */ }
      return this.shape(updated);
    }
    const updated = await this.prisma.memo.update({
      where: { id },
      data: { actualAmount: actual, settledAt: new Date(), overBudget: false },
      include: INCLUDE,
    });
    await this.audit(id, user.id, 'settle', `ยอดใช้จริง ${actual} (คืนเงิน ${estimate - actual})`);
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
    if ((memo as any).forwardedTo) {
      // a recipient of "ส่งปิดงาน" may view/download the memo's files
      const me = await this.prisma.user.findUnique({ where: { id: user.id }, select: { email: true } });
      if (me?.email && String((memo as any).forwardedTo).toLowerCase().includes(me.email.toLowerCase())) return;
    }
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
