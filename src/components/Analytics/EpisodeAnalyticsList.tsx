import { useState } from 'react';
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
  autoDetectAllSpeakers: () => Promise<{ swapped: number; unchanged: number; uncertain: number }>;
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
  autoDetectAllSpeakers,
}: Props) {
  const { t } = useTranslation();
  const [detecting, setDetecting] = useState(false);
  const [detectResult, setDetectResult] = useState<{
    swapped: number;
    unchanged: number;
    uncertain: number;
  } | null>(null);

  const handleAutoDetect = async () => {
    setDetecting(true);
    setDetectResult(null);
    try {
      const result = await autoDetectAllSpeakers();
      setDetectResult(result);
    } finally {
      setDetecting(false);
    }
  };

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: detectResult ? 6 : 12,
        }}
      >
        <h3 style={{ margin: 0, fontSize: 13 }}>{t('pages.analytics.episode_list_title')}</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-outline" onClick={handleAutoDetect} disabled={detecting}>
            {detecting ? t('pages.analytics.auto_detecting') : t('pages.analytics.auto_detect')}
          </button>
          <button className="btn-outline" onClick={onAnalyzeAll}>
            {t('pages.analytics.analyze_all')}
          </button>
        </div>
      </div>

      {detectResult && (
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 10 }}>
          {t('pages.analytics.auto_detect_result', {
            swapped: detectResult.swapped,
            unchanged: detectResult.unchanged,
            uncertain: detectResult.uncertain,
          })}
        </div>
      )}

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
