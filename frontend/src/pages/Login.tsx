import { useForm } from 'react-hook-form';
import { Navigate, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../auth';
import { useI18n } from '../i18n';
import { api } from '../api';

type Form = { email: string; password: string };
type PwForm = { email: string; currentPassword: string; newPassword: string };

export function Login() {
  const { user, login } = useAuth();
  const { t } = useI18n();
  const nav = useNavigate();
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [mode, setMode] = useState<'login' | 'pw'>('login');

  const { register, handleSubmit, formState: { isSubmitting } } = useForm<Form>({
    defaultValues: { email: 'ploy@loveandaman.com', password: 'Password123!' },
  });
  const pw = useForm<PwForm>({ defaultValues: { email: '', currentPassword: '', newPassword: '' } });

  if (user) return <Navigate to="/dashboard" replace />;

  const onSubmit = async (d: Form) => {
    setErr('');
    try { await login(d.email, d.password); nav('/dashboard'); }
    catch (e: any) { setErr(e.message || t('login.failed')); }
  };

  const onChangePw = async (d: PwForm) => {
    setErr(''); setOk('');
    try {
      await api.changePassword(d);
      setOk(t('login.changed')); pw.reset(); setMode('login');
    } catch (e: any) { setErr(e?.response?.data?.message || e.message); }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-gradient-to-br from-ocean to-ocean-dark p-5">
      <div className="bg-white w-full max-w-sm rounded-2xl p-9 shadow-xl">
        <h1 className="text-xl font-bold text-ocean-dark flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-ocean inline-block" />{t('common.appName')}
        </h1>
        <p className="text-gray-500 text-[13px] mt-1 mb-5">{t('login.subtitle')}</p>
        {ok && <div className="text-emerald-600 text-[13px] mb-3">{ok}</div>}

        {mode === 'login' ? (
          <form onSubmit={handleSubmit(onSubmit)}>
            <label className="label">{t('login.email')}</label>
            <input className="input" type="email" {...register('email', { required: true })} />
            <label className="label">{t('login.password')}</label>
            <input className="input" type="password" {...register('password', { required: true })} />
            <div className="text-red-500 text-[13px] mt-2.5 min-h-[18px]">{err}</div>
            <button className="btn btn-primary w-full mt-2" disabled={isSubmitting}>
              {isSubmitting ? t('login.signingIn') : t('login.signIn')}
            </button>
            <button type="button" onClick={() => { setMode('pw'); setErr(''); setOk(''); }}
              className="block w-full text-center text-[13px] text-ocean-dark font-semibold mt-4 hover:underline">
              {t('login.changePassword')}
            </button>
          </form>
        ) : (
          <form onSubmit={pw.handleSubmit(onChangePw)}>
            <label className="label">{t('login.email')}</label>
            <input className="input" type="email" {...pw.register('email', { required: true })} />
            <label className="label">{t('login.currentPassword')}</label>
            <input className="input" type="password" {...pw.register('currentPassword', { required: true })} />
            <label className="label">{t('login.newPassword')}</label>
            <input className="input" type="password" {...pw.register('newPassword', { required: true, minLength: 6 })} />
            <div className="text-red-500 text-[13px] mt-2.5 min-h-[18px]">{err}</div>
            <button className="btn btn-primary w-full mt-2" disabled={pw.formState.isSubmitting}>
              {pw.formState.isSubmitting ? t('login.changing') : t('login.changeBtn')}
            </button>
            <button type="button" onClick={() => { setMode('login'); setErr(''); }}
              className="block w-full text-center text-[13px] text-slate-500 mt-4 hover:underline">
              {t('login.backToLogin')}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
