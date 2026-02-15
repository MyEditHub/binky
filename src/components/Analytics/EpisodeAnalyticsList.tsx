import EpisodeAnalyticsRow from './EpisodeAnalyticsRow';
import { EpisodeStats, HostProfile, SegmentRow } from '../../hooks/useAnalytics';
import { UseDiarizationReturn } from '../../hooks/useDiarization';
import { useTranslation } from 'react-i18next';

interface Props {
  episodes: EpisodeStats[];
  hostProfile: HostProfile;
  diarization: UseDiarizationReturn;
  onAnalyzeAll: () => void;
  flipEpisodeSpeakers: (episodeId: number) => Promise<void>;
  correctSegment: (segmentId: number, newSpeaker: string) => Promise<void>;
  loadSegments: (episodeId: number) => Promise<SegmentRow[]>;
  onReanalyze: (episodeId: number, audioUrl: string) => void;
}

export default function EpisodeAnalyticsList({
  episodes,
  hostProfile,
  diarization,
  onAnalyzeAll,
  flipEpisodeSpeakers,
  correctSegment,
  loadSegments,
  onReanalyze,
}: Props) {
  const { t } = useTranslation();

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
        }}
      >
        <h3 style={{ margin: 0, fontSize: 13 }}>{t('pages.analytics.episode_list_title')}</h3>
        <button className="btn-outline" onClick={onAnalyzeAll}>
          {t('pages.analytics.analyze_all')}
        </button>
      </div>

      {diarization.isProcessing && (
        <div className="analytics-progress-banner">
          {diarization.queueLength > 0
            ? t('pages.analytics.analyzing_queue', { count: diarization.queueLength })
            : t('pages.analytics.analyzing')}
        </div>
      )}

      {episodes.length === 0 ? (
        <div style={{ color: 'var(--text-secondary, #888)', fontSize: 13, padding: '20px 0' }}>
          {t('pages.analytics.empty_hint')}
        </div>
      ) : (
        episodes.map((ep) => (
          <EpisodeAnalyticsRow
            key={ep.episodeId}
            stats={ep}
            hostProfile={hostProfile}
            flipEpisodeSpeakers={flipEpisodeSpeakers}
            correctSegment={correctSegment}
            loadSegments={loadSegments}
            onReanalyze={onReanalyze}
          />
        ))
      )}
    </div>
  );
}
