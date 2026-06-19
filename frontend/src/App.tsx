import { HashRouter, Routes, Route, Navigate, NavLink } from 'react-router-dom';
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

const NAV: [string, string, keyof typeof I, string?][] = [
  ['/dashboard', 'nav.dashboard', 'dashboard'],
  ['/memos', 'nav.memos', 'memos'],
  ['/memos/create', 'nav.create', 'create'],
  ['/reports', 'nav.reports', 'reports'],
  ['/users', 'nav.users', 'users', 'admin'],
  ['/settings', 'nav.settings', 'settings'],
];

function LangToggle() {
  const { lang, setLang } = useI18n();
  return (
    <div className="flex gap-1.5 mb-3 bg-sand rounded-xl p-1.5 shadow-neu-inset">
      {(['th', 'en'] as const).map((l) => (
        <button key={l} onClick={() => setLang(l)}
          className={'flex-1 py-1.5 rounded-lg text-[11px] font-bold uppercase transition-all ' +
            (lang === l ? 'bg-surface text-ocean-dark shadow-neu-sm' : 'text-slate-400 hover:text-slate-600')}>
          {l === 'th' ? 'ไทย' : 'EN'}
        </button>
      ))}
    </div>
  );
}

function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const { t, roleLabel } = useI18n();
  const [open, setOpen] = useState(false);
  const initial = (user?.name || 'L').trim().charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-sand lg:grid lg:grid-cols-[248px_1fr]">
      {/* mobile top bar */}
      <header className="lg:hidden sticky top-0 z-30 flex items-center gap-3 px-4 py-3 bg-sand/95 backdrop-blur">
        <button onClick={() => setOpen(true)} aria-label="menu"
          className="w-10 h-10 rounded-xl grid place-items-center bg-surface shadow-neu-sm text-ocean-dark">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
        <div className="font-extrabold text-base bg-gradient-to-r from-[#6d5ef0] to-[#9a7df3] bg-clip-text text-transparent">{t('common.appName')}</div>
      </header>

      {/* backdrop (mobile) */}
      {open && <div className="lg:hidden fixed inset-0 bg-ink/40 z-40" onClick={() => setOpen(false)} />}

      {/* sidebar — drawer on mobile, static on lg */}
      <aside className={
        'bg-sand w-64 px-4 py-5 flex flex-col z-50 fixed inset-y-0 left-0 overflow-y-auto transition-transform duration-200 ' +
        'lg:static lg:w-auto lg:h-screen lg:translate-x-0 ' +
        (open ? 'translate-x-0 shadow-2xl' : '-translate-x-full')
      }>
        <div className="flex items-center gap-3 px-1.5 pb-6">
          <div className="w-11 h-11 rounded-2xl grid place-items-center text-white font-extrabold text-lg bg-gradient-to-br from-[#8273f7] to-[#6354e6] shadow-neu-sm">
            {initial}
          </div>
          <div className="leading-tight">
            <div className="font-extrabold text-base bg-gradient-to-r from-[#6d5ef0] to-[#9a7df3] bg-clip-text text-transparent">
              {t('common.appName')}
            </div>
            <div className="text-[10.5px] text-slate-400 font-medium">{t('common.systemName')}</div>
          </div>
        </div>

        <nav className="flex flex-col gap-1.5">
          {NAV.filter(([, , , role]) => !role || role === user?.role).map(([to, label, icon]) => (
            <NavLink key={to} to={to} end={to === '/memos'} onClick={() => setOpen(false)}
              className={({ isActive }) =>
                'flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ' +
                (isActive
                  ? 'bg-surface text-ocean-dark shadow-neu-sm'
                  : 'text-slate-500 hover:text-ocean-dark')}>
              <Icon d={I[icon]} />
              {t(label)}
            </NavLink>
          ))}
        </nav>

        <div className="flex-1 min-h-6" />
        <LangToggle />
        <div className="bg-surface rounded-2xl p-3.5 shadow-neu">
          <div className="text-ink font-bold text-sm truncate">{user?.name}</div>
          <div className="text-ocean-dark text-[12px] font-medium">{roleLabel(user?.role || '')}</div>
          <button onClick={logout} className="btn btn-primary w-full mt-3 !py-2 text-xs">
            {t('common.logout')}
          </button>
        </div>
      </aside>

      <main className="min-w-0 p-4 sm:p-6 lg:p-7 lg:max-h-screen lg:overflow-y-auto">{children}</main>
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
