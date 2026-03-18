import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
import { useEpisodes } from '../../hooks/useEpisodes';
import { UsePipelineReturn } from '../../hooks/usePipeline';
import EpisodeRow from './EpisodeRow';
import EpisodeExpandedView from './EpisodeExpandedView';

interface ModelStatus {
  downloaded_model: string | null;
}

interface EpisodeListProps {
  onTranscriptionStateChange?: (isProcessing: boolean, queueCount: number) => void;
  onViewTranscript?: (episodeId: number, episodeTitle: string) => void;
  pipeline?: UsePipelineReturn;
}

export default function EpisodeList({
  onTranscriptionStateChange,
  onViewTranscript,
  pipeline,
}: EpisodeListProps) {
  const { t } = useTranslation();
  const {
    episodes,
    loading,
    syncing,
    error,
    searchQuery,
    setSearchQuery,
    syncRss,
    loadEpisodes,
  } = useEpisodes();

  // Fetch model status so we know whether transcription is available
  const [downloadedModel, setDownloadedModel] = useState<string | null>(null);

  useEffect(() => {
    invoke<ModelStatus>('get_model_status')
      .then((status) => setDownloadedModel(status.downloaded_model))
      .catch(() => setDownloadedModel(null));
  }, []);

  // Refresh episode list when pipeline completes (event fired from Layout)
  useEffect(() => {
    function handleUpdated() { loadEpisodes(); }
    window.addEventListener('pipeline-episode-updated', handleUpdated);
    return () => window.removeEventListener('pipeline-episode-updated', handleUpdated);
  }, [loadEpisodes]);

  // Keep parent in sync when processing state changes (for sidebar badge)
  const isProcessing = pipeline?.isProcessing ?? false;
  useEffect(() => {
    onTranscriptionStateChange?.(isProcessing, 0);
  }, [isProcessing, onTranscriptionStateChange]);

  const activeEpisodeId = pipeline?.activeEpisodeId ?? null;
  const progress = pipeline?.progress ?? 0;
  const stepLabel = pipeline?.stepLabel ?? null;
  const pipelineError = pipeline?.error ?? false;
  const pipelineInterrupted = pipeline?.interrupted ?? false;
  const startPipeline = pipeline?.startPipeline;
  const cancelPipeline = pipeline?.cancelPipeline;

  const [expandedId, setExpandedId] = useState<number | null>(null);

  function handleToggle(id: number) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  const count = episodes.length;
  const countLabel =
    count === 1
      ? t('pages.episodes.count_one')
      : t('pages.episodes.count', { count });

  const modelDownloaded = downloadedModel !== null;

  return (
    <div className="episode-list">
      {/* Toolbar: search + count + sync button */}
      <div className="episode-toolbar">
        <div className="episode-search-wrapper">
          <span className="episode-search-icon">&#128269;</span>
          <input
            type="text"
            className="episode-search"
            placeholder={t('pages.episodes.search_placeholder')}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setExpandedId(null);
            }}
          />
        </div>
        <span className="episode-count">{countLabel}</span>
        <button
          className="episode-sync-btn"
          onClick={() => syncRss()}
          disabled={syncing}
        >
          {syncing ? (
            <>
              <span className="spinner episode-sync-spinner" />
              {t('pages.episodes.syncing')}
            </>
          ) : (
            t('pages.episodes.sync')
          )}
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="episode-error">
          {t('pages.episodes.sync_error')}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="episode-loading">
          <span className="spinner" />
        </div>
      )}

      {/* Episode rows */}
      {!loading && episodes.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">&#127897;</div>
          <div className="empty-state-title">{t('pages.episodes.empty')}</div>
          <div className="empty-state-hint">
            {searchQuery
              ? `Keine Episoden für „${searchQuery}" gefunden.`
              : t('pages.episodes.empty_hint')}
          </div>
        </div>
      )}

      {!loading && episodes.length > 0 && (
        <div className="episode-rows">
          {episodes.map((ep) => {
            const isThisActive = activeEpisodeId === ep.id;
            const anotherIsActive = isProcessing && !isThisActive;
            return (
              <div key={ep.id}>
                <EpisodeRow
                  episode={ep}
                  isExpanded={expandedId === ep.id}
                  onToggle={handleToggle}
                  pipelineProgress={isThisActive ? progress : null}
                  pipelineStepLabel={isThisActive ? stepLabel : null}
                  pipelineActive={isThisActive && isProcessing}
                  pipelineError={isThisActive && pipelineError}
                  pipelineInterrupted={isThisActive && pipelineInterrupted}
                />
                {expandedId === ep.id && (
                  <EpisodeExpandedView
                    episode={ep}
                    modelDownloaded={modelDownloaded}
                    isPipelineRunning={isThisActive && isProcessing}
                    anotherIsActive={anotherIsActive}
                    onProcess={() => {
                      if (ep.audio_url) {
                        startPipeline?.(ep.id, ep.audio_url, ep.title);
                      } else {
                        alert('Keine Audio-URL für diese Episode gefunden. Bitte neu synchronisieren (Synchronisieren-Button).');
                      }
                    }}
                    onCancel={() => cancelPipeline?.()}
                    onViewTranscript={onViewTranscript}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
