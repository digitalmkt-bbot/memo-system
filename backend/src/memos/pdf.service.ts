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

  private fmtMoney(n: any): string {
    return (Number(n) || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  private html({ memo, approvals }: { memo: any; approvals: any[] }): string {
    const managerApproval = approvals.find((a) => a.step === 'manager' && a.status === 'approve');
    const execApproval = approvals.find((a) => a.step === 'executive' && a.status === 'approve');
    const initials = (memo.companyCode || 'M').slice(0, 2).toUpperCase();
    const detailRows = Math.max(9, String(memo.detail || '').split('\n').length);
    const items = Array.isArray(memo.items) ? memo.items : [];
    const totalAmount = items.reduce((sum: number, it: any) => sum + (Number(it.qty) || 0) * (Number(it.unitPrice) || 0), 0);
    const vatAmount = memo.vat ? totalAmount * 0.07 : 0;
    const grandTotal = totalAmount + vatAmount;
    const itemsBlock = items.length
      ? `<div class="items-label">รายการสินค้า / บริการ (Items)</div>
        <table class="items">
          <thead><tr>
            <th class="c" style="width:30px">#</th><th>รายการ</th><th>รายละเอียด</th>
            <th class="num" style="width:60px">จำนวน</th><th class="c" style="width:60px">หน่วย</th>
            <th class="num" style="width:90px">ราคา/หน่วย</th><th class="num" style="width:100px">รวม</th>
          </tr></thead>
          <tbody>${items.map((it: any, i: number) => `<tr>
            <td class="c">${i + 1}</td>
            <td>${this.esc(it.name)}</td>
            <td>${this.esc(it.detail || '')}</td>
            <td class="num">${this.fmtMoney(it.qty)}</td>
            <td class="c">${this.esc(it.unit || '')}</td>
            <td class="num">${this.fmtMoney(it.unitPrice)}</td>
            <td class="num">${this.fmtMoney((Number(it.qty) || 0) * (Number(it.unitPrice) || 0))}</td>
          </tr>`).join('')}</tbody>
        </table>
        <div class="total-box">
          <div>ยอดรวม (ฐานอนุมัติ): ฿${this.fmtMoney(totalAmount)}</div>
          ${memo.vat
            ? `<div>VAT 7%: ฿${this.fmtMoney(vatAmount)}</div><div style="margin-top:2px">ยอดรวมสุทธิ: <span class="amt">฿${this.fmtMoney(grandTotal)}</span></div>`
            : `<div style="margin-top:2px"><span class="amt">฿${this.fmtMoney(totalAmount)}</span></div>`}
        </div>`
      : '';

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
      .items-label{font-weight:700;margin:16px 0 6px;color:#0a6e7c}
      table.items{width:100%;border-collapse:collapse;font-size:12px}
      table.items th,table.items td{border:1px solid #e2e8ec;padding:6px 8px}
      table.items th{background:#f6f3ec;color:#5a6b78;font-weight:700;text-align:left}
      table.items td.num,table.items th.num{text-align:right}
      table.items td.c,table.items th.c{text-align:center}
      .total-box{margin-top:8px;text-align:right;font-size:13px}
      .total-box .amt{font-size:18px;font-weight:800;color:#0a6e7c}
      .total-box .note{font-size:11px;color:#888}
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

      ${itemsBlock}

      <div class="items-label">ลายมือชื่ออนุมัติ</div>
      <div class="sign">
        <div class="col"><div class="line"></div><div class="role">ผู้ขอ / Requester</div>
          <div class="who">${this.esc(memo.creatorName || '')}</div>
          <div class="date">${this.fmtDate(memo.submittedAt)}</div></div>
        <div class="col"><div class="line"></div><div class="role">ผู้จัดการ / Manager</div>
          <div class="who">${this.esc((managerApproval && managerApproval.approverName) || '')}</div>
          <div class="date">${managerApproval ? this.fmtDate(managerApproval.approvedAt) : ''}</div></div>
        <div class="col"><div class="line"></div><div class="role">ผู้บริหาร / Executive</div>
          <div class="who">${this.esc((execApproval && execApproval.approverName) || '')}</div>
          <div class="date">${execApproval ? this.fmtDate(execApproval.approvedAt) : ''}</div></div>
      </div>
    </body></html>`;
  }
}
