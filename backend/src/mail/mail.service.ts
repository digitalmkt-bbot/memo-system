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

  private appUrl() {
    return (process.env.APP_URL || 'https://memo-system-production-001.up.railway.app').replace(/\/$/, '');
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

  /** Notify the user who must approve next that a memo is waiting. */
  async notifyPendingApprover(memo: any) {
    if (!memo?.currentApproverId) return;
    const approver = await this.prisma.user.findUnique({ where: { id: memo.currentApproverId } });
    if (!approver?.email) return;
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

  /** Notify the creator that their memo was approved or rejected. */
  async notifyCreator(memo: any, kind: 'approved' | 'rejected', comment?: string) {
    if (!memo?.createdBy) return;
    const creator = await this.prisma.user.findUnique({ where: { id: memo.createdBy } });
    if (!creator?.email) return;
    const approved = kind === 'approved';
    const html = this.layout(
      approved ? 'บันทึกข้อความได้รับการอนุมัติแล้ว' : 'บันทึกข้อความถูกตีกลับ (ไม่อนุมัติ)',
      [
        `เรียน คุณ${this.esc(creator.name)}`,
        approved
          ? `บันทึกข้อความของท่านได้รับการอนุมัติครบทุกขั้นแล้ว`
          : `บันทึกข้อความของท่านถูกตีกลับ (ไม่อนุมัติ)`,
        `<b>เลขที่:</b> ${this.esc(memo.memoNo || '-')}`,
        `<b>เรื่อง:</b> ${this.esc(memo.subject || '-')}`,
        ...(comment ? [`<b>หมายเหตุ:</b> ${this.esc(comment)}`] : []),
      ],
      memo.id,
      'เปิดดูบันทึก',
    );
    await this.send(creator.email, `[MEMO] ${approved ? 'อนุมัติแล้ว' : 'ไม่อนุมัติ'}: ${memo.memoNo || ''}`.trim(), html);
  }
}