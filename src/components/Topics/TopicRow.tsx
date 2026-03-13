import { useTranslation } from 'react-i18next';
import type { TopicRow as TopicRowData, TopicStatus } from '../../hooks/useTopics';

export interface RelatedEpisode {
  episode_id: number;
  episode_title: string;
  episode_number: number | null;
}

interface TopicRowProps {
  topic: TopicRowData;
  onStatusChange: (topicId: number, status: TopicStatus) => void;
  relatedEpisodes?: RelatedEpisode[];
}

export default function TopicRow({ topic, onStatusChange, relatedEpisodes }: TopicRowProps) {
  const { t } = useTranslation();

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

      {relatedEpisodes && relatedEpisodes.length > 0 && (
        <div className="topic-related-episodes">
          <div className="topic-related-episodes-label">
            {t('pages.topics.related_episodes_label')}
          </div>
          <ul className="topic-related-episodes-list">
            {relatedEpisodes.map(rel => (
              <li key={rel.episode_id} className="topic-related-episode-item">
                <button
                  type="button"
                  className="topic-related-episode-btn"
                  onClick={() => {
                    window.dispatchEvent(
                      new CustomEvent('navigate-to-episode-topics', {
                        detail: { episodeId: rel.episode_id },
                      })
                    );
                  }}
                >
                  {rel.episode_number != null
                    ? t('pages.topics.related_episode_entry', {
                        number: rel.episode_number,
                        title: rel.episode_title,
                      })
                    : rel.episode_title}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="topic-status-bar">
        {topic.status === 'offen' ? (
          <button
            type="button"
            className="topic-status-btn topic-status-btn-inactive"
            onClick={() => onStatusChange(topic.id, 'erledigt')}
          >
            {t('pages.topics.status_erledigt')}
          </button>
        ) : (
          <button
            type="button"
            className="topic-status-btn topic-status-btn-inactive"
            onClick={() => onStatusChange(topic.id, 'offen')}
          >
            {t('pages.topics.status_offen')}
          </button>
        )}
      </div>
    </div>
  );
}
