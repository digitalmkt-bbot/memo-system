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
  'border border-slate-200 focus:outline-none focus:ring-4 focus:ring-emerald-100 focus:border-emerald-400 transition';

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

/* Original brand panel — soft aurora gradient + abstract island / wave motif. */
function BrandPanel() {
  return (
    <div className="relative h-full w-full overflow-hidden bg-[#0e3b3a]">
      {/* aurora blobs */}
      <div className="absolute -top-24 -left-16 h-96 w-96 rounded-full bg-[#34d399] opacity-40 blur-3xl" />
      <div className="absolute top-1/3 -right-20 h-[26rem] w-[26rem] rounded-full bg-[#22d3ee] opacity-30 blur-3xl" />
      <div className="absolute bottom-[-6rem] left-1/4 h-80 w-80 rounded-full bg-[#a7f3d0] opacity-25 blur-3xl" />

      {/* abstract island / horizon */}
      <svg className="absolute bottom-0 left-0 w-full" viewBox="0 0 600 260" preserveAspectRatio="xMidYMax slice" xmlns="http://www.w3.org/2000/svg">
        <circle cx="470" cy="70" r="42" fill="#e9fff6" opacity="0.85" />
        <path d="M0 150 C120 110 200 150 300 140 C420 128 500 160 600 138 L600 260 L0 260 Z" fill="#0b524d" opacity="0.55" />
        <path d="M0 190 C140 160 240 200 360 186 C470 174 540 200 600 188 L600 260 L0 260 Z" fill="#083f3b" opacity="0.7" />
        <path d="M0 224 C160 204 260 232 380 222 C480 214 560 232 600 224 L600 260 L0 260 Z" fill="#062f2c" />
      </svg>

      {/* mascot */}
      <div className="pointer-events-none absolute bottom-6 right-6 z-10 w-40 xl:bottom-10 xl:right-12 xl:w-52">
        <Mascot />
      </div>

      {/* content */}
      <div className="relative z-10 flex h-full flex-col justify-between p-10 xl:p-14">
        <div className="flex items-center gap-3 text-white">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-white/15 backdrop-blur-sm">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#a7f3d0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 15c2 0 2-1.6 4-1.6S9 15 11 15s2-1.6 4-1.6S17 15 19 15s2-1.6 4-1.6" /><path d="M3 20c2 0 2-1.6 4-1.6S9 20 11 20s2-1.6 4-1.6S17 20 19 20" /><circle cx="12" cy="6" r="3" fill="#a7f3d0" stroke="none" /></svg>
          </div>
          <span className="text-[17px] font-bold tracking-wide">Love Andaman</span>
        </div>

        <div className="max-w-md text-white">
          <div className="text-[13px] font-semibold uppercase tracking-[0.25em] text-emerald-200/90">MEMO System</div>
          <h2 className="mt-3 text-[34px] xl:text-[40px] font-extrabold leading-[1.1]">ระบบบันทึกข้อความ<br />และการอนุมัติ</h2>
          <p className="mt-4 text-[15px] leading-relaxed text-white/70">สร้าง ส่ง และติดตามการอนุมัติบันทึกข้อความได้ในที่เดียว รวดเร็ว โปร่งใส ทุกขั้นตอน</p>
        </div>

        <div className="text-[12.5px] text-white/50">© {new Date().getFullYear()} Love Andaman. All rights reserved.</div>
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
    <div className="min-h-screen w-full bg-white lg:grid lg:grid-cols-[1fr_1.05fr]">
      {/* form side */}
      <div className="flex min-h-screen items-center justify-center px-6 py-10 sm:px-10">
        <div className="w-full max-w-[400px]">
          {/* brand mark (mobile + all) */}
          <div className="mb-9 flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-[#34d399] to-[#10b981] shadow-sm">
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
                  <input type="checkbox" defaultChecked className="h-4 w-4 accent-emerald-500" />
                  {t('login.rememberMe')}
                </label>
                <button type="button" onClick={() => { setMode('pw'); setErr(''); setOk(''); }}
                  className="text-[13px] font-medium text-emerald-600 hover:underline">{t('login.forgot')}</button>
              </div>

              <div className="mt-3 min-h-[18px] text-[13px] text-rose-600">{err}</div>
              <button className="w-full rounded-2xl bg-gradient-to-br from-[#34d399] to-[#10b981] py-3.5 font-bold text-white shadow-sm transition hover:brightness-105 active:scale-[0.99] disabled:opacity-60" disabled={isSubmitting}>
                {isSubmitting ? t('login.signingIn') : t('login.signIn')}
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
              <button className="w-full rounded-2xl bg-gradient-to-br from-[#34d399] to-[#10b981] py-3.5 font-bold text-white shadow-sm transition hover:brightness-105 active:scale-[0.99] disabled:opacity-60" disabled={pw.formState.isSubmitting}>
                {pw.formState.isSubmitting ? t('login.changing') : t('login.changeBtn')}
              </button>
              <button type="button" onClick={() => { setMode('login'); setErr(''); }}
                className="mt-4 block w-full text-center text-[13px] text-slate-500 hover:underline">{t('login.backToLogin')}</button>
            </form>
          )}
        </div>
      </div>

      {/* brand side (desktop only) */}
      <div className="hidden lg:block">
        <BrandPanel />
      </div>
    </div>
  );
}
