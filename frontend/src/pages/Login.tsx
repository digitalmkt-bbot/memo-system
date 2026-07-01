import { useForm } from 'react-hook-form';
import { Navigate, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../auth';
import { useI18n } from '../i18n';
import { api } from '../api';

type Form = { email: string; password: string };
type PwForm = { email: string; currentPassword: string; newPassword: string };

const field =
  'w-full rounded-2xl bg-slate-50 px-4 py-3.5 text-[15px] text-slate-800 placeholder:text-slate-400 ' +
  'border border-slate-200 focus:outline-none focus:ring-4 focus:ring-lime-100 focus:border-lime-400 transition';

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

/* Original friendly mascot — a cheerful character waving and holding a memo. */
function Mascot() {
  return (
    <svg viewBox="0 0 220 280" className="h-full w-full" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <ellipse cx="110" cy="267" rx="60" ry="9" fill="#062f2c" opacity="0.35" />
      {/* legs + shoes */}
      <rect x="92" y="196" width="16" height="58" rx="8" fill="#0b3b38" />
      <rect x="113" y="196" width="16" height="58" rx="8" fill="#0b3b38" />
      <rect x="82" y="250" width="28" height="13" rx="6" fill="#e9fff6" />
      <rect x="111" y="250" width="28" height="13" rx="6" fill="#e9fff6" />
      {/* torso */}
      <path d="M78 150 q32 -14 64 0 v40 q-32 12 -64 0 Z" fill="#2dd4bf" />
      <rect x="78" y="150" width="64" height="52" rx="24" fill="#2dd4bf" />
      {/* waving arm */}
      <path d="M136 158 q28 -4 36 -34" stroke="#2dd4bf" strokeWidth="16" fill="none" strokeLinecap="round" />
      <circle cx="174" cy="120" r="9" fill="#f2c8a0" />
      {/* holding arm */}
      <path d="M84 160 q-16 10 -14 32" stroke="#2dd4bf" strokeWidth="16" fill="none" strokeLinecap="round" />
      <circle cx="72" cy="196" r="8" fill="#f2c8a0" />
      {/* neck + head */}
      <rect x="102" y="130" width="16" height="18" fill="#f2c8a0" />
      <circle cx="110" cy="104" r="30" fill="#f2c8a0" />
      <path d="M80 106 C80 74 140 74 140 106 C140 92 128 80 110 80 C92 80 80 92 80 106 Z" fill="#33261f" />
      <circle cx="100" cy="105" r="3.2" fill="#2b2b2b" />
      <circle cx="120" cy="105" r="3.2" fill="#2b2b2b" />
      <circle cx="93" cy="113" r="4" fill="#f7a6a6" opacity="0.6" />
      <circle cx="127" cy="113" r="4" fill="#f7a6a6" opacity="0.6" />
      <path d="M101 115 q9 8 18 0" stroke="#2b2b2b" strokeWidth="3" fill="none" strokeLinecap="round" />
      {/* memo / clipboard */}
      <rect x="86" y="176" width="46" height="56" rx="6" fill="#ffffff" stroke="#d1d5db" strokeWidth="1.5" />
      <rect x="100" y="170" width="18" height="9" rx="3" fill="#0e7490" />
      <rect x="94" y="192" width="30" height="4" rx="2" fill="#cbd5e1" />
      <rect x="94" y="202" width="30" height="4" rx="2" fill="#cbd5e1" />
      <rect x="94" y="212" width="20" height="4" rx="2" fill="#cbd5e1" />
      <circle cx="116" cy="224" r="7" fill="#34d399" />
      <path d="M112.5 224 l2.5 2.5 l4 -5" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* Original brand panel — bright daytime landscape (sky, hills, warm path). */
function BrandPanel() {
  return (
    <div className="relative h-full w-full overflow-hidden">
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 600 820" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="loSky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#bfe4fb" /><stop offset="1" stopColor="#e9f7ff" />
          </linearGradient>
          <linearGradient id="loFg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#e4f2a6" /><stop offset="1" stopColor="#cfe888" />
          </linearGradient>
        </defs>
        <rect width="600" height="820" fill="url(#loSky)" />
        {/* sun */}
        <circle cx="472" cy="150" r="72" fill="#ffe58a" opacity="0.4" />
        <circle cx="472" cy="150" r="52" fill="#ffd75e" opacity="0.95" />
        {/* clouds */}
        <g fill="#ffffff" opacity="0.92">
          <ellipse cx="150" cy="120" rx="80" ry="26" />
          <ellipse cx="210" cy="140" rx="60" ry="20" />
          <ellipse cx="360" cy="90" rx="66" ry="22" opacity="0.8" />
        </g>
        {/* distant blue hills */}
        <path d="M0 330 Q150 260 320 320 T600 300 L600 500 L0 500 Z" fill="#a9d0e8" opacity="0.85" />
        {/* green hills */}
        <path d="M0 385 Q180 305 360 385 T600 360 L600 820 L0 820 Z" fill="#a6d968" />
        <path d="M0 455 Q200 380 420 455 T600 430 L600 820 L0 820 Z" fill="#8bc850" />
        <path d="M0 545 Q220 470 440 545 T600 520 L600 820 L0 820 Z" fill="#74b23f" />
        {/* warm foreground */}
        <path d="M0 625 Q220 560 600 635 L600 820 L0 820 Z" fill="url(#loFg)" />
        {/* winding path */}
        <path d="M300 820 C312 725 236 690 306 638 C366 596 452 610 496 582" fill="none" stroke="#eef3c6" strokeWidth="72" strokeLinecap="round" opacity="0.95" />
        {/* tree */}
        <rect x="94" y="452" width="15" height="70" rx="4" fill="#8a5a3b" />
        <circle cx="101" cy="436" r="40" fill="#6fae3d" />
        <circle cx="74" cy="454" r="26" fill="#7cba46" />
        <circle cx="128" cy="452" r="26" fill="#66a437" />
        <circle cx="92" cy="420" r="18" fill="#8fca55" opacity="0.8" />
      </svg>

      {/* mascot on the path */}
      <div className="pointer-events-none absolute bottom-[7%] right-[10%] z-10 w-40 xl:w-48">
        <Mascot />
      </div>
    </div>
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
    <div className="flex min-h-screen w-full items-center justify-center bg-gradient-to-br from-[#eef8cf] to-[#d6ee9a] p-4 sm:p-8">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-[32px] bg-white shadow-[0_30px_80px_-20px_rgba(54,83,20,0.35)] lg:min-h-[600px] lg:grid-cols-2">
        {/* form side */}
        <div className="flex items-center justify-center px-6 py-12 sm:px-12">
          <div className="w-full max-w-[380px]">
          {/* brand mark (mobile + all) */}
          <div className="mb-9 flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-[#a3e635] to-[#65a30d] shadow-sm">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 15c2 0 2-1.6 4-1.6S9 15 11 15s2-1.6 4-1.6S17 15 19 15s2-1.6 4-1.6 4-1.6" /><circle cx="12" cy="6.5" r="2.5" fill="#fff" stroke="none" /></svg>
            </div>
            <div className="leading-tight">
              <div className="text-[15px] font-bold text-slate-900">Love Andaman</div>
              <div className="text-[11px] text-slate-400">MEMO System</div>
            </div>
          </div>

          <h1 className="text-[30px] font-extrabold tracking-tight text-slate-900">{t('login.welcome')}</h1>
          <p className="mt-2 mb-8 text-[14.5px] text-slate-500">{t('login.subtitle')}</p>

          {ok && <div className="mb-5 rounded-xl bg-emerald-50 px-3.5 py-2.5 text-[13px] text-emerald-700">{ok}</div>}

          {mode === 'login' ? (
            <form onSubmit={handleSubmit(onSubmit)}>
              <label className="mb-2 block text-[13.5px] font-semibold text-slate-700">{t('login.email')}</label>
              <input className={field} type="email" placeholder={t('login.emailPlaceholder')} {...register('email', { required: true })} />

              <label className="mb-2 mt-5 block text-[13.5px] font-semibold text-slate-700">{t('login.password')}</label>
              <div className="relative">
                <input className={field + ' pr-12'} type={showPw ? 'text' : 'password'} placeholder="••••••••" {...register('password', { required: true })} />
                <EyeBtn on={showPw} toggle={() => setShowPw((s) => !s)} />
              </div>

              <div className="mt-4 flex items-center justify-between">
                <label className="flex cursor-pointer select-none items-center gap-2 text-[13px] text-slate-600">
                  <input type="checkbox" defaultChecked className="h-4 w-4 accent-lime-600" />
                  {t('login.rememberMe')}
                </label>
                <button type="button" onClick={() => { setMode('pw'); setErr(''); setOk(''); }}
                  className="text-[13px] font-medium text-[#65a30d] hover:underline">{t('login.forgot')}</button>
              </div>

              <div className="mt-3 min-h-[18px] text-[13px] text-rose-600">{err}</div>
              <button className="w-full rounded-2xl bg-gradient-to-br from-[#a3e635] to-[#65a30d] py-3.5 font-bold text-white shadow-sm transition hover:brightness-105 active:scale-[0.99] disabled:opacity-60" disabled={isSubmitting}>
                {isSubmitting ? t('login.signingIn') : t('login.signIn')}
              </button>
              <button type="button" onClick={() => { setMode('pw'); setErr(''); setOk(''); }}
                className="mt-4 block w-full text-center text-[13px] font-medium text-slate-500 hover:text-[#65a30d] hover:underline">
                {t('login.changePassword')}
              </button>
            </form>
          ) : (
            <form onSubmit={pw.handleSubmit(onChangePw)}>
              <label className="mb-2 block text-[13.5px] font-semibold text-slate-700">{t('login.email')}</label>
              <input className={field} type="email" placeholder={t('login.emailPlaceholder')} {...pw.register('email', { required: true })} />
              <label className="mb-2 mt-5 block text-[13.5px] font-semibold text-slate-700">{t('login.currentPassword')}</label>
              <div className="relative">
                <input className={field + ' pr-12'} type={showCur ? 'text' : 'password'} {...pw.register('currentPassword', { required: true })} />
                <EyeBtn on={showCur} toggle={() => setShowCur((s) => !s)} />
              </div>
              <label className="mb-2 mt-5 block text-[13.5px] font-semibold text-slate-700">{t('login.newPassword')}</label>
              <div className="relative">
                <input className={field + ' pr-12'} type={showNew ? 'text' : 'password'} {...pw.register('newPassword', { required: true, minLength: 6 })} />
                <EyeBtn on={showNew} toggle={() => setShowNew((s) => !s)} />
              </div>
              <div className="mt-3 min-h-[18px] text-[13px] text-rose-600">{err}</div>
              <button className="w-full rounded-2xl bg-gradient-to-br from-[#a3e635] to-[#65a30d] py-3.5 font-bold text-white shadow-sm transition hover:brightness-105 active:scale-[0.99] disabled:opacity-60" disabled={pw.formState.isSubmitting}>
                {pw.formState.isSubmitting ? t('login.changing') : t('login.changeBtn')}
              </button>
              <button type="button" onClick={() => { setMode('login'); setErr(''); }}
                className="mt-4 block w-full text-center text-[13px] text-slate-500 hover:underline">{t('login.backToLogin')}</button>
            </form>
          )}
        </div>
      </div>

        {/* illustration side (desktop only) */}
        <div className="hidden p-3.5 lg:block">
          <div className="h-full w-full overflow-hidden rounded-[24px]">
            <BrandPanel />
          </div>
        </div>
      </div>
    </div>
  );
}
