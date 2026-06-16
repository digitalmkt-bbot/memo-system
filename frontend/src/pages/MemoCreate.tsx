import { MemoForm } from './MemoForm';
import { useI18n } from '../i18n';

export function MemoCreate() {
  const { t } = useI18n();
  return (
    <>
      <div className="mb-5"><h2 className="text-xl font-bold">{t('create.title')}</h2>
        <p className="text-gray-500 text-[13px]">{t('create.subtitle')}</p></div>
      <MemoForm />
    </>
  );
}
