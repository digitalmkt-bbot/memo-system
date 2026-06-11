import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { ROLE_TH } from '../ui';

export function Settings() {
  const { user } = useAuth();
  const [companies, setCompanies] = useState<any[]>([]);

  useEffect(() => { api.companies().then(setCompanies).catch(() => {}); }, []);

  return (
    <>
      <div className="mb-5"><h2 className="text-xl font-bold">ตั้งค่า (Settings)</h2></div>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="card p-5">
          <div className="font-bold text-ocean-dark text-sm mb-3">บัญชีของฉัน</div>
          <div className="flex justify-between py-2 border-b border-dashed border-gray-200 text-sm"><span className="text-gray-500">ชื่อ</span><span>{user?.name}</span></div>
          <div className="flex justify-between py-2 border-b border-dashed border-gray-200 text-sm"><span className="text-gray-500">บทบาท</span><span>{ROLE_TH[user?.role || ''] || user?.role}</span></div>
          <div className="flex justify-between py-2 text-sm"><span className="text-gray-500">บริษัท</span><span>{companies.find((c) => c.id === user?.companyId)?.name || '—'}</span></div>
        </div>
        <div className="card p-5">
          <div className="font-bold text-ocean-dark text-sm mb-3">บริษัทในระบบ</div>
          {companies.map((c) => (
            <div key={c.id} className="flex justify-between py-2 border-b border-dashed border-gray-200 last:border-0 text-sm">
              <span>{c.name}</span><span className="text-gray-400 text-xs">{c.code}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
