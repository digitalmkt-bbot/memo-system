import { Injectable } from '@nestjs/common';

@Injectable()
export class PdfService {
  /** Render an A4 portrait MEMO PDF using Puppeteer + Chromium. */
  async render(data: { memo: any; approvals: any[] }): Promise<Buffer> {
    const puppeteer = require('puppeteer');
    const browser = await puppeteer.launch({
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    try {
      const page = await browser.newPage();
      await page.setContent(this.html(data), { waitUntil: 'networkidle0' });
      const pdf = await page.pdf({
        format: 'A4', printBackground: true,
        margin: { top: '16mm', bottom: '16mm', left: '18mm', right: '18mm' },
      });
      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }

  private esc(s: any): string {
    return String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string));
  }

  private fmtDate(d: any): string {
    if (!d) return '';
    return new Date(d).toLocaleDateString('th-TH', { day: '2-digit', month: 'long', year: 'numeric' });
  }

  private html({ memo, approvals }: { memo: any; approvals: any[] }): string {
    const managerApproval = approvals.find((a) => a.step === 'manager' && a.status === 'approve');
    const execApproval = approvals.find((a) => a.step === 'executive' && a.status === 'approve');
    const initials = (memo.companyCode || 'M').slice(0, 2).toUpperCase();
    const detailRows = Math.max(9, String(memo.detail || '').split('\n').length);

    return `<!doctype html><html lang="th"><head><meta charset="utf-8">
    <style>
      *{box-sizing:border-box}
      body{font-family:'Sarabun','TH Sarabun New','Helvetica',sans-serif;color:#1d2733;font-size:13px;margin:0}
      .header{display:flex;align-items:center;gap:14px;border-bottom:2px solid #0a6e7c;padding-bottom:12px}
      .logo{width:54px;height:54px;border-radius:50%;background:#0a6e7c;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:20px;flex:0 0 auto}
      .company{flex:1}
      .company .name{font-size:16px;font-weight:700;color:#0a6e7c}
      .doc{ text-align:right }
      .doc .title{font-size:26px;font-weight:800;letter-spacing:3px;color:#0a6e7c}
      .doc .no{font-size:12px;color:#444;margin-top:2px}
      .meta{margin:16px 0;border:1px solid #e2e8ec;border-radius:6px;overflow:hidden}
      .meta div{display:flex;border-bottom:1px solid #eef1f3}
      .meta div:last-child{border-bottom:none}
      .meta .k{width:130px;background:#f6f3ec;padding:7px 10px;font-weight:700;color:#5a6b78}
      .meta .v{flex:1;padding:7px 10px}
      .detail-label{font-weight:700;margin:14px 0 6px;color:#0a6e7c}
      .detail{border:1px solid #e2e8ec;border-radius:6px;padding:12px;white-space:pre-wrap;min-height:${detailRows * 1.7}em;line-height:1.7}
      .sign{display:flex;gap:40px;margin-top:36px}
      .sign .col{flex:1;text-align:center}
      .sign .line{border-top:1px dotted #888;margin:48px 16px 6px}
      .sign .role{font-weight:700}.sign .who{color:#444;font-size:12px;min-height:16px}
      .sign .date{color:#888;font-size:11px;margin-top:4px}
    </style></head><body>
      <div class="header">
        <div class="logo">${this.esc(initials)}</div>
        <div class="company"><div class="name">${this.esc(memo.companyName || memo.companyCode)}</div>
          <div style="font-size:11px;color:#888">${this.esc(memo.deptName || memo.deptCode || '')}</div></div>
        <div class="doc"><div class="title">MEMO</div><div class="no">${this.esc(memo.memoNo || 'DRAFT')}</div></div>
      </div>

      <div class="meta">
        <div><div class="k">Date</div><div class="v">${this.fmtDate(memo.date)}</div></div>
        <div><div class="k">Department</div><div class="v">${this.esc(memo.deptName || memo.deptCode || '')}</div></div>
        <div><div class="k">From</div><div class="v">${this.esc(memo.fromName)}</div></div>
        <div><div class="k">Subject</div><div class="v">${this.esc(memo.subject)}</div></div>
        <div><div class="k">Attachment</div><div class="v">${this.esc(memo.attachment || '-')}</div></div>
      </div>

      <div class="detail-label">Detail</div>
      <div class="detail">${this.esc(memo.detail)}</div>

      <div class="sign">
        <div class="col"><div class="line"></div><div class="role">Prepared By</div>
          <div class="who">${this.esc(memo.creatorName || '')}</div>
          <div class="date">${this.fmtDate(memo.submittedAt)}</div></div>
        <div class="col"><div class="line"></div><div class="role">Approved By</div>
          <div class="who">${this.esc((execApproval && execApproval.approverName) || (managerApproval && managerApproval.approverName) || '')}</div>
          <div class="date">${this.fmtDate(memo.closedAt)}</div></div>
        <div class="col"><div class="line"></div><div class="role">Date</div>
          <div class="who">&nbsp;</div><div class="date">&nbsp;</div></div>
      </div>
    </body></html>`;
  }
}
