import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { fmtDay } from '../ui';

export type MemoFormValues = {
  companyId: number; departmentId: number;
  fromName: string; subject: string; attachment?: string; detail: string;
};

export function MemoForm({ initial, memoId, status }: { initial?: Partial<MemoFormValues>; memoId?: number; status?: string }) {
  const nav = useNavigate();
  const [companies, setCompanies] = useState<any[]>([]);
  const [depts, setDepts] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
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

  const saveDraft = handleSubmit(async (v) => {
    setBusy(true);
    try {
      if (memoId) { await api.updateMemo(memoId, build(v)); nav('/memos'); }
      else { await api.createMemo(build(v)); nav('/memos'); }
    } finally { setBusy(false); }
  });

  const submit = handleSubmit(async (v) => {
    setBusy(true);
    try {
      let id = memoId;
      if (id) await api.updateMemo(id, build(v));
      else { const m = await api.createMemo(build(v)); id = m.id; }
      await api.submitMemo(id!);
      nav(`/memos/view/${id}`);
    } finally { setBusy(false); }
  });

  return (
    <div className="card p-6 max-w-3xl">
      <form>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="label">บริษัท (Company) *</label>
            <select className="input" {...register('companyId', { required: true })}>
              {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">แผนก (Department) *</label>
            <select className="input" {...register('departmentId', { required: true })}>
              {depts.map((d) => <option key={d.id} value={d.id}>{d.code} — {d.name}</option>)}
            </select>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="label">วันที่ (Date)</label>
            <input className="input bg-gray-50" value={fmtDay(new Date().toISOString())} disabled />
          </div>
          <div>
            <label className="label">เลขที่ (Memo Number)</label>
            <input className="input bg-gray-50" value={memoId && status !== 'draft' ? '— ออกแล้ว —' : 'ออกอัตโนมัติเมื่อส่ง'} disabled />
          </div>
        </div>

        <label className="label">จาก (From) *</label>
        <input className="input" {...register('fromName', { required: true })} placeholder="ชื่อผู้ส่ง / หน่วยงาน" />

        <label className="label">เรื่อง (Subject) *</label>
        <input className="input" {...register('subject', { required: true })} maxLength={200} />

        <label className="label">สิ่งที่แนบมา (Attachment)</label>
        <input className="input" {...register('attachment')} placeholder="เช่น ใบเสนอราคา 1 ฉบับ" />

        <label className="label">รายละเอียด (Detail) *</label>
        <textarea className="input min-h-[220px] leading-7" {...register('detail', { required: true })}
          placeholder="แสดงอย่างน้อย 9 บรรทัด…" />
        {errors.detail && <p className="text-red-500 text-xs mt-1">กรุณากรอกรายละเอียด</p>}

        <div className="flex gap-2.5 mt-4">
          <button type="button" className="btn btn-ghost" onClick={saveDraft} disabled={busy}>บันทึกฉบับร่าง</button>
          <button type="button" className="btn btn-primary" onClick={submit} disabled={busy}>ส่งเพื่ออนุมัติ</button>
        </div>
      </form>
    </div>
  );
}
