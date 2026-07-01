import { useForm } from 'react-hook-form';
import { Navigate, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../auth';
import { useI18n } from '../i18n';
import { api } from '../api';

type Form = { email: string; password: string };
type PwForm = { email: string; currentPassword: string; newPassword: string };

const field =
  'w-full border-0 border-b-2 border-slate-200 bg-transparent px-1 py-2.5 text-[15px] text-slate-800 ' +
  'placeholder:text-slate-400 focus:outline-none focus:border-slate-900 transition-colors';

const loCss = `
@keyframes loGradient{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}
@keyframes loRise{from{opacity:0;transform:translateY(26px) scale(.98)}to{opacity:1;transform:none}}
@keyframes loSlide{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
@keyframes loBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-9px)}}
.lo-rise{animation:loRise .7s cubic-bezier(.22,1,.36,1) both}
.lo-bob{animation:loBob 4.5s ease-in-out infinite}
.lo-form>*{opacity:0;animation:loSlide .5s ease forwards}
.lo-form>*:nth-child(1){animation-delay:.14s}
.lo-form>*:nth-child(2){animation-delay:.20s}
.lo-form>*:nth-child(3){animation-delay:.26s}
.lo-form>*:nth-child(4){animation-delay:.32s}
.lo-form>*:nth-child(5){animation-delay:.38s}
.lo-form>*:nth-child(6){animation-delay:.44s}
.lo-form>*:nth-child(7){animation-delay:.50s}
.lo-form>*:nth-child(8){animation-delay:.56s}
.lo-form>*:nth-child(9){animation-delay:.62s}
@keyframes loWiggle{0%,100%{transform:translateY(0) rotate(0deg)}50%{transform:translateY(-6px) rotate(2deg)}}
.lo-wig{transform-box:fill-box;transform-origin:center bottom;animation:loWiggle 3.4s ease-in-out infinite}
.lo-wig.d2{animation-duration:4.2s;animation-delay:.3s}
.lo-wig.d3{animation-duration:3s;animation-delay:.15s}
@media (prefers-reduced-motion:reduce){.lo-rise,.lo-bob,.lo-wig,.lo-form>*{animation:none!important;opacity:1!important}}
`;

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

/* Original playful characters — friendly flat blob creatures (our own design). */
function BrandPanel() {
  return (
    <div className="relative h-full w-full overflow-hidden bg-[#eef0f2]">
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 480 560" preserveAspectRatio="xMidYMax slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <ellipse cx="240" cy="560" rx="270" ry="72" fill="#e3e6ec" />

        {/* tall periwinkle character (back) */}
        <g className="lo-wig d2">
          <path d="M170 545 L170 305 a80 80 0 0 1 160 0 L330 545 Z" fill="#9aa7e6" />
          <circle cx="250" cy="300" r="42" fill="#fff" />
          <circle cx="262" cy="308" r="21" fill="#2b2b2b" />
          <circle cx="314" cy="330" r="16" fill="#fff" />
          <circle cx="320" cy="335" r="8" fill="#2b2b2b" />
          <ellipse cx="250" cy="372" rx="13" ry="9" fill="#5b64a8" />
        </g>

        {/* teal fluffy character (left) */}
        <g className="lo-wig">
          <rect x="96" y="470" width="13" height="82" rx="6" fill="#7fc9c2" />
          <rect x="126" y="470" width="13" height="82" rx="6" fill="#7fc9c2" />
          <g fill="#7fc9c2">
            <circle cx="118" cy="432" r="52" />
            <circle cx="78" cy="442" r="34" />
            <circle cx="158" cy="442" r="34" />
            <circle cx="100" cy="402" r="30" />
            <circle cx="140" cy="404" r="30" />
          </g>
          <circle cx="104" cy="430" r="20" fill="#fff" /><circle cx="110" cy="435" r="10" fill="#2b2b2b" />
          <circle cx="140" cy="430" r="20" fill="#fff" /><circle cx="146" cy="435" r="10" fill="#2b2b2b" />
          <rect x="110" y="460" width="26" height="10" rx="5" fill="#3f7d78" />
        </g>

        {/* amber round character (front) */}
        <g className="lo-wig d3">
          <rect x="228" y="486" width="14" height="76" rx="7" fill="#f2b64a" />
          <rect x="262" y="486" width="14" height="76" rx="7" fill="#f2b64a" />
          <circle cx="252" cy="440" r="72" fill="#f2b64a" />
          <circle cx="234" cy="428" r="22" fill="#fff" /><circle cx="240" cy="433" r="11" fill="#2b2b2b" />
          <circle cx="272" cy="428" r="22" fill="#fff" /><circle cx="278" cy="433" r="11" fill="#2b2b2b" />
          <ellipse cx="253" cy="470" rx="15" ry="18" fill="#b9791f" />
          <rect x="245" y="456" width="6" height="9" fill="#fff" /><rect x="255" y="456" width="6" height="9" fill="#fff" />
        </g>
      </svg>
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
    <div className="flex min-h-screen w-full items-center justify-center p-4 sm:p-8"
      style={{ background: 'linear-gradient(120deg,#eef0f2,#e6e9ee,#f1f2f4,#e8ebf0)', backgroundSize: '300% 300%', animation: 'loGradient 20s ease infinite' }}>
      <style>{loCss}</style>
      <div className="lo-rise grid w-full max-w-5xl overflow-hidden rounded-[32px] bg-white shadow-[0_30px_80px_-20px_rgba(54,83,20,0.35)] lg:min-h-[600px] lg:grid-cols-2">
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
            <form onSubmit={handleSubmit(onSubmit)} className="lo-form">
              <label className="mb-2 block text-[13.5px] font-semibold text-slate-700">{t('login.email')}</label>
              <input className={field} type="email" placeholder={t('login.emailPlaceholder')} {...register('email', { required: true })} />

              <label className="mb-2 mt-5 block text-[13.5px] font-semibold text-slate-700">{t('login.password')}</label>
              <div className="relative">
                <input className={field + ' pr-12'} type={showPw ? 'text' : 'password'} placeholder="••••••••" {...register('password', { required: true })} />
                <EyeBtn on={showPw} toggle={() => setShowPw((s) => !s)} />
              </div>

              <div className="mt-4 flex items-center justify-between">
                <label className="flex cursor-pointer select-none items-center gap-2 text-[13px] text-slate-600">
                  <input type="checkbox" defaultChecked className="h-4 w-4 accent-slate-900" />
                  {t('login.rememberMe')}
                </label>
                <button type="button" onClick={() => { setMode('pw'); setErr(''); setOk(''); }}
                  className="text-[13px] font-medium text-slate-400 hover:text-slate-700 hover:underline">{t('login.forgot')}</button>
              </div>

              <div className="mt-3 min-h-[18px] text-[13px] text-rose-600">{err}</div>
              <button className="w-full rounded-2xl bg-slate-900 py-3.5 font-bold text-white shadow-sm transition hover:bg-slate-800 hover:-translate-y-0.5 active:scale-[0.99] disabled:opacity-60" disabled={isSubmitting}>
                {isSubmitting ? t('login.signingIn') : t('login.signIn')}
              </button>
              <button type="button" onClick={() => { setMode('pw'); setErr(''); setOk(''); }}
                className="mt-4 block w-full text-center text-[13px] font-medium text-slate-500 hover:text-[#65a30d] hover:underline">
                {t('login.changePassword')}
              </button>
            </form>
          ) : (
            <form onSubmit={pw.handleSubmit(onChangePw)} className="lo-form">
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
              <button className="w-full rounded-2xl bg-slate-900 py-3.5 font-bold text-white shadow-sm transition hover:bg-slate-800 hover:-translate-y-0.5 active:scale-[0.99] disabled:opacity-60" disabled={pw.formState.isSubmitting}>
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
