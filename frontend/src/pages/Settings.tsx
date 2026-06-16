import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { useI18n } from '../i18n';

export function Settings() {
  const { user } = useAuth();
  const { t, roleLabel } = useI18n();
  const [companies, setCompanies] = useState<any[]>([]);

  useEffect(() => { api.companies().then(setCompanies).catch(() => {}); }, []);

  return (
    <>
      <div className="mb-5"><h2 className="text-xl font-bold">{t('settings.title')}</h2></div>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="card p-5">
          <div className="font-bold text-ocean-dark text-sm mb-3">{t('settings.myAccount')}</div>
          <div className="flex justify-between py-2 border-b border-dashed border-gray-200 text-sm"><span className="text-gray-500">{t('settings.name')}</span><span>{user?.name}</span></div>
          <div className="flex justify-between py-2 border-b border-dashed border-gray-200 text-sm"><span className="text-gray-500">{t('settings.role')}</span><span>{roleLabel(user?.role || '')}</span></div>
          <div className="flex justify-between py-2 text-sm"><span className="text-gray-500">{t('settings.company')}</span><span>{companies.find((c) => c.id === user?.companyId)?.name || '—'}</span></div>
        </div>
        <div className="card p-5">
          <div className="font-bold text-ocean-dark text-sm mb-3">{t('settings.companiesInSystem')}</div>
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
