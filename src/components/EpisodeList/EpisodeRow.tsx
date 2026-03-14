import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Episode } from '../../hooks/useEpisodes';

interface EpisodeRowProps {
  episode: Episode;
  isExpanded: boolean;
  onToggle: (id: number) => void;
  /** 0–100 overall progress, null when idle and not in interrupted/error state */
  pipelineProgress: number | null;
  /** Step label e.g. 'Herunterladen...', 'Transkription...' */
  pipelineStepLabel: string | null;
  /** True while pipeline is actively running for this episode */
  pipelineActive: boolean;
  /** True when pipeline errored — turns fill red */
  pipelineError: boolean;
  /** True when showing interrupted state */
  pipelineInterrupted: boolean;
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
  pipelineProgress,
  pipelineStepLabel,
  pipelineActive,
  pipelineError,
  pipelineInterrupted,
}: EpisodeRowProps) {
  const { t } = useTranslation();

  // Fade-out state: when pipeline completes (pipelineActive flips false after 100%)
  const [isFadingOut, setIsFadingOut] = useState(false);
  const prevActiveRef = useRef(pipelineActive);
  const prevProgressRef = useRef(pipelineProgress);

  useEffect(() => {
    // Detect transition from active@100 → idle
    if (prevActiveRef.current && !pipelineActive && prevProgressRef.current === 100) {
      setIsFadingOut(true);
      const timer = setTimeout(() => setIsFadingOut(false), 400);
      prevActiveRef.current = pipelineActive;
      prevProgressRef.current = pipelineProgress;
      return () => clearTimeout(timer);
    }
    prevActiveRef.current = pipelineActive;
    prevProgressRef.current = pipelineProgress;
  }, [pipelineActive, pipelineProgress]);

  const durationLabel =
    episode.duration_minutes != null
      ? t('pages.episodes.duration_minutes', { minutes: Math.round(episode.duration_minutes) })
      : null;

  // Show interrupted state from persisted DB values even when not actively processing
  const isPersistedInterrupted =
    !pipelineActive &&
    !pipelineError &&
    !pipelineInterrupted &&
    episode.pipeline_status === 'interrupted' &&
    (episode.pipeline_progress ?? 0) > 0;

  // Determine whether to show the progress bar
  const showBar =
    pipelineActive ||
    pipelineError ||
    pipelineInterrupted ||
    isFadingOut ||
    isPersistedInterrupted;

  // Determine the fill width
  let fillWidth: number;
  if (isFadingOut) {
    fillWidth = 100;
  } else if (isPersistedInterrupted) {
    fillWidth = episode.pipeline_progress ?? 0;
  } else {
    fillWidth = pipelineProgress ?? 0;
  }

  // Determine fill CSS classes
  const fillClasses = ['episode-progress-fill'];
  if (pipelineError) fillClasses.push('error');
  if (pipelineInterrupted || isPersistedInterrupted) fillClasses.push('interrupted');

  // Bar container CSS classes
  const barClasses = ['episode-progress-bar'];
  if (isFadingOut) barClasses.push('fade-out');

  // Determine the step label to show
  let displayLabel: string | null = null;
  if (pipelineActive || pipelineError) {
    displayLabel = pipelineStepLabel;
  } else if (pipelineInterrupted || isPersistedInterrupted) {
    displayLabel = 'Unterbrochen';
  }

  // Hide StatusBadge while bar is shown
  const showStatusBadge = !showBar;

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
          {showStatusBadge && <StatusBadge status={episode.transcription_status} />}
          <span className="episode-row-chevron">{isExpanded ? '▲' : '▼'}</span>
        </div>
      </div>
      {showBar && (
        <div className={barClasses.join(' ')}>
          <div
            className={fillClasses.join(' ')}
            style={{ width: `${fillWidth}%` }}
          />
        </div>
      )}
      {showBar && displayLabel && (
        <span className="pipeline-step-label">{displayLabel}</span>
      )}
    </div>
  );
}
