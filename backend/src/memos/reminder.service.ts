import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../db/prisma.service';
import { MailService } from '../mail/mail.service';

/**
 * Approval Timeline Tracking
 * ─────────────────────────────────────────────────────────────
 *  • Memo pending with the same approver for > 48 hours
 *      → reminder e-mail to that approver (repeats once every 24 h)
 *  • Memo pending for > 3 BUSINESS days
 *      → one Summary Alert to the higher-level executives (md / executive / admin)
 *
 * Implemented with a plain interval (no extra npm dependency) so the Railway
 * build stays exactly as it is today.
 */
@Injectable()
export class ReminderService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('ReminderService');
  private timer: any = null;

  /** How often the check runs. */
  private readonly TICK_MS = 30 * 60 * 1000; // 30 minutes
  /** First reminder after this many hours pending. */
  private readonly REMIND_AFTER_H = 48;
  /** Repeat the reminder at most once every this many hours. */
  private readonly REPEAT_EVERY_H = 24;
  /** Escalate to executives after this many business days. */
  private readonly ESCALATE_AFTER_BD = 3;
  /** Safety cap so an ignored memo can't mail forever. */
  private readonly MAX_REMINDERS = 10;

  constructor(private prisma: PrismaService, private mail: MailService) {}

  onModuleInit() {
    // First run 2 minutes after boot so it never delays start-up / health checks.
    setTimeout(() => this.safeTick(), 2 * 60 * 1000);
    this.timer = setInterval(() => this.safeTick(), this.TICK_MS);
    this.log.log(`Approval timeline tracking active (every ${this.TICK_MS / 60000} min)`);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async safeTick() {
    try {
      await this.tick();
    } catch (e: any) {
      this.log.error(`reminder tick failed: ${e?.message || e}`);
    }
  }

  /** Business days (Mon–Fri) elapsed between two dates. */
  private businessDays(from: Date, to: Date): number {
    if (!(from instanceof Date) || isNaN(from.getTime())) return 0;
    let days = 0;
    const cur = new Date(from.getTime());
    cur.setHours(0, 0, 0, 0);
    const end = new Date(to.getTime());
    end.setHours(0, 0, 0, 0);
    while (cur < end) {
      cur.setDate(cur.getDate() + 1);
      const d = cur.getDay();
      if (d !== 0 && d !== 6) days++;
    }
    return days;
  }

  private async tick() {
    const now = new Date();
    const pending: any[] = await this.prisma.memo.findMany({
      where: {
        status: { in: ['pending_manager', 'pending_hrmd', 'pending_fc', 'pending_executive'] as any },
        submittedAt: { not: null },
        currentApproverId: { not: null },
        onHold: false,
      },
      include: { currentApprover: { select: { id: true, name: true, email: true, role: true } } },
    });
    if (!pending.length) return;

    const escalate: { memo: any; approverName: string; days: number }[] = [];

    for (const m of pending) {
      const submitted = m.submittedAt ? new Date(m.submittedAt) : null;
      if (!submitted) continue;
      const hours = (now.getTime() - submitted.getTime()) / 36e5;

      // ── 1) 48-hour reminder to the current approver ────────────────
      if (hours >= this.REMIND_AFTER_H && (m.reminderCount || 0) < this.MAX_REMINDERS) {
        const last = m.lastReminderAt ? new Date(m.lastReminderAt) : null;
        const sinceLastH = last ? (now.getTime() - last.getTime()) / 36e5 : Infinity;
        if (sinceLastH >= this.REPEAT_EVERY_H) {
          try {
            await this.mail.notifyApproverReminder(m, hours);
            await this.prisma.memo.update({
              where: { id: m.id },
              data: { reminderCount: { increment: 1 }, lastReminderAt: now } as any,
            });
            this.log.log(`reminder sent — memo ${m.memoNo || m.id} (${Math.floor(hours)}h)`);
          } catch (e: any) {
            this.log.warn(`reminder failed for memo ${m.id}: ${e?.message || e}`);
          }
        }
      }

      // ── 2) 3-business-day escalation to higher-level executives ────
      if (!m.escalatedAt) {
        const bd = this.businessDays(submitted, now);
        if (bd >= this.ESCALATE_AFTER_BD) {
          escalate.push({ memo: m, approverName: m.currentApprover?.name || '-', days: bd });
        }
      }
    }

    if (escalate.length) {
      const bosses = await this.prisma.user.findMany({
        where: { active: true, role: { in: ['md', 'executive', 'admin'] as any } },
        select: { email: true },
      });
      const emails: string[] = bosses.map((b: any) => String(b.email || '').trim().toLowerCase()).filter(Boolean);
      const recipients: string[] = Array.from(new Set<string>(emails));
      // Never mail the person who is themselves the bottleneck.
      const stuckWith = new Set<string>(
        escalate.map((r) => String(r.memo.currentApprover?.email || '').trim().toLowerCase()).filter(Boolean),
      );
      const to: string[] = recipients.filter((e: string) => !stuckWith.has(e));
      try {
        await this.mail.notifyEscalation(escalate, to);
        await this.prisma.memo.updateMany({
          where: { id: { in: escalate.map((r) => r.memo.id) } },
          data: { escalatedAt: now } as any,
        });
        this.log.log(`escalation summary sent for ${escalate.length} memo(s) to ${to.length} recipient(s)`);
      } catch (e: any) {
        this.log.warn(`escalation failed: ${e?.message || e}`);
      }
    }
  }
}
