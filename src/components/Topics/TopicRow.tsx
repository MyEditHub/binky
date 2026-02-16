import { useTranslation } from 'react-i18next';
import type { TopicRow as TopicRowData, TopicStatus } from '../../hooks/useTopics';

interface TopicRowProps {
  topic: TopicRowData;
  onStatusChange: (topicId: number, status: TopicStatus) => void;
}

export default function TopicRow({ topic, onStatusChange }: TopicRowProps) {
  const { t } = useTranslation();

  const statusButtons: { key: TopicStatus; label: string }[] = [
    { key: 'offen', label: t('pages.topics.status_offen') },
    { key: 'erledigt', label: t('pages.topics.status_erledigt') },
    { key: 'zurückgestellt', label: t('pages.topics.status_zurückgestellt') },
  ];

  const confidencePercent =
    topic.confidence !== null ? Math.round(topic.confidence * 100) : null;

  return (
    <div className="topic-card">
      <div className="topic-title">{topic.title}</div>

      {topic.description && (
        <div className="topic-desc">{topic.description}</div>
      )}

      {topic.ai_detected === 1 && topic.ai_reason && (
        <div className="topic-reason">
          {t('pages.topics.ai_reason_label')}: {topic.ai_reason}
        </div>
      )}

      <div className="topic-meta">
        {topic.source_episode_title && (
          <span>
            {t('pages.topics.source_episode')}: {topic.source_episode_title}
          </span>
        )}
        {confidencePercent !== null && (
          <span className="topic-confidence-badge">
            {t('pages.topics.confidence_label')}: {confidencePercent}%
          </span>
        )}
      </div>

      <div className="topic-status-bar">
        {statusButtons.map(btn => (
          <button
            key={btn.key}
            type="button"
            className={`topic-status-btn topic-status-btn-${btn.key === topic.status ? 'active-' + btn.key : 'inactive'}`}
            onClick={() => onStatusChange(topic.id, btn.key)}
          >
            {btn.label}
          </button>
        ))}
      </div>
    </div>
  );
}
