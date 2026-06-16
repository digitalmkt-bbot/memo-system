import { useForm } from 'react-hook-form';
import { Navigate, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../auth';
import { useI18n } from '../i18n';

type Form = { email: string; password: string };

export function Login() {
  const { user, login } = useAuth();
  const { t } = useI18n();
  const nav = useNavigate();
  const [err, setErr] = useState('');
  const { register, handleSubmit, formState: { isSubmitting } } = useForm<Form>({
    defaultValues: { email: 'ploy@loveandaman.com', password: 'Password123!' },
  });

  if (user) return <Navigate to="/dashboard" replace />;

  const onSubmit = async (d: Form) => {
    setErr('');
    try { await login(d.email, d.password); nav('/dashboard'); }
    catch (e: any) { setErr(e.message || t('login.failed')); }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-gradient-to-br from-ocean to-ocean-dark p-5">
      <div className="bg-white w-full max-w-sm rounded-2xl p-9 shadow-xl">
        <h1 className="text-xl font-bold text-ocean-dark flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-ocean inline-block" />{t('common.appName')}
        </h1>
        <p className="text-gray-500 text-[13px] mt-1 mb-5">{t('login.subtitle')}</p>
        <form onSubmit={handleSubmit(onSubmit)}>
          <label className="label">{t('login.email')}</label>
          <input className="input" type="email" {...register('email', { required: true })} />
          <label className="label">{t('login.password')}</label>
          <input className="input" type="password" {...register('password', { required: true })} />
          <div className="text-red-500 text-[13px] mt-2.5 min-h-[18px]">{err}</div>
          <button className="btn btn-primary w-full mt-2" disabled={isSubmitting}>
            {isSubmitting ? t('login.signingIn') : t('login.signIn')}
          </button>
        </form>
      </div>
    </div>
  );
}
