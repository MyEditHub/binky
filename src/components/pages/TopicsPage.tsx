import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
import Database from '@tauri-apps/plugin-sql';
import { useTopics } from '../../hooks/useTopics';
import type { TopicStatus } from '../../hooks/useTopics';
import TopicsList from '../Topics/TopicsList';

type FilterTab = 'offen' | 'erledigt';

export default function TopicsPage() {
  const { t } = useTranslation();
  const {
    topics,
    loading,
    loadTopics,
    updateStatus,
  } = useTopics();

  const [activeFilter, setActiveFilter] = useState<FilterTab>('offen');
  const autoAnalyzedRef = useRef(false);

  useEffect(() => {
    void loadTopics('offen');

    // Auto-analyze all not_started episodes silently in background
    void (async () => {
      if (autoAnalyzedRef.current) return;
      autoAnalyzedRef.current = true;

      try {
        const hasKey = await invoke<boolean>('has_openai_key_configured');
        if (!hasKey) return;

        const db = await Database.load('sqlite:binky.db');
        const notStarted = await db.select<{ id: number }[]>(`
          SELECT e.id FROM episodes e
          INNER JOIN transcripts tr ON tr.episode_id = e.id
          LEFT JOIN episode_analysis ea ON ea.episode_id = e.id
          WHERE COALESCE(ea.status, 'not_started') = 'not_started'
          ORDER BY e.publish_date DESC
        `);

        for (const ep of notStarted) {
          try {
            await invoke('analyze_episode_topics', { episodeId: ep.id });
          } catch {
            // ignore per-episode errors, continue with others
          }
        }

        // Reload topics after all analysis done
        await loadTopics('offen');
      } catch {
        // non-fatal
      }
    })();
  }, [loadTopics]);

  async function handleFilterChange(filter: FilterTab) {
    setActiveFilter(filter);
    await loadTopics(filter as TopicStatus);
  }

  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'offen', label: t('pages.topics.filter_offen') },
    { key: 'erledigt', label: t('pages.topics.filter_erledigt') },
  ];

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">{t('pages.topics.title')}</h2>
      </div>

      <div className="tab-bar">
        {tabs.map(tab => (
          <button
            key={tab.key}
            type="button"
            className={`tab-btn${activeFilter === tab.key ? ' tab-btn-active' : ''}`}
            onClick={() => void handleFilterChange(tab.key)}
          >
            {tab.label}
            {tab.key === 'offen' && topics.length > 0 && activeFilter === 'offen' && (
              <span className="tab-badge">{topics.length}</span>
            )}
          </button>
        ))}
      </div>

      <TopicsList
        topics={topics}
        loading={loading}
        onStatusChange={updateStatus}
      />
    </div>
  );
}
