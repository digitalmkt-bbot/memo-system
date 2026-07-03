import { Injectable } from '@nestjs/common';
import { LOVE_LOGO } from './love-logo';

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
      const isLove = /love\s*island/i.test(data.memo?.companyName || '') || data.memo?.companyCode === 'LOVE';
      await page.setContent(isLove ? this.htmlLoveIsland(data) : this.html(data), { waitUntil: 'networkidle0' });
      // make sure the Thai web fonts are fully loaded before rendering the PDF
      try { await page.evaluate(() => (document as any).fonts.ready); } catch { /* noop */ }
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
    const hrmApproval = approvals.find((a) => a.step === 'hrm' && a.status === 'approve');
    const mdApproval = approvals.find((a) => a.step === 'md' && a.status === 'approve');
    const initials = (memo.companyCode || 'M').slice(0, 2).toUpperCase();
    const detailRows = Math.max(9, String(memo.detail || '').split('\n').length);
    const catMap: Record<string, string> = { general: 'ขออนุมัติทั่วไป', budget: 'ขออนุมัติงบประมาณ', procurement: 'ขอจัดซื้อ/จัดจ้าง', info: 'แจ้งเพื่อทราบ', other: 'อื่นๆ' };
    const catLabel = memo.category ? ((catMap[memo.category] || memo.category) + (memo.category === 'other' && memo.categoryNote ? ` (${memo.categoryNote})` : '')) : '-';
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
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;500;600;700;800&family=Noto+Sans+Thai:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
      *{box-sizing:border-box}
      body{font-family:'Sarabun','Noto Sans Thai','Helvetica',sans-serif;color:#1d2733;font-size:13px;margin:0}
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
      .sign{display:flex;gap:18px;margin-top:36px}
      .sign .col{flex:1;text-align:center}
      .sign .line{border-top:1px dotted #888;margin:48px 8px 6px}
      .sign .role{font-weight:700;font-size:12px}.sign .who{color:#444;font-size:12px;min-height:16px}
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
        <div><div class="k">ประเภท</div><div class="v">${this.esc(catLabel)}</div></div>
        <div><div class="k">วันที่ต้องการ</div><div class="v">${memo.neededDate ? this.fmtDate(memo.neededDate) : '-'}</div></div>
        <div><div class="k">ผู้ขอ</div><div class="v">${this.esc(memo.fromName)}</div></div>
        <div><div class="k">Subject</div><div class="v">${this.esc(memo.subject)}</div></div>
        <div><div class="k">Attachment</div><div class="v">${this.esc(memo.attachment || '-')}</div></div>
      </div>

      <div class="detail-label">รายละเอียด</div>
      <div class="detail">${this.esc(memo.detail)}</div>

      ${itemsBlock}

      <div class="items-label">ลายมือชื่ออนุมัติ</div>
      <div class="sign">
        <div class="col"><div class="line"></div><div class="role">ผจก.แผนก / Manager</div>
          <div class="who">${this.esc((managerApproval && managerApproval.approverName) || '')}</div>
          <div class="date">${managerApproval ? this.fmtDate(managerApproval.approvedAt) : ''}</div></div>
        <div class="col"><div class="line"></div><div class="role">ผจก.ฝ่ายบุคคล / HRM</div>
          <div class="who">${this.esc((hrmApproval && hrmApproval.approverName) || '')}</div>
          <div class="date">${hrmApproval ? this.fmtDate(hrmApproval.approvedAt) : ''}</div></div>
        <div class="col"><div class="line"></div><div class="role">กรรมการผู้จัดการ / MD</div>
          <div class="who">${this.esc((mdApproval && mdApproval.approverName) || '')}</div>
          <div class="date">${mdApproval ? this.fmtDate(mdApproval.approvedAt) : ''}</div></div>
      </div>
    </body></html>`;
  }

  /* LOVE ISLAND branded template — matches the company's Memo letterhead. */
  private htmlLoveIsland({ memo, approvals }: { memo: any; approvals: any[] }): string {
    const mgr = approvals.find((a) => a.step === 'manager' && a.status === 'approve');
    const hrm = approvals.find((a) => a.step === 'hrm' && a.status === 'approve');
    const md = approvals.find((a) => a.step === 'md' && a.status === 'approve');
    const catMap: Record<string, string> = { general: 'ขออนุมัติทั่วไป', budget: 'ขออนุมัติงบประมาณ', procurement: 'ขอจัดซื้อ/จัดจ้าง', info: 'แจ้งเพื่อทราบ', other: 'อื่นๆ' };
    const catLabel = memo.category ? ((catMap[memo.category] || memo.category) + (memo.category === 'other' && memo.categoryNote ? ` (${memo.categoryNote})` : '')) : '-';
    const items = Array.isArray(memo.items) ? memo.items : [];
    const total = items.reduce((s: number, it: any) => s + (Number(it.qty) || 0) * (Number(it.unitPrice) || 0), 0);
    const vat = memo.vat ? total * 0.07 : 0;
    const grand = total + vat;
    const rows = items.length
      ? items.map((it: any, i: number) => `<tr>
          <td class="c">${i + 1}</td><td>${this.esc(it.name)}</td><td>${this.esc(it.detail || '')}</td>
          <td class="num">${this.fmtMoney(it.qty)}</td><td class="c">${this.esc(it.unit || '')}</td>
          <td class="num">${this.fmtMoney(it.unitPrice)}</td>
          <td class="num">${this.fmtMoney((Number(it.qty) || 0) * (Number(it.unitPrice) || 0))}</td></tr>`).join('')
      : `<tr><td class="c">1</td><td colspan="6" style="color:#9aa5b1">—</td></tr>`;
    const totalsBlock = items.length ? `<div class="tot">
        <div>ยอดรวม (ฐานอนุมัติ): ฿${this.fmtMoney(total)}</div>
        ${memo.vat ? `<div>VAT 7%: ฿${this.fmtMoney(vat)}</div><div style="margin-top:2px">ยอดรวมสุทธิ: <span class="amt">฿${this.fmtMoney(grand)}</span></div>` : `<div style="margin-top:2px"><span class="amt">฿${this.fmtMoney(total)}</span></div>`}
      </div>` : '';

    return `<!doctype html><html lang="th"><head><meta charset="utf-8">
    <link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;500;600;700;800&family=Noto+Sans+Thai:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
      *{box-sizing:border-box}
      body{font-family:'Sarabun','Noto Sans Thai',sans-serif;color:#1f2937;font-size:12.5px;margin:0}
      .head{display:flex;justify-content:space-between;align-items:flex-start}
      .co{font-size:20px;font-weight:800;color:#17263f}
      .bar{width:96px;height:6px;margin:6px 0 10px;background:linear-gradient(90deg,#17263f 55%,#23b4d8 55%)}
      .addr{font-size:10.5px;color:#5b6875;line-height:1.75}
      .logo{width:158px;display:block;margin-left:auto}
      .docno{text-align:right;margin-top:16px;font-weight:700;color:#17263f;font-size:12px}
      .rule{border-top:1.6px solid #17263f;margin:8px 0}
      .title{text-align:center;font-size:22px;font-weight:800;color:#17263f;letter-spacing:1px;margin:2px 0}
      .date{text-align:right;font-weight:700;color:#17263f;margin:10px 0 4px}
      .fields .row{margin:5px 0;font-size:13px}
      .fields .k{font-weight:700;color:#17263f}
      .sec{display:flex;align-items:center;gap:7px;font-weight:800;color:#17263f;margin:16px 0 6px;font-size:13.5px}
      .sec .tri{width:0;height:0;border-left:9px solid #23b4d8;border-top:6px solid transparent;border-bottom:6px solid transparent}
      table.it{width:100%;border-collapse:collapse;font-size:12px}
      table.it th{background:#17263f;color:#fff;font-weight:700;padding:7px 8px;text-align:left}
      table.it td{border:1px solid #e2e8ec;padding:6px 8px}
      table.it tr:nth-child(even) td{background:#f5f7f9}
      table.it td.num,table.it th.num{text-align:right}
      table.it td.c,table.it th.c{text-align:center}
      .tot{margin-top:8px;text-align:right;font-size:13px}
      .tot .amt{font-size:18px;font-weight:800;color:#17263f}
      .detail{background:#eef1f4;border-radius:6px;padding:12px;white-space:pre-wrap;line-height:1.7;min-height:120px}
      .sign-title{font-weight:800;color:#17263f;margin:26px 0 4px;font-size:13.5px}
      .sign{display:flex;gap:18px;margin-top:34px}
      .sign .col{flex:1;text-align:center}
      .sign .line{border-top:1.5px dotted #6b7785;margin:0 6px 6px}
      .sign .role{font-weight:800;color:#17263f;font-size:12px}
      .sign .who{color:#374151;font-size:12px;min-height:15px}
      .sign .dt{color:#8a98a5;font-size:11px;margin-top:3px}
    </style></head><body>
      <div class="head">
        <div>
          <div class="co">Love Island Co., Ltd.</div>
          <div class="bar"></div>
          <div class="addr">9/239-240 Sakdidej Road<br>T.Talat Nuea A.Mueang Phuket 83000<br>T: +66 76 390 250<br>E-mail : info@loveandaman.com</div>
        </div>
        <div style="min-width:200px">
          <img class="logo" src="${LOVE_LOGO}" alt="LOVE andaman" />
          <div class="docno">เลขที่เอกสาร : ${this.esc(memo.memoNo || '-')}</div>
        </div>
      </div>
      <div class="rule"></div>
      <div class="title">Memorandum</div>
      <div class="rule"></div>

      <div class="date">วันที่ : ${this.fmtDate(memo.date)}</div>
      <div class="fields">
        <div class="row"><span class="k">แผนก :</span> ${this.esc(memo.deptName || memo.deptCode || '-')}</div>
        <div class="row"><span class="k">ประเภท :</span> ${this.esc(catLabel)}</div>
        <div class="row"><span class="k">วันที่ต้องการ :</span> ${memo.neededDate ? this.fmtDate(memo.neededDate) : '-'}</div>
        <div class="row"><span class="k">เรื่อง :</span> ${this.esc(memo.subject)}</div>
        <div class="row"><span class="k">ผู้ขอ :</span> ${this.esc(memo.fromName)}</div>
        <div class="row"><span class="k">เอกสารแนบ :</span> ${this.esc(memo.attachment || '-')}</div>
      </div>

      <div class="sec"><span class="tri"></span>รายละเอียด</div>
      <div class="detail">${this.esc(memo.detail)}</div>

      <div class="sec"><span class="tri"></span>รายการสินค้า / บริการ</div>
      <table class="it">
        <thead><tr>
          <th class="c" style="width:34px">No.</th><th>รายการ</th><th>รายละเอียด</th>
          <th class="num" style="width:56px">จำนวน</th><th class="c" style="width:52px">หน่วย</th>
          <th class="num" style="width:78px">ราคา/หน่วย</th><th class="num" style="width:88px">รวม</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      ${totalsBlock}

      <div class="sign-title">ลายมือชื่อผู้อนุมัติ</div>
      <div class="sign">
        <div class="col"><div class="line"></div><div class="role">ผู้จัดการแผนก / Manager</div><div class="who">${this.esc((mgr && mgr.approverName) || '')}</div><div class="dt">${mgr ? this.fmtDate(mgr.approvedAt) : ''}</div></div>
        <div class="col"><div class="line"></div><div class="role">ผจก.ฝ่ายบุคคล / HRM</div><div class="who">${this.esc((hrm && hrm.approverName) || '')}</div><div class="dt">${hrm ? this.fmtDate(hrm.approvedAt) : ''}</div></div>
        <div class="col"><div class="line"></div><div class="role">กรรมการผู้จัดการ / MD</div><div class="who">${this.esc((md && md.approverName) || '')}</div><div class="dt">${md ? this.fmtDate(md.approvedAt) : ''}</div></div>
      </div>
    </body></html>`;
  }
}
