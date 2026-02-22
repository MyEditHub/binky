import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Database from '@tauri-apps/plugin-sql';
import { getSetting } from '../../lib/settings';

interface SpeechStat {
  speaker: string;
  ms: number;
  percent: number;
}

interface Topic {
  id: number;
  title: string;
  priority: string;
}

interface InnuendoCount {
  word: string;
  count: number;
}

export default function StatsPage() {
  const { t } = useTranslation();
  const [speech, setSpeech] = useState<SpeechStat[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [innuendos, setInnuendos] = useState<InnuendoCount[]>([]);
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
      const name0 = h0 ?? 'Sprecher 1';
      const name1 = h1 ?? 'Sprecher 2';
      setHost0Name(name0);
      setHost1Name(name1);
      setHost0Color(c0 ?? '#d97757');
      setHost1Color(c1 ?? '#5B8C5A');

      // Aggregate speech proportion across all episodes
      const rows = await db.select<{ spk: string; total_ms: number }[]>(
        `SELECT COALESCE(corrected_speaker, speaker_label) as spk,
                SUM(end_ms - start_ms) as total_ms
         FROM diarization_segments
         GROUP BY spk`
      );
      const totalMs = rows.reduce((s, r) => s + r.total_ms, 0);
      setSpeech(
        rows.map(r => ({
          speaker: r.spk,
          ms: r.total_ms,
          percent: totalMs > 0 ? Math.round((r.total_ms / totalMs) * 100) : 0,
        }))
      );

      // Open topics
      const topicRows = await db.select<Topic[]>(
        `SELECT id, title, priority FROM topics
         WHERE status = 'offen'
         ORDER BY CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, created_at ASC`
      );
      setTopics(topicRows);

      // Innuendo counter — search all transcript full_text for configured words
      const wordsRaw = await getSetting('innuendo_words');
      if (wordsRaw) {
        let words: string[] = [];
        try { words = JSON.parse(wordsRaw); } catch { words = []; }

        if (words.length > 0) {
          const texts = await db.select<{ full_text: string }[]>('SELECT full_text FROM transcripts');
          const allText = texts.map(r => r.full_text).join('\n').toLowerCase();
          setInnuendos(
            words.map(word => ({
              word,
              count: (allText.match(new RegExp(word.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) ?? []).length,
            }))
          );
        }
      }

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
        <div className="page-header">
          <h2 className="page-title">{t('pages.stats.title')}</h2>
        </div>
        <div style={{ padding: '20px' }}>{t('common.loading')}</div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">{t('pages.stats.title')}</h2>
      </div>

      {/* Speech Proportion */}
      <div className="settings-section">
        <h3 className="settings-section-title">{t('pages.stats.speech_title')}</h3>
        {speech.length === 0 ? (
          <p className="settings-row-desc">{t('pages.stats.no_data')}</p>
        ) : (
          speech.map(s => (
            <div key={s.speaker} style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: '0.9rem' }}>
                <span>{getHostName(s.speaker)}</span>
                <strong>{s.percent}%</strong>
              </div>
              <div style={{ height: 10, background: 'var(--color-border)', borderRadius: 5, overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${s.percent}%`,
                    height: '100%',
                    background: getHostColor(s.speaker),
                    borderRadius: 5,
                    transition: 'width 0.4s ease',
                  }}
                />
              </div>
            </div>
          ))
        )}
      </div>

      {/* Open Topics */}
      <div className="settings-section">
        <h3 className="settings-section-title">
          {t('pages.stats.topics_title')}
          {topics.length > 0 && (
            <span style={{ marginLeft: 8, fontSize: '0.85rem', fontWeight: 400, opacity: 0.6 }}>
              ({topics.length})
            </span>
          )}
        </h3>
        {topics.length === 0 ? (
          <p className="settings-row-desc">{t('pages.stats.no_topics')}</p>
        ) : (
          <ul style={{ margin: 0, padding: '0 0 0 18px' }}>
            {topics.map(topic => (
              <li key={topic.id} style={{ marginBottom: 6, fontSize: '0.9rem' }}>
                {topic.title}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Innuendo Counter */}
      {innuendos.length > 0 && (
        <div className="settings-section">
          <h3 className="settings-section-title">{t('pages.stats.innuendo_title')}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px 20px', alignItems: 'center' }}>
            {innuendos.map(item => (
              <>
                <span key={`w-${item.word}`} style={{ fontSize: '0.9rem' }}>{item.word}</span>
                <strong key={`c-${item.word}`} style={{ fontSize: '1.2rem', color: 'var(--color-primary)' }}>
                  {item.count}×
                </strong>
              </>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
