import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { api } from '../api';
import { useI18n } from '../i18n';
import { PasswordInput } from '../components/PasswordInput';

const ROLES = ['staff', 'manager', 'executive', 'hrm', 'md', 'fc', 'admin'];

export function Users() {
  const { t, roleLabel } = useI18n();
  const [companies, setCompanies] = useState<any[]>([]);
  const [depts, setDepts] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [msg, setMsg] = useState('');

  const loadUsers = () => api.users().then(setUsers).catch(() => {});
  const { register, handleSubmit, watch, reset } = useForm<any>({
    defaultValues: { role: 'staff', password: 'Password123!' },
  });
  const companyId = watch('companyId');

  useEffect(() => { api.companies().then(setCompanies); loadUsers(); }, []);
  useEffect(() => { if (companyId) api.departments(Number(companyId)).then(setDepts); }, [companyId]);

  const openAdd = () => {
    setEditId(null); setMsg('');
    reset({ role: 'staff', password: 'Password123!', employeeCode: '', name: '', email: '', companyId: '', departmentId: '' });
    setOpen(true);
  };

  const openEdit = (u: any) => {
    setEditId(u.id); setMsg('');
    reset({
      employeeCode: u.employeeCode, name: u.name, email: u.email, password: '',
      companyId: u.companyId, departmentId: u.departmentId ?? '', role: u.role,
    });
    setOpen(true);
  };

  const onSubmit = async (v: any) => {
    setMsg('');
    try {
      const payload: any = {
        companyId: Number(v.companyId),
        departmentId: v.departmentId ? Number(v.departmentId) : undefined,
        employeeCode: v.employeeCode, name: v.name, email: v.email, role: v.role,
      };
      if (editId) {
        if (v.password) payload.password = v.password;
        await api.updateUser(editId, payload);
        setMsg(t('users.updated'));
      } else {
        payload.password = v.password;
        await api.register(payload);
        setMsg(t('users.added'));
      }
      setOpen(false); setEditId(null); loadUsers();
    } catch (e: any) { setMsg(e?.response?.data?.message || e.message); }
  };

  const onDelete = async (u: any) => {
    if (!window.confirm(t('users.confirmDelete').replace('{name}', u.name))) return;
    setMsg('');
    try { await api.deleteUser(u.id); setMsg(t('users.deleted')); loadUsers(); }
    catch (e: any) { setMsg(e?.response?.data?.message || e.message); }
  };

  return (
    <>
      <div className="flex items-center justify-between mb-5">
        <div><h2 className="text-xl font-bold">{t('users.title')}</h2>
          <p className="text-gray-500 text-[13px]">{t('users.subtitle')}</p></div>
        <button className="btn btn-primary" onClick={openAdd}>{t('users.addUser')}</button>
      </div>
      {msg && <div className="mb-4 text-sm text-ocean-dark">{msg}</div>}

      {open && (
        <div className="card p-6 max-w-2xl mb-6">
          <div className="font-bold text-ink mb-4">{editId ? t('users.editTitle') : t('users.addUser')}</div>
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="grid sm:grid-cols-2 gap-4">
              <div><label className="label">{t('users.employeeCode')}</label><input className="input" {...register('employeeCode', { required: true })} /></div>
              <div><label className="label">{t('users.name')}</label><input className="input" {...register('name', { required: true })} /></div>
              <div><label className="label">{t('users.email')}</label><input className="input" type="email" {...register('email', { required: true })} /></div>
              <div><label className="label">{editId ? t('users.passwordEdit') : t('users.password')}</label><PasswordInput reg={register('password', { required: !editId })} placeholder={editId ? t('users.passwordKeep') : ''} /></div>
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
              <button type="button" className="btn btn-ghost" onClick={() => { setOpen(false); setEditId(null); }}>{t('common.cancel')}</button>
              <button className="btn btn-primary">{t('common.save')}</button>
            </div>
          </form>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 text-[12px] border-b border-slate-100">
                <th className="px-5 py-3 font-semibold">{t('users.employeeCode')}</th>
                <th className="px-5 py-3 font-semibold">{t('users.name')}</th>
                <th className="px-5 py-3 font-semibold">{t('users.email')}</th>
                <th className="px-5 py-3 font-semibold">{t('users.company')}</th>
                <th className="px-5 py-3 font-semibold">{t('users.department')}</th>
                <th className="px-5 py-3 font-semibold">{t('users.role')}</th>
                <th className="px-5 py-3 font-semibold">{t('users.status')}</th>
                <th className="px-5 py-3 font-semibold text-right">{t('users.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr><td colSpan={8} className="px-5 py-8 text-center text-slate-400">{t('common.noData')}</td></tr>
              ) : users.map((u) => (
                <tr key={u.id} className="border-b border-slate-50 hover:bg-slate-50/60">
                  <td className="px-5 py-3 text-slate-500">{u.employeeCode}</td>
                  <td className="px-5 py-3 font-medium text-ink">{u.name}</td>
                  <td className="px-5 py-3 text-slate-500">{u.email}</td>
                  <td className="px-5 py-3 text-slate-500">{u.companyCode || '—'}</td>
                  <td className="px-5 py-3 text-slate-500">{u.deptCode ? `${u.deptCode}` : '—'}</td>
                  <td className="px-5 py-3">
                    <span className="inline-block rounded-full bg-slate-100 text-slate-600 text-[12px] font-semibold px-2.5 py-1">{roleLabel(u.role)}</span>
                  </td>
                  <td className="px-5 py-3">
                    <span className={'inline-flex items-center gap-1.5 text-[12px] font-semibold ' + (u.active ? 'text-emerald-600' : 'text-slate-400')}>
                      <span className={'w-2 h-2 rounded-full ' + (u.active ? 'bg-emerald-500' : 'bg-slate-300')} />
                      {u.active ? t('users.active') : t('users.inactive')}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => openEdit(u)} className="text-[12px] font-semibold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200">{t('users.edit')}</button>
                      <button onClick={() => onDelete(u)} className="text-[12px] font-semibold px-2.5 py-1 rounded-lg bg-rose-100 text-rose-600 hover:bg-rose-200">{t('users.delete')}</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
