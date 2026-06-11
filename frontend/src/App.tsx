import { HashRouter, Routes, Route, Navigate, NavLink } from 'react-router-dom';
import { ReactNode } from 'react';
import { useAuth } from './auth';
import { ROLE_TH } from './ui';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Memos } from './pages/Memos';
import { MemoCreate } from './pages/MemoCreate';
import { MemoEdit } from './pages/MemoEdit';
import { MemoView } from './pages/MemoView';
import { Reports } from './pages/Reports';
import { Users } from './pages/Users';
import { Settings } from './pages/Settings';

const NAV: [string, string, string?][] = [
  ['/dashboard', 'แดชบอร์ด'],
  ['/memos', 'บันทึก (MEMO)'],
  ['/memos/create', 'สร้างใหม่'],
  ['/reports', 'รายงาน'],
  ['/users', 'ผู้ใช้', 'admin'],
  ['/settings', 'ตั้งค่า'],
];

function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  return (
    <div className="grid grid-cols-[232px_1fr] min-h-screen">
      <aside className="bg-ocean-dark text-cyan-100 px-3.5 py-5 flex flex-col">
        <div className="text-white font-bold text-base px-2.5 pb-4">
          Love Island<span className="block font-normal text-[11px] text-cyan-300">MEMO System</span>
        </div>
        <nav className="flex flex-col gap-0.5">
          {NAV.filter(([, , role]) => !role || role === user?.role).map(([to, label]) => (
            <NavLink key={to} to={to} end={to === '/memos'}
              className={({ isActive }) =>
                'px-3 py-2.5 rounded-lg text-sm font-medium ' +
                (isActive ? 'bg-ocean text-white' : 'text-cyan-100 hover:bg-white/10 hover:text-white')}>
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="flex-1" />
        <div className="bg-black/20 rounded-xl p-3 text-[12.5px]">
          <div className="text-white font-semibold">{user?.name}</div>
          <div className="text-cyan-300">{ROLE_TH[user?.role || ''] || user?.role}</div>
          <button onClick={logout} className="mt-2.5 w-full border border-white/25 text-cyan-100 rounded-md py-1.5 text-xs hover:bg-white/10">
            ออกจากระบบ
          </button>
        </div>
      </aside>
      <main className="p-7 overflow-y-auto max-h-screen">{children}</main>
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
