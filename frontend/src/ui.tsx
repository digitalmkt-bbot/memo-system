import { useI18n, getStoredLang, Lang } from './i18n';

const STATUS_CLS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  pending_manager: 'bg-amber-100 text-amber-700',
  pending_executive: 'bg-blue-100 text-blue-700',
  pending_hrmd: 'bg-indigo-100 text-indigo-700',
  pending_fc: 'bg-cyan-100 text-cyan-700',
  approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-600',
  cancelled: 'bg-gray-100 text-gray-400',
};

export function StatusTag({ s }: { s: string }) {
  const { statusLabel } = useI18n();
  return <span className={'tag ' + (STATUS_CLS[s] || 'bg-gray-100 text-gray-600')}>{statusLabel(s)}</span>;
}

function locale(l: Lang) { return l === 'th' ? 'th-TH' : 'en-GB'; }

export function fmtDate(s?: string, lang?: Lang) {
  const lc = locale(lang || getStoredLang());
  return s ? new Date(s).toLocaleString(lc, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
}
export function fmtDay(s?: string, lang?: Lang) {
  const lc = locale(lang || getStoredLang());
  return s ? new Date(s).toLocaleDateString(lc, { day: '2-digit', month: 'long', year: 'numeric' }) : '—';
}
