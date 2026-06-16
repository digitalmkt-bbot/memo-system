import { useEffect, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
  PieChart, Pie, Cell,
} from 'recharts';
import { api } from '../api';
import { useAuth } from '../auth';
import { useI18n } from '../i18n';

const STAT: Record<string, { color: string; tint: string; d: string }> = {
  inbox:             { color: '#7c6cf5', tint: '#ece9fd', d: 'M4 13h4l2 3h4l2-3h4M4 13l2-7h12l2 7M4 13v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5' },
  approved:          { color: '#10b981', tint: '#d8f6ec', d: 'M20 6 9 17l-5-5' },
  pending_manager:   { color: '#f59e0b', tint: '#fdeccf', d: 'M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z' },
  pending_executive: { color: '#3b82f6', tint: '#d8e7fd', d: 'M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z' },
  rejected:          { color: '#ef4444', tint: '#fbdcdc', d: 'M18 6 6 18M6 6l12 12' },
  total:             { color: '#8b5cf6', tint: '#ebe5fd', d: 'M4 7l8-4 8 4-8 4-8-4ZM4 12l8 4 8-4M4 17l8 4 8-4' },
};
const PIE_COLORS = ['#7c6cf5', '#22b8cf', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#3b82f6'];
const RANGES: [string, string][] = [['7d', 'r7d'], ['30d', 'r30d'], ['90d', 'r90d'], ['12m', 'r12m']];

function Badge({ k }: { k: string }) {
  const s = STAT[k];
  if (!s) return null;
  return (
    <div className="w-11 h-11 rounded-xl grid place-items-center shadow-neu-sm" style={{ background: s.tint }}>
      <svg viewBox="0 0 24 24" fill="none" stroke={s.color} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <path d={s.d} />
      </svg>
    </div>
  );
}

export function Dashboard() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [sum, setSum] = useState<Record<string, number>>({});
  const [series, setSeries] = useState<any[]>([]);
  const [range, setRange] = useState('30d');
  const [byCompany, setByCompany] = useState<any[]>([]);

  useEffect(() => {
    api.summary().then(setSum).catch(() => {});
    api.byCompany().then(setByCompany).catch(() => {});
  }, []);
  useEffect(() => { api.series(range).then(setSeries).catch(() => {}); }, [range]);

  const cards = ['inbox', 'approved', 'pending_manager', 'pending_executive', 'rejected', 'total'];
  const pieData = byCompany.map((c) => ({ name: c.name || c.company || '—', value: Number(c.count) || 0 }));
  const pieTotal = pieData.reduce((a, b) => a + b.value, 0);

  return (
    <>
      <div className="mb-6">
        <h2 className="text-2xl">{t('dashboard.hello')}, {user?.name}</h2>
        <p className="text-slate-500 text-[13px] mt-0.5">{t('dashboard.overview')}</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        {cards.map((k) => (
          <div key={k} className="card p-4">
            <Badge k={k} />
            <div className="text-2xl font-extrabold text-ink mt-3">{sum[k] ?? 0}</div>
            <div className="text-slate-500 text-xs mt-0.5">{t('dashboard.' + k)}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div className="font-bold text-ocean-dark text-sm">{t('dashboard.monthlyTitle')}</div>
            <div className="flex gap-1 bg-sand rounded-xl p-1 shadow-neu-inset">
              {RANGES.map(([k, lbl]) => (
                <button key={k} onClick={() => setRange(k)}
                  className={'px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all ' +
                    (range === k ? 'bg-surface text-ocean-dark shadow-neu-sm' : 'text-slate-400 hover:text-slate-600')}>
                  {t('dashboard.' + lbl)}
                </button>
              ))}
            </div>
          </div>
          <div className="w-full h-64">
            <ResponsiveContainer>
              <LineChart data={series} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                <defs>
                  <linearGradient id="lineTotal" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#9a7df3" /><stop offset="100%" stopColor="#6354e6" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#d9deea" vertical={false} />
                <XAxis dataKey="label" fontSize={10} stroke="#94a3b8" tickLine={false} axisLine={false}
                  interval="preserveStartEnd" minTickGap={24} />
                <YAxis allowDecimals={false} fontSize={11} stroke="#94a3b8" tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 8px 24px rgba(45,50,69,0.15)' }} />
                <Legend />
                <Line type="monotone" dataKey="count" name={t('dashboard.barTotal')} stroke="url(#lineTotal)" strokeWidth={3} dot={false} activeDot={{ r: 5 }} />
                <Line type="monotone" dataKey="approved" name={t('dashboard.barApproved')} stroke="#10b981" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-5">
          <div className="font-bold text-ocean-dark text-sm mb-3">{t('dashboard.byCompanyTitle')}</div>
          {pieData.length === 0 ? <p className="text-slate-400 text-sm">{t('common.noData')}</p> : (
            <>
              <div className="w-full h-44">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={48} outerRadius={70} paddingAngle={2} stroke="none">
                      {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 8px 24px rgba(45,50,69,0.15)' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2">
                {pieData.map((d, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5 text-[13px]">
                    <span className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      {d.name}
                    </span>
                    <span className="font-semibold text-ocean-dark">{pieTotal ? Math.round((d.value / pieTotal) * 100) : 0}%</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
