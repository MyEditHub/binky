import { useTranslation } from 'react-i18next';

export default function BirdPage() {
  const { t } = useTranslation();

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">{t('pages.bird.title')}</h2>
      </div>
      <div className="coming-soon">
        <div className="coming-soon-title">🦜</div>
        <div className="coming-soon-message">{t('pages.bird.coming_soon')}</div>
      </div>
    </div>
  );
}
