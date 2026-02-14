import { useTranslation } from 'react-i18next';
import { Episode } from '../../hooks/useEpisodes';

interface EpisodeRowProps {
  episode: Episode;
  isExpanded: boolean;
  onToggle: (id: number) => void;
  /** Progress value 0–100 if this episode is actively being transcribed, otherwise null */
  transcriptionProgress: number | null;
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

function StatusBadge({ status }: { status: Episode['transcription_status'] }) {
  const { t } = useTranslation();

  if (status === 'not_started') return null;

  const labelKey = `pages.episodes.status_${status}` as const;
  const label = t(labelKey);

  const classMap: Record<string, string> = {
    queued: 'episode-badge episode-badge-queued',
    downloading: 'episode-badge episode-badge-downloading',
    transcribing: 'episode-badge episode-badge-transcribing',
    done: 'episode-badge episode-badge-done',
    error: 'episode-badge episode-badge-error',
  };

  const extraLabel = status === 'done' ? '✓ ' : '';

  return (
    <span className={classMap[status] ?? 'episode-badge'}>
      {extraLabel}{label}
    </span>
  );
}

export default function EpisodeRow({
  episode,
  isExpanded,
  onToggle,
  transcriptionProgress,
}: EpisodeRowProps) {
  const { t } = useTranslation();

  const durationLabel =
    episode.duration_minutes != null
      ? t('pages.episodes.duration_minutes', { minutes: Math.round(episode.duration_minutes) })
      : null;

  // Show the progress bar whenever the parent hook says this episode is active —
  // don't gate on episode.transcription_status from DB, which lags behind the
  // real-time Rust updates and would never be 'downloading'|'transcribing' during
  // the early phases of progress reporting.
  const showProgress = transcriptionProgress !== null;

  return (
    <div
      className={`episode-row${isExpanded ? ' episode-row-expanded' : ''}`}
      onClick={() => onToggle(episode.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onToggle(episode.id)}
      aria-expanded={isExpanded}
    >
      <div className="episode-row-main">
        <div className="episode-row-left">
          <div className="episode-row-title">{episode.title}</div>
          <div className="episode-row-subtitle">
            <span className="episode-row-podcast">
              {episode.podcast_name ?? 'Nettgefluster'}
            </span>
            {episode.publish_date && (
              <span className="episode-row-date">{formatDate(episode.publish_date)}</span>
            )}
            {durationLabel && (
              <span className="episode-row-duration">{durationLabel}</span>
            )}
          </div>
        </div>
        <div className="episode-row-right">
          <StatusBadge status={episode.transcription_status} />
          <span className="episode-row-chevron">{isExpanded ? '▲' : '▼'}</span>
        </div>
      </div>
      {showProgress && (
        <div className="episode-progress-bar">
          <div
            className="episode-progress-fill"
            style={{ width: `${transcriptionProgress ?? 0}%` }}
          />
        </div>
      )}
    </div>
  );
}
