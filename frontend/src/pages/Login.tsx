import { useForm } from 'react-hook-form';
import { Navigate, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../auth';
import { useI18n } from '../i18n';
import { api } from '../api';

type Form = { email: string; password: string };
type PwForm = { email: string; currentPassword: string; newPassword: string };

const pill = 'w-full rounded-full bg-white/95 px-5 py-3 text-[15px] text-slate-800 placeholder:text-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-white border border-white/60';

function EyeBtn({ on, toggle }: { on: boolean; toggle: () => void }) {
  return (
    <button type="button" tabIndex={-1} onClick={toggle} aria-label="toggle"
      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
      {on ? (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
      ) : (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
      )}
    </button>
  );
}

function Scenery() {
  // calm misty-mountain landscape (inline SVG, fills the screen)
  return (
    <svg className="absolute inset-0 w-full h-full" viewBox="0 0 800 600" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#cfe2e8" /><stop offset="1" stopColor="#b6d0d7" />
        </linearGradient>
      </defs>
      <rect width="800" height="600" fill="url(#sky)" />
      {/* clouds */}
      <g fill="#eef5f7" opacity="0.9">
        <ellipse cx="560" cy="120" rx="140" ry="46" />
        <ellipse cx="660" cy="150" rx="120" ry="40" />
        <ellipse cx="470" cy="150" rx="90" ry="32" />
        <ellipse cx="200" cy="90" rx="110" ry="36" opacity="0.7" />
      </g>
      {/* birds */}
      <g stroke="#1c2b2b" strokeWidth="2.5" fill="none" strokeLinecap="round">
        <path d="M610 215 q10 -10 20 0 q10 -10 20 0" />
        <path d="M650 240 q8 -8 16 0 q8 -8 16 0" />
      </g>
      {/* mountains, far -> near */}
      <path d="M0 360 L150 250 L300 360 L470 230 L640 360 L800 280 L800 600 L0 600 Z" fill="#9ab6bb" />
      <path d="M0 420 L180 300 L360 430 L540 300 L720 430 L800 360 L800 600 L0 600 Z" fill="#7aa0a6" opacity="0.95" />
      <path d="M0 470 L160 370 L340 480 L520 370 L700 480 L800 430 L800 600 L0 600 Z" fill="#5d878d" opacity="0.95" />
      {/* foreground hills */}
      <path d="M0 540 L220 460 L430 540 L640 470 L800 540 L800 600 L0 600 Z" fill="#3f6b6f" />
      <path d="M0 600 L0 560 L260 600 Z" fill="#274c4d" />
      {/* pine trees */}
      <g fill="#16302f">
        <g transform="translate(60 520) scale(1.1)"><path d="M0 70 L14 30 L28 70 Z" /><path d="M2 50 L14 14 L26 50 Z" /><path d="M4 34 L14 4 L24 34 Z" /><rect x="11" y="66" width="6" height="14" /></g>
        <g transform="translate(720 500) scale(1.4)"><path d="M0 70 L14 30 L28 70 Z" /><path d="M2 50 L14 14 L26 50 Z" /><path d="M4 34 L14 4 L24 34 Z" /><rect x="11" y="66" width="6" height="16" /></g>
        <g transform="translate(640 545) scale(0.9)"><path d="M0 70 L14 30 L28 70 Z" /><path d="M2 50 L14 14 L26 50 Z" /><rect x="11" y="66" width="6" height="12" /></g>
        <g transform="translate(560 560) scale(0.7)"><path d="M0 70 L14 30 L28 70 Z" /><path d="M2 50 L14 14 L26 50 Z" /><rect x="11" y="66" width="6" height="12" /></g>
      </g>
    </svg>
  );
}

export function Login() {
  const { user, login } = useAuth();
  const { t } = useI18n();
  const nav = useNavigate();
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [mode, setMode] = useState<'login' | 'pw'>('login');
  const [showPw, setShowPw] = useState(false);
  const [showCur, setShowCur] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const { register, handleSubmit, formState: { isSubmitting } } = useForm<Form>({
    defaultValues: { email: '', password: '' },
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
    try { await api.changePassword(d); setOk(t('login.changed')); pw.reset(); setMode('login'); }
    catch (e: any) { setErr(e?.response?.data?.message || e.message); }
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      <Scenery />
      <div className="relative z-10 min-h-screen flex">
        <div className="w-full lg:max-w-[560px] bg-white/25 backdrop-blur-xl border-r border-white/30 flex items-center px-7 sm:px-14">
          <div className="w-full max-w-sm py-12">
            <h1 className="text-[40px] leading-none font-extrabold text-slate-900">{t('login.welcome')} 👋</h1>
            <p className="text-slate-600/90 text-[15px] mt-3 mb-8">{t('login.subtitle')}</p>
            {ok && <div className="text-emerald-700 bg-emerald-50/80 rounded-xl px-3 py-2 text-[13px] mb-4">{ok}</div>}

            {mode === 'login' ? (
              <form onSubmit={handleSubmit(onSubmit)}>
                <label className="block text-[14px] font-semibold text-slate-700 mb-2">{t('login.email')}</label>
                <input className={pill} type="email" placeholder={t('login.emailPlaceholder')} {...register('email', { required: true })} />

                <label className="block text-[14px] font-semibold text-slate-700 mb-2 mt-5">{t('login.password')}</label>
                <div className="relative">
                  <input className={pill + ' pr-12'} type={showPw ? 'text' : 'password'} placeholder="••••••••" {...register('password', { required: true })} />
                  <EyeBtn on={showPw} toggle={() => setShowPw((s) => !s)} />
                </div>

                <div className="flex items-center justify-between mt-4">
                  <label className="flex items-center gap-2 text-[13px] text-slate-700 select-none cursor-pointer">
                    <input type="checkbox" defaultChecked className="accent-slate-700 w-4 h-4" />
                    {t('login.rememberMe')}
                  </label>
                  <button type="button" onClick={() => { setMode('pw'); setErr(''); setOk(''); }}
                    className="text-[13px] text-slate-700 font-medium hover:underline">{t('login.forgot')}</button>
                </div>

                <div className="text-rose-600 text-[13px] mt-3 min-h-[18px]">{err}</div>
                <button className="w-full rounded-full bg-[#2c3b40] text-white font-bold py-3.5 hover:brightness-125 transition disabled:opacity-60" disabled={isSubmitting}>
                  {isSubmitting ? t('login.signingIn') : t('login.signIn')}
                </button>
              </form>
            ) : (
              <form onSubmit={pw.handleSubmit(onChangePw)}>
                <label className="block text-[14px] font-semibold text-slate-700 mb-2">{t('login.email')}</label>
                <input className={pill} type="email" placeholder={t('login.emailPlaceholder')} {...pw.register('email', { required: true })} />
                <label className="block text-[14px] font-semibold text-slate-700 mb-2 mt-5">{t('login.currentPassword')}</label>
                <div className="relative">
                  <input className={pill + ' pr-12'} type={showCur ? 'text' : 'password'} {...pw.register('currentPassword', { required: true })} />
                  <EyeBtn on={showCur} toggle={() => setShowCur((s) => !s)} />
                </div>
                <label className="block text-[14px] font-semibold text-slate-700 mb-2 mt-5">{t('login.newPassword')}</label>
                <div className="relative">
                  <input className={pill + ' pr-12'} type={showNew ? 'text' : 'password'} {...pw.register('newPassword', { required: true, minLength: 6 })} />
                  <EyeBtn on={showNew} toggle={() => setShowNew((s) => !s)} />
                </div>
                <div className="text-rose-600 text-[13px] mt-3 min-h-[18px]">{err}</div>
                <button className="w-full rounded-full bg-[#2c3b40] text-white font-bold py-3.5 hover:brightness-125 transition disabled:opacity-60" disabled={pw.formState.isSubmitting}>
                  {pw.formState.isSubmitting ? t('login.changing') : t('login.changeBtn')}
                </button>
                <button type="button" onClick={() => { setMode('login'); setErr(''); }}
                  className="block w-full text-center text-[13px] text-slate-600 mt-4 hover:underline">{t('login.backToLogin')}</button>
              </form>
            )}
          </div>
        </div>
        <div className="hidden lg:block flex-1" />
      </div>
    </div>
  );
}
