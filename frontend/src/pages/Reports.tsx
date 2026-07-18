import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { api } from '../api';
import { StatusTag, fmtDate } from '../ui';
import { useAuth } from '../auth';
import { useI18n } from '../i18n';

const money = (n: number) => '฿' + (Number(n) || 0).toLocaleString(undefined, { maximumFractionDigits: 0 });
const num = (n: number) => (Number(n) || 0).toLocaleString();

export function Reports() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const nav = useNavigate();
  const [ov, setOv] = useState<any>({ summary: {}, totalAmount: 0, byDept: [] });
  const [months, setMonths] = useState<any[]>([]);
  const [byCompany, setByCompany] = useState<any[]>([]);
  const [byDept, setByDept] = useState<any[]>([]);
  const [range, setRange] = useState('12m');
  const [companies, setCompanies] = useState<any[]>([]);
  const [companyId, setCompanyId] = useState('');
  const canFilter = user?.role === 'admin' || user?.role === 'executive';

  // history-by-department (admin/executive only)
  const [depts, setDepts] = useState<any[]>([]);
  const [deptId, setDeptId] = useState('');
  const [status, setStatus] = useState('');
  const [histMemos, setHistMemos] = useState<any[]>([]);
  const [histLoading, setHistLoading] = useState(false);
  useEffect(() => { if (canFilter) api.departments(companyId ? Number(companyId) : undefined).then(setDepts).catch(() => setDepts([])); }, [canFilter, companyId]);
  useEffect(() => {
    if (!canFilter) return;
    setHistLoading(true);
    const params: Record<string, string> = {};
    if (companyId) params.companyId = companyId;
    if (deptId) params.departmentId = deptId;
    if (status) params.status = status;
    api.memos(params).then(setHistMemos).catch(() => setHistMemos([])).finally(() => setHistLoading(false));
  }, [canFilter, companyId, deptId, status]);

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

  const ChartBars = ({ title, rows, keyName, color }: { title: string; rows: any[]; keyName: string; color: string }) => {
    const data = rows.map((r) => ({ name: (r[keyName] || '—') + (r.company ? ` (${r.company})` : ''), amount: Number(r.amount) || 0, count: Number(r.count) || 0 }));
    const h = Math.max(180, data.length * 40 + 20);
    const trunc = (s: string) => (s.length > 22 ? s.slice(0, 21) + '…' : s);
    return (
      <div className="card p-5">
        <div className="font-bold text-ink text-[15px] mb-3">{title}</div>
        {data.length === 0 ? <p className="text-slate-400 text-sm">{t('common.noData')}</p> : (
          <div className="w-full" style={{ height: h }}>
            <ResponsiveContainer>
              <BarChart layout="vertical" data={data} margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
                <CartesianGrid horizontal={false} strokeDasharray="4 5" stroke="#eef1f3" />
                <XAxis type="number" fontSize={10} stroke="#94a3b8" tickLine={false} axisLine={false} tickFormatter={(v) => (v >= 1000 ? (v / 1000) + 'K' : String(v))} />
                <YAxis type="category" dataKey="name" width={140} fontSize={11} stroke="#64748b" tickLine={false} axisLine={false} tickFormatter={trunc} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 8px 24px rgba(17,24,39,0.12)' }}
                  formatter={(v: any, _n: any, p: any) => [money(v) + `  ·  ${num(p.payload.count)} ` + t('memos.title'), '']}
                  labelFormatter={(l) => l} />
                <Bar dataKey="amount" radius={[0, 8, 8, 0]} maxBarSize={26} fill={color} />
              </BarChart>
            </ResponsiveContainer>
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
        <ChartBars title={t('reports.byCompany')} rows={byCompany} keyName="name" color="#10b981" />
        <ChartBars title={t('reports.byDept')} rows={byDept} keyName="department" color="#7c9cf5" />
      </div>

      {canFilter && (
        <div className="card p-5 mt-6">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div className="font-bold text-ink text-[15px]">📁 {lang === 'th' ? 'บันทึกย้อนหลังรายแผนก' : 'Memo history by department'}</div>
            <div className="flex gap-2 flex-wrap">
              <select className="input !w-auto !py-1.5 text-[13px]" value={deptId} onChange={(e) => setDeptId(e.target.value)}>
                <option value="">{lang === 'th' ? 'ทุกแผนก' : 'All departments'}</option>
                {depts.map((d) => <option key={d.id} value={d.id}>{d.code} — {d.name}</option>)}
              </select>
              <select className="input !w-auto !py-1.5 text-[13px]" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">{lang === 'th' ? 'ทุกสถานะ' : 'All statuses'}</option>
                <option value="draft">{lang === 'th' ? 'ฉบับร่าง' : 'Draft'}</option>
                <option value="pending_manager">{lang === 'th' ? 'รออนุมัติขั้นแรก' : 'Awaiting first'}</option>
                <option value="pending_hrmd">{lang === 'th' ? 'รอ HRM/MD' : 'Awaiting HRM/MD'}</option>
                <option value="approved">{lang === 'th' ? 'อนุมัติแล้ว' : 'Approved'}</option>
                <option value="rejected">{lang === 'th' ? 'ไม่อนุมัติ' : 'Rejected'}</option>
              </select>
            </div>
          </div>
          <div className="overflow-x-auto">
            {histLoading ? <div className="py-8 text-center text-slate-400">{t('common.loading')}</div> :
              histMemos.length === 0 ? <div className="py-8 text-center text-slate-400">{t('memos.noMemos')}</div> : (
                <table className="w-full text-[13px] min-w-[720px]">
                  <thead><tr className="bg-sand text-slate-500 text-[11px] uppercase tracking-wide">
                    <th className="text-left px-3 py-2">{t('memos.colNo')}</th>
                    <th className="text-left px-3 py-2">{t('memos.colSubject')}</th>
                    <th className="text-left px-3 py-2">{t('memos.colCompanyDept')}</th>
                    <th className="text-left px-3 py-2">{t('memos.colFrom')}</th>
                    <th className="text-right px-3 py-2">{lang === 'th' ? 'จำนวนเงิน' : 'Amount'}</th>
                    <th className="text-left px-3 py-2">{lang === 'th' ? 'วันที่' : 'Date'}</th>
                    <th className="text-right px-3 py-2">{t('memos.colStatus')}</th>
                  </tr></thead>
                  <tbody>
                    {histMemos.map((m) => (
                      <tr key={m.id} onClick={() => nav(`/memos/view/${m.id}`)} className="border-t border-slate-200/70 hover:bg-ocean-light cursor-pointer">
                        <td className="px-3 py-2 text-[12px] text-gray-500 whitespace-nowrap">{m.memoNo || '—'}</td>
                        <td className="px-3 py-2">
                          {m.backdated && (
                            <span
                              title={lang === 'th' ? 'เอกสารขออนุมัติย้อนหลัง' : 'Backdated request'}
                              className="inline-block mr-1.5 align-middle text-rose-600"
                            >🚩</span>
                          )}
                          {m.subject}
                        </td>
                        <td className="px-3 py-2 text-[12px] text-gray-500">{m.companyCode}/{m.deptCode}</td>
                        <td className="px-3 py-2 text-[12.5px]">{m.fromName}</td>
                        <td className="px-3 py-2 text-right font-semibold text-ocean-dark whitespace-nowrap">฿{(Number(m.grandTotal ?? m.totalAmount) || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                        <td className="px-3 py-2 text-[12px] text-gray-500 whitespace-nowrap">{fmtDate(m.createdAt, lang)}</td>
                        <td className="px-3 py-2 text-right"><StatusTag s={m.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
          </div>
          <div className="text-[12px] text-slate-400 mt-2">{lang === 'th' ? `พบ ${histMemos.length} รายการ` : `${histMemos.length} memos`}</div>
        </div>
      )}
    </>
  );
}
