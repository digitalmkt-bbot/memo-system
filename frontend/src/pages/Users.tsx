import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { api } from '../api';
import { ROLE_TH } from '../ui';

export function Users() {
  const [companies, setCompanies] = useState<any[]>([]);
  const [depts, setDepts] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState('');
  const { register, handleSubmit, watch, reset } = useForm<any>({
    defaultValues: { role: 'staff', password: 'Password123!' },
  });
  const companyId = watch('companyId');

  useEffect(() => { api.companies().then((c) => { setCompanies(c); }); }, []);
  useEffect(() => { if (companyId) api.departments(Number(companyId)).then(setDepts); }, [companyId]);

  const onSubmit = async (v: any) => {
    setMsg('');
    try {
      await api.register({
        companyId: Number(v.companyId), departmentId: v.departmentId ? Number(v.departmentId) : undefined,
        employeeCode: v.employeeCode, name: v.name, email: v.email, password: v.password, role: v.role,
      });
      setMsg('เพิ่มผู้ใช้เรียบร้อย'); reset({ role: 'staff', password: 'Password123!' }); setOpen(false);
    } catch (e: any) { setMsg(e.message); }
  };

  return (
    <>
      <div className="flex items-center justify-between mb-5">
        <div><h2 className="text-xl font-bold">จัดการผู้ใช้ (Users)</h2>
          <p className="text-gray-500 text-[13px]">เฉพาะผู้ดูแลระบบ — เพิ่มผู้ใช้และกำหนดบทบาท</p></div>
        <button className="btn btn-primary" onClick={() => setOpen((o) => !o)}>+ เพิ่มผู้ใช้</button>
      </div>
      {msg && <div className="mb-4 text-sm text-ocean-dark">{msg}</div>}

      {open && (
        <div className="card p-6 max-w-2xl mb-6">
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="grid sm:grid-cols-2 gap-4">
              <div><label className="label">รหัสพนักงาน *</label><input className="input" {...register('employeeCode', { required: true })} /></div>
              <div><label className="label">ชื่อ *</label><input className="input" {...register('name', { required: true })} /></div>
              <div><label className="label">อีเมล *</label><input className="input" type="email" {...register('email', { required: true })} /></div>
              <div><label className="label">รหัสผ่าน *</label><input className="input" {...register('password', { required: true })} /></div>
              <div><label className="label">บริษัท *</label>
                <select className="input" {...register('companyId', { required: true })}>
                  <option value="">— เลือก —</option>
                  {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select></div>
              <div><label className="label">แผนก</label>
                <select className="input" {...register('departmentId')}>
                  <option value="">—</option>
                  {depts.map((d) => <option key={d.id} value={d.id}>{d.code} — {d.name}</option>)}
                </select></div>
              <div><label className="label">บทบาท *</label>
                <select className="input" {...register('role', { required: true })}>
                  {Object.entries(ROLE_TH).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select></div>
            </div>
            <div className="flex gap-2.5 mt-4">
              <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>ยกเลิก</button>
              <button className="btn btn-primary">บันทึก</button>
            </div>
          </form>
        </div>
      )}

      <div className="card p-5 text-sm text-gray-500">
        การแสดงรายชื่อผู้ใช้ทั้งหมดต้องการ endpoint <code className="text-ocean">GET /users</code> (อยู่ใน Phase 2).
        ปัจจุบันรองรับการ <span className="font-semibold text-ink">เพิ่มผู้ใช้</span> ผ่าน <code className="text-ocean">POST /auth/register</code>.
      </div>
    </>
  );
}
