import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
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

  // diverging satisfaction — last 3 monthly buckets (Optivue ref shows 3 rows)
  const div = months.slice(-3);
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
            <div>
              <div className="text-ink font-semibold text-[16px]">{t('dashboard.kpiTotalValue')}</div>
              <div className="text-slate-400 text-[12px] mt-1">{t('dashboard.approvalRate')} · {fill(t('dashboard.ofTotalMemos'), total)}</div>
            </div>
            <span className="text-slate-300">•••</span>
          </div>
          <div className="flex items-center gap-2.5 mt-4 flex-wrap">
            <div className="text-[40px] leading-none font-extrabold text-ink">{money(ov.totalAmount)}</div>
            <Chip up>{approvalRate}%</Chip>
            <span className="rounded-full bg-emerald-100 text-emerald-700 text-[12px] font-semibold px-2.5 py-1">{num(approved)} {t('dashboard.barApproved')}</span>
          </div>
        </div>

        {/* In progress */}
        <div className="card p-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-ink font-semibold text-[16px]">{t('dashboard.kpiPending')}</div>
              <div className="text-slate-400 text-[12px] mt-1">{fill(t('dashboard.ofTotalMemos'), total)}</div>
            </div>
            <span className="text-slate-300">•••</span>
          </div>
          <div className="flex items-center gap-2.5 mt-4 flex-wrap">
            <div className="text-[40px] leading-none font-extrabold text-ink">{num(pending)}</div>
            <Chip up={false}>{pendingRate}%</Chip>
            <span className="rounded-full bg-rose-100 text-rose-600 text-[12px] font-semibold px-2.5 py-1">{num(rejected)} {t('dashboard.barRejected')}</span>
          </div>
        </div>

        {/* Satisfaction (diverging) */}
        <div className="card p-6 lg:row-span-2 flex flex-col">
          <div className="flex items-center justify-between mb-1">
            <div className="font-bold text-ink text-[18px]">{t('dashboard.satisfTitle')}</div>
            <span className="text-[12px] text-slate-500 bg-slate-100 rounded-full px-3 py-1">Monthly</span>
          </div>
          <div className="flex items-center gap-4 text-[12px] mb-4">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#4ade80]" />{t('dashboard.barApproved')}</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#ff6fb5]" />{t('dashboard.barRejected')}</span>
          </div>
          <div className="relative flex-1 flex flex-col justify-around py-2">
            {/* vertical dashed gridlines (9 ticks, like Ref) */}
            <div className="absolute inset-0 flex justify-between pointer-events-none">
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className="w-px border-l border-dashed border-slate-200/80" />
              ))}
            </div>
            {div.length === 0 ? <p className="text-slate-400 text-sm">{t('common.noData')}</p> : div.map((m, i) => (
              <div key={i} className="relative">
                <div className="text-[11px] text-slate-400 mb-1.5">{m.label}</div>
                <div className="flex items-center">
                  <div className="flex-1 flex justify-end">
                    <div className="h-8 rounded-l-full bg-gradient-to-l from-[#4ade80] to-[#a7f3d0]" style={{ width: ((m.approved || 0) / divMax * 100) + '%' }} />
                  </div>
                  <div className="w-px h-9 bg-slate-300" />
                  <div className="flex-1">
                    <div className="h-8 rounded-r-full bg-gradient-to-r from-[#f24d92] to-[#f9c2da]" style={{ width: ((m.rejected || 0) / divMax * 100) + '%' }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
          {div.length > 0 && (
            <div className="flex justify-between text-[10px] text-slate-400 mt-3 pt-3 border-t border-slate-100">
              {[1, 0.75, 0.5, 0.25, 0, 0.25, 0.5, 0.75, 1].map((f, i) => (
                <span key={i}>{Math.round(divMax * f)}</span>
              ))}
            </div>
          )}
        </div>

        {/* Status overview (period style) */}
        <div className="card p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-100 grid place-items-center text-slate-500">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
                </svg>
              </div>
              <div>
                <div className="text-slate-500 text-[12px]">{t('dashboard.statusOverview')}</div>
                <div className="font-bold text-ink text-[15px]">{fill(t('dashboard.ofTotalMemos'), total).replace('of ', '').replace('จาก ', '')}</div>
              </div>
            </div>
            <span className="text-[12px] text-slate-500 bg-slate-100 rounded-full px-3 py-1">Monthly</span>
          </div>
          {/* numbers row */}
          <div className="flex items-end">
            <div className="flex-[3]">
              <div className="text-slate-500 text-[12px]">{t('dashboard.barTotal')}</div>
              <div className="text-[28px] leading-tight font-extrabold text-ink mt-0.5">{num(total)}</div>
            </div>
            <div className="w-px mx-3" />
            <div className="flex-1">
              <div className="text-slate-500 text-[12px]">{t('dashboard.barApproved')}</div>
              <div className="text-[28px] leading-tight font-extrabold text-ink mt-0.5">{num(approved)}</div>
            </div>
            <div className="w-px mx-3" />
            <div className="flex-1">
              <div className="text-slate-500 text-[12px]">{t('dashboard.barRejected')}</div>
              <div className="text-[28px] leading-tight font-extrabold text-ink mt-0.5">{num(rejected)}</div>
            </div>
          </div>
          {/* bar row with thin vertical dividers (like Ref) */}
          <div className="flex items-center mt-3">
            <div className="flex-[3] h-5 rounded-full bg-gradient-to-r from-[#ededed] to-[#1a1a1a]" />
            <div className="w-px h-6 bg-slate-200 mx-3" />
            <div className="flex-1 h-5 rounded-full bg-gradient-to-r from-[#eafff3] to-[#4ade80]" />
            <div className="w-px h-6 bg-slate-200 mx-3" />
            <div className="flex-1 h-5 rounded-full bg-gradient-to-r from-[#fff0f7] to-[#ff6fb5]" />
          </div>
        </div>

        {/* Sales analytics (bar) */}
        <div className="card p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
            <div>
              <div className="font-bold text-ink text-[18px]">{t('dashboard.monthlyTitle')}</div>
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
          <div className="w-full h-56 mt-4">
            <svg width="0" height="0" className="absolute">
              <defs>
                <pattern id="memoStripes" patternUnits="userSpaceOnUse" width="11" height="11" patternTransform="rotate(45)">
                  <rect width="11" height="11" fill="#dcfce7" />
                  <line x1="0" y1="0" x2="0" y2="11" stroke="#86efac" strokeWidth="6" />
                </pattern>
              </defs>
            </svg>
            <ResponsiveContainer>
              <BarChart data={bars} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <CartesianGrid vertical={false} strokeDasharray="4 5" stroke="#e5e7eb" />
                <XAxis dataKey="label" fontSize={10} stroke="#94a3b8" tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={20} />
                <YAxis fontSize={10} stroke="#94a3b8" tickLine={false} axisLine={false} width={38}
                  tickFormatter={(v) => (v >= 1000 ? (v / 1000) + 'K' : String(v))} />
                <Tooltip cursor={{ fill: 'rgba(74,222,128,0.08)' }} contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 8px 24px rgba(17,24,39,0.12)' }} />
                <Bar dataKey="count" radius={[14, 14, 14, 14]} maxBarSize={64}>
                  {bars.map((_, i) => <Cell key={i} fill={i === lastIdx ? 'url(#memoStripes)' : '#86efac'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Smart insights */}
        <div className="card p-0 overflow-hidden lg:col-span-1 relative text-white"
          style={{ background: 'linear-gradient(150deg,#22c55e 0%,#4ade80 45%,#7c3aed 100%)' }}>
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
