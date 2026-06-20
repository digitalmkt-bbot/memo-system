import { useEffect, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
  PieChart, Pie, Cell, BarChart, Bar,
} from 'recharts';
import { api } from '../api';
import { useAuth } from '../auth';
import { useI18n } from '../i18n';
import { StatusTag } from '../ui';

const STAT: Record<string, { color: string; tint: string; d: string }> = {
  inbox:             { color: '#10b981', tint: '#d1fae5', d: 'M4 13h4l2 3h4l2-3h4M4 13l2-7h12l2 7M4 13v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5' },
  approved:          { color: '#10b981', tint: '#d8f6ec', d: 'M20 6 9 17l-5-5' },
  pending_manager:   { color: '#f59e0b', tint: '#fdeccf', d: 'M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z' },
  pending_executive: { color: '#3b82f6', tint: '#d8e7fd', d: 'M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z' },
  pending_hrmd:      { color: '#14b8a6', tint: '#ccfbf1', d: 'M16 19a4 4 0 0 0-8 0M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z' },
  pending_fc:        { color: '#06b6d4', tint: '#cffafe', d: 'M3 7h18v10H3zM12 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z' },
  rejected:          { color: '#ef4444', tint: '#fbdcdc', d: 'M18 6 6 18M6 6l12 12' },
  total:             { color: '#14b8a6', tint: '#d1fae5', d: 'M4 7l8-4 8 4-8 4-8-4ZM4 12l8 4 8-4M4 17l8 4 8-4' },
};
const PIE_COLORS = ['#10b981', '#22b8cf', '#10b981', '#f59e0b', '#ef4444', '#14b8a6', '#3b82f6', '#ec4899'];
const RANGES: [string, string][] = [['7d', 'r7d'], ['30d', 'r30d'], ['90d', 'r90d'], ['12m', 'r12m']];
const STATUSES = ['draft', 'pending_manager', 'pending_executive', 'approved', 'rejected', 'cancelled'];
const money = (n: number) => (Number(n) || 0).toLocaleString(undefined, { maximumFractionDigits: 0 });

function Badge({ k }: { k: string }) {
  const s = STAT[k];
  if (!s) return null;
  return (
    <div className="w-11 h-11 rounded-xl grid place-items-center shadow-neu-sm" style={{ background: s.tint }}>
      <svg viewBox="0 0 24 24" fill="none" stroke={s.color} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d={s.d} /></svg>
    </div>
  );
}

export function Dashboard() {
  const { user } = useAuth();
  const { t, statusLabel } = useI18n();
  const [ov, setOv] = useState<any>({ summary: {}, totalAmount: 0, byDept: [], recent: [] });
  const [series, setSeries] = useState<any[]>([]);
  const [range, setRange] = useState('30d');
  // filter (draft) + applied
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [status, setStatus] = useState('all');
  const [applied, setApplied] = useState<{ from?: string; to?: string; status?: string }>({});

  useEffect(() => {
    const params: Record<string, string> = {};
    if (applied.from) params.from = applied.from;
    if (applied.to) params.to = applied.to;
    if (applied.status && applied.status !== 'all') params.status = applied.status;
    api.overview(params).then(setOv).catch(() => {});
  }, [applied]);
  useEffect(() => { api.series(range).then(setSeries).catch(() => {}); }, [range]);

  const doFilter = () => setApplied({ from, to, status });
  const doClear = () => { setFrom(''); setTo(''); setStatus('all'); setApplied({}); };

  const sum = ov.summary || {};
  const cards = ['inbox', 'pending_manager', 'pending_hrmd', 'pending_fc', 'approved', 'rejected'];
  const pieData = (ov.byDept || []).map((d: any) => ({ name: d.department || '—', value: Number(d.count) || 0 }));
  const pieTotal = pieData.reduce((a: number, b: any) => a + b.value, 0);
  const topDept = (ov.byDept || []).filter((d: any) => Number(d.amount) > 0).slice(0, 6)
    .map((d: any) => ({ name: d.department, amount: Number(d.amount) || 0 }));

  return (
    <>
      <div className="mb-5">
        <h2 className="text-2xl">{t('dashboard.hello')}, {user?.name}</h2>
        <p className="text-slate-500 text-[13px] mt-0.5">{t('dashboard.overview')}</p>
      </div>

      {/* filter bar */}
      <div className="card p-3.5 mb-5 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 mb-1">{t('dashboard.fFrom')}</label>
          <input type="date" className="input !py-2 w-44" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 mb-1">{t('dashboard.fTo')}</label>
          <input type="date" className="input !py-2 w-44" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 mb-1">{t('memos.colStatus')}</label>
          <select className="input !py-2 w-48" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">{t('dashboard.fAll')}</option>
            {STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
          </select>
        </div>
        <button className="btn btn-primary !py-2" onClick={doFilter}>{t('dashboard.fFilter')}</button>
        <button className="btn btn-ghost !py-2" onClick={doClear}>{t('dashboard.fClear')}</button>
      </div>

      {/* total value */}
      <div className="card p-5 mb-5 flex items-center justify-between bg-gradient-to-br from-[#ecfdf5] to-[#f0fdf4]">
        <div>
          <div className="text-slate-500 text-[13px]">{t('dashboard.totalValue')}</div>
          <div className="text-3xl font-extrabold text-ocean-dark mt-1">฿{money(ov.totalAmount)}</div>
        </div>
        <div className="w-14 h-14 rounded-2xl grid place-items-center text-white text-2xl font-extrabold bg-gradient-to-br from-[#34d399] to-[#10b981] shadow-neu-sm">฿</div>
      </div>

      {/* status cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        {cards.map((k) => (
          <div key={k} className="card p-4">
            <Badge k={k} />
            <div className="text-2xl font-extrabold text-ink mt-3">{sum[k] ?? 0}</div>
            <div className="text-slate-500 text-xs mt-0.5">{t('dashboard.' + k)}</div>
          </div>
        ))}
      </div>

      {/* trend + donut */}
      <div className="grid lg:grid-cols-3 gap-5 mb-5">
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div className="font-bold text-ocean-dark text-sm">{t('dashboard.monthlyTitle')}</div>
            <div className="flex gap-1 bg-sand rounded-xl p-1 shadow-neu-inset">
              {RANGES.map(([k, lbl]) => (
                <button key={k} onClick={() => setRange(k)}
                  className={'px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all ' + (range === k ? 'bg-surface text-ocean-dark shadow-neu-sm' : 'text-slate-400 hover:text-slate-600')}>
                  {t('dashboard.' + lbl)}
                </button>
              ))}
            </div>
          </div>
          <div className="w-full h-60">
            <ResponsiveContainer>
              <LineChart data={series} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                <defs><linearGradient id="lineTotal" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#10b981" /><stop offset="100%" stopColor="#10b981" /></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#d9deea" vertical={false} />
                <XAxis dataKey="label" fontSize={10} stroke="#94a3b8" tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={24} />
                <YAxis allowDecimals={false} fontSize={11} stroke="#94a3b8" tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 8px 24px rgba(45,50,69,0.15)' }} />
                <Legend />
                <Line type="monotone" dataKey="count" name={t('dashboard.barTotal')} stroke="url(#lineTotal)" strokeWidth={3} dot={false} activeDot={{ r: 5 }} />
                <Line type="monotone" dataKey="approved" name={t('dashboard.barApproved')} stroke="#ec4899" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-5">
          <div className="font-bold text-ocean-dark text-sm mb-3">{t('dashboard.byDeptTitle')}</div>
          {pieData.length === 0 ? <p className="text-slate-400 text-sm">{t('common.noData')}</p> : (
            <>
              <div className="w-full h-40">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={44} outerRadius={64} paddingAngle={2} stroke="none">
                      {pieData.map((_: any, i: number) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 8px 24px rgba(45,50,69,0.15)' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 max-h-36 overflow-y-auto">
                {pieData.map((d: any, i: number) => (
                  <div key={i} className="flex items-center justify-between py-1 text-[12.5px]">
                    <span className="flex items-center gap-2 truncate"><span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />{d.name}</span>
                    <span className="font-semibold text-ocean-dark shrink-0">{pieTotal ? Math.round((d.value / pieTotal) * 100) : 0}%</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* top dept by value + recent */}
      <div className="grid lg:grid-cols-2 gap-5">
        <div className="card p-5">
          <div className="font-bold text-ocean-dark text-sm mb-3">{t('dashboard.topDeptValue')}</div>
          {topDept.length === 0 ? <p className="text-slate-400 text-sm">{t('common.noData')}</p> : (
            <div className="w-full" style={{ height: topDept.length * 46 + 20 }}>
              <ResponsiveContainer>
                <BarChart data={topDept} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e6ef" horizontal={false} />
                  <XAxis type="number" fontSize={10} stroke="#94a3b8" tickLine={false} axisLine={false} tickFormatter={(v) => money(v)} />
                  <YAxis type="category" dataKey="name" width={150} fontSize={11} stroke="#64748b" tickLine={false} axisLine={false} />
                  <Tooltip formatter={(v: any) => '฿' + money(v)} contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 8px 24px rgba(45,50,69,0.15)' }} />
                  <Bar dataKey="amount" fill="#10b981" radius={[0, 6, 6, 0]} barSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="card p-5">
          <div className="font-bold text-ocean-dark text-sm mb-3">{t('dashboard.recent')}</div>
          {(ov.recent || []).length === 0 ? <p className="text-slate-400 text-sm">{t('common.noData')}</p> : (
            <div className="overflow-x-auto"><table className="w-full text-[13px] min-w-[460px]">
              <thead>
                <tr className="text-slate-500 text-[11px] uppercase tracking-wide">
                  <th className="text-left font-semibold py-2">{t('memos.colNo')}</th>
                  <th className="text-left font-semibold py-2">{t('memos.colSubject')}</th>
                  <th className="text-right font-semibold py-2">{t('dashboard.colValue')}</th>
                  <th className="text-right font-semibold py-2">{t('memos.colStatus')}</th>
                </tr>
              </thead>
              <tbody>
                {ov.recent.map((m: any) => (
                  <tr key={m.id} className="border-t border-slate-200/70">
                    <td className="py-2 text-[12px] text-slate-500 whitespace-nowrap">{m.memoNo || '—'}</td>
                    <td className="py-2 pr-2"><div className="truncate max-w-[180px]">{m.subject}</div><div className="text-slate-400 text-[11px]">{m.deptCode}</div></td>
                    <td className="py-2 text-right whitespace-nowrap">฿{money(m.amount)}</td>
                    <td className="py-2 text-right"><StatusTag s={m.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          )}
        </div>
      </div>
    </>
  );
}
