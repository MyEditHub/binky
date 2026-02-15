import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { SegmentRow } from '../../hooks/useAnalytics';

interface HostProfile {
  host0Name: string;
  host1Name: string;
  host0Color: string;
  host1Color: string;
}

interface Props {
  episodeId: number;
  hostProfile: HostProfile;
  loadSegments: (episodeId: number) => Promise<SegmentRow[]>;
  correctSegment: (segmentId: number, newSpeaker: string) => Promise<void>;
  flipEpisodeSpeakers: (episodeId: number) => Promise<void>;
  onReanalyze: () => void;
  onClose: () => void;
}

function formatTime(ms: number): string {
  const totalSecs = Math.floor(ms / 1000);
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export default function SegmentCorrectionPanel({
  episodeId,
  hostProfile,
  loadSegments,
  correctSegment,
  flipEpisodeSpeakers,
  onReanalyze,
  onClose,
}: Props) {
  const { t } = useTranslation();
  const [segments, setSegments] = useState<SegmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(100);
  const [confirmReanalyze, setConfirmReanalyze] = useState(false);

  useEffect(() => {
    loadSegments(episodeId)
      .then((segs) => {
        setSegments(segs);
        setLoading(false);
      })
      .catch(console.error);
  }, [episodeId]);

  const handleSegmentClick = async (seg: SegmentRow) => {
    const current = seg.corrected_speaker ?? seg.speaker_label;
    const next = current === 'SPEAKER_0' ? 'SPEAKER_1' : 'SPEAKER_0';
    await correctSegment(seg.id, next);
    // Update local state optimistically
    setSegments((prev) =>
      prev.map((s) => (s.id === seg.id ? { ...s, corrected_speaker: next } : s))
    );
  };

  const handleFlipAll = async () => {
    await flipEpisodeSpeakers(episodeId);
    const refreshed = await loadSegments(episodeId);
    setSegments(refreshed);
  };

  const getSpeakerName = (seg: SegmentRow) => {
    const effective = seg.corrected_speaker ?? seg.speaker_label;
    return effective === 'SPEAKER_0' ? hostProfile.host0Name : hostProfile.host1Name;
  };

  const getSpeakerColor = (seg: SegmentRow) => {
    const effective = seg.corrected_speaker ?? seg.speaker_label;
    return effective === 'SPEAKER_0' ? hostProfile.host0Color : hostProfile.host1Color;
  };

  return (
    <div className="segment-correction-panel" onClick={(e) => e.stopPropagation()}>
      <div className="correction-actions">
        <button className="btn-outline" onClick={handleFlipAll}>
          {t('pages.analytics.flip_speakers')}
        </button>
        <button
          className="btn-outline btn-danger-outline"
          onClick={() => setConfirmReanalyze(true)}
        >
          {t('pages.analytics.reanalyze')}
        </button>
        <button
          className="btn-outline"
          style={{ marginLeft: 'auto' }}
          onClick={onClose}
        >
          {t('pages.analytics.correction_close')}
        </button>
      </div>

      {confirmReanalyze && (
        <div className="model-confirm-box">
          <p>{t('pages.analytics.reanalyze_confirm')}</p>
          <div className="model-confirm-actions">
            <button
              className="model-confirm-danger"
              onClick={() => {
                onReanalyze();
                setConfirmReanalyze(false);
              }}
            >
              {t('pages.analytics.reanalyze')}
            </button>
            <button className="btn-outline" onClick={() => setConfirmReanalyze(false)}>
              Abbrechen
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ padding: 8, color: 'var(--text-secondary)', fontSize: 12 }}>
          Lade Segmente...
        </div>
      ) : (
        <>
          {segments.slice(0, visibleCount).map((seg) => (
            <div
              key={seg.id}
              className={`segment-row ${seg.corrected_speaker ? 'segment-row-corrected' : ''}`}
              onClick={() => handleSegmentClick(seg)}
            >
              <span className="segment-time">
                {formatTime(seg.start_ms)} – {formatTime(seg.end_ms)}
              </span>
              <span
                className="segment-speaker-dot"
                style={{ backgroundColor: getSpeakerColor(seg) }}
              />
              <span style={{ fontSize: 12 }}>{getSpeakerName(seg)}</span>
              {seg.corrected_speaker && (
                <span style={{ fontSize: 10, color: 'var(--text-secondary)', marginLeft: 4 }}>
                  ↩
                </span>
              )}
            </div>
          ))}
          {segments.length > visibleCount && (
            <button
              className="btn-outline"
              style={{ marginTop: 8 }}
              onClick={() => setVisibleCount((v) => v + 100)}
            >
              {t('pages.analytics.load_more')} ({segments.length - visibleCount} weitere)
            </button>
          )}
        </>
      )}
    </div>
  );
}
