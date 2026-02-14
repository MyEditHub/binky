import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
import { useEpisodes } from '../../hooks/useEpisodes';
import { useTranscription } from '../../hooks/useTranscription';
import EpisodeRow from './EpisodeRow';
import EpisodeExpandedView from './EpisodeExpandedView';

interface ModelStatus {
  downloaded_model: string | null;
}

interface EpisodeListProps {
  onTranscriptionStateChange?: (isProcessing: boolean, queueCount: number) => void;
  onViewTranscript?: (episodeId: number, episodeTitle: string) => void;
}

export default function EpisodeList({ onTranscriptionStateChange, onViewTranscript }: EpisodeListProps) {
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

  const {
    activeEpisodeId,
    progress,
    queueLength,
    isProcessing,
    startTranscription,
    cancelTranscription,
  } = useTranscription(() => {
    // Reload episodes from DB when a transcription completes/errors/cancels
    loadEpisodes();
    // Notify Layout of state changes for the sidebar badge
    onTranscriptionStateChange?.(isProcessing, queueLength);
  });

  // Keep parent in sync when processing state changes
  useEffect(() => {
    onTranscriptionStateChange?.(isProcessing, queueLength);
  }, [isProcessing, queueLength, onTranscriptionStateChange]);

  const [expandedId, setExpandedId] = useState<number | null>(null);

  function handleToggle(id: number) {
    // Find the episode to check if it's done
    const ep = episodes.find((e) => e.id === id);
    if (ep?.transcription_status === 'done' && onViewTranscript) {
      onViewTranscript(ep.id, ep.title);
      return;
    }
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
            return (
              <div key={ep.id}>
                <EpisodeRow
                  episode={ep}
                  isExpanded={expandedId === ep.id}
                  onToggle={handleToggle}
                  transcriptionProgress={isThisActive ? progress : null}
                />
                {expandedId === ep.id && (
                  <EpisodeExpandedView
                    episode={ep}
                    modelDownloaded={modelDownloaded}
                    isTranscribing={isThisActive && isProcessing}
                    onTranscribe={() => {
                      if (ep.audio_url) {
                        startTranscription(ep.id, ep.audio_url);
                      }
                    }}
                    onCancel={cancelTranscription}
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
