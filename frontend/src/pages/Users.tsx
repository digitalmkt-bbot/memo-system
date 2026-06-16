import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { api } from '../api';
import { useI18n } from '../i18n';

export function Users() {
  const { t, roleLabel } = useI18n();
  const [companies, setCompanies] = useState<any[]>([]);
  const [depts, setDepts] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState('');
  const { register, handleSubmit, watch, reset } = useForm<any>({
    defaultValues: { role: 'staff', password: 'Password123!' },
  });
  const companyId = watch('companyId');

  const ROLES = ['staff', 'manager', 'executive', 'admin'];

  useEffect(() => { api.companies().then((c) => { setCompanies(c); }); }, []);
  useEffect(() => { if (companyId) api.departments(Number(companyId)).then(setDepts); }, [companyId]);

  const onSubmit = async (v: any) => {
    setMsg('');
    try {
      await api.register({
        companyId: Number(v.companyId), departmentId: v.departmentId ? Number(v.departmentId) : undefined,
        employeeCode: v.employeeCode, name: v.name, email: v.email, password: v.password, role: v.role,
      });
      setMsg(t('users.added')); reset({ role: 'staff', password: 'Password123!' }); setOpen(false);
    } catch (e: any) { setMsg(e.message); }
  };

  return (
    <>
      <div className="flex items-center justify-between mb-5">
        <div><h2 className="text-xl font-bold">{t('users.title')}</h2>
          <p className="text-gray-500 text-[13px]">{t('users.subtitle')}</p></div>
        <button className="btn btn-primary" onClick={() => setOpen((o) => !o)}>{t('users.addUser')}</button>
      </div>
      {msg && <div className="mb-4 text-sm text-ocean-dark">{msg}</div>}

      {open && (
        <div className="card p-6 max-w-2xl mb-6">
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="grid sm:grid-cols-2 gap-4">
              <div><label className="label">{t('users.employeeCode')}</label><input className="input" {...register('employeeCode', { required: true })} /></div>
              <div><label className="label">{t('users.name')}</label><input className="input" {...register('name', { required: true })} /></div>
              <div><label className="label">{t('users.email')}</label><input className="input" type="email" {...register('email', { required: true })} /></div>
              <div><label className="label">{t('users.password')}</label><input className="input" {...register('password', { required: true })} /></div>
              <div><label className="label">{t('users.company')}</label>
                <select className="input" {...register('companyId', { required: true })}>
                  <option value="">{t('users.select')}</option>
                  {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select></div>
              <div><label className="label">{t('users.department')}</label>
                <select className="input" {...register('departmentId')}>
                  <option value="">—</option>
                  {depts.map((d) => <option key={d.id} value={d.id}>{d.code} — {d.name}</option>)}
                </select></div>
              <div><label className="label">{t('users.role')}</label>
                <select className="input" {...register('role', { required: true })}>
                  {ROLES.map((k) => <option key={k} value={k}>{roleLabel(k)}</option>)}
                </select></div>
            </div>
            <div className="flex gap-2.5 mt-4">
              <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>{t('common.cancel')}</button>
              <button className="btn btn-primary">{t('common.save')}</button>
            </div>
          </form>
        </div>
      )}

      <div className="card p-5 text-sm text-gray-500">
        {t('users.note1')}<code className="text-ocean">GET /users</code>{t('users.note2')}
        <span className="font-semibold text-ink">{t('users.note3')}</span>{t('users.note4')}<code className="text-ocean">POST /auth/register</code>.
      </div>
    </>
  );
}
