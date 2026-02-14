import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useEpisodes } from '../../hooks/useEpisodes';
import EpisodeRow from './EpisodeRow';
import EpisodeExpandedView from './EpisodeExpandedView';

export default function EpisodeList() {
  const { t } = useTranslation();
  const {
    episodes,
    loading,
    syncing,
    error,
    searchQuery,
    setSearchQuery,
    syncRss,
  } = useEpisodes();

  const [expandedId, setExpandedId] = useState<number | null>(null);

  function handleToggle(id: number) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  const count = episodes.length;
  const countLabel =
    count === 1
      ? t('pages.episodes.count_one')
      : t('pages.episodes.count', { count });

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
          {episodes.map((ep) => (
            <div key={ep.id}>
              <EpisodeRow
                episode={ep}
                isExpanded={expandedId === ep.id}
                onToggle={handleToggle}
              />
              {expandedId === ep.id && (
                <EpisodeExpandedView episode={ep} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
