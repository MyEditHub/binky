import { useTranslation } from 'react-i18next';
import EpisodeList from '../EpisodeList/EpisodeList';

interface EpisodesPageProps {
  onTranscriptionStateChange?: (isProcessing: boolean, queueCount: number) => void;
}

export default function EpisodesPage({ onTranscriptionStateChange }: EpisodesPageProps) {
  const { t } = useTranslation();

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">{t('pages.episodes.title')}</h2>
      </div>
      <EpisodeList onTranscriptionStateChange={onTranscriptionStateChange} />
    </div>
  );
}
