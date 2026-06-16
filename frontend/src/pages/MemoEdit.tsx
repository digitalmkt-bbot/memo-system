import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api';
import { MemoForm } from './MemoForm';
import { useI18n } from '../i18n';

export function MemoEdit() {
  const { id } = useParams();
  const { t } = useI18n();
  const mid = Number(id);
  const [data, setData] = useState<any>(null);

  useEffect(() => { api.memo(mid).then((d) => setData(d)); }, [mid]);
  if (!data) return <div className="card p-6">{t('common.loading')}</div>;

  return (
    <>
      <div className="mb-5"><h2 className="text-xl font-bold">{t('edit.title')}</h2></div>
      <MemoForm memoId={mid} status={data.memo.status} initial={{
        companyId: data.memo.companyId, departmentId: data.memo.departmentId,
        fromName: data.memo.fromName, subject: data.memo.subject,
        attachment: data.memo.attachment || '', detail: data.memo.detail,
        items: data.memo.items || [], vat: !!data.memo.vat,
      }} />
    </>
  );
}
