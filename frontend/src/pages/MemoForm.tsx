import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { fmtDay } from '../ui';
import { useI18n } from '../i18n';

export type MemoFormValues = {
  companyId: number; departmentId: number;
  fromName: string; subject: string; attachment?: string; detail: string;
};

export function MemoForm({ initial, memoId, status }: { initial?: Partial<MemoFormValues>; memoId?: number; status?: string }) {
  const nav = useNavigate();
  const { t, lang } = useI18n();
  const [companies, setCompanies] = useState<any[]>([]);
  const [depts, setDepts] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<MemoFormValues>({
    defaultValues: { companyId: 0, departmentId: 0, fromName: '', subject: '', attachment: '', detail: '', ...initial },
  });
  const companyId = watch('companyId');

  useEffect(() => { api.companies().then((c) => { setCompanies(c); if (!initial?.companyId && c[0]) setValue('companyId', c[0].id); }); }, []);
  useEffect(() => {
    if (companyId) api.departments(Number(companyId)).then((d) => {
      setDepts(d);
      if (!d.find((x: any) => x.id === Number(watch('departmentId'))) && d[0]) setValue('departmentId', d[0].id);
    });
  }, [companyId]);

  const build = (v: MemoFormValues) => ({
    companyId: Number(v.companyId), departmentId: Number(v.departmentId),
    fromName: v.fromName.trim(), subject: v.subject.trim(),
    attachment: v.attachment?.trim() || undefined, detail: v.detail.trim(),
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
      await uploadIfAny(id);
      nav('/memos');
    } finally { setBusy(false); }
  });

  const submit = handleSubmit(async (v) => {
    setBusy(true);
    try {
      let id = memoId;
      if (id) await api.updateMemo(id, build(v));
      else { const m = await api.createMemo(build(v)); id = m.id; }
      await uploadIfAny(id!);
      await api.submitMemo(id!);
      nav(`/memos/view/${id}`);
    } finally { setBusy(false); }
  });

  return (
    <div className="card p-6 lg:p-8">
      <form>
        <div className="grid lg:grid-cols-2 gap-x-8 gap-y-0">
          {/* left column — meta fields */}
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

            <label className="label">{t('form.subject')}</label>
            <input className="input" {...register('subject', { required: true })} maxLength={200} />

            <label className="label">{t('form.attachmentNote')}</label>
            <input className="input" {...register('attachment')} placeholder={t('form.attachmentNotePlaceholder')} />

            <label className="label">{t('form.attachFile')}</label>
            <input ref={fileRef} type="file" className="text-[13px]" />
            <p className="text-gray-400 text-[11px] mt-1">{t('form.attachHint')}</p>
          </div>

          {/* right column — detail */}
          <div className="flex flex-col">
            <label className="label">{t('form.detail')}</label>
            <textarea className="input flex-1 min-h-[260px] lg:min-h-[440px] leading-7" {...register('detail', { required: true })}
              placeholder={t('form.detailPlaceholder')} />
            {errors.detail && <p className="text-red-500 text-xs mt-1">{t('form.detailRequired')}</p>}
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
