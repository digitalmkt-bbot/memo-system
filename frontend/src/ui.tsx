export const STATUS_TH: Record<string, string> = {
  draft: 'ฉบับร่าง', pending_manager: 'รอหัวหน้า', pending_executive: 'รอผู้บริหาร',
  approved: 'อนุมัติแล้ว', rejected: 'ไม่อนุมัติ', cancelled: 'ยกเลิก',
};
export const ROLE_TH: Record<string, string> = {
  staff: 'พนักงาน', manager: 'หัวหน้างาน', executive: 'ผู้บริหาร', admin: 'ผู้ดูแลระบบ',
};
const STATUS_CLS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  pending_manager: 'bg-amber-100 text-amber-700',
  pending_executive: 'bg-blue-100 text-blue-700',
  approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-600',
  cancelled: 'bg-gray-100 text-gray-400',
};

export function StatusTag({ s }: { s: string }) {
  return <span className={'tag ' + (STATUS_CLS[s] || 'bg-gray-100 text-gray-600')}>{STATUS_TH[s] || s}</span>;
}

export function fmtDate(s?: string) {
  return s ? new Date(s).toLocaleString('th-TH', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
}
export function fmtDay(s?: string) {
  return s ? new Date(s).toLocaleDateString('th-TH', { day: '2-digit', month: 'long', year: 'numeric' }) : '—';
}
