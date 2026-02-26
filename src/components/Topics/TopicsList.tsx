import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TopicRow, TopicStatus } from '../../hooks/useTopics';
import TopicRowComponent from './TopicRow';

interface TopicsListProps {
  topics: TopicRow[];
  loading: boolean;
  onStatusChange: (topicId: number, status: TopicStatus) => void;
  viewMode?: 'list' | 'grouped';
}

export default function TopicsList({ topics, loading, onStatusChange, viewMode = 'grouped' }: TopicsListProps) {
  const { t } = useTranslation();
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

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
          />
        ))}
      </div>
    );
  }

  // Grouped view: group by source episode
  const groupMap = new Map<string, TopicRow[]>();
  for (const topic of topics) {
    const key = topic.source_episode_title ?? t('pages.topics.group_no_episode');
    if (!groupMap.has(key)) groupMap.set(key, []);
    groupMap.get(key)!.push(topic);
  }

  const toggleGroup = (key: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="topics-list">
      {Array.from(groupMap.entries()).map(([groupKey, groupTopics]) => {
        const isCollapsed = collapsedGroups.has(groupKey);
        return (
          <div key={groupKey} className="topics-group">
            <button
              type="button"
              className="topics-group-header"
              onClick={() => toggleGroup(groupKey)}
            >
              <span className="topics-group-title">{groupKey}</span>
              <span className="topics-group-count">{groupTopics.length}</span>
              <span className="topics-group-chevron">{isCollapsed ? '▶' : '▼'}</span>
            </button>
            {!isCollapsed && groupTopics.map(topic => (
              <TopicRowComponent
                key={topic.id}
                topic={topic}
                onStatusChange={onStatusChange}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}
