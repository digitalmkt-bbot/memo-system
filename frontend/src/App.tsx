import { HashRouter, Routes, Route, Navigate, NavLink, useNavigate } from 'react-router-dom';
import { ReactNode, useState } from 'react';
import { useAuth } from './auth';
import { useI18n } from './i18n';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Memos } from './pages/Memos';
import { MemoCreate } from './pages/MemoCreate';
import { MemoEdit } from './pages/MemoEdit';
import { MemoView } from './pages/MemoView';
import { Reports } from './pages/Reports';
import { Users } from './pages/Users';
import { Settings } from './pages/Settings';

const I = {
  dashboard: 'M3 10.5 12 3l9 7.5M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5',
  memos: 'M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1ZM14 3v5h5M9 12h7M9 16h7',
  create: 'M12 5v14M5 12h14',
  reports: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  users: 'M16 19a4 4 0 0 0-8 0M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM20 19a3 3 0 0 0-4-2.8M18 11a2.5 2.5 0 0 0 0-5',
  settings: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM19.4 13a7.8 7.8 0 0 0 0-2l1.6-1.2-2-3.4-1.9.8a7.6 7.6 0 0 0-1.7-1l-.3-2H10.9l-.3 2a7.6 7.6 0 0 0-1.7 1l-1.9-.8-2 3.4L4.6 11a7.8 7.8 0 0 0 0 2l-1.6 1.2 2 3.4 1.9-.8a7.6 7.6 0 0 0 1.7 1l.3 2h3.4l.3-2a7.6 7.6 0 0 0 1.7-1l1.9.8 2-3.4Z',
} as const;

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px] shrink-0">
      <path d={d} />
    </svg>
  );
}

const NAV_MAIN: [string, string, keyof typeof I, string?][] = [
  ['/dashboard', 'nav.dashboard', 'dashboard'],
  ['/memos', 'nav.memos', 'memos'],
  ['/memos/create', 'nav.create', 'create'],
  ['/reports', 'nav.reports', 'reports'],
];
const NAV_SUPPORT: [string, string, keyof typeof I, string?][] = [
  ['/users', 'nav.users', 'users', 'admin'],
  ['/settings', 'nav.settings', 'settings'],
];

function NavItem({ to, label, icon, end, onClick }: { to: string; label: string; icon: keyof typeof I; end?: boolean; onClick: () => void }) {
  const { t } = useI18n();
  return (
    <NavLink to={to} end={end} onClick={onClick}
      className={({ isActive }) =>
        'flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[18.5px] font-light transition-all ' +
        (isActive ? 'bg-ink text-white shadow-neu-sm' : 'text-slate-500 hover:bg-slate-100 hover:text-ink')}>
      <Icon d={I[icon]} />
      {t(label)}
    </NavLink>
  );
}

function LangToggle() {
  const { lang, setLang } = useI18n();
  return (
    <div className="flex gap-1 mb-3 bg-slate-100 rounded-xl p-1">
      {(['th', 'en'] as const).map((l) => (
        <button key={l} onClick={() => setLang(l)}
          className={'flex-1 py-1.5 rounded-lg text-[11px] font-bold uppercase transition-all ' +
            (lang === l ? 'bg-surface text-ink shadow-neu-sm' : 'text-slate-400 hover:text-slate-600')}>
          {l === 'th' ? 'ไทย' : 'EN'}
        </button>
      ))}
    </div>
  );
}

function Sidebar({ onNav }: { onNav: () => void }) {
  const { user } = useAuth();
  const { t } = useI18n();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const initial = (user?.name || 'L').trim().charAt(0).toUpperCase();
  const visibleSupport = NAV_SUPPORT.filter(([, , , role]) => !role || role === user?.role);

  return (
    <>
      <div className="flex items-center gap-3 px-1.5 pb-5">
        <div className="w-10 h-10 rounded-xl grid place-items-center text-white font-extrabold text-lg bg-gradient-to-br from-[#4ade80] to-[#22c55e]">
          {initial}
        </div>
        <div className="leading-tight">
          <div className="font-extrabold text-[17px] text-ink">{t('common.appName')}</div>
          <div className="text-[10.5px] text-slate-400 font-medium">{t('common.systemName')}</div>
        </div>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); onNav(); nav('/memos'); }} className="mb-5">
        <div className="flex items-center gap-2 bg-slate-100 rounded-xl px-3 py-2">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" /></svg>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('common.search') + '...'}
            className="bg-transparent text-sm text-ink placeholder:text-slate-400 focus:outline-none w-full" />
        </div>
      </form>

      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 px-2 mb-2">Overview</div>
      <nav className="flex flex-col gap-1">
        {NAV_MAIN.map(([to, label, icon]) => (
          <NavItem key={to} to={to} label={label} icon={icon} end={to === '/memos'} onClick={onNav} />
        ))}
      </nav>

      {visibleSupport.length > 0 && <>
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 px-2 mt-5 mb-2">Support</div>
        <nav className="flex flex-col gap-1">
          {visibleSupport.map(([to, label, icon]) => (
            <NavItem key={to} to={to} label={label} icon={icon} onClick={onNav} />
          ))}
        </nav>
      </>}

      <div className="flex-1 min-h-6" />
      <LangToggle />
      <div className="rounded-2xl p-4 text-white relative overflow-hidden" style={{ background: 'linear-gradient(155deg,#111827 0%,#1f2937 100%)' }}>
        <div className="font-bold text-[13.5px] leading-snug">{t('dashboard.promoTitle')}</div>
        <div className="text-white/65 text-[11.5px] mt-1">{t('dashboard.promoSub')}</div>
        <button onClick={() => { onNav(); nav('/memos/create'); }} className="mt-3 w-full bg-white text-ink rounded-xl py-2 text-xs font-bold hover:bg-slate-100 transition">
          {t('dashboard.promoBtn')}
        </button>
      </div>
    </>
  );
}

function Layout({ children }: { children: ReactNode }) {
  const { t, roleLabel } = useI18n();
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const initial = (user?.name || 'L').trim().charAt(0).toUpperCase();
  return (
    <div className="min-h-screen bg-[linear-gradient(150deg,#f7f4ec_0%,#f2f5f0_45%,#e9f3ee_100%)] lg:grid lg:grid-cols-[252px_1fr]">
      <header className="lg:hidden sticky top-0 z-30 flex items-center gap-3 px-4 py-3 bg-surface border-b border-slate-200">
        <button onClick={() => setOpen(true)} aria-label="menu"
          className="w-10 h-10 rounded-xl grid place-items-center bg-slate-100 text-ink">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
        <div className="font-extrabold text-base text-ink">{t('common.appName')}</div>
      </header>

      {open && <div className="lg:hidden fixed inset-0 bg-ink/40 z-40" onClick={() => setOpen(false)} />}

      <aside className={
        'bg-surface border-r border-slate-200 w-64 px-4 py-5 flex flex-col z-50 fixed inset-y-0 left-0 overflow-y-auto transition-transform duration-200 ' +
        'lg:static lg:w-auto lg:h-screen lg:translate-x-0 ' +
        (open ? 'translate-x-0 shadow-2xl' : '-translate-x-full')
      }>
        <Sidebar onNav={() => setOpen(false)} />
      </aside>

      <main className="min-w-0 p-4 sm:p-6 lg:p-7 lg:max-h-screen lg:overflow-y-auto">
        <div className="flex items-center justify-end gap-2.5 mb-5">
          <button className="w-10 h-10 rounded-full grid place-items-center bg-surface border border-slate-200 text-slate-500 hover:text-ink" aria-label="notifications">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" /></svg>
          </button>
          <div className="flex items-center gap-2.5 bg-surface border border-slate-200 rounded-full pl-1.5 pr-2.5 py-1.5">
            <div className="w-8 h-8 rounded-full grid place-items-center text-white font-bold text-[13px] bg-gradient-to-br from-[#4ade80] to-[#22c55e] shrink-0">{initial}</div>
            <div className="leading-tight hidden sm:block">
              <div className="text-ink font-semibold text-[13px] max-w-[140px] truncate">{user?.name}</div>
              <div className="text-slate-400 text-[11px]">{roleLabel(user?.role || '')}</div>
            </div>
            <button onClick={logout} title={t('common.logout')} className="ml-1 w-7 h-7 rounded-full grid place-items-center text-slate-400 hover:text-rose-500 hover:bg-rose-50">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M16 17l5-5-5-5M21 12H9M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /></svg>
            </button>
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}

function Protected({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
}

export function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
        <Route path="/memos" element={<Protected><Memos /></Protected>} />
        <Route path="/memos/create" element={<Protected><MemoCreate /></Protected>} />
        <Route path="/memos/edit/:id" element={<Protected><MemoEdit /></Protected>} />
        <Route path="/memos/view/:id" element={<Protected><MemoView /></Protected>} />
        <Route path="/reports" element={<Protected><Reports /></Protected>} />
        <Route path="/users" element={<Protected><Users /></Protected>} />
        <Route path="/settings" element={<Protected><Settings /></Protected>} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </HashRouter>
  );
}
