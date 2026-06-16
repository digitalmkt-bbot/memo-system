import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { fmtDay } from '../ui';
import { useI18n } from '../i18n';

export type MemoItemRow = { name: string; detail?: string; qty: any; unit?: string; unitPrice: any };
export type MemoFormValues = {
  companyId: number; departmentId: number;
  fromName: string; subject: string; attachment?: string; detail: string;
};
type Extra = { items?: MemoItemRow[]; vat?: boolean; category?: string; neededDate?: string };

const money = (n: number) => (Number(n) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const lineTotal = (r: MemoItemRow) => (Number(r.qty) || 0) * (Number(r.unitPrice) || 0);
const UNITS = ['ชิ้น', 'กล่อง', 'ชุด', 'แพ็ค', 'ม้วน', 'ลิตร', 'กิโลกรัม', 'เดือน', 'ครั้ง', 'รายการ'];
const CATS: [string, string][] = [['general', 'catGeneral'], ['budget', 'catBudget'], ['procurement', 'catProcurement'], ['info', 'catInfo'], ['other', 'catOther']];
const STEPS: [string, string][] = [['create', 'steps.create'], ['pending_manager', 'steps.manager'], ['pending_executive', 'steps.executive'], ['approved', 'steps.done']];

export function MemoForm({ initial, memoId, status }: { initial?: (Partial<MemoFormValues> & Extra); memoId?: number; status?: string }) {
  const nav = useNavigate();
  const { t, lang } = useI18n();
  const [companies, setCompanies] = useState<any[]>([]);
  const [depts, setDepts] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState<MemoItemRow[]>(initial?.items?.length
    ? initial.items.map((it) => ({ name: it.name || '', detail: it.detail || '', qty: it.qty ?? 1, unit: it.unit || '', unitPrice: it.unitPrice ?? '' }))
    : []);
  const [vat, setVat] = useState<boolean>(!!initial?.vat);
  const [category, setCategory] = useState<string>(initial?.category || 'general');
  const [neededDate, setNeededDate] = useState<string>(initial?.neededDate || '');
  const fileRef = useRef<HTMLInputElement>(null);
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<MemoFormValues>({
    defaultValues: { companyId: 0, departmentId: 0, fromName: '', subject: '', attachment: '', detail: '', ...initial },
  });
  const companyId = watch('companyId');
  const activeStep = Math.max(0, STEPS.findIndex(([k]) => k === (status || 'create')));

  useEffect(() => { api.companies().then((c) => { setCompanies(c); if (!initial?.companyId && c[0]) setValue('companyId', c[0].id); }); }, []);
  useEffect(() => {
    if (companyId) api.departments(Number(companyId)).then((d) => {
      setDepts(d);
      if (!d.find((x: any) => x.id === Number(watch('departmentId'))) && d[0]) setValue('departmentId', d[0].id);
    });
  }, [companyId]);

  const addRow = () => setItems((xs) => [...xs, { name: '', detail: '', qty: 1, unit: '', unitPrice: '' }]);
  const removeRow = (i: number) => setItems((xs) => xs.filter((_, idx) => idx !== i));
  const setCell = (i: number, k: keyof MemoItemRow, v: any) => setItems((xs) => xs.map((r, idx) => idx === i ? { ...r, [k]: v } : r));
  const subtotal = items.reduce((s, r) => s + lineTotal(r), 0);
  const vatAmount = vat ? subtotal * 0.07 : 0;
  const grandTotal = subtotal + vatAmount;

  const cleanItems = () => items.filter((r) => String(r.name || '').trim())
    .map((r) => ({ name: r.name.trim(), detail: r.detail?.trim() || undefined, qty: Number(r.qty) || 0, unit: r.unit?.trim() || undefined, unitPrice: Number(r.unitPrice) || 0 }));

  const build = (v: MemoFormValues) => ({
    companyId: Number(v.companyId), departmentId: Number(v.departmentId),
    fromName: v.fromName.trim(), subject: v.subject.trim(),
    attachment: v.attachment?.trim() || undefined, detail: v.detail.trim(),
    vat, category, neededDate: neededDate || undefined, items: cleanItems(),
  });

  const uploadIfAny = async (id: number) => {
    const f = fileRef.current?.files?.[0];
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) { alert(t('form.fileTooBig')); return; }
    try { await api.uploadAttachment(id, f); } catch (e: any) { alert(t('form.attachFailed') + e.message); }
  };
  const saveDraft = handleSubmit(async (v) => {
    setBusy(true);
    try {
      const id = memoId ? (await api.updateMemo(memoId, build(v)), memoId) : (await api.createMemo(build(v))).id;
      await uploadIfAny(id); nav('/memos');
    } finally { setBusy(false); }
  });
  const submit = handleSubmit(async (v) => {
    setBusy(true);
    try {
      let id = memoId;
      if (id) await api.updateMemo(id, build(v));
      else { const m = await api.createMemo(build(v)); id = m.id; }
      await uploadIfAny(id!); await api.submitMemo(id!); nav(`/memos/view/${id}`);
    } finally { setBusy(false); }
  });

  const cell = 'rounded-lg bg-surface shadow-neu-inset px-2.5 py-1.5 text-[13px] text-ink focus:outline-none focus:ring-2 focus:ring-ocean/40 w-full';

  return (
    <div className="card p-6 lg:p-8">
      {/* step indicator */}
      <div className="flex items-center mb-7">
        {STEPS.map(([k, lbl], i) => (
          <div key={k} className="flex items-center flex-1 last:flex-none">
            <div className="flex items-center gap-2">
              <div className={'w-8 h-8 rounded-full grid place-items-center text-[13px] font-bold ' +
                (i <= activeStep ? 'text-white bg-gradient-to-br from-[#8273f7] to-[#6354e6] shadow-neu-sm' : 'bg-surface text-slate-400 shadow-neu-sm')}>{i + 1}</div>
              <span className={'text-[13px] font-semibold ' + (i <= activeStep ? 'text-ocean-dark' : 'text-slate-400')}>{t(lbl)}</span>
            </div>
            {i < STEPS.length - 1 && <div className={'flex-1 h-0.5 mx-3 rounded ' + (i < activeStep ? 'bg-ocean' : 'bg-slate-200')} />}
          </div>
        ))}
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
              </div>
              <div>
                <label className="label">{t('form.neededDate')}</label>
                <input type="date" className="input" value={neededDate} onChange={(e) => setNeededDate(e.target.value)} />
              </div>
            </div>
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
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-slate-500 text-[11px] uppercase tracking-wide">
                  <th className="text-left font-semibold px-2 py-2 w-8">#</th>
                  <th className="text-left font-semibold px-2 py-2">{t('items.colItem')}</th>
                  <th className="text-left font-semibold px-2 py-2">{t('items.colDetail')}</th>
                  <th className="text-right font-semibold px-2 py-2 w-20">{t('items.colQty')}</th>
                  <th className="text-left font-semibold px-2 py-2 w-28">{t('items.colUnit')}</th>
                  <th className="text-right font-semibold px-2 py-2 w-28">{t('items.colUnitPrice')}</th>
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
                      <select className={cell} value={r.unit} onChange={(e) => setCell(i, 'unit', e.target.value)}>
                        <option value="">{t('form.unitSelect')}</option>
                        {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-1"><input className={cell + ' text-right'} type="number" min="0" step="any" value={r.unitPrice} onChange={(e) => setCell(i, 'unitPrice', e.target.value)} /></td>
                    <td className="px-2 py-1 text-right font-semibold text-ocean-dark whitespace-nowrap">{money(lineTotal(r))}</td>
                    <td className="px-2 py-1 text-center"><button type="button" className="text-red-400 hover:text-red-600 text-lg leading-none" onClick={() => removeRow(i)} aria-label="remove">×</button></td>
                  </tr>
                ))}
                {items.length === 0 && <tr><td colSpan={8} className="text-center text-slate-400 py-4 text-[13px]">{t('items.none')}</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="flex items-start justify-between mt-3 flex-wrap gap-4">
            <div className="flex flex-col gap-3">
              <button type="button" className="btn btn-ghost !py-2 text-[13px] self-start" onClick={addRow}>{t('items.addRow')}</button>
              <label className="flex items-center gap-2 text-[13px] text-ink cursor-pointer select-none">
                <input type="checkbox" className="w-4 h-4 accent-ocean" checked={vat} onChange={(e) => setVat(e.target.checked)} />
                {t('items.vatLabel')}
              </label>
            </div>
            <div className="text-right min-w-[200px]">
              <div className="flex justify-between gap-8 text-[13px]"><span className="text-slate-500">{t('items.subtotal')}</span><span className="font-semibold">฿{money(subtotal)}</span></div>
              {vat && <div className="flex justify-between gap-8 text-[13px] mt-1"><span className="text-slate-500">{t('items.vatAmount')}</span><span className="font-semibold">฿{money(vatAmount)}</span></div>}
              <div className="flex justify-between gap-8 items-baseline mt-2 pt-2 border-t border-slate-200">
                <span className="text-slate-500 text-xs">{vat ? t('items.grandTotal') : t('items.total')}</span>
                <span className="text-xl font-extrabold text-ocean-dark">฿{money(grandTotal)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-2.5 mt-6">
          <button type="button" className="btn btn-ghost" onClick={saveDraft} disabled={busy}>{t('form.saveDraft')}</button>
          <button type="button" className="btn btn-primary" onClick={submit} disabled={busy}>{t('form.submit')}</button>
        </div>
      </form>
    </div>
  );
}
