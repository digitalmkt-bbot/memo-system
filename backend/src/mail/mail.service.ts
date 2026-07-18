import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../db/prisma.service';

/**
 * Email notifications via SMTP2GO Web API (configured through env vars):
 *   SMTP2GO_API_KEY   — SMTP2GO API key (starts with "api-")
 *   MAIL_FROM         — verified sender, e.g. "MEMO System <no-reply@loveandaman.com>"
 *   APP_URL           — frontend base url (e.g. https://memo-system-production-001.up.railway.app)
 * If SMTP2GO is not configured the service no-ops (logs and skips) so the
 * approval flow never breaks because of email.
 */
@Injectable()
export class MailService {
  private readonly log = new Logger('MailService');

  constructor(private prisma: PrismaService) {}

  private get enabled(): boolean {
    return !!(process.env.SMTP2GO_API_KEY && process.env.MAIL_FROM);
  }

  /**
   * Base URL used in e-mail links. ALWAYS the production domain
   * (memo.loveandaman.com) — the Railway *.up.railway.app URL is a different
   * origin, so its login session doesn't carry over and users get bounced to
   * the login page when they click a link from an e-mail.
   */
  private appUrl() {
    const url = (process.env.APP_URL || '').trim().replace(/\/$/, '');
    if (!url || /railway\.app$/i.test(url)) return 'https://memo.loveandaman.com';
    return url;
  }

  /** Fire-and-forget; never throws. */
  async send(to: string, subject: string, html: string) {
    if (!to) return;
    if (!this.enabled) { this.log.warn(`SMTP2GO not configured — skip mail to ${to} (${subject})`); return; }
    try {
      const res = await fetch('https://api.smtp2go.com/v3/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: process.env.SMTP2GO_API_KEY,
          to: [to],
          sender: process.env.MAIL_FROM,
          subject,
          html_body: html,
        }),
      });
      const data: any = await res.json();
      if (data?.data?.succeeded) {
        this.log.log(`mail sent → ${to} (${subject})`);
      } else {
        this.log.error(`mail failed → ${to}: ${JSON.stringify(data?.data?.failures ?? data)}`);
      }
    } catch (e: any) {
      this.log.error(`mail error → ${to}: ${e.message}`);
    }
  }

  private layout(title: string, lines: string[], memoId: number, ctaText: string) {
    const url = `${this.appUrl()}/#/memos/view/${memoId}`;
    return `<div style="font-family:Tahoma,Arial,sans-serif;max-width:560px;margin:auto;color:#1d2733">
      <div style="background:#10b981;color:#fff;padding:16px 20px;border-radius:10px 10px 0 0;font-size:18px;font-weight:700">MEMO System · Love Andaman</div>
      <div style="border:1px solid #e2e8ec;border-top:none;border-radius:0 0 10px 10px;padding:20px">
        <div style="font-size:16px;font-weight:700;margin-bottom:10px">${title}</div>
        ${lines.map((l) => `<div style="margin:4px 0;font-size:14px">${l}</div>`).join('')}
        <a href="${url}" style="display:inline-block;margin-top:16px;background:#10b981;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600">${ctaText}</a>
        <div style="color:#8a98a5;font-size:12px;margin-top:16px">อีเมลนี้ส่งอัตโนมัติจากระบบ MEMO กรุณาอย่าตอบกลับ</div>
      </div>
    </div>`;
  }

  private esc(s: any) {
    return String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string));
  }

  /** Send with file attachments (base64) and optional CC. Fire-and-forget; never throws. */
  async sendWithAttachments(
    to: string[], subject: string, html: string,
    attachments: { filename: string; mimeType: string; base64: string }[],
    cc?: string[],
  ) {
    const list = (to || []).filter(Boolean);
    if (!list.length) return;
    if (!this.enabled) { this.log.warn(`SMTP2GO not configured — skip mail to ${list.join(',')} (${subject})`); return; }
    const ccList = (cc || []).filter(Boolean).filter((e) => !list.includes(e));
    try {
      const res = await fetch('https://api.smtp2go.com/v3/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: process.env.SMTP2GO_API_KEY,
          to: list,
          ...(ccList.length ? { cc: ccList } : {}),
          sender: process.env.MAIL_FROM,
          subject,
          html_body: html,
          attachments: (attachments || []).map((a) => ({ filename: a.filename, fileblob: a.base64, mimetype: a.mimeType })),
        }),
      });
      const data: any = await res.json();
      if (data?.data?.succeeded) this.log.log(`mail(+att) sent → ${list.join(',')}${ccList.length ? ` cc:${ccList.join(',')}` : ''} (${subject})`);
      else this.log.error(`mail(+att) failed → ${list.join(',')}: ${JSON.stringify(data?.data?.failures ?? data)}`);
    } catch (e: any) {
      this.log.error(`mail(+att) error → ${list.join(',')}: ${e.message}`);
    }
  }

  /** Notify FC/accounting that an approved memo is available — for acknowledgement only. */
  async notifyFcAcknowledge(memo: any) {
    const fcUsers = await this.prisma.user.findMany({ where: { role: 'fc' as any, active: true }, select: { email: true } });
    const emails = fcUsers.map((u) => u.email).filter(Boolean);
    if (!emails.length) return;
    const html = this.layout(
      'บันทึกข้อความอนุมัติแล้ว (แจ้งเพื่อทราบ)',
      [
        `มีบันทึกข้อความที่อนุมัติสมบูรณ์แล้ว ส่งถึงฝ่ายการเงินเพื่อทราบ`,
        `<b>เลขที่:</b> ${this.esc(memo.memoNo || '-')}`,
        `<b>เรื่อง:</b> ${this.esc(memo.subject || '-')}`,
        `<b>ผู้ขอ:</b> ${this.esc(memo.creatorName || memo.fromName || '-')}`,
      ],
      memo.id,
      'เปิดดูบันทึก',
    );
    for (const to of emails) await this.send(to, `[MEMO] แจ้งเพื่อทราบ: ${memo.memoNo || ''} ${memo.subject || ''}`.trim(), html);
  }

  /** Final forward: send the approved memo PDF + attachments to archive mailboxes (CC the creator). */
  async sendMemoForward(recipients: string[], memo: any, attachments: { filename: string; mimeType: string; base64: string }[], cc?: string[], skipped?: string[]) {
    const attNames = attachments.map((a) => a.filename);
    const html = this.layout(
      'ส่งบันทึกข้อความที่อนุมัติแล้ว',
      [
        `บันทึกข้อความที่อนุมัติสมบูรณ์แล้ว (แนบไฟล์ PDF และเอกสารประกอบ)`,
        `<b>เลขที่:</b> ${this.esc(memo.memoNo || '-')}`,
        `<b>เรื่อง:</b> ${this.esc(memo.subject || '-')}`,
        `<b>ผู้ขอ:</b> ${this.esc(memo.creatorName || memo.fromName || '-')}`,
        `<b>ไฟล์แนบในอีเมล:</b> ${attNames.map((n) => this.esc(n)).join(', ') || '-'}`,
        ...(skipped && skipped.length
          ? [`<b>ไฟล์ขนาดใหญ่ (ดาวน์โหลดในระบบ):</b> ${skipped.map((n) => this.esc(n)).join(', ')}`]
          : []),
      ],
      memo.id,
      'เปิดดู / ดาวน์โหลดไฟล์ทั้งหมดในระบบ',
    );
    await this.sendWithAttachments(recipients, `[MEMO] ${memo.memoNo || ''} ${memo.subject || ''}`.trim(), html, attachments, cc);
  }

  /** Notify the user who must approve next that a memo is waiting. */
  async notifyPendingApprover(memo: any) {
    if (!memo?.currentApproverId) return;
    const approver = await this.prisma.user.findUnique({ where: { id: memo.currentApproverId } });
    if (!approver?.email) return;
    if (approver.role === 'executive') return; // executives are view-only — never notify
    const html = this.layout(
      'มีบันทึกข้อความรออนุมัติ',
      [
        `เรียน คุณ${this.esc(approver.name)}`,
        `มีบันทึกข้อความรอการอนุมัติจากท่าน`,
        `<b>เลขที่:</b> ${this.esc(memo.memoNo || '-')}`,
        `<b>เรื่อง:</b> ${this.esc(memo.subject || '-')}`,
        `<b>ผู้ขอ:</b> ${this.esc(memo.creatorName || memo.fromName || '-')}`,
      ],
      memo.id,
      'เปิดเพื่ออนุมัติ',
    );
    await this.send(approver.email, `[MEMO] รออนุมัติ: ${memo.memoNo || ''} ${memo.subject || ''}`.trim(), html);
  }

  /** Notify the creator that their memo was approved, rejected, or put on hold. */
  async notifyCreator(memo: any, kind: 'approved' | 'rejected' | 'held', comment?: string) {
    if (!memo?.createdBy) return;
    const creator = await this.prisma.user.findUnique({ where: { id: memo.createdBy } });
    if (!creator?.email) return;
    if (creator.role === 'executive') return; // executives are view-only — never notify
    const title = kind === 'approved' ? 'บันทึกข้อความได้รับการอนุมัติแล้ว'
      : kind === 'rejected' ? 'บันทึกข้อความถูกตีกลับ (ไม่อนุมัติ)'
      : 'บันทึกข้อความอยู่ระหว่างพิจารณา (รอพิจารณา)';
    const line = kind === 'approved' ? 'บันทึกข้อความของท่านได้รับการอนุมัติครบทุกขั้นแล้ว'
      : kind === 'rejected' ? 'บันทึกข้อความของท่านถูกตีกลับ (ไม่อนุมัติ)'
      : 'ผู้อนุมัติได้ทำเครื่องหมาย “รอพิจารณา” ไว้ อยู่ระหว่างการพิจารณา';
    const subj = kind === 'approved' ? 'อนุมัติแล้ว' : kind === 'rejected' ? 'ไม่อนุมัติ' : 'รอพิจารณา';
    const html = this.layout(
      title,
      [
        `เรียน คุณ${this.esc(creator.name)}`,
        line,
        `<b>เลขที่:</b> ${this.esc(memo.memoNo || '-')}`,
        `<b>เรื่อง:</b> ${this.esc(memo.subject || '-')}`,
        ...(comment ? [`<b>หมายเหตุ:</b> ${this.esc(comment)}`] : []),
      ],
      memo.id,
      'เปิดดูบันทึก',
    );
    await this.send(creator.email, `[MEMO] ${subj}: ${memo.memoNo || ''}`.trim(), html);
  }

  /** Reminder to the current approver that a memo has been waiting too long. */
  async notifyApproverReminder(memo: any, hours: number) {
    if (!memo?.currentApproverId) return;
    const approver = await this.prisma.user.findUnique({ where: { id: memo.currentApproverId } });
    if (!approver?.email) return;
    if (approver.role === 'executive') return;
    const creator = memo.createdBy ? await this.prisma.user.findUnique({ where: { id: memo.createdBy } }) : null;
    const html = this.layout(
      '⏰ เตือน: มีบันทึกข้อความค้างรออนุมัติ',
      [
        `เรียน คุณ${this.esc(approver.name)}`,
        `<div style="background:#fff4e5;border-left:4px solid #f59e0b;padding:10px 12px;border-radius:6px;margin:8px 0">
           บันทึกข้อความฉบับนี้ <b>ค้างรอการอนุมัติจากท่านมาแล้ว ${Math.floor(hours)} ชั่วโมง</b> กรุณาพิจารณาโดยเร็ว
         </div>`,
        `<b>เลขที่:</b> ${this.esc(memo.memoNo || '-')}`,
        `<b>เรื่อง:</b> ${this.esc(memo.subject || '-')}`,
        `<b>ผู้ขอ:</b> ${this.esc(creator?.name || memo.fromName || '-')}`,
        `<b>ส่งเมื่อ:</b> ${this.esc(this.thDate(memo.submittedAt))}`,
      ],
      memo.id,
      'เปิดเพื่ออนุมัติ',
    );
    await this.send(approver.email, `[MEMO] ⏰ เตือนอนุมัติ (ค้าง ${Math.floor(hours)} ชม.): ${memo.memoNo || ''}`.trim(), html);
  }

  /** Summary alert to higher-level executives about memos stuck past the SLA. */
  async notifyEscalation(rows: { memo: any; approverName: string; days: number }[], recipients: string[]) {
    const list = (recipients || []).filter(Boolean);
    if (!list.length || !rows.length) return;
    const base = this.appUrl();
    const items = rows
      .map(
        (r) => `<tr>
          <td style="padding:6px 8px;border-bottom:1px solid #eef2f5;font-size:13px"><a href="${base}/#/memos/view/${r.memo.id}" style="color:#0f766e;text-decoration:none">${this.esc(r.memo.memoNo || r.memo.id)}</a></td>
          <td style="padding:6px 8px;border-bottom:1px solid #eef2f5;font-size:13px">${this.esc(r.memo.subject || '-')}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #eef2f5;font-size:13px">${this.esc(r.approverName)}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #eef2f5;font-size:13px;color:#dc2626;font-weight:700;text-align:center">${r.days} วันทำการ</td>
        </tr>`,
      )
      .join('');
    const html = `<div style="font-family:Tahoma,Arial,sans-serif;max-width:720px;margin:auto;color:#1d2733">
      <div style="background:#dc2626;color:#fff;padding:16px 20px;border-radius:10px 10px 0 0;font-size:18px;font-weight:700">🚨 สรุปเอกสารค้างอนุมัติเกินกำหนด</div>
      <div style="border:1px solid #e2e8ec;border-top:none;border-radius:0 0 10px 10px;padding:20px">
        <div style="font-size:14px;margin-bottom:12px">มีบันทึกข้อความ <b>${rows.length} ฉบับ</b> ค้างอยู่ที่ผู้อนุมัติเกิน <b>3 วันทำการ</b> ยังไม่ได้รับการพิจารณา</div>
        <table style="width:100%;border-collapse:collapse">
          <tr style="background:#f7fafc">
            <th style="padding:8px;text-align:left;font-size:12px;color:#64748b">เลขที่</th>
            <th style="padding:8px;text-align:left;font-size:12px;color:#64748b">เรื่อง</th>
            <th style="padding:8px;text-align:left;font-size:12px;color:#64748b">ค้างที่</th>
            <th style="padding:8px;text-align:center;font-size:12px;color:#64748b">ค้างนาน</th>
          </tr>
          ${items}
        </table>
        <a href="${base}/#/memos" style="display:inline-block;margin-top:16px;background:#dc2626;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600">เปิดระบบ MEMO</a>
        <div style="color:#8a98a5;font-size:12px;margin-top:16px">อีเมลนี้ส่งอัตโนมัติจากระบบ MEMO กรุณาอย่าตอบกลับ</div>
      </div>
    </div>`;
    for (const to of list) {
      await this.send(to, `[MEMO] 🚨 สรุปเอกสารค้างอนุมัติเกิน 3 วันทำการ (${rows.length} ฉบับ)`, html);
    }
  }

  private thDate(d: any) {
    if (!d) return '-';
    try {
      return new Date(d).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Bangkok' });
    } catch {
      return '-';
    }
  }
}