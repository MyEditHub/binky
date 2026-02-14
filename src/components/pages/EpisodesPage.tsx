import { useTranslation } from 'react-i18next';
import EpisodeList from '../EpisodeList/EpisodeList';

export default function EpisodesPage() {
  const { t } = useTranslation();

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">{t('pages.episodes.title')}</h2>
      </div>
      <EpisodeList />
    </div>
  );
}
