import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { fmtDay } from '../ui';
import { useI18n } from '../i18n';
import { useAuth } from '../auth';

export type MemoItemRow = { name: string; detail?: string; qty: any; unit?: string; unitPrice: any; discount?: any; taxRate?: any };
export type MemoFormValues = {
  companyId: number; departmentId: number;
  fromName: string; subject: string; attachment?: string; detail: string;
};
type Extra = { items?: MemoItemRow[]; vat?: boolean; discount?: any; category?: string; categoryNote?: string; neededDate?: string; expenseDate?: string; backdateReason?: string };

const money = (n: number) => (Number(n) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const lineNet = (r: MemoItemRow) => Math.max(0, (Number(r.qty) || 0) * (Number(r.unitPrice) || 0) - (Number(r.discount) || 0));
const lineTax = (r: MemoItemRow) => lineNet(r) * ((Number(r.taxRate) || 0) / 100);
const lineTotal = (r: MemoItemRow) => lineNet(r) + lineTax(r);
const UNITS = ['ชิ้น', 'กล่อง', 'ชุด', 'แพ็ค', 'ม้วน', 'ลิตร', 'กิโลกรัม', 'เดือน', 'ครั้ง', 'รายการ'];
const CATS: [string, string][] = [['general', 'catGeneral'], ['budget', 'catBudget'], ['procurement', 'catProcurement'], ['salary', 'catSalary'], ['allowance', 'catAllowance'], ['fuel', 'catFuel'], ['island', 'catIsland'], ['info', 'catInfo'], ['other', 'catOther']];
const HR_CATS = ['salary', 'allowance', 'fuel', 'island'];
const STEPS: [string, string][] = [['create', 'steps.create'], ['pending_manager', 'steps.manager'], ['pending_hrmd', 'steps.hrmd'], ['pending_fc', 'steps.fc'], ['approved', 'steps.done']];

export function MemoForm({ initial, memoId, status }: { initial?: (Partial<MemoFormValues> & Extra); memoId?: number; status?: string }) {
  const nav = useNavigate();
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const [companies, setCompanies] = useState<any[]>([]);
  const [depts, setDepts] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState<MemoItemRow[]>(initial?.items?.length
    ? initial.items.map((it) => ({ name: it.name || '', detail: it.detail || '', qty: it.qty ?? 1, unit: it.unit || '', unitPrice: it.unitPrice ?? '', discount: (it as any).discount || '', taxRate: (it as any).taxRate || '' }))
    : []);
  const [vat, setVat] = useState<boolean>(!!initial?.vat);
  const [discount, setDiscount] = useState<any>(initial?.discount ?? '');
  const [editNote, setEditNote] = useState<string>('');
  // net total of the memo BEFORE this edit (for comparing increase/decrease)
  const oldNet = Math.max(0, (initial?.items || []).reduce((s: number, it: any) => s + Math.max(0, (Number(it.qty) || 0) * (Number(it.unitPrice) || 0) - (Number(it.discount) || 0)), 0) - (Number(initial?.discount) || 0));
  const isEditingApproved = !!memoId && status === 'approved';
  const [category, setCategory] = useState<string>(initial?.category || 'general');
  const [categoryNote, setCategoryNote] = useState<string>(initial?.categoryNote || '');
  const [neededDate, setNeededDate] = useState<string>(initial?.neededDate || '');
  const [expenseDate, setExpenseDate] = useState<string>((initial as any)?.expenseDate ? String((initial as any).expenseDate).slice(0, 10) : '');
  const [backdateReason, setBackdateReason] = useState<string>((initial as any)?.backdateReason || '');
  const isBackdated = !!expenseDate && (Date.now() - new Date(expenseDate).getTime()) > 24 * 60 * 60 * 1000;
  const fileRef = useRef<HTMLInputElement>(null);
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<MemoFormValues>({
    defaultValues: { companyId: 0, departmentId: 0, fromName: '', subject: '', attachment: '', detail: '', ...initial },
  });
  const companyId = watch('companyId');
  const activeStep = Math.max(0, STEPS.findIndex(([k]) => k === (status || 'create')));
  // Authoritative home company/department from the server (works even if an old
  // token didn't carry departmentId). Falls back to the cached auth user.
  const [me, setMe] = useState<any>(null);
  const homeCompany = me?.companyId ?? user?.companyId;
  const homeDept = me?.departmentId ?? user?.departmentId;

  useEffect(() => { api.companies().then(setCompanies).catch(() => {}); }, []);
  useEffect(() => { api.me().then(setMe).catch(() => {}); }, []);
  // Default company to the creator's own (once companies + profile are loaded).
  useEffect(() => {
    if (initial?.companyId || !companies.length || Number(watch('companyId'))) return;
    const cid = (homeCompany && companies.find((c: any) => c.id === homeCompany)) ? homeCompany : companies[0]?.id;
    if (cid) setValue('companyId', cid);
  }, [companies, me]);
  // Load departments for the selected company.
  useEffect(() => { if (companyId) api.departments(Number(companyId)).then(setDepts).catch(() => {}); }, [companyId]);
  // Default department to the creator's home department (once departments loaded).
  useEffect(() => {
    if (initial?.departmentId || !depts.length) return;
    const cur = Number(watch('departmentId'));
    if (depts.find((x: any) => x.id === cur)) return; // a valid choice is already set
    const did = (homeDept && depts.find((x: any) => x.id === homeDept)) ? homeDept : depts[0]?.id;
    if (did) setValue('departmentId', did);
  }, [depts, me]);

  const addRow = () => setItems((xs) => [...xs, { name: '', detail: '', qty: 1, unit: '', unitPrice: '', discount: '', taxRate: '' }]);
  const removeRow = (i: number) => setItems((xs) => xs.filter((_, idx) => idx !== i));
  const setCell = (i: number, k: keyof MemoItemRow, v: any) => setItems((xs) => xs.map((r, idx) => idx === i ? { ...r, [k]: v } : r));
  const subtotal = items.reduce((s, r) => s + lineNet(r), 0);           // net of per-line discounts
  const memoDiscount = Number(discount) || 0;
  const netTotal = Math.max(0, subtotal - memoDiscount);
  const perLineTax = items.reduce((s, r) => s + lineTax(r), 0);
  const vatAmount = perLineTax > 0 ? perLineTax : (vat ? netTotal * 0.07 : 0);
  const totalLineDiscount = items.reduce((s, r) => s + (Number(r.discount) || 0), 0);
  const grandTotal = netTotal + vatAmount;
  // editing an approved memo: increased total => note required + re-approval.
  const totalIncreased = isEditingApproved && netTotal > oldNet + 0.005;
  const noteRequired = totalIncreased;

  const cleanItems = () => items.filter((r) => String(r.name || '').trim())
    .map((r) => ({ name: r.name.trim(), detail: r.detail?.trim() || undefined, qty: Number(r.qty) || 0, unit: r.unit?.trim() || undefined, unitPrice: Number(r.unitPrice) || 0, discount: Number(r.discount) || 0, taxRate: Number(r.taxRate) || 0 }));

  const build = (v: MemoFormValues) => ({
    companyId: Number(v.companyId), departmentId: Number(v.departmentId),
    fromName: v.fromName.trim(), subject: v.subject.trim(),
    attachment: v.attachment?.trim() || undefined, detail: v.detail.trim(),
    vat, discount: Number(discount) || 0, editNote: editNote.trim() || undefined, category, categoryNote: category === 'other' ? categoryNote.trim() : '', neededDate: neededDate || undefined,
    expenseDate: expenseDate || undefined, backdateReason: backdateReason.trim() || undefined, items: cleanItems(),
  });

  const uploadIfAny = async (id: number) => {
    const f = fileRef.current?.files?.[0];
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) { alert(t('form.fileTooBig')); return; }
    try { await api.uploadAttachment(id, f); } catch (e: any) { alert(t('form.attachFailed') + e.message); }
  };
  const saveDraft = handleSubmit(async (v) => {
    if (noteRequired && !editNote.trim()) {
      alert(lang === 'th' ? 'ยอดรวมเพิ่มขึ้น — กรุณากรอก "หมายเหตุการแก้ไข" (เอกสารจะถูกส่งขออนุมัติใหม่)' : 'Total increased — an edit note is required.');
      return;
    }
    setBusy(true);
    try {
      const id = memoId ? (await api.updateMemo(memoId, build(v)), memoId) : (await api.createMemo(build(v))).id;
      await uploadIfAny(id);
      nav(memoId ? `/memos/view/${memoId}` : '/memos');
    } catch (e: any) {
      if (e?.response?.data?.message === 'EDIT_NOTE_REQUIRED_INCREASE') alert(lang === 'th' ? 'ยอดรวมเพิ่มขึ้น — ต้องกรอกหมายเหตุการแก้ไข' : 'Total increased — edit note required.');
      else alert(e?.response?.data?.message || e.message);
    } finally { setBusy(false); }
  });
  const submit = handleSubmit(async (v) => {
    if (isBackdated && !backdateReason.trim()) {
      alert(lang === 'th' ? '🚩 เอกสารย้อนหลัง — กรุณากรอก "เหตุผลความจำเป็นฉุกเฉิน" ก่อนส่ง' : 'Backdated: a reason is required.');
      return;
    }
    setBusy(true);
    try {
      let id = memoId;
      if (id) await api.updateMemo(id, build(v));
      else { const m = await api.createMemo(build(v)); id = m.id; }
      await uploadIfAny(id!);
      try {
        await api.submitMemo(id!);
        nav(`/memos/view/${id}`);
      } catch (e: any) {
        // No default first approver configured — finish on the view page, where
        // the creator is prompted to choose who to send the memo to.
        if (e?.response?.data?.message === 'CHOOSE_APPROVER') {
          nav(`/memos/view/${id}`, { state: { pickApprover: true } });
        } else { throw e; }
      }
    } catch (e: any) {
      alert(e?.response?.data?.message || e.message);
    } finally { setBusy(false); }
  });
  // Editing an already-submitted memo (before the first approval): just save the
  // changes and go back to the memo — it stays with the same approver.
  const saveEdit = handleSubmit(async (v) => {
    if (noteRequired && !editNote.trim()) {
      alert(lang === 'th' ? 'ยอดรวมเพิ่มขึ้น — กรุณากรอก "หมายเหตุการแก้ไข" (เอกสารจะถูกส่งขออนุมัติใหม่)' : 'Total increased — an edit note is required.');
      return;
    }
    setBusy(true);
    try { await api.updateMemo(memoId!, build(v)); await uploadIfAny(memoId!); nav(`/memos/view/${memoId}`); }
    catch (e: any) {
      if (e?.response?.data?.message === 'EDIT_NOTE_REQUIRED_INCREASE') alert(lang === 'th' ? 'ยอดรวมเพิ่มขึ้น — ต้องกรอกหมายเหตุการแก้ไข' : 'Total increased — edit note required.');
      else alert(e?.response?.data?.message || e.message);
    } finally { setBusy(false); }
  });

  const cell = 'rounded-lg bg-surface shadow-neu-inset px-2.5 py-1.5 text-[13px] text-ink focus:outline-none focus:ring-2 focus:ring-ocean/40 w-full';

  return (
    <div className="card p-6 lg:p-8">
      {/* step indicator */}
      <div className="overflow-x-auto pb-1 mb-7">
        <div className="flex items-center min-w-[600px]">
          {STEPS.map(([k, lbl], i) => (
            <div key={k} className="flex items-center flex-1 last:flex-none">
              <div className="flex items-center gap-2 shrink-0">
                <div className={'w-8 h-8 rounded-full grid place-items-center text-[13px] font-bold shrink-0 ' +
                  (i <= activeStep ? 'text-white bg-gradient-to-br from-[#34d399] to-[#10b981] shadow-neu-sm' : 'bg-surface text-slate-400 shadow-neu-sm')}>{i + 1}</div>
                <span className={'text-[13px] font-semibold whitespace-nowrap ' + (i <= activeStep ? 'text-ocean-dark' : 'text-slate-400')}>{t(lbl)}</span>
              </div>
              {i < STEPS.length - 1 && <div className={'flex-1 h-0.5 mx-3 rounded ' + (i < activeStep ? 'bg-ocean' : 'bg-slate-200')} />}
            </div>
          ))}
        </div>
      </div>

      <form>
        <div className="font-bold text-ocean-dark text-sm mb-4">{t('form.generalInfo')}</div>
        <div className="grid lg:grid-cols-2 gap-x-8 gap-y-0">
          <div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="label">{t('form.company')}</label>
                <select className="input" {...register('companyId', { required: true })}>
                  {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">{t('form.department')}</label>
                <select className="input" {...register('departmentId', { required: true })}>
                  {depts.map((d) => <option key={d.id} value={d.id}>{d.code} — {d.name}</option>)}
                </select>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="label">{t('form.category')}</label>
                <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
                  {CATS.map(([k, lbl]) => <option key={k} value={k}>{t('form.' + lbl)}</option>)}
                </select>
                {HR_CATS.includes(category) && (
                  <p className="mt-1 text-[12px] text-emerald-700">{lang === 'th' ? 'สายอนุมัติ: หัวหน้าแผนก → ฝ่ายบุคคล (HR) → จบ (ไม่ผ่าน MD)' : 'Approval: department head → HR → done (no MD).'}</p>
                )}
              </div>
              <div>
                <label className="label">{t('form.neededDate')}</label>
                <input type="date" className="input" value={neededDate} onChange={(e) => setNeededDate(e.target.value)} />
              </div>
              <div>
                <label className="label">{lang === 'th' ? 'วันที่ในใบเสร็จ/บิล' : 'Receipt/bill date'}</label>
                <input type="date" className="input" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} />
              </div>
            </div>
            {category === 'other' && (
              <div>
                <label className="label">{t('form.categoryNote')}</label>
                <input className="input" value={categoryNote} onChange={(e) => setCategoryNote(e.target.value)} placeholder={t('form.categoryNotePh')} />
              </div>
            )}
            {isBackdated && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3.5 mt-1">
                <div className="flex items-center gap-2 text-rose-700 font-bold text-[13px]">
                  🚩 {lang === 'th' ? 'เอกสารขออนุมัติย้อนหลัง' : 'Backdated request'}
                </div>
                <p className="text-[12px] text-rose-600 mt-1">
                  {lang === 'th'
                    ? 'วันที่ในใบเสร็จเกิดขึ้นก่อนวันที่ส่งเอกสาร — กรุณาระบุเหตุผลความจำเป็นฉุกเฉินที่ไม่สามารถขออนุมัติล่วงหน้าได้ (จำเป็นต้องกรอกจึงจะส่งได้)'
                    : 'The receipt date precedes submission — a reason is required.'}
                </p>
                <textarea className="input min-h-[70px] mt-2" value={backdateReason} onChange={(e) => setBackdateReason(e.target.value)}
                  placeholder={lang === 'th' ? 'เหตุผลความจำเป็นฉุกเฉินที่ไม่สามารถขออนุมัติล่วงหน้าได้…' : 'Reason…'} />
              </div>
            )}
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="label">{t('form.date')}</label>
                <input className="input bg-gray-50" value={fmtDay(new Date().toISOString(), lang)} disabled />
              </div>
              <div>
                <label className="label">{t('form.memoNumber')}</label>
                <input className="input bg-gray-50" value={memoId && status !== 'draft' ? t('form.memoIssued') : t('form.memoAuto')} disabled />
              </div>
            </div>
            <label className="label">{t('form.from')}</label>
            <input className="input" {...register('fromName', { required: true })} placeholder={t('form.fromPlaceholder')} />
            <label className="label">{t('form.attachmentNote')}</label>
            <input className="input" {...register('attachment')} placeholder={t('form.attachmentNotePlaceholder')} />
            <label className="label">{t('form.attachFile')}</label>
            <input ref={fileRef} type="file" className="text-[13px]" />
            <p className="text-gray-400 text-[11px] mt-1">{t('form.attachHint')}</p>
          </div>
          <div className="flex flex-col">
            <label className="label">{t('form.subject')}</label>
            <input className="input" {...register('subject', { required: true })} maxLength={200} />
            <label className="label">{t('form.detail')}</label>
            <textarea className="input flex-1 min-h-[220px] lg:min-h-[340px] leading-7" {...register('detail', { required: true })} placeholder={t('form.detailPlaceholder')} />
            {errors.detail && <p className="text-red-500 text-xs mt-1">{t('form.detailRequired')}</p>}
          </div>
        </div>

        <div className="mt-7">
          <div className="font-bold text-ocean-dark text-sm mb-3">{t('items.title')}</div>
          <datalist id="memo-units">{UNITS.map((u) => <option key={u} value={u} />)}</datalist>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-slate-500 text-[11px] uppercase tracking-wide">
                  <th className="text-left font-semibold px-2 py-2 w-8">#</th>
                  <th className="text-left font-semibold px-2 py-2">{t('items.colItem')}</th>
                  <th className="text-left font-semibold px-2 py-2">{t('items.colDetail')}</th>
                  <th className="text-right font-semibold px-2 py-2 w-20">{t('items.colQty')}</th>
                  <th className="text-left font-semibold px-2 py-2 w-28">{t('items.colUnit')}</th>
                  <th className="text-right font-semibold px-2 py-2 w-24">{t('items.colUnitPrice')}</th>
                  <th className="text-right font-semibold px-2 py-2 w-20">{lang === 'th' ? 'ส่วนลด' : 'Disc.'}</th>
                  <th className="text-right font-semibold px-2 py-2 w-16">{lang === 'th' ? 'ภาษี %' : 'Tax %'}</th>
                  <th className="text-right font-semibold px-2 py-2 w-28">{t('items.colAmount')}</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((r, i) => (
                  <tr key={i}>
                    <td className="px-2 py-1 text-slate-400 text-center">{i + 1}</td>
                    <td className="px-2 py-1"><input className={cell} value={r.name} onChange={(e) => setCell(i, 'name', e.target.value)} /></td>
                    <td className="px-2 py-1"><input className={cell} value={r.detail} onChange={(e) => setCell(i, 'detail', e.target.value)} /></td>
                    <td className="px-2 py-1"><input className={cell + ' text-right'} type="number" min="0" step="any" value={r.qty} onChange={(e) => setCell(i, 'qty', e.target.value)} /></td>
                    <td className="px-2 py-1">
                      <input className={cell} list="memo-units" value={r.unit} onChange={(e) => setCell(i, 'unit', e.target.value)} placeholder={t('form.unitSelect')} />
                    </td>
                    <td className="px-2 py-1"><input className={cell + ' text-right'} type="number" min="0" step="any" value={r.unitPrice} onChange={(e) => setCell(i, 'unitPrice', e.target.value)} /></td>
                    <td className="px-2 py-1"><input className={cell + ' text-right'} type="number" min="0" step="any" value={r.discount} onChange={(e) => setCell(i, 'discount', e.target.value)} placeholder="0" /></td>
                    <td className="px-2 py-1"><input className={cell + ' text-right'} type="number" min="0" step="any" value={r.taxRate} onChange={(e) => setCell(i, 'taxRate', e.target.value)} placeholder="0" /></td>
                    <td className="px-2 py-1 text-right font-semibold text-ocean-dark whitespace-nowrap">{money(lineTotal(r))}</td>
                    <td className="px-2 py-1 text-center"><button type="button" className="text-red-400 hover:text-red-600 text-lg leading-none" onClick={() => removeRow(i)} aria-label="remove">×</button></td>
                  </tr>
                ))}
                {items.length === 0 && <tr><td colSpan={10} className="text-center text-slate-400 py-4 text-[13px]">{t('items.none')}</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="flex items-start justify-between mt-3 flex-wrap gap-4">
            <div className="flex flex-col gap-3">
              <button type="button" style={{ WebkitTapHighlightColor: 'transparent' }} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-[13px] font-semibold text-white hover:bg-emerald-600 active:bg-emerald-700 self-start" onClick={addRow}>{t('items.addRow')}</button>
              <label className="flex items-center gap-2 text-[13px] text-ink cursor-pointer select-none">
                <input type="checkbox" className="w-4 h-4 accent-ocean" checked={vat} onChange={(e) => setVat(e.target.checked)} />
                {t('items.vatLabel')}
              </label>
            </div>
            <div className="text-right min-w-[260px]">
              <div className="flex justify-between gap-8 text-[13px]"><span className="text-slate-500">{t('items.subtotal')}</span><span className="font-semibold">฿{money(subtotal)}</span></div>
              {totalLineDiscount > 0 && <div className="flex justify-between gap-8 text-[13px] mt-1"><span className="text-slate-500">{lang === 'th' ? 'ส่วนลดรายรายการ' : 'Line discounts'}</span><span className="font-semibold text-rose-600">-฿{money(totalLineDiscount)}</span></div>}
              <div className="flex justify-between gap-8 items-center text-[13px] mt-1">
                <span className="text-slate-500">{lang === 'th' ? 'ส่วนลดรวม' : 'Total discount'}</span>
                <span className="inline-flex items-center gap-1"><span className="text-rose-600">-฿</span><input className="input !py-1 !w-24 text-right text-[13px]" type="number" min="0" step="any" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0" /></span>
              </div>
              {vatAmount > 0 && <div className="flex justify-between gap-8 text-[13px] mt-1"><span className="text-slate-500">{lang === 'th' ? 'ภาษีรวม' : 'Total tax'}</span><span className="font-semibold">฿{money(vatAmount)}</span></div>}
              <div className="flex justify-between gap-8 items-baseline mt-2 pt-2 border-t border-slate-200">
                <span className="text-slate-500 text-xs">{t('items.grandTotal')}</span>
                <span className="text-xl font-extrabold text-ocean-dark">฿{money(grandTotal)}</span>
              </div>
            </div>
          </div>
        </div>

        {isEditingApproved && (
          <div className={`mt-4 rounded-xl border p-4 ${noteRequired ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-slate-50'}`}>
            <label className="label flex items-center gap-2">
              {lang === 'th' ? 'หมายเหตุการแก้ไข' : 'Edit note'}{noteRequired && <span className="text-rose-600">*</span>}
            </label>
            <textarea className="input min-h-[64px]" value={editNote} onChange={(e) => setEditNote(e.target.value)} placeholder={lang === 'th' ? 'ระบุเหตุผล/สิ่งที่แก้ไข…' : 'What changed and why…'} />
            <p className="mt-1 text-[12px] text-slate-600">
              {totalIncreased
                ? (lang === 'th' ? '⚠️ ยอดรวมเพิ่มขึ้นจากเดิม — เอกสารจะถูกส่งขออนุมัติใหม่ (ต้องกรอกหมายเหตุ)' : '⚠️ Total increased — will be re-submitted for approval (note required).')
                : (lang === 'th' ? 'ยอดรวมเท่าเดิมหรือลดลง — ใช้การอนุมัติเดิม กดบันทึกแล้วส่งปิดงานซ้ำได้เลย (หมายเหตุไม่บังคับ)' : 'Total same/decreased — keeps existing approval; you can re-send the close (note optional).')}
            </p>
          </div>
        )}

        <div className="flex gap-2.5 mt-4">
          {status === 'pending_manager' || status === 'approved' ? (
            <button type="button" className="btn btn-primary" onClick={saveEdit} disabled={busy}>{lang === 'th' ? 'บันทึกการแก้ไข' : 'Save changes'}</button>
          ) : (
            <>
              <button type="button" className="btn btn-ghost" onClick={saveDraft} disabled={busy}>{t('form.saveDraft')}</button>
              <button type="button" className="btn btn-primary" onClick={submit} disabled={busy}>{t('form.submit')}</button>
            </>
          )}
        </div>
      </form>
    </div>
  );
}
