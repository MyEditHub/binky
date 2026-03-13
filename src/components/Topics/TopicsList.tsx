import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { TopicRow, TopicStatus } from '../../hooks/useTopics';
import TopicRowComponent from './TopicRow';
import type { RelatedEpisode } from './TopicRow';

interface TopicsListProps {
  topics: TopicRow[];
  loading: boolean;
  onStatusChange: (topicId: number, status: TopicStatus) => void;
  viewMode?: 'list' | 'grouped';
  relatedMap?: Map<number, RelatedEpisode[]>;
  forceExpandEpisodeId?: number | null;
}

export default function TopicsList({
  topics,
  loading,
  onStatusChange,
  viewMode = 'grouped',
  relatedMap,
  forceExpandEpisodeId,
}: TopicsListProps) {
  const { t } = useTranslation();
  // Key: episode_id (number). Using -1 as the key for the "no episode" group.
  const [collapsedGroups, setCollapsedGroups] = useState<Set<number>>(new Set());

  const toggleGroup = (key: number) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Force-expand a specific episode group when deep-link nav arrives
  useEffect(() => {
    if (!forceExpandEpisodeId) return;
    // Remove from collapsed set (expand it)
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      next.delete(forceExpandEpisodeId);
      return next;
    });
    // Scroll after React re-render
    requestAnimationFrame(() => {
      document
        .querySelector(`[data-episode-group="${forceExpandEpisodeId}"]`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [forceExpandEpisodeId]);

  if (loading) {
    return (
      <div className="episode-loading">
        <div className="spinner" />
      </div>
    );
  }

  if (topics.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">📝</div>
        <div className="empty-state-title">{t('pages.topics.no_topics')}</div>
        <div className="empty-state-hint">{t('pages.topics.no_topics_hint')}</div>
      </div>
    );
  }

  if (viewMode === 'list') {
    return (
      <div className="topics-list">
        {topics.map(topic => (
          <TopicRowComponent
            key={topic.id}
            topic={topic}
            onStatusChange={onStatusChange}
            relatedEpisodes={relatedMap?.get(topic.id)}
          />
        ))}
      </div>
    );
  }

  // Grouped view: group by detected_from_episode_id (number).
  // -1 is the sentinel key for topics with no episode.
  const groupMap = new Map<number, { episodeTitle: string; topics: TopicRow[] }>();
  for (const topic of topics) {
    const groupId = topic.detected_from_episode_id ?? -1;
    const episodeTitle = topic.source_episode_title ?? t('pages.topics.group_no_episode');
    if (!groupMap.has(groupId)) {
      groupMap.set(groupId, { episodeTitle, topics: [] });
    }
    groupMap.get(groupId)!.topics.push(topic);
  }

  return (
    <div className="topics-list">
      {Array.from(groupMap.entries()).map(([groupId, { episodeTitle, topics: groupTopics }]) => {
        const isCollapsed = collapsedGroups.has(groupId);
        return (
          <div key={groupId} className="topics-group" data-episode-group={groupId}>
            <button
              type="button"
              className="topics-group-header"
              onClick={() => toggleGroup(groupId)}
            >
              <span className="topics-group-title">{episodeTitle}</span>
              <span className="topics-group-count">{groupTopics.length}</span>
              <span className="topics-group-chevron">{isCollapsed ? '▶' : '▼'}</span>
            </button>
            {!isCollapsed && groupTopics.map(topic => (
              <TopicRowComponent
                key={topic.id}
                topic={topic}
                onStatusChange={onStatusChange}
                relatedEpisodes={relatedMap?.get(topic.id)}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}
