import { useEffect, useState } from 'react';
import { api } from '../api';
import { useI18n } from '../i18n';

export function Reports() {
  const { t } = useI18n();
  const [byCompany, setByCompany] = useState<any[]>([]);
  const [byDept, setByDept] = useState<any[]>([]);
  const [monthly, setMonthly] = useState<any[]>([]);

  useEffect(() => {
    api.byCompany().then(setByCompany).catch(() => {});
    api.byDept().then(setByDept).catch(() => {});
    api.monthly().then(setMonthly).catch(() => {});
  }, []);

  const Table = ({ title, rows, keyName }: { title: string; rows: any[]; keyName: string }) => (
    <div className="card p-5">
      <div className="font-bold text-ocean-dark text-sm mb-3">{title}</div>
      {rows.length === 0 ? <p className="text-gray-400 text-sm">{t('common.noData')}</p> :
        rows.map((r, i) => (
          <div key={i} className="flex justify-between py-2 border-b border-dashed border-gray-200 last:border-0 text-sm">
            <span>{r[keyName] || '—'}{r.company ? <span className="text-gray-400 text-xs"> ({r.company})</span> : null}</span>
            <span className="font-semibold text-ocean-dark">{r.count ?? r.month}</span>
          </div>
        ))}
    </div>
  );

  return (
    <>
      <div className="mb-5"><h2 className="text-xl font-bold">{t('reports.title')}</h2>
        <p className="text-gray-500 text-[13px]">{t('reports.subtitle')}</p></div>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Table title={t('reports.byCompany')} rows={byCompany} keyName="name" />
        <Table title={t('reports.byDept')} rows={byDept} keyName="department" />
        <Table title={t('reports.monthly')} rows={monthly.map((m) => ({ department: m.month, count: m.count }))} keyName="department" />
      </div>
    </>
  );
}
