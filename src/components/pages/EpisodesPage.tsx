import { useTranslation } from 'react-i18next';

export default function EpisodesPage() {
  const { t } = useTranslation();

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">{t('pages.episodes.title')}</h2>
      </div>
      <div className="empty-state">
        <div className="empty-state-icon">🎙️</div>
        <div className="empty-state-title">{t('pages.episodes.empty')}</div>
        <div className="empty-state-hint">{t('pages.episodes.empty_hint')}</div>
      </div>
    </div>
  );
}
