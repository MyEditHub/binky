import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Episode } from '../../hooks/useEpisodes';

interface EpisodeExpandedViewProps {
  episode: Episode;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

export default function EpisodeExpandedView({ episode }: EpisodeExpandedViewProps) {
  const { t } = useTranslation();
  const [showFull, setShowFull] = useState(false);

  const hasDescription = !!episode.description?.trim();
  const descriptionText = hasDescription
    ? episode.description!
    : t('pages.episodes.no_description');

  const isDone = episode.transcription_status === 'done';

  const durationLabel = episode.duration_minutes != null
    ? t('pages.episodes.duration_minutes', { minutes: Math.round(episode.duration_minutes) })
    : null;

  return (
    <div
      className="episode-expanded"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Episode metadata */}
      <div className="episode-meta">
        {episode.publish_date && (
          <span>{formatDate(episode.publish_date)}</span>
        )}
        {durationLabel && <span>{durationLabel}</span>}
        {episode.episode_number != null && (
          <span>{t('pages.episodes.episode_label', { number: episode.episode_number })}</span>
        )}
      </div>

      {/* Description with truncation toggle */}
      <div className={`episode-description${showFull ? ' episode-description-full' : ''}`}>
        {descriptionText}
      </div>
      {hasDescription && (
        <button
          className="episode-toggle-btn"
          onClick={(e) => {
            e.stopPropagation();
            setShowFull((prev) => !prev);
          }}
        >
          {showFull ? t('pages.episodes.show_less') : t('pages.episodes.show_more')}
        </button>
      )}

      {/* Action buttons */}
      <div className="episode-actions">
        <button
          className="episode-action-btn episode-action-primary"
          disabled
          title={t('pages.episodes.model_needed')}
        >
          {t('pages.episodes.transcribe_btn')}
        </button>
        <button
          className="episode-action-btn episode-action-secondary"
          disabled={!isDone}
          title={!isDone ? t('pages.episodes.model_needed') : undefined}
        >
          {t('pages.episodes.view_transcript_btn')}
        </button>
      </div>
    </div>
  );
}
