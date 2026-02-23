import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import Database from '@tauri-apps/plugin-sql';
import { useAnalytics } from '../../hooks/useAnalytics';
import { useDiarization } from '../../hooks/useDiarization';
import HostConfirmation from '../Analytics/HostConfirmation';
import DashboardSummary from '../Analytics/DashboardSummary';
import EpisodeAnalyticsList from '../Analytics/EpisodeAnalyticsList';

export default function AnalyticsPage() {
  const { t } = useTranslation();
  const {
    episodes,
    aggregate,
    hostProfile,
    loading,
    error,
    refresh,
    saveHostProfile,
    flipEpisodeSpeakers,
    correctSegment,
    loadSegments,
  } = useAnalytics();
  const diarization = useDiarization(refresh);
  const autoStartedRef = useRef(false);

  // Auto-start diarization for all transcribed but not-diarized episodes on first visit
  useEffect(() => {
    if (!hostProfile.confirmed || autoStartedRef.current) return;

    Database.load('sqlite:binky.db')
      .then((db) =>
        db.select<Array<{ id: number; audio_url: string }>>(`
          SELECT id, audio_url FROM episodes
          WHERE transcription_status = 'done'
          AND diarization_status = 'not_started'
          AND audio_url IS NOT NULL
        `)
      )
      .then((pendingEps) => {
        if (pendingEps.length > 0) {
          autoStartedRef.current = true;
          diarization.startBatchDiarization(
            pendingEps.map((e) => ({ id: e.id, audioUrl: e.audio_url }))
          );
        }
      })
      .catch(console.error);
  }, [hostProfile.confirmed]);

  const handleReanalyze = async (episodeId: number, audioUrl: string) => {
    const db = await Database.load('sqlite:binky.db');
    await db.execute('DELETE FROM diarization_segments WHERE episode_id = ?', [episodeId]);
    await db.execute(
      `UPDATE episodes SET diarization_status = 'not_started', diarization_error = NULL WHERE id = ?`,
      [episodeId]
    );
    await diarization.startDiarization(episodeId, audioUrl);
    await refresh();
  };

  const handleAnalyzeAll = () => {
    Database.load('sqlite:binky.db')
      .then((db) =>
        db.select<Array<{ id: number; audio_url: string }>>(`
          SELECT id, audio_url FROM episodes
          WHERE transcription_status = 'done'
          AND diarization_status = 'not_started'
          AND audio_url IS NOT NULL
        `)
      )
      .then((pendingEps) => {
        if (pendingEps.length > 0) {
          diarization.startBatchDiarization(
            pendingEps.map((e) => ({ id: e.id, audioUrl: e.audio_url }))
          );
        }
      })
      .catch(console.error);
  };

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">{t('pages.analytics.title')}</h2>
      </div>
      {error && <div className="error-message">{error}</div>}

      {!hostProfile.confirmed ? (
        <HostConfirmation hostProfile={hostProfile} onConfirm={saveHostProfile} />
      ) : (
        <>
          {!loading && episodes.length === 0 && !diarization.isProcessing ? (
            <div className="coming-soon">
              <div className="coming-soon-title">📊</div>
              <div className="coming-soon-message">{t('pages.analytics.empty_hint')}</div>
            </div>
          ) : (
            <>
              <DashboardSummary aggregate={aggregate} hostProfile={hostProfile} />
              <EpisodeAnalyticsList
                episodes={episodes}
                hostProfile={hostProfile}
                diarization={diarization}
                onAnalyzeAll={handleAnalyzeAll}
                flipEpisodeSpeakers={flipEpisodeSpeakers}
                correctSegment={correctSegment}
                loadSegments={loadSegments}
                onReanalyze={handleReanalyze}
              />
            </>
          )}
        </>
      )}
    </div>
  );
}
