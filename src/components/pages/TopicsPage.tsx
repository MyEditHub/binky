import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
import { useTopics } from '../../hooks/useTopics';
import type { TopicStatus } from '../../hooks/useTopics';
import TopicsList from '../Topics/TopicsList';

type FilterTab = TopicStatus | 'alle';

export default function TopicsPage() {
  const { t } = useTranslation();
  const {
    topics,
    episodes,
    loading,
    analyzing,
    loadTopics,
    loadEpisodes,
    updateStatus,
    analyzeEpisode,
  } = useTopics();

  const [activeFilter, setActiveFilter] = useState<FilterTab>('offen');
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  const [analyzingEpisodeId, setAnalyzingEpisodeId] = useState<number | null>(null);

  useEffect(() => {
    invoke<boolean>('has_openai_key_configured')
      .then(configured => setHasApiKey(configured))
      .catch(() => setHasApiKey(false));

    loadTopics('offen');
    loadEpisodes();
  }, [loadTopics, loadEpisodes]);

  async function handleFilterChange(filter: FilterTab) {
    setActiveFilter(filter);
    if (filter === 'alle') {
      await loadTopics(undefined);
    } else {
      await loadTopics(filter);
    }
  }

  async function handleAnalyze(episodeId: number) {
    setAnalyzingEpisodeId(episodeId);
    await analyzeEpisode(episodeId);
    setAnalyzingEpisodeId(null);
  }

  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'offen', label: t('pages.topics.filter_offen') },
    { key: 'erledigt', label: t('pages.topics.filter_erledigt') },
    { key: 'zurückgestellt', label: t('pages.topics.filter_zurückgestellt') },
    { key: 'alle', label: t('pages.topics.filter_all') },
  ];

  function getAnalysisStatusLabel(status: string, topicsFound: number): string {
    switch (status) {
      case 'done':
        return t('pages.topics.episode_analyzed', { count: topicsFound });
      case 'processing':
        return t('pages.topics.episode_analyzing');
      case 'error':
        return t('pages.topics.episode_error');
      default:
        return t('pages.topics.episode_not_analyzed');
    }
  }

  function getAnalysisStatusClass(status: string): string {
    switch (status) {
      case 'done':
        return 'episode-badge-done';
      case 'processing':
        return 'episode-badge-transcribing';
      case 'error':
        return 'episode-badge-error';
      default:
        return 'episode-badge-queued';
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">{t('pages.topics.title')}</h2>
      </div>

      {hasApiKey === false && (
        <div className="api-key-warning">
          <span className="api-key-warning-icon">⚠️</span>
          <div>
            <strong>{t('pages.topics.api_key_missing')}</strong>
            <div>{t('pages.topics.api_key_missing_hint')}</div>
          </div>
        </div>
      )}

      {/* Episode Analysis Section */}
      {episodes.length > 0 && (
        <div className="settings-section" style={{ marginBottom: 20 }}>
          <h3 className="settings-section-title">{t('pages.topics.episodes_title')}</h3>
          <div className="episodes-analysis-list">
            {episodes.map(ep => {
              const isThisAnalyzing =
                analyzingEpisodeId === ep.id ||
                ep.analysis_status === 'processing';
              return (
                <div key={ep.id} className="episode-analysis-row">
                  <span className="episode-analysis-title">{ep.title}</span>
                  <span className={`episode-badge ${getAnalysisStatusClass(ep.analysis_status)}`}>
                    {getAnalysisStatusLabel(ep.analysis_status, ep.topics_found)}
                  </span>
                  <button
                    type="button"
                    className="btn-outline"
                    disabled={!hasApiKey || analyzing || isThisAnalyzing}
                    onClick={() => handleAnalyze(ep.id)}
                  >
                    {isThisAnalyzing
                      ? t('pages.topics.analyzing')
                      : t('pages.topics.analyze')}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab Filter Bar */}
      <div className="tab-bar">
        {tabs.map(tab => (
          <button
            key={tab.key}
            type="button"
            className={`tab-btn${activeFilter === tab.key ? ' tab-btn-active' : ''}`}
            onClick={() => handleFilterChange(tab.key)}
          >
            {tab.label}
            {tab.key === 'offen' && topics.length > 0 && activeFilter === 'offen' && (
              <span className="tab-badge">{topics.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Topics List */}
      <TopicsList
        topics={topics}
        loading={loading}
        onStatusChange={updateStatus}
      />
    </div>
  );
}
