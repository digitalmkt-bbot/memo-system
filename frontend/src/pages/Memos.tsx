import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { StatusTag } from '../ui';

const BOXES: [string, string][] = [['sent', 'ของฉัน'], ['inbox', 'รออนุมัติ'], ['all', 'ทั้งหมด']];

export function Memos() {
  const nav = useNavigate();
  const [box, setBox] = useState('sent');
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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
        <h2 className="text-xl font-bold">บันทึก (MEMO)</h2>
        <button className="btn btn-primary" onClick={() => nav('/memos/create')}>+ สร้างบันทึกใหม่</button>
      </div>

      <div className="flex items-center gap-2 mb-4">
        {BOXES.map(([k, l]) => (
          <button key={k} onClick={() => setBox(k)}
            className={'px-3.5 py-1.5 rounded-lg text-[13px] font-semibold border ' +
              (box === k ? 'bg-ocean text-white border-ocean' : 'bg-white text-gray-500 border-gray-200')}>
            {l}
          </button>
        ))}
        <div className="flex-1" />
        <form onSubmit={(e) => { e.preventDefault(); load(); }} className="flex gap-2">
          <input className="input !py-1.5 w-56" placeholder="ค้นหา เลขที่/เรื่อง…" value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="btn btn-ghost !py-1.5">ค้นหา</button>
        </form>
      </div>

      <div className="card overflow-hidden">
        {loading ? <div className="p-10 text-center text-gray-400">กำลังโหลด…</div> :
          rows.length === 0 ? <div className="p-10 text-center text-gray-400">ยังไม่มีบันทึก</div> : (
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-[11px] uppercase tracking-wide">
                  <th className="text-left px-4 py-3">เลขที่</th>
                  <th className="text-left px-4 py-3">เรื่อง</th>
                  <th className="text-left px-4 py-3">บริษัท/แผนก</th>
                  <th className="text-left px-4 py-3">จาก</th>
                  <th className="text-right px-4 py-3">สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((m) => (
                  <tr key={m.id} onClick={() => nav(`/memos/view/${m.id}`)}
                    className="border-t border-gray-100 hover:bg-ocean-light cursor-pointer">
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
