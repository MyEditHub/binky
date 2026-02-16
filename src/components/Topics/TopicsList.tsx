import { useTranslation } from 'react-i18next';
import type { TopicRow, TopicStatus } from '../../hooks/useTopics';
import TopicRowComponent from './TopicRow';

interface TopicsListProps {
  topics: TopicRow[];
  loading: boolean;
  onStatusChange: (topicId: number, status: TopicStatus) => void;
}

export default function TopicsList({ topics, loading, onStatusChange }: TopicsListProps) {
  const { t } = useTranslation();

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
