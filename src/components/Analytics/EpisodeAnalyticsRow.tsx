import { useState } from 'react';
import SpeakingBalanceBar from './SpeakingBalanceBar';
import SegmentCorrectionPanel from './SegmentCorrectionPanel';
import { EpisodeStats, HostProfile, SegmentRow } from '../../hooks/useAnalytics';
import { useTranslation } from 'react-i18next';

interface Props {
  stats: EpisodeStats;
  hostProfile: HostProfile;
  flipEpisodeSpeakers: (episodeId: number) => Promise<void>;
  correctSegment: (segmentId: number, newSpeaker: string) => Promise<void>;
  loadSegments: (episodeId: number) => Promise<SegmentRow[]>;
  onReanalyze: (episodeId: number, audioUrl: string) => void;
}

export default function EpisodeAnalyticsRow({
  stats,
  hostProfile,
  flipEpisodeSpeakers,
  correctSegment,
  loadSegments,
  onReanalyze,
}: Props) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [showCorrections, setShowCorrections] = useState(false);

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

  const isSolo = stats.diarizationStatus === 'solo';
  const isDone = stats.diarizationStatus === 'done';
  const isExpandable = isDone || isSolo;

  const statusLabel: Record<string, string> = {
    not_started: t('pages.analytics.status_not_started'),
    queued: t('pages.analytics.status_queued'),
    processing: t('pages.analytics.status_processing'),
    error: t('pages.analytics.status_error'),
  };

  return (
    <div
      className="analytics-episode-row"
      onClick={() => isExpandable && setExpanded(!expanded)}
      style={{ cursor: isExpandable ? 'pointer' : 'default' }}
    >
      <div className="analytics-episode-title">
        {stats.title}
        {isSolo && (
          <span className="analytics-badge-solo">{t('pages.analytics.solo_episode')}</span>
        )}
      </div>
      <div className="analytics-episode-meta">{formatDate(stats.publishDate)}</div>

      {stats.diarizationStatus === 'done' ? (
        <SpeakingBalanceBar
          host0Pct={stats.host0Pct}
          host1Pct={stats.host1Pct}
          host0Color={hostProfile.host0Color}
          host1Color={hostProfile.host1Color}
          host0Name={hostProfile.host0Name}
          host1Name={hostProfile.host1Name}
        />
      ) : isSolo ? (
        <div style={{ fontSize: 12, color: 'var(--text-secondary, #888)' }}>
          {hostProfile.host0Name}: ~100%
        </div>
      ) : (
        <div style={{ fontSize: 12, color: 'var(--text-secondary, #888)', fontStyle: 'italic' }}>
          {statusLabel[stats.diarizationStatus] ?? stats.diarizationStatus}
        </div>
      )}

      {expanded && isSolo && (
        <div
          className="analytics-episode-expanded"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="analytics-episode-actions">
            <button
              className="btn-outline btn-danger-outline"
              onClick={(e) => {
                e.stopPropagation();
                onReanalyze(stats.episodeId, stats.audioUrl);
              }}
            >
              {t('pages.analytics.reanalyze')}
            </button>
          </div>
        </div>
      )}

      {expanded && isDone && (
        <div
          className="analytics-episode-expanded"
          onClick={(e) => e.stopPropagation()}
        >
          <div>
            {hostProfile.host0Name}: {stats.host0Minutes} Min. &middot; {stats.host0Turns}{' '}
            {t('pages.analytics.turns')}
          </div>
          <div>
            {hostProfile.host1Name}: {stats.host1Minutes} Min. &middot; {stats.host1Turns}{' '}
            {t('pages.analytics.turns')}
          </div>

          <div className="analytics-episode-actions">
            <button
              className="btn-outline"
              onClick={(e) => {
                e.stopPropagation();
                flipEpisodeSpeakers(stats.episodeId);
              }}
            >
              {t('pages.analytics.flip_speakers')}
            </button>
            <button
              className="btn-outline"
              onClick={(e) => {
                e.stopPropagation();
                setShowCorrections(!showCorrections);
              }}
            >
              {t('pages.analytics.correct_segments')}
            </button>
          </div>

          {showCorrections && (
            <SegmentCorrectionPanel
              episodeId={stats.episodeId}
              hostProfile={hostProfile}
              loadSegments={loadSegments}
              correctSegment={correctSegment}
              flipEpisodeSpeakers={flipEpisodeSpeakers}
              onReanalyze={() => onReanalyze(stats.episodeId, stats.audioUrl)}
              onClose={() => setShowCorrections(false)}
            />
          )}
        </div>
      )}
    </div>
  );
}
