import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Episode } from '../../hooks/useEpisodes';

interface EpisodeExpandedViewProps {
  episode: Episode;
  onTranscribe: () => void;
  onCancel: () => void;
  onViewTranscript?: (episodeId: number, episodeTitle: string) => void;
  isTranscribing: boolean;
  modelDownloaded: boolean;
  /** True when a different episode is currently being transcribed. Disables the transcribe button. */
  anotherIsActive: boolean;
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

export default function EpisodeExpandedView({
  episode,
  onTranscribe,
  onCancel,
  onViewTranscript,
  isTranscribing,
  modelDownloaded,
  anotherIsActive,
}: EpisodeExpandedViewProps) {
  const { t } = useTranslation();
  const [showFull, setShowFull] = useState(false);

  const hasDescription = !!episode.description?.trim();
  const descriptionText = hasDescription
    ? episode.description!
    : t('pages.episodes.no_description');

  const status = episode.transcription_status;
  const isDone = status === 'done';
  const isQueued = status === 'queued';
  const isActive = status === 'downloading' || status === 'transcribing';
  const isError = status === 'error';
  const hasNoModel = !modelDownloaded;

  const durationLabel =
    episode.duration_minutes != null
      ? t('pages.episodes.duration_minutes', { minutes: Math.round(episode.duration_minutes) })
      : null;

  // Render the appropriate action button depending on state
  function renderTranscribeAction() {
    if (isDone) {
      // No transcribe button when done — only "view transcript"
      return null;
    }

    if (isActive || isTranscribing) {
      // Show cancel button while downloading or transcribing
      return (
        <button
          className="episode-action-btn episode-action-cancel"
          onClick={(e) => {
            e.stopPropagation();
            onCancel();
          }}
        >
          {t('pages.episodes.transcription_cancel')}
        </button>
      );
    }

    if (isQueued) {
      // Queued — waiting to process
      return (
        <button
          className="episode-action-btn episode-action-primary"
          disabled
        >
          <span className="spinner episode-btn-spinner" />
          {t('pages.episodes.transcription_queued')}
        </button>
      );
    }

    // not_started or error — show transcribe button
    const disabledByOther = anotherIsActive;
    const isDisabled = hasNoModel || disabledByOther;
    const titleHint = hasNoModel
      ? t('pages.episodes.model_needed')
      : disabledByOther
      ? 'Eine andere Episode wird gerade transkribiert.'
      : undefined;
    return (
      <button
        className="episode-action-btn episode-action-primary"
        disabled={isDisabled}
        title={titleHint}
        onClick={(e) => {
          e.stopPropagation();
          onTranscribe();
        }}
      >
        {isError
          ? t('pages.episodes.transcription_retry')
          : t('pages.episodes.transcribe_btn')}
      </button>
    );
  }

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

      {/* Transcription error message */}
      {isError && episode.transcription_error && (
        <div className="episode-error-msg">
          {episode.transcription_error}
        </div>
      )}

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
        {renderTranscribeAction()}
        <button
          className="episode-action-btn episode-action-secondary"
          disabled={!isDone}
          title={!isDone ? t('pages.episodes.model_needed') : undefined}
          onClick={(e) => {
            e.stopPropagation();
            if (isDone && onViewTranscript) {
              onViewTranscript(episode.id, episode.title);
            }
          }}
        >
          {t('pages.episodes.view_transcript_btn')}
        </button>
      </div>
    </div>
  );
}
