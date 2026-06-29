import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { api } from '../api';
import { useAuth } from '../auth';
import { useI18n } from '../i18n';

const money = (n: number) => '฿' + (Number(n) || 0).toLocaleString(undefined, { maximumFractionDigits: 0 });
const num = (n: number) => (Number(n) || 0).toLocaleString();

export function Reports() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [ov, setOv] = useState<any>({ summary: {}, totalAmount: 0, byDept: [] });
  const [months, setMonths] = useState<any[]>([]);
  const [byCompany, setByCompany] = useState<any[]>([]);
  const [byDept, setByDept] = useState<any[]>([]);
  const [range, setRange] = useState('12m');
  const [companies, setCompanies] = useState<any[]>([]);
  const [companyId, setCompanyId] = useState('');
  const canFilter = user?.role === 'admin' || user?.role === 'executive';

  useEffect(() => { if (canFilter) api.companies().then(setCompanies).catch(() => {}); }, [canFilter]);
  useEffect(() => { api.overview(companyId ? { companyId } : {}).then(setOv).catch(() => {}); }, [companyId]);
  useEffect(() => { api.series(range, companyId || undefined).then(setMonths).catch(() => {}); }, [range, companyId]);
  useEffect(() => { api.byCompany().then(setByCompany).catch(() => {}); api.byDept().then(setByDept).catch(() => {}); }, []);

  const sum = ov.summary || {};
  const total = sum.total || 0;
  const approved = sum.approved || 0;
  const rejected = sum.rejected || 0;
  const pending = (sum.pending_manager || 0) + (sum.pending_hrmd || 0) + (sum.pending_fc || 0) + (sum.pending_executive || 0);
  const draft = sum.draft || 0;

  const bars = months.map((m) => ({ label: m.label, count: m.count || 0, amount: m.amount || 0 }));
  const lastIdx = bars.length - 1;
  const RANGES: [string, string][] = [['7d', 'r7d'], ['30d', 'r30d'], ['90d', 'r90d'], ['12m', 'r12m']];

  const statusData = [
    { name: t('dashboard.barApproved'), value: approved, color: '#4ade80' },
    { name: t('dashboard.barRejected'), value: rejected, color: '#ff6fb5' },
    { name: t('dashboard.kpiPending'), value: pending, color: '#fbbf24' },
    { name: t('status.draft'), value: draft, color: '#cbd5e1' },
  ].filter((s) => s.value > 0);

  const KPI = ({ label, value, color }: { label: string; value: string; color?: string }) => (
    <div className="card p-4">
      <div className="text-slate-500 text-[12px]">{label}</div>
      <div className={'text-[24px] leading-tight font-extrabold mt-1 ' + (color || 'text-ink')}>{value}</div>
    </div>
  );

  const BarList = ({ title, rows, keyName }: { title: string; rows: any[]; keyName: string }) => {
    const max = Math.max(1, ...rows.map((r) => Number(r.amount) || 0));
    return (
      <div className="card p-5">
        <div className="font-bold text-ink text-[15px] mb-4">{title}</div>
        {rows.length === 0 ? <p className="text-slate-400 text-sm">{t('common.noData')}</p> : (
          <div className="space-y-3">
            {rows.map((r, i) => (
              <div key={i}>
                <div className="flex justify-between items-baseline text-[13px] mb-1 gap-2">
                  <span className="font-medium text-ink truncate">{r[keyName] || '—'}{r.company ? <span className="text-slate-400 text-[11px]"> ({r.company})</span> : null}</span>
                  <span className="shrink-0 text-right">
                    <span className="font-semibold text-ink">{num(r.count)}</span>
                    <span className="text-slate-400 text-[11px] ml-2">{money(r.amount)}</span>
                  </span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-[#86efac] to-[#10b981]" style={{ width: Math.max(3, (Number(r.amount) || 0) / max * 100) + '%' }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <div className="mb-6 flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold">{t('reports.title')}</h2>
          <p className="text-slate-500 text-[13px] mt-0.5">{t('reports.subtitle')}</p>
        </div>
        {canFilter && (
          <select className="input !w-auto !py-2" value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
            <option value="">{t('dashboard.allCompanies')}</option>
            {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        <KPI label={t('dashboard.barTotal')} value={num(total)} />
        <KPI label={t('dashboard.barApproved')} value={num(approved)} color="text-emerald-600" />
        <KPI label={t('dashboard.barRejected')} value={num(rejected)} color="text-pink-500" />
        <KPI label={t('dashboard.kpiPending')} value={num(pending)} color="text-amber-500" />
        <KPI label={t('dashboard.kpiTotalValue')} value={money(ov.totalAmount)} />
      </div>

      <div className="grid lg:grid-cols-3 gap-6 mb-6">
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div className="font-bold text-ink text-[15px]">{t('reports.trend')}</div>
            <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
              {RANGES.map(([k, lbl]) => (
                <button key={k} onClick={() => setRange(k)}
                  className={'px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all ' + (range === k ? 'bg-surface text-ink shadow-neu-sm' : 'text-slate-400 hover:text-slate-600')}>
                  {t('dashboard.' + lbl)}
                </button>
              ))}
            </div>
          </div>
          <div className="w-full h-64">
            <ResponsiveContainer>
              <BarChart data={bars} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <CartesianGrid vertical={false} strokeDasharray="4 5" stroke="#e5e7eb" />
                <XAxis dataKey="label" fontSize={10} stroke="#94a3b8" tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={20} />
                <YAxis fontSize={10} stroke="#94a3b8" tickLine={false} axisLine={false} width={32} />
                <Tooltip cursor={{ fill: 'rgba(74,222,128,0.08)' }} contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 8px 24px rgba(17,24,39,0.12)' }} />
                <Bar dataKey="count" radius={[8, 8, 0, 0]} maxBarSize={48}>
                  {bars.map((_, i) => <Cell key={i} fill={i === lastIdx ? '#10b981' : '#86efac'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-5">
          <div className="font-bold text-ink text-[15px] mb-2">{t('reports.statusBreakdown')}</div>
          {statusData.length === 0 ? <p className="text-slate-400 text-sm">{t('common.noData')}</p> : (
            <>
              <div className="w-full h-40">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={42} outerRadius={64} paddingAngle={2}>
                      {statusData.map((s, i) => <Cell key={i} fill={s.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 8px 24px rgba(17,24,39,0.12)' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-1.5 mt-2">
                {statusData.map((s, i) => (
                  <div key={i} className="flex items-center justify-between text-[13px]">
                    <span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />{s.name}</span>
                    <span className="font-semibold text-ink">{num(s.value)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <BarList title={t('reports.byCompany')} rows={byCompany} keyName="name" />
        <BarList title={t('reports.byDept')} rows={byDept} keyName="department" />
      </div>
    </>
  );
}
