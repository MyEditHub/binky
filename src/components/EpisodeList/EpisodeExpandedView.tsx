import { useTranslation } from 'react-i18next';
import { Episode } from '../../hooks/useEpisodes';

interface EpisodeExpandedViewProps {
  episode: Episode;
  onProcess: () => void;
  onCancel: () => void;
  onViewTranscript?: (episodeId: number, episodeTitle: string) => void;
  isPipelineRunning: boolean;
  modelDownloaded: boolean;
  /** True when a different episode's pipeline is currently running. Disables the button. */
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
  onProcess,
  onCancel,
  onViewTranscript,
  isPipelineRunning,
  modelDownloaded,
  anotherIsActive,
}: EpisodeExpandedViewProps) {
  const { t } = useTranslation();

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
  const isPipelineInterrupted = episode.pipeline_status === 'interrupted';

  const durationLabel =
    episode.duration_minutes != null
      ? t('pages.episodes.duration_minutes', { minutes: Math.round(episode.duration_minutes) })
      : null;

  // Render the appropriate action button depending on state
  function renderProcessAction() {
    if (isDone && !isPipelineInterrupted) {
      // No process button when fully done — only "view transcript"
      return null;
    }

    if (isActive || isPipelineRunning) {
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
          {t('pipeline.queued')}
        </button>
      );
    }

    // not_started or error — show process button
    const disabledByOther = anotherIsActive;
    const isDisabled = hasNoModel || disabledByOther;
    const titleHint = hasNoModel
      ? t('pages.episodes.model_needed')
      : disabledByOther
      ? 'Eine andere Episode wird gerade verarbeitet.'
      : undefined;
    return (
      <button
        className="episode-action-btn episode-action-primary"
        disabled={isDisabled}
        title={titleHint}
        onClick={(e) => {
          e.stopPropagation();
          onProcess();
        }}
      >
        {isError || isPipelineInterrupted
          ? t('pages.episodes.transcription_retry')
          : t('episodes.process')}
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

      {/* Description */}
      <div className="episode-description">
        {descriptionText}
      </div>

      {/* Action buttons */}
      <div className="episode-actions">
        {renderProcessAction()}
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
