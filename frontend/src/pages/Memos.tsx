import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { StatusTag } from '../ui';
import { useI18n } from '../i18n';

export function Memos() {
  const nav = useNavigate();
  const { t } = useI18n();
  const [box, setBox] = useState('sent');
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const BOXES: [string, string][] = [['sent', t('memos.boxSent')], ['inbox', t('memos.boxInbox')], ['all', t('memos.boxAll')]];

  const load = () => {
    setLoading(true);
    const params: Record<string, string> = box === 'all' ? {} : { box };
    if (q) params.q = q;
    api.memos(params).then(setRows).catch(() => setRows([])).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [box]);

  return (
    <>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold">{t('memos.title')}</h2>
        <button className="btn btn-primary" onClick={() => nav('/memos/create')}>{t('memos.newMemo')}</button>
      </div>

      <div className="flex items-center gap-2 mb-4">
        {BOXES.map(([k, l]) => (
          <button key={k} onClick={() => setBox(k)}
            className={'px-4 py-2 rounded-xl text-[13px] font-semibold transition-all ' +
              (box === k ? 'text-white bg-gradient-to-br from-[#34d399] to-[#10b981] shadow-neu-sm' : 'bg-surface text-slate-500 shadow-neu-sm hover:text-ocean-dark')}>
            {l}
          </button>
        ))}
        <div className="flex-1" />
        <form onSubmit={(e) => { e.preventDefault(); load(); }} className="flex gap-2">
          <input className="input !py-1.5 w-56" placeholder={t('memos.searchPlaceholder')} value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="btn btn-ghost !py-1.5">{t('common.search')}</button>
        </form>
      </div>

      <div className="card overflow-x-auto">
        {loading ? <div className="p-10 text-center text-gray-400">{t('common.loading')}</div> :
          rows.length === 0 ? <div className="p-10 text-center text-gray-400">{t('memos.noMemos')}</div> : (
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="bg-sand text-slate-500 text-[11px] uppercase tracking-wide">
                  <th className="text-left px-4 py-3">{t('memos.colNo')}</th>
                  <th className="text-left px-4 py-3">{t('memos.colSubject')}</th>
                  <th className="text-left px-4 py-3">{t('memos.colCompanyDept')}</th>
                  <th className="text-left px-4 py-3">{t('memos.colFrom')}</th>
                  <th className="text-right px-4 py-3">{t('memos.colStatus')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((m) => (
                  <tr key={m.id} onClick={() => nav(`/memos/view/${m.id}`)}
                    className="border-t border-slate-200/70 hover:bg-ocean-light cursor-pointer">
                    <td className="px-4 py-3 text-[12px] text-gray-500 whitespace-nowrap">{m.memoNo || '—'}</td>
                    <td className="px-4 py-3 text-[13.5px]">{m.subject}</td>
                    <td className="px-4 py-3 text-[12.5px] text-gray-500">{m.companyCode}/{m.deptCode}</td>
                    <td className="px-4 py-3 text-[12.5px]">{m.fromName}</td>
                    <td className="px-4 py-3 text-right"><StatusTag s={m.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </div>
    </>
  );
}
