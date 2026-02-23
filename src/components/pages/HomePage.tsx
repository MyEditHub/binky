import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Database from '@tauri-apps/plugin-sql';
import { getSetting } from '../../lib/settings';

interface HostStat {
  speaker: string;
  percent: number;
}

export default function HomePage() {
  const { t } = useTranslation();
  const [hostStats, setHostStats] = useState<HostStat[]>([]);
  const [episodeCount, setEpisodeCount] = useState(0);
  const [host0Name, setHost0Name] = useState('Sprecher 1');
  const [host1Name, setHost1Name] = useState('Sprecher 2');
  const [host0Color, setHost0Color] = useState('#d97757');
  const [host1Color, setHost1Color] = useState('#5B8C5A');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const db = await Database.load('sqlite:binky.db');

      const [h0, h1, c0, c1] = await Promise.all([
        getSetting('host_0_name'),
        getSetting('host_1_name'),
        getSetting('host_0_color'),
        getSetting('host_1_color'),
      ]);
      setHost0Name(h0 ?? 'Sprecher 1');
      setHost1Name(h1 ?? 'Sprecher 2');
      setHost0Color(c0 ?? '#d97757');
      setHost1Color(c1 ?? '#5B8C5A');

      const rows = await db.select<{ spk: string; total_ms: number }[]>(
        `SELECT COALESCE(corrected_speaker, speaker_label) as spk,
                SUM(end_ms - start_ms) as total_ms
         FROM diarization_segments GROUP BY spk`
      );
      const totalMs = rows.reduce((s, r) => s + r.total_ms, 0);
      if (totalMs > 0) {
        setHostStats(
          rows.map(r => ({
            speaker: r.spk,
            percent: Math.round((r.total_ms / totalMs) * 100),
          }))
        );
      }

      const countRows = await db.select<{ cnt: number }[]>(
        `SELECT COUNT(*) as cnt FROM episodes WHERE diarization_status = 'done'`
      );
      setEpisodeCount(countRows[0]?.cnt ?? 0);

      setLoading(false);
    }
    load().catch(console.error);
  }, []);

  const getHostName = (speaker: string) => {
    if (speaker === 'SPEAKER_0') return host0Name;
    if (speaker === 'SPEAKER_1') return host1Name;
    return speaker;
  };

  const getHostColor = (speaker: string) => {
    if (speaker === 'SPEAKER_0') return host0Color;
    if (speaker === 'SPEAKER_1') return host1Color;
    return 'var(--color-primary)';
  };

  if (loading) {
    return (
      <div className="page">
        <div className="page-header"><h2 className="page-title">{t('pages.home.title')}</h2></div>
        <div style={{ padding: '20px' }}>{t('common.loading')}</div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">{t('pages.home.title')}</h2>
      </div>

      <div className="settings-section">
        <h3 className="settings-section-title">{t('pages.home.speaking_balance')}</h3>

        {hostStats.length === 0 ? (
          <p className="settings-row-desc">{t('pages.home.no_data')}</p>
        ) : (
          <>
            {hostStats.map(s => (
              <div key={s.speaker} style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: '0.9rem' }}>
                  <span>{getHostName(s.speaker)}</span>
                  <strong>{s.percent}%</strong>
                </div>
                <div style={{ height: 10, background: 'var(--color-border)', borderRadius: 5, overflow: 'hidden' }}>
                  <div style={{ width: `${s.percent}%`, height: '100%', background: getHostColor(s.speaker), borderRadius: 5, transition: 'width 0.4s ease' }} />
                </div>
              </div>
            ))}
            {episodeCount > 0 && (
              <p className="settings-row-desc" style={{ marginTop: 8 }}>
                {t('pages.home.episodes_analyzed', { count: episodeCount })}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
