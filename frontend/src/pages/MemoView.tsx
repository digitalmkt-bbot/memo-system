import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { api } from '../api';
import { StatusTag, fmtDate, fmtDay } from '../ui';
import { useAuth } from '../auth';
import { useI18n } from '../i18n';

function money(n: number) { return (Number(n) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
const CAT_KEY: Record<string, string> = { general: 'catGeneral', budget: 'catBudget', procurement: 'catProcurement', info: 'catInfo', other: 'catOther' };
const FWD_OPTS = [
  { email: 'ac@loveandaman.com', label: 'ฝ่ายบัญชี · ac@loveandaman.com' },
  { email: 'hr@loveandaman.com', label: 'ฝ่ายบุคคล · hr@loveandaman.com' },
  { email: 'apm@loveandaman.com', label: 'ฝ่ายจัดซื้อ · apm@loveandaman.com' },
];
function fmtSize(n: number) {
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(0) + ' KB';
  return (n / 1024 / 1024).toFixed(1) + ' MB';
}

export function MemoView() {
  const { id } = useParams();
  const nav = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { t, lang, roleLabel } = useI18n();
  const mid = Number(id);
  const [data, setData] = useState<any>(null);
  const [atts, setAtts] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [modal, setModal] = useState<'approve' | 'reject' | 'hold' | null>(null);
  const [comment, setComment] = useState('');
  const [nextRole, setNextRole] = useState<string>('hrm');
  const [preview, setPreview] = useState<{ url: string; mime: string; name: string } | null>(null);
  const [fwd, setFwd] = useState(false);
  const [recips, setRecips] = useState<string[]>([]);
  const [fwdBusy, setFwdBusy] = useState(false);
  const [pick, setPick] = useState(false);
  const [approverList, setApproverList] = useState<any[]>([]);
  const [chosen, setChosen] = useState('');
  const [submitBusy, setSubmitBusy] = useState(false);
  const [pdfView, setPdfView] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [actRows, setActRows] = useState<any[]>([]);
  const [settleBusy, setSettleBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const actTotal = actRows.reduce((s, r) => s + (Number(r.qty) || 0) * (Number(String(r.unitPrice).replace(/,/g, '')) || 0), 0);

  const settle = async () => {
    const items = actRows
      .filter((r) => String(r.name || '').trim())
      .map((r) => ({ name: String(r.name).trim(), detail: r.detail || '', qty: Number(r.qty) || 0, unit: r.unit || '', unitPrice: Number(String(r.unitPrice).replace(/,/g, '')) || 0 }));
    if (!items.length) { alert(lang === 'th' ? 'กรุณาใส่รายการใช้จริงอย่างน้อย 1 รายการ' : 'Add at least one item'); return; }
    setSettleBusy(true);
    try { await api.settleMemo(mid, { actualItems: items }); setActRows([]); load(); }
    catch (e: any) { alert(e?.response?.data?.message || e.message); } finally { setSettleBusy(false); }
  };

  const openPdfPreview = async () => {
    setPdfBusy(true);
    try { setPdfView(await api.pdfBlobUrl(mid)); } catch (e: any) { alert(e?.response?.data?.message || e.message); } finally { setPdfBusy(false); }
  };
  const closePdfPreview = () => { if (pdfView) URL.revokeObjectURL(pdfView); setPdfView(null); };

  const canPreview = (mime: string) => !!mime && (mime.startsWith('image/') || mime === 'application/pdf');
  const openPreview = async (a: any) => {
    try {
      const url = await api.attachmentBlobUrl(mid, a.id);
      setPreview({ url, mime: a.mimeType, name: a.filename });
    } catch (e: any) { alert(e.message); }
  };
  const closePreview = () => {
    if (preview) URL.revokeObjectURL(preview.url);
    setPreview(null);
  };

  const load = () => api.memo(mid).then(setData).catch(() => nav('/memos'));
  const loadAtts = () => api.listAttachments(mid).then(setAtts).catch(() => setAtts([]));
  useEffect(() => { load(); loadAtts(); }, [mid]);
  // Arriving from "create → send" when the creator has no default approver:
  // open the picker automatically so they can choose who to send to.
  useEffect(() => {
    if (!data || !(location.state as any)?.pickApprover) return;
    if (data.memo.createdBy !== user?.id || data.memo.status !== 'draft') return;
    api.approvers().then((list) => { setApproverList(list); setChosen(list[0]?.id ? String(list[0].id) : ''); setPick(true); }).catch(() => {});
    window.history.replaceState({}, '');
  }, [data]);
  if (!data) return <div className="card p-6">{t('common.loading')}</div>;

  const { memo, approvals, canApprove } = data;
  // Signature boxes are ROLE-based: each approver appears in the box for THEIR
  // OWN role. So the MD always shows in "กรรมการผู้จัดการ" — never in "ผจก.แผนก".
  const mgrAppr = approvals.find((a: any) => a.approverRole === 'manager' && a.status === 'approve');
  const hrmAppr = approvals.find((a: any) => a.approverRole === 'hrm' && a.status === 'approve');
  const mdAppr = approvals.find((a: any) => a.approverRole === 'md' && a.status === 'approve');
  // Person currently expected to sign — shown greyed in the box for their role.
  const isPending = ['pending_manager', 'pending_hrmd', 'pending_fc'].includes(memo.status);
  const pendMgr = isPending && memo.currentApproverRole === 'manager' ? memo.currentApproverName : null;
  const pendHrm = isPending && memo.currentApproverRole === 'hrm' ? memo.currentApproverName : null;
  const pendMd = isPending && memo.currentApproverRole === 'md' ? memo.currentApproverName : null;
  // When the creator IS a department manager, the memo skips the manager step and
  // goes straight up — so the creator themselves fills the "ผจก.แผนก" box.
  const mgrFallback = !mgrAppr && memo.creatorRole === 'manager' ? memo.creatorName : null;
  const items = memo.items || [];
  const subtotal = items.reduce((s: number, it: any) => s + (Number(it.qty) || 0) * (Number(it.unitPrice) || 0), 0);
  const vatAmount = memo.vat ? subtotal * 0.07 : 0;
  const grandTotal = subtotal + vatAmount;
  const isSmall = subtotal <= 1000; // ≤ 1,000: skip MD (manager finalizes or forwards to HRM)
  const isCreator = memo.createdBy === user?.id;
  const isOpen = !['approved', 'rejected', 'cancelled'].includes(memo.status);
  // creator may attach files while in progress AND after final approval/close
  // (e.g. tax invoice / receipt / bill for the approved memo)
  const canAttach = isCreator && (isOpen || memo.status === 'approved');

  const act = async () => {
    try {
      if (modal === 'approve') await api.approveMemo(mid, comment, memo.status === 'pending_manager' ? nextRole : undefined);
      else if (modal === 'reject') { if (!comment.trim()) return alert(t('view.reasonRequired')); await api.rejectMemo(mid, comment); }
      else if (modal === 'hold') await api.holdMemo(mid, comment);
      setModal(null); setComment(''); load();
    } catch (e: any) { alert(e.message); }
  };
  const submit = async (approverId?: number) => {
    setSubmitBusy(true);
    try {
      await api.submitMemo(mid, approverId);
      setPick(false);
      load();
    } catch (e: any) {
      const msg = e?.response?.data?.message;
      if (msg === 'CHOOSE_APPROVER') {
        // No first approver configured for this creator — let them choose one.
        const list = await api.approvers().catch(() => []);
        setApproverList(list);
        setChosen(list[0]?.id ? String(list[0].id) : '');
        setPick(true);
      } else {
        alert(msg || e.message);
      }
    } finally { setSubmitBusy(false); }
  };
  const toggleRecip = (email: string) => setRecips((r) => r.includes(email) ? r.filter((x) => x !== email) : [...r, email]);
  const doForward = async () => {
    if (!recips.length) return alert(t('view.forwardDesc'));
    setFwdBusy(true);
    try { await api.forwardMemo(mid, recips); setFwd(false); setRecips([]); load(); }
    catch (e: any) { alert(e?.response?.data?.message || e.message); }
    finally { setFwdBusy(false); }
  };

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) { alert(t('view.fileTooBig')); return; }
    setUploading(true);
    try { await api.uploadAttachment(mid, f); await loadAtts(); }
    catch (err: any) { alert(err.message); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; }
  };
  const del = async (attId: number) => {
    if (!confirm(t('view.delFileConfirm'))) return;
    try { await api.deleteAttachment(mid, attId); await loadAtts(); } catch (e: any) { alert(e.message); }
  };

  const steps: any[] = [
    { c: '#1a9d5a', t: t('view.stepCreate'), w: memo.creatorName, d: memo.createdAt },
    ...(memo.submittedAt ? [{ c: '#1a9d5a', t: t('view.stepSubmit'), w: memo.creatorName, d: memo.submittedAt }] : []),
    ...approvals.map((a: any) => ({
      c: a.status === 'approve' ? '#1a9d5a' : a.status === 'hold' ? '#d97706' : '#d23c3c',
      t: `${roleLabel(a.approverRole)} ${a.status === 'approve' ? t('view.stepApprove') : a.status === 'hold' ? t('view.stepHold') : t('view.stepReject')}`,
      w: a.approverName, d: a.approvedAt, cm: a.comment,
    })),
    ...(['pending_manager', 'pending_hrmd', 'pending_fc'].includes(memo.status)
      ? [{
          c: '#b9c4cc',
          // Label the pending step by the ACTUAL approver's role, e.g.
          // "รอกรรมการผู้จัดการอนุมัติ" — never a fixed "ผจก.แผนก".
          t: memo.currentApproverRole
            ? `${lang === 'th' ? 'รอ' : 'Awaiting '}${roleLabel(memo.currentApproverRole)}${lang === 'th' ? 'อนุมัติ' : ' approval'}`
            : t('view.waitManager'),
          w: memo.currentApproverName,
          d: null,
        }]
      : []),
    ...(memo.status === 'pending_executive' ? [{ c: '#b9c4cc', t: t('view.waitExecutive'), w: memo.currentApproverName, d: null }] : []),
  ];

  return (
    <>
      <div className="flex items-start justify-between gap-3 mb-5 flex-wrap">
        <div className="min-w-0">
          <h2 className="text-xl font-bold break-words">{memo.subject}</h2>
          <p className="text-gray-500 text-[12.5px]">{memo.memoNo || t('view.draft')} · {memo.companyCode}/{memo.deptCode} · {t('view.from')} {memo.fromName}</p>
        </div>
        <button className="btn btn-ghost !py-1.5 shrink-0" onClick={() => nav(-1)}>{t('common.back')}</button>
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-5">
        <div className="card p-6">
          <div className="flex items-center gap-2 flex-wrap"><StatusTag s={memo.status} />
            {memo.onHold && isOpen && <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-800 text-[12px] font-semibold px-2.5 py-1">{t('view.onHoldBadge')}</span>}
            <span className="text-gray-400 text-xs">{t('view.dateLabel')} {fmtDay(memo.date, lang)}</span></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 mt-4 text-sm">
            <div><span className="text-gray-500">{t('view.from')}:</span> {memo.fromName}</div>
            <div><span className="text-gray-500">{t('view.dept')}:</span> {memo.deptName}</div>
            <div><span className="text-gray-500">{t('form.category')}:</span> {memo.category ? t('form.' + (CAT_KEY[memo.category] || 'catOther')) : '—'}{memo.category === 'other' && memo.categoryNote ? ` — ${memo.categoryNote}` : ''}</div>
            <div><span className="text-gray-500">{t('form.neededDate')}:</span> {memo.neededDate ? fmtDay(memo.neededDate, lang) : '—'}</div>
            <div className="sm:col-span-2"><span className="text-gray-500">{t('view.attachmentNote')}:</span> {memo.attachment || '—'}</div>
          </div>
          <div className="whitespace-pre-wrap bg-gray-50 border border-gray-200 rounded-lg p-4 mt-4 text-sm leading-7 min-h-[200px]">{memo.detail}</div>

          {items.length > 0 && (
            <div className="mt-5">
              <div className="font-bold text-ocean-dark text-sm mb-2">{t('items.title')}</div>
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="bg-sand text-slate-500 text-[11px] uppercase tracking-wide">
                      <th className="text-left px-3 py-2 w-8">#</th>
                      <th className="text-left px-3 py-2">{t('items.colItem')}</th>
                      <th className="text-left px-3 py-2">{t('items.colDetail')}</th>
                      <th className="text-right px-3 py-2">{t('items.colQty')}</th>
                      <th className="text-left px-3 py-2">{t('items.colUnit')}</th>
                      <th className="text-right px-3 py-2">{t('items.colUnitPrice')}</th>
                      <th className="text-right px-3 py-2">{t('items.colAmount')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it: any, i: number) => (
                      <tr key={i} className="border-t border-slate-200/70">
                        <td className="px-3 py-2 text-slate-400">{i + 1}</td>
                        <td className="px-3 py-2">{it.name}</td>
                        <td className="px-3 py-2 text-slate-500">{it.detail || '—'}</td>
                        <td className="px-3 py-2 text-right">{money(it.qty)}</td>
                        <td className="px-3 py-2">{it.unit || '—'}</td>
                        <td className="px-3 py-2 text-right">{money(it.unitPrice)}</td>
                        <td className="px-3 py-2 text-right font-semibold text-ocean-dark whitespace-nowrap">{money((Number(it.qty) || 0) * (Number(it.unitPrice) || 0))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 flex justify-end">
                <div className="min-w-[220px]">
                  <div className="flex justify-between gap-8 text-[13px]"><span className="text-slate-500">{t('items.subtotal')}</span><span className="font-semibold">฿{money(subtotal)}</span></div>
                  {memo.vat && <div className="flex justify-between gap-8 text-[13px] mt-1"><span className="text-slate-500">{t('items.vatAmount')}</span><span className="font-semibold">฿{money(vatAmount)}</span></div>}
                  <div className="flex justify-between gap-8 items-baseline mt-2 pt-2 border-t border-slate-200">
                    <span className="text-slate-500 text-xs">{memo.vat ? t('items.grandTotal') : t('items.total')}</span>
                    <span className="text-xl font-extrabold text-ocean-dark">฿{money(grandTotal)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="mt-6">
            <div className="font-bold text-ocean-dark text-sm mb-3">{t('sign.title')}</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { role: t('sign.manager'), a: mgrAppr, pend: pendMgr, fallback: mgrFallback },
                { role: t('sign.hrm'), a: hrmAppr, pend: pendHrm, fallback: null },
                { role: t('sign.md'), a: mdAppr, pend: pendMd, fallback: null },
              ].map((c, i) => {
                const signedName = c.a?.approverName || c.fallback; // name that sits on the line
                return (
                <div key={i} className="bg-surface rounded-xl shadow-neu-sm p-4 text-center">
                  <div className="h-11 flex items-end justify-center">
                    {c.a?.approverRole === 'md'
                      ? <img src="/md-signature.png" alt="" className="max-h-11 max-w-[80%] object-contain" />
                      : signedName
                        ? <span className="text-[15px] text-[#22206a] italic pb-1">{signedName}</span>
                        : null}
                  </div>
                  <div className="border-t border-dashed border-slate-300 mx-3 mb-2" />
                  {signedName
                    ? <div className="text-[13px] font-semibold min-h-[16px]">{signedName}</div>
                    : c.pend
                      ? <div className="text-[13px] font-medium text-slate-400 min-h-[16px]">{c.pend}</div>
                      : <div className="text-[13px] font-semibold min-h-[16px]">—</div>}
                  <div className="text-slate-400 text-[11.5px]">{c.role}</div>
                  <div className="text-slate-400 text-[11px]">{c.a?.approvedAt ? fmtDate(c.a.approvedAt, lang) : (c.pend ? (lang === 'th' ? 'รออนุมัติ' : 'Pending') : '—')}</div>
                </div>
              ); })}
            </div>
          </div>

          {memo.category === 'budget' && (memo.status === 'approved' || memo.overBudget) && (isCreator || user?.role === 'admin') && (() => {
            const estimate = grandTotal;
            const actual = memo.actualAmount;
            const settled = actual != null;
            const over = settled && actual > estimate;
            const diff = settled ? estimate - actual : 0;
            const overPending = memo.overBudget && memo.status !== 'approved';
            const canClose = memo.status === 'approved' && settled && !overPending && !memo.forwardedAt;
            return (
              <div className="mt-6 card !shadow-none border border-indigo-100 bg-indigo-50/40 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[13px] font-bold text-indigo-700">📊 {lang === 'th' ? 'สรุปการใช้งบประมาณ (งบประมาณการ)' : 'Budget settlement'}</span>
                </div>
                <div className="flex justify-between text-[13.5px] py-1.5 border-b border-dashed border-indigo-200/70">
                  <span className="text-slate-500">{lang === 'th' ? 'งบประมาณการ (ที่อนุมัติ)' : 'Approved estimate'}</span>
                  <span className="font-bold">฿{money(estimate)}</span>
                </div>
                {settled && (memo.actualItems?.length > 0) && (
                  <div className="text-[12px] text-slate-500 py-2 border-b border-dashed border-indigo-200/70">
                    {lang === 'th' ? 'รายการใช้จริงที่บันทึกไว้:' : 'Saved actual items:'}{' '}
                    {(memo.actualItems as any[]).map((it: any, i: number) => `${it.name} (${money((Number(it.qty)||0)*(Number(it.unitPrice)||0))})`).join(', ')} = <b>฿{money(actual)}</b>
                  </div>
                )}
                {overPending ? (
                  <div className="flex justify-between text-[13.5px] py-2.5">
                    <span className="text-slate-500">{lang === 'th' ? 'ยอดใช้จริง' : 'Actual used'}</span>
                    <span className="font-bold">฿{money(actual || 0)}</span>
                  </div>
                ) : (
                  <div className="py-2">
                    <div className="text-slate-500 text-[13px] mb-1.5">{lang === 'th' ? 'กรอกรายการใช้จริง (ระบบรวมยอดให้อัตโนมัติ)' : 'Enter actual usage items'}</div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-[12.5px]">
                        <thead><tr className="text-slate-400">
                          <th className="text-left font-semibold px-1 py-1">{lang === 'th' ? 'รายการ' : 'Item'}</th>
                          <th className="text-right font-semibold px-1 py-1 w-16">{lang === 'th' ? 'จำนวน' : 'Qty'}</th>
                          <th className="text-right font-semibold px-1 py-1 w-24">{lang === 'th' ? 'ราคา/หน่วย' : 'Unit'}</th>
                          <th className="text-right font-semibold px-1 py-1 w-24">{lang === 'th' ? 'รวม' : 'Total'}</th>
                          <th className="w-6" />
                        </tr></thead>
                        <tbody>
                          {actRows.map((r, i) => (
                            <tr key={i}>
                              <td className="px-1 py-1"><input className="input !py-1 text-[12.5px]" value={r.name} onChange={(e) => setActRows((xs) => xs.map((x, idx) => idx === i ? { ...x, name: e.target.value } : x))} /></td>
                              <td className="px-1 py-1"><input className="input !py-1 text-right text-[12.5px]" type="number" min="0" value={r.qty} onChange={(e) => setActRows((xs) => xs.map((x, idx) => idx === i ? { ...x, qty: e.target.value } : x))} /></td>
                              <td className="px-1 py-1"><input className="input !py-1 text-right text-[12.5px]" type="number" min="0" value={r.unitPrice} onChange={(e) => setActRows((xs) => xs.map((x, idx) => idx === i ? { ...x, unitPrice: e.target.value } : x))} /></td>
                              <td className="px-1 py-1 text-right font-semibold text-ocean-dark whitespace-nowrap">{money((Number(r.qty) || 0) * (Number(String(r.unitPrice).replace(/,/g, '')) || 0))}</td>
                              <td className="px-1 py-1 text-center"><button type="button" className="text-red-400 hover:text-red-600 text-base leading-none" onClick={() => setActRows((xs) => xs.filter((_, idx) => idx !== i))}>×</button></td>
                            </tr>
                          ))}
                          {actRows.length === 0 && <tr><td colSpan={5} className="text-center text-slate-400 py-2">{lang === 'th' ? 'กด "เพิ่มรายการ" เพื่อเริ่ม' : 'Add a row to start'}</td></tr>}
                        </tbody>
                      </table>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <button type="button" className="btn btn-ghost !py-1 text-[12.5px]" onClick={() => setActRows((xs) => [...xs, { name: '', qty: 1, unitPrice: '' }])}>+ {lang === 'th' ? 'เพิ่มรายการ' : 'Add row'}</button>
                      <div className="text-[13px]">{lang === 'th' ? 'รวมใช้จริง' : 'Total'}: <span className="font-bold text-ocean-dark">฿{money(actTotal)}</span></div>
                    </div>
                    <button className="btn btn-primary !py-1.5 mt-2 w-full" onClick={settle} disabled={settleBusy || actRows.length === 0}>{lang === 'th' ? 'บันทึกยอดใช้จริง & คำนวณ' : 'Save & calculate'}</button>
                  </div>
                )}
                {settled && (
                  <div className={'rounded-xl px-4 py-3 mt-1 flex items-center justify-between text-[13.5px] ' + (over ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800')}>
                    <span className="font-bold">
                      {over
                        ? `${lang === 'th' ? 'เบิกเพิ่ม' : 'Over budget'} ฿${money(-diff)}`
                        : `${lang === 'th' ? 'คืนเงิน' : 'Refund'} ฿${money(diff)}`}
                    </span>
                    <span className="text-[12px] font-medium">
                      {overPending
                        ? (lang === 'th' ? 'รออนุมัติส่วนเกิน…' : 'Awaiting over-budget approval…')
                        : over
                          ? (lang === 'th' ? 'อนุมัติส่วนเกินแล้ว' : 'Over-budget approved')
                          : (lang === 'th' ? 'พร้อมส่งปิดงาน' : 'Ready to close')}
                    </span>
                  </div>
                )}
                {overPending && (
                  <p className="text-[12px] text-amber-700 mt-2">{lang === 'th' ? 'ใช้จริงเกินงบที่อนุมัติ — ระบบส่งขออนุมัติส่วนเกินให้แล้ว เมื่ออนุมัติจึงจะส่งปิดงานได้' : 'Sent for over-budget approval; close once approved.'}</p>
                )}
                {!settled && (
                  <p className="text-[12px] text-slate-500 mt-1">{lang === 'th' ? 'กรอกยอดใช้จริงแล้วกด "คำนวณ" ระบบจะสรุปคืนเงิน/เบิกเพิ่มให้อัตโนมัติ ก่อนส่งปิดงาน' : ''}</p>
                )}
                {canClose && <p className="text-[12px] text-emerald-700 mt-2">{lang === 'th' ? '✓ พร้อมแล้ว — กดปุ่ม "ส่งปิดงาน" ด้านล่างเพื่อปิดงาน' : ''}</p>}
              </div>
            );
          })()}

          <div className="flex gap-2.5 mt-5 flex-wrap">
            {canApprove && <>
              <button className="btn btn-green" onClick={() => { setComment(''); setModal('approve'); }}>{t('view.approve')}</button>
              <button className="btn bg-amber-400 text-amber-950 hover:bg-amber-500" onClick={() => { setComment(''); setModal('hold'); }}>{t('view.hold')}</button>
              <button className="btn btn-red" onClick={() => setModal('reject')}>{t('view.reject')}</button>
            </>}
            {isCreator && memo.status === 'draft' && <>
              <button className="btn btn-primary" onClick={() => submit()} disabled={submitBusy}>{t('view.submit')}</button>
              <button className="btn btn-ghost" onClick={() => nav(`/memos/edit/${mid}`)}>{t('view.edit')}</button>
            </>}
            {isCreator && memo.status === 'pending_manager' && (
              <button className="btn btn-ghost" onClick={() => nav(`/memos/edit/${mid}`)}>{t('view.edit')}</button>
            )}
            {memo.memoNo && <button className="btn btn-ghost" onClick={openPdfPreview} disabled={pdfBusy}>{pdfBusy ? (lang === 'th' ? 'กำลังเปิด…' : 'Opening…') : (lang === 'th' ? 'ดูตัวอย่าง PDF' : 'Preview PDF')}</button>}
            {memo.memoNo && <button className="btn btn-ghost" onClick={() => api.openPdf(mid, memo.memoNo).catch((e) => alert(e.message))}>{t('view.downloadPdf')}</button>}
            {memo.status === 'approved' && (isCreator || user?.role === 'admin') && !memo.forwardedAt &&
              <button className="btn btn-primary" onClick={() => setFwd(true)}>{t('view.forwardClose')}</button>}
            {isCreator && memo.status === 'approved' && !memo.forwardedAt &&
              <button className="btn btn-ghost" onClick={() => nav(`/memos/edit/${mid}`)}>{t('view.edit')}</button>}
          </div>
          {memo.forwardedAt && (
            <div className="mt-3 inline-flex items-center gap-2 rounded-lg bg-emerald-50 text-emerald-700 text-[12.5px] px-3 py-2">
              ✓ {t('view.forwardedTo')}: {memo.forwardedTo} · {fmtDate(memo.forwardedAt, lang)}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <div className="card p-5">
            <div className="font-bold text-ocean-dark text-sm mb-3">{t('view.attachments')} ({atts.length})</div>
            {atts.length === 0 && <p className="text-gray-400 text-[13px] mb-2">{t('view.noAttachments')}</p>}
            {atts.map((a) => (
              <div key={a.id} className="flex items-center justify-between py-1.5 border-b border-dashed border-gray-200 last:border-0 text-[13px]">
                <button className="text-ocean hover:underline text-left truncate mr-2" title={a.filename}
                  onClick={() => api.downloadAttachment(mid, a.id, a.filename)}>
                  📎 {a.filename}
                </button>
                <span className="flex items-center gap-2 shrink-0">
                  {canPreview(a.mimeType) && <button className="text-ocean text-xs hover:underline" onClick={() => openPreview(a)}>{t('view.preview')}</button>}
                  <span className="text-gray-400 text-[11px]">{fmtSize(a.size)}</span>
                  {canAttach && <button className="text-red-500 text-xs" onClick={() => del(a.id)}>{t('view.del')}</button>}
                </span>
              </div>
            ))}
            {canAttach && (
              <div className="mt-3">
                {memo.status === 'approved' && (
                  <p className="text-emerald-600 text-[11.5px] mb-1.5">{t('view.attachAfterClose')}</p>
                )}
                <input ref={fileRef} type="file" onChange={onPick} disabled={uploading} className="text-[12px]" />
                {uploading && <p className="text-gray-400 text-xs mt-1">{t('view.uploading')}</p>}
                <p className="text-gray-400 text-[11px] mt-1">{t('view.maxPerFile')}</p>
              </div>
            )}
          </div>

          <div className="card p-5 h-fit">
            <div className="font-bold text-ocean-dark text-sm mb-3">{t('view.approvalPath')}</div>
            {steps.map((s, i) => (
              <div key={i} className="relative pl-4 pb-3.5 border-l-2 last:border-l-transparent border-gray-200">
                <span className="absolute -left-[7px] top-0.5 w-3 h-3 rounded-full border-2 border-white" style={{ background: s.c }} />
                <div className="text-[13px] font-semibold">{s.t}</div>
                <div className="text-gray-400 text-[11.5px]">{s.w}{s.d ? ' · ' + fmtDate(s.d, lang) : ' · ' + t('view.pendingAction')}</div>
                {s.cm && <div className="bg-ocean-light text-ocean-dark px-2.5 py-1.5 rounded-md mt-1.5 text-[12px]">💬 {s.cm}</div>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {modal && (
        <div className="fixed inset-0 bg-ink/50 grid place-items-center p-5 z-50" onClick={() => setModal(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold">{modal === 'approve' ? t('view.confirmApprove') : modal === 'hold' ? t('view.confirmHold') : t('view.confirmReject')}</h3>
            <p className="text-gray-500 text-[13px] mt-1">{modal === 'reject' ? t('view.provideReason') : t('view.addComment')}</p>
            {modal === 'approve' && memo.status === 'pending_manager' && !isSmall && user?.role !== 'hrm' && user?.role !== 'md' && (
              <div className="mt-3 text-[12.5px] text-slate-500 bg-sand rounded-lg px-3 py-2">
                {lang === 'th' ? 'ยอด > 1,000 → เมื่ออนุมัติจะส่งต่อให้กรรมการผู้จัดการ (MD) อัตโนมัติ' : 'Over 1,000 → forwards to the MD automatically on approval.'}
              </div>
            )}
            <textarea className="input min-h-[90px] mt-2.5" value={comment} onChange={(e) => setComment(e.target.value)} />
            <div className="flex gap-2.5 justify-end mt-4">
              <button className="btn btn-ghost" onClick={() => setModal(null)}>{t('common.cancel')}</button>
              <button className={'btn ' + (modal === 'approve' ? 'btn-green' : modal === 'hold' ? 'bg-amber-400 text-amber-950 hover:bg-amber-500' : 'btn-red')} onClick={act}>{modal === 'approve' ? t('view.approveBtn') : modal === 'hold' ? t('view.holdBtn') : t('view.rejectBtn')}</button>
            </div>
          </div>
        </div>
      )}

      {fwd && (
        <div className="fixed inset-0 bg-ink/50 grid place-items-center p-5 z-50" onClick={() => setFwd(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold">{t('view.forwardTitle')}</h3>
            <p className="text-gray-500 text-[13px] mt-1">{t('view.forwardDesc')}</p>
            <div className="mt-3 space-y-2">
              {FWD_OPTS.map((o) => (
                <label key={o.email} className="flex items-center gap-2.5 rounded-lg border border-slate-200 px-3 py-2.5 text-[13.5px] cursor-pointer hover:bg-slate-50">
                  <input type="checkbox" className="h-4 w-4 accent-emerald-600" checked={recips.includes(o.email)} onChange={() => toggleRecip(o.email)} />
                  {o.label}
                </label>
              ))}
            </div>
            <div className="flex gap-2.5 justify-end mt-4">
              <button className="btn btn-ghost" onClick={() => setFwd(false)}>{t('common.cancel')}</button>
              <button className="btn btn-green" onClick={doForward} disabled={fwdBusy || !recips.length}>{fwdBusy ? t('view.forwardSending') : t('view.forwardSend')}</button>
            </div>
          </div>
        </div>
      )}

      {pick && (
        <div className="fixed inset-0 bg-ink/50 grid place-items-center p-5 z-50" onClick={() => setPick(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold">{lang === 'th' ? 'เลือกผู้อนุมัติ' : 'Choose an approver'}</h3>
            <p className="text-gray-500 text-[13px] mt-1">
              {lang === 'th'
                ? 'ยังไม่ได้ตั้งผู้อนุมัติขั้นแรกให้คุณในระบบ กรุณาเลือกผู้ที่จะส่งบันทึกนี้ไปอนุมัติ'
                : 'You have no default first approver set. Choose who should approve this memo.'}
            </p>
            <select className="input mt-3" value={chosen} onChange={(e) => setChosen(e.target.value)}>
              {approverList.length === 0 && <option value="">—</option>}
              {approverList.map((a: any) => (
                <option key={a.id} value={a.id}>
                  {a.name} — {roleLabel(a.role)}{a.deptCode ? ' · ' + a.deptCode : ''}
                </option>
              ))}
            </select>
            <div className="flex gap-2.5 justify-end mt-4">
              <button className="btn btn-ghost" onClick={() => setPick(false)}>{t('common.cancel')}</button>
              <button className="btn btn-primary" onClick={() => submit(Number(chosen))} disabled={submitBusy || !chosen}>{t('view.submit')}</button>
            </div>
          </div>
        </div>
      )}

      {preview && (
        <div className="fixed inset-0 bg-ink/70 grid place-items-center p-5 z-50" onClick={closePreview}>
          <div className="bg-white rounded-2xl overflow-hidden w-full max-w-4xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
              <div className="font-semibold text-[13px] truncate mr-2">📎 {preview.name}</div>
              <div className="flex items-center gap-3 shrink-0">
                <a className="text-ocean text-[13px] hover:underline" href={preview.url} download={preview.name}>{t('view.downloadPdf')}</a>
                <button className="text-gray-500 hover:text-ink text-lg leading-none" onClick={closePreview}>✕</button>
              </div>
            </div>
            <div className="bg-gray-50 flex-1 overflow-auto grid place-items-center">
              {preview.mime.startsWith('image/')
                ? <img src={preview.url} alt={preview.name} className="max-w-full max-h-[80vh] object-contain" />
                : <iframe src={preview.url} title={preview.name} className="w-full h-[80vh] border-0" />}
            </div>
          </div>
        </div>
      )}

      {pdfView && (
        <div className="fixed inset-0 bg-ink/70 grid place-items-center p-5 z-50" onClick={closePdfPreview}>
          <div className="bg-white rounded-2xl overflow-hidden w-full max-w-4xl max-h-[92vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
              <div className="font-semibold text-[13px] truncate mr-2">📄 {lang === 'th' ? 'ตัวอย่าง PDF' : 'PDF preview'} · {memo.memoNo}</div>
              <div className="flex items-center gap-3 shrink-0">
                <button className="text-ocean text-[13px] hover:underline" onClick={() => api.openPdf(mid, memo.memoNo).catch((e) => alert(e.message))}>{t('view.downloadPdf')}</button>
                <button className="text-gray-500 hover:text-ink text-lg leading-none" onClick={closePdfPreview}>✕</button>
              </div>
            </div>
            <div className="bg-gray-50 flex-1 overflow-auto">
              <iframe src={pdfView} title="PDF" className="w-full h-[82vh] border-0" />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
