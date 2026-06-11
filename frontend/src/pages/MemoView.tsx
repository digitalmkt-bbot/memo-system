import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { StatusTag, fmtDate, fmtDay, ROLE_TH } from '../ui';
import { useAuth } from '../auth';

export function MemoView() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const mid = Number(id);
  const [data, setData] = useState<any>(null);
  const [modal, setModal] = useState<'approve' | 'reject' | null>(null);
  const [comment, setComment] = useState('');

  const load = () => api.memo(mid).then(setData).catch(() => nav('/memos'));
  useEffect(() => { load(); }, [mid]);
  if (!data) return <div className="card p-6">กำลังโหลด…</div>;

  const { memo, approvals, canApprove } = data;
  const isCreator = memo.createdBy === user?.id;

  const act = async () => {
    try {
      if (modal === 'approve') await api.approveMemo(mid, comment);
      else if (modal === 'reject') { if (!comment.trim()) return alert('กรุณาระบุเหตุผล'); await api.rejectMemo(mid, comment); }
      setModal(null); setComment(''); load();
    } catch (e: any) { alert(e.message); }
  };
  const submit = async () => { await api.submitMemo(mid); load(); };

  const steps: any[] = [
    { c: '#1a9d5a', t: 'สร้างบันทึก', w: memo.creatorName, d: memo.createdAt },
    ...(memo.submittedAt ? [{ c: '#1a9d5a', t: 'ส่งเพื่ออนุมัติ', w: memo.creatorName, d: memo.submittedAt }] : []),
    ...approvals.map((a: any) => ({
      c: a.status === 'approve' ? '#1a9d5a' : '#d23c3c',
      t: `${ROLE_TH[a.approverRole] || a.approverRole} ${a.status === 'approve' ? 'อนุมัติ' : 'ไม่อนุมัติ'}`,
      w: a.approverName, d: a.approvedAt, cm: a.comment,
    })),
    ...(memo.status === 'pending_manager' ? [{ c: '#b9c4cc', t: 'รอหัวหน้าอนุมัติ', w: memo.currentApproverName, d: null }] : []),
    ...(memo.status === 'pending_executive' ? [{ c: '#b9c4cc', t: 'รอผู้บริหารอนุมัติ', w: memo.currentApproverName, d: null }] : []),
  ];

  return (
    <>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl font-bold">{memo.subject}</h2>
          <p className="text-gray-500 text-[12.5px]">{memo.memoNo || 'ฉบับร่าง'} · {memo.companyCode}/{memo.deptCode} · จาก {memo.fromName}</p>
        </div>
        <button className="btn btn-ghost !py-1.5" onClick={() => nav(-1)}>← กลับ</button>
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-5">
        <div className="card p-6">
          <div className="flex items-center gap-2">
            <StatusTag s={memo.status} />
            <span className="text-gray-400 text-xs">วันที่ {fmtDay(memo.date)}</span>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 mt-4 text-sm">
            <div><span className="text-gray-500">จาก:</span> {memo.fromName}</div>
            <div><span className="text-gray-500">แผนก:</span> {memo.deptName}</div>
            <div className="col-span-2"><span className="text-gray-500">สิ่งที่แนบ:</span> {memo.attachment || '—'}</div>
          </div>
          <div className="whitespace-pre-wrap bg-gray-50 border border-gray-200 rounded-lg p-4 mt-4 text-sm leading-7 min-h-[200px]">{memo.detail}</div>

          <div className="flex gap-2.5 mt-5 flex-wrap">
            {canApprove && <>
              <button className="btn btn-green" onClick={() => setModal('approve')}>✓ อนุมัติ</button>
              <button className="btn btn-red" onClick={() => setModal('reject')}>✕ ไม่อนุมัติ</button>
            </>}
            {isCreator && memo.status === 'draft' && <>
              <button className="btn btn-primary" onClick={submit}>ส่งเพื่ออนุมัติ</button>
              <button className="btn btn-ghost" onClick={() => nav(`/memos/edit/${mid}`)}>แก้ไข</button>
            </>}
            {memo.memoNo && <a className="btn btn-ghost" href={api.pdfUrl(mid)} target="_blank" rel="noreferrer">ดาวน์โหลด PDF</a>}
          </div>
        </div>

        <div className="card p-5 h-fit">
          <div className="font-bold text-ocean-dark text-sm mb-3">เส้นทางการอนุมัติ</div>
          {steps.map((s, i) => (
            <div key={i} className="relative pl-4 pb-3.5 border-l-2 last:border-l-transparent border-gray-200">
              <span className="absolute -left-[7px] top-0.5 w-3 h-3 rounded-full border-2 border-white" style={{ background: s.c }} />
              <div className="text-[13px] font-semibold">{s.t}</div>
              <div className="text-gray-400 text-[11.5px]">{s.w}{s.d ? ' · ' + fmtDate(s.d) : ' · รอดำเนินการ'}</div>
              {s.cm && <div className="bg-ocean-light text-ocean-dark px-2.5 py-1.5 rounded-md mt-1.5 text-[12px]">💬 {s.cm}</div>}
            </div>
          ))}
        </div>
      </div>

      {modal && (
        <div className="fixed inset-0 bg-ink/50 grid place-items-center p-5 z-50" onClick={() => setModal(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold">{modal === 'approve' ? 'ยืนยันการอนุมัติ' : 'ยืนยันการไม่อนุมัติ'}</h3>
            <p className="text-gray-500 text-[13px] mt-1">{modal === 'approve' ? 'เพิ่มความคิดเห็น (ถ้ามี)' : 'กรุณาระบุเหตุผล'}</p>
            <textarea className="input min-h-[90px] mt-2.5" value={comment} onChange={(e) => setComment(e.target.value)} />
            <div className="flex gap-2.5 justify-end mt-4">
              <button className="btn btn-ghost" onClick={() => setModal(null)}>ยกเลิก</button>
              <button className={'btn ' + (modal === 'approve' ? 'btn-green' : 'btn-red')} onClick={act}>{modal === 'approve' ? 'อนุมัติ' : 'ไม่อนุมัติ'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
