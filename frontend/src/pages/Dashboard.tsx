import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { api } from '../api';
import { useAuth } from '../auth';

const LBL: Record<string, string> = {
  inbox: 'รออนุมัติจากคุณ', approved: 'อนุมัติแล้ว', pending_manager: 'รอหัวหน้า',
  pending_executive: 'รอผู้บริหาร', rejected: 'ไม่อนุมัติ', total: 'ทั้งหมด',
};

export function Dashboard() {
  const { user } = useAuth();
  const [sum, setSum] = useState<Record<string, number>>({});
  const [monthly, setMonthly] = useState<any[]>([]);
  const [byCompany, setByCompany] = useState<any[]>([]);

  useEffect(() => {
    api.summary().then(setSum).catch(() => {});
    api.monthly().then(setMonthly).catch(() => {});
    api.byCompany().then(setByCompany).catch(() => {});
  }, []);

  const cards = ['inbox', 'approved', 'pending_manager', 'pending_executive', 'rejected', 'total'];

  return (
    <>
      <div className="mb-5">
        <h2 className="text-xl font-bold">สวัสดี, {user?.name}</h2>
        <p className="text-gray-500 text-[13px]">ภาพรวมบันทึกข้อความ</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5 mb-6">
        {cards.map((k) => (
          <div key={k} className="card p-4">
            <div className="text-2xl font-bold text-ocean-dark">{sum[k] ?? 0}</div>
            <div className="text-gray-500 text-xs mt-0.5">{LBL[k]}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="card p-5 lg:col-span-2">
          <div className="font-bold text-ocean-dark text-sm mb-3">บันทึกรายเดือน (12 เดือน)</div>
          <div className="w-full h-64">
            <ResponsiveContainer>
              <BarChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef1f3" />
                <XAxis dataKey="month" fontSize={11} />
                <YAxis allowDecimals={false} fontSize={11} />
                <Tooltip /><Legend />
                <Bar dataKey="count" name="ทั้งหมด" fill="#0a6e7c" radius={[4, 4, 0, 0]} />
                <Bar dataKey="approved" name="อนุมัติ" fill="#1a9d5a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card p-5">
          <div className="font-bold text-ocean-dark text-sm mb-3">บันทึกตามบริษัท</div>
          {byCompany.length === 0 ? <p className="text-gray-400 text-sm">ยังไม่มีข้อมูล</p> :
            byCompany.map((c) => (
              <div key={c.companyId} className="flex justify-between py-2 border-b border-dashed border-gray-200 last:border-0 text-sm">
                <span>{c.name || c.company}</span><span className="font-semibold text-ocean-dark">{c.count}</span>
              </div>
            ))}
        </div>
      </div>
    </>
  );
}
