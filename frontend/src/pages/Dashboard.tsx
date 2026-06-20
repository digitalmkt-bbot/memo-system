import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { api } from '../api';
import { useAuth } from '../auth';
import { useI18n } from '../i18n';

const money = (n: number) => '฿' + (Number(n) || 0).toLocaleString(undefined, { maximumFractionDigits: 0 });
const num = (n: number) => (Number(n) || 0).toLocaleString();
const fill = (n: string, v: any) => n.replace('{n}', String(v));

function Chip({ up, children }: { up: boolean; children: any }) {
  return (
    <span className={'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-semibold ' + (up ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-600')}>
      <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d={up ? 'M4 17l6-6 4 4 6-6M20 9V5h-4' : 'M4 7l6 6 4-4 6 6M20 15v4h-4'} />
      </svg>
      {children}
    </span>
  );
}

export function Dashboard() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [ov, setOv] = useState<any>({ summary: {}, totalAmount: 0 });
  const [months, setMonths] = useState<any[]>([]);
  const [range, setRange] = useState('12m');

  useEffect(() => { api.overview({}).then(setOv).catch(() => {}); }, []);
  useEffect(() => { api.series(range).then(setMonths).catch(() => {}); }, [range]);

  const sum = ov.summary || {};
  const total = sum.total || 0;
  const approved = sum.approved || 0;
  const rejected = sum.rejected || 0;
  const pending = (sum.pending_manager || 0) + (sum.pending_hrmd || 0) + (sum.pending_fc || 0) + (sum.pending_executive || 0);
  const processed = approved + rejected;
  const approvalRate = processed ? Math.round((approved / processed) * 100) : 0;
  const pendingRate = total ? Math.round((pending / total) * 100) : 0;

  // diverging satisfaction — last 5 monthly buckets
  const div = months.slice(-5);
  const divMax = Math.max(1, ...div.map((m) => Math.max(m.approved || 0, m.rejected || 0)));

  // bar chart — monthly counts, highlight last
  const bars = months.map((m) => ({ label: m.label, count: m.count || 0 }));
  const lastIdx = bars.length - 1;

  const RANGES: [string, string][] = [['7d', 'r7d'], ['30d', 'r30d'], ['90d', 'r90d'], ['12m', 'r12m']];

  return (
    <>
      <div className="mb-6">
        <h2 className="text-3xl">{t('dashboard.hello')}, {user?.name}</h2>
        <p className="text-slate-500 text-sm mt-1">{t('dashboard.overview')}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr_1.25fr] lg:auto-rows-min lg:grid-flow-row-dense">
        {/* Total value */}
        <div className="card p-6">
          <div className="flex items-start justify-between">
            <div className="text-slate-500 text-[13px]">{t('dashboard.kpiTotalValue')}</div>
            <span className="text-slate-300">•••</span>
          </div>
          <div className="flex items-end gap-3 mt-3 flex-wrap">
            <div className="text-[40px] leading-none font-extrabold text-ink">{money(ov.totalAmount)}</div>
            <Chip up>{approvalRate}%</Chip>
          </div>
          <div className="text-slate-400 text-[12px] mt-2">{t('dashboard.approvalRate')} · {fill(t('dashboard.ofTotalMemos'), total)}</div>
        </div>

        {/* In progress */}
        <div className="card p-6">
          <div className="flex items-start justify-between">
            <div className="text-slate-500 text-[13px]">{t('dashboard.kpiPending')}</div>
            <span className="text-slate-300">•••</span>
          </div>
          <div className="flex items-end gap-3 mt-3 flex-wrap">
            <div className="text-[40px] leading-none font-extrabold text-ink">{num(pending)}</div>
            <Chip up={false}>{pendingRate}%</Chip>
          </div>
          <div className="text-slate-400 text-[12px] mt-2">{fill(t('dashboard.ofTotalMemos'), total)}</div>
        </div>

        {/* Satisfaction (diverging) */}
        <div className="card p-6 lg:row-span-2">
          <div className="flex items-center justify-between mb-1">
            <div className="font-bold text-ink text-[15px]">{t('dashboard.satisfTitle')}</div>
            <span className="text-[12px] text-slate-500 bg-slate-100 rounded-full px-3 py-1">Monthly</span>
          </div>
          <div className="flex items-center gap-4 text-[12px] mb-4">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />{t('dashboard.barApproved')}</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-pink-400" />{t('dashboard.barRejected')}</span>
          </div>
          <div className="space-y-6">
            {div.length === 0 ? <p className="text-slate-400 text-sm">{t('common.noData')}</p> : div.map((m, i) => (
              <div key={i}>
                <div className="text-[11px] text-slate-400 mb-1.5">{m.label}</div>
                <div className="flex items-center">
                  <div className="flex-1 flex justify-end">
                    <div className="h-4 rounded-l-full bg-gradient-to-l from-emerald-400 to-emerald-200" style={{ width: ((m.approved || 0) / divMax * 100) + '%' }} />
                  </div>
                  <div className="w-px h-5 bg-slate-300" />
                  <div className="flex-1">
                    <div className="h-4 rounded-r-full bg-gradient-to-r from-pink-400 to-pink-200" style={{ width: ((m.rejected || 0) / divMax * 100) + '%' }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Status overview (period style) */}
        <div className="card p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-slate-500 text-[12px]">{t('dashboard.statusOverview')}</div>
              <div className="font-bold text-ink text-[15px]">{fill(t('dashboard.ofTotalMemos'), total).replace('of ', '').replace('จาก ', '')}</div>
            </div>
          </div>
          <div className="grid sm:grid-cols-3 gap-5">
            {[
              { label: t('dashboard.barTotal'), val: total, grad: 'from-slate-700 to-slate-900', w: 100 },
              { label: t('dashboard.barApproved'), val: approved, grad: 'from-emerald-200 to-emerald-500', w: total ? approved / total * 100 : 0 },
              { label: t('dashboard.barRejected'), val: rejected, grad: 'from-pink-200 to-pink-500', w: total ? rejected / total * 100 : 0 },
            ].map((c, i) => (
              <div key={i}>
                <div className="text-slate-500 text-[12px]">{c.label}</div>
                <div className="text-[28px] leading-tight font-extrabold text-ink mt-0.5">{num(c.val)}</div>
                <div className="h-2.5 rounded-full bg-slate-100 mt-3 overflow-hidden">
                  <div className={'h-full rounded-full bg-gradient-to-r ' + c.grad} style={{ width: Math.max(4, c.w) + '%' }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sales analytics (bar) */}
        <div className="card p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
            <div>
              <div className="font-bold text-ink text-[15px]">{t('dashboard.monthlyTitle')}</div>
              <div className="text-slate-500 text-[12px]">{t('dashboard.overview')}</div>
            </div>
            <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
              {RANGES.map(([k, lbl]) => (
                <button key={k} onClick={() => setRange(k)}
                  className={'px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all ' + (range === k ? 'bg-surface text-ink shadow-neu-sm' : 'text-slate-400 hover:text-slate-600')}>
                  {t('dashboard.' + lbl)}
                </button>
              ))}
            </div>
          </div>
          <div className="w-full h-72 mt-4">
            <ResponsiveContainer>
              <BarChart data={bars} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <XAxis dataKey="label" fontSize={10} stroke="#94a3b8" tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={20} />
                <Tooltip cursor={{ fill: 'rgba(16,185,129,0.06)' }} contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 8px 24px rgba(17,24,39,0.12)' }} />
                <Bar dataKey="count" radius={[12, 12, 0, 0]} maxBarSize={64}>
                  {bars.map((_, i) => <Cell key={i} fill={i === lastIdx ? '#10b981' : '#a7f3d0'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Smart insights */}
        <div className="card p-0 overflow-hidden lg:col-span-1 relative text-white"
          style={{ background: 'linear-gradient(150deg,#0f766e 0%,#10b981 45%,#7c3aed 100%)' }}>
          <div className="p-6 h-full flex flex-col">
            <div className="flex gap-2 flex-wrap">
              <span className="text-[11px] font-semibold bg-white/15 backdrop-blur rounded-full px-2.5 py-1">⚡ {t('dashboard.badgeAccuracy')}</span>
              <span className="text-[11px] font-semibold bg-white/15 backdrop-blur rounded-full px-2.5 py-1">↗ {fill(t('dashboard.badgeExpected'), approved)}</span>
            </div>
            <div className="flex-1" />
            <div className="text-2xl font-extrabold mt-8">{t('dashboard.insightsTitle')}</div>
            <p className="text-white/85 text-[13px] mt-1.5">{fill(t('dashboard.insightLine'), approvalRate)}</p>
          </div>
        </div>
      </div>
    </>
  );
}
