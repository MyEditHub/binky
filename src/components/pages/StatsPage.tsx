import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import HostTrendChart from '../Analytics/HostTrendChart';
import Database from '@tauri-apps/plugin-sql';
import { getSetting, setSetting } from '../../lib/settings';

interface SpeechStat {
  speaker: string;
  ms: number;
  percent: number;
}

interface TrendPoint {
  label: string;
  title: string;
  host0Pct: number;
  host1Pct: number;
}

interface Topic {
  id: number;
  title: string;
  priority: string;
}

export interface WordGroup {
  label: string;
  words: string[];
}

interface InnuendoResult {
  label: string;
  count: number;
}

/** Parse innuendo_words setting — handles both old string[] and new WordGroup[] format */
export function parseWordGroups(raw: string | null): WordGroup[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // New format: [{label, words}]
    if (parsed.length > 0 && typeof parsed[0] === 'object' && 'words' in parsed[0]) {
      return parsed as WordGroup[];
    }
    // Old format: string[] — migrate each word into its own group
    return (parsed as string[]).map(w => ({ label: w, words: [w] }));
  } catch {
    return [];
  }
}

export default function StatsPage() {
  const { t } = useTranslation();
  const [speech, setSpeech] = useState<SpeechStat[]>([]);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [groups, setGroups] = useState<WordGroup[]>([]);
  const [innuendos, setInnuendos] = useState<InnuendoResult[]>([]);
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

      // Aggregate speech proportion
      const rows = await db.select<{ spk: string; total_ms: number }[]>(
        `SELECT COALESCE(corrected_speaker, speaker_label) as spk,
                SUM(end_ms - start_ms) as total_ms
         FROM diarization_segments GROUP BY spk`
      );
      const totalMs = rows.reduce((s, r) => s + r.total_ms, 0);
      setSpeech(
        rows
          .map(r => ({
            speaker: r.spk,
            ms: r.total_ms,
            percent: totalMs > 0 ? Math.round((r.total_ms / totalMs) * 100) : 0,
          }))
          .filter(s => s.percent >= 1)
      );

      // Per-episode trend
      const epRows = await db.select<{ title: string; publish_date: string; spk: string; ms: number }[]>(
        `SELECT e.title, e.publish_date,
                COALESCE(ds.corrected_speaker, ds.speaker_label) as spk,
                SUM(ds.end_ms - ds.start_ms) as ms
         FROM episodes e
         JOIN diarization_segments ds ON ds.episode_id = e.id
         GROUP BY e.id, spk
         ORDER BY e.publish_date ASC`
      );
      // Group by episode
      const epMap = new Map<string, { title: string; s0: number; s1: number }>();
      for (const r of epRows) {
        const key = r.publish_date + r.title;
        if (!epMap.has(key)) epMap.set(key, { title: r.title, s0: 0, s1: 0 });
        const ep = epMap.get(key)!;
        if (r.spk === 'SPEAKER_0') ep.s0 += r.ms;
        else if (r.spk === 'SPEAKER_1') ep.s1 += r.ms;
      }
      const trendPoints: TrendPoint[] = [];
      for (const ep of epMap.values()) {
        const total = ep.s0 + ep.s1;
        if (total === 0) continue;
        // Shorten long episode titles
        const label = ep.title.length > 20 ? ep.title.slice(0, 18) + '…' : ep.title;
        trendPoints.push({
          label,
          title: ep.title,
          host0Pct: Math.round((ep.s0 / total) * 100),
          host1Pct: Math.round((ep.s1 / total) * 100),
        });
      }
      setTrend(trendPoints);

      // Open topics
      const topicRows = await db.select<Topic[]>(
        `SELECT id, title, priority FROM topics
         WHERE status = 'offen'
         ORDER BY CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, created_at ASC`
      );
      setTopics(topicRows);

      // Innuendo counter — word groups
      const wordsRaw = await getSetting('innuendo_words');
      const loadedGroups = parseWordGroups(wordsRaw);
      setGroups(loadedGroups);
      if (loadedGroups.length > 0) {
        const texts = await db.select<{ full_text: string }[]>('SELECT full_text FROM transcripts');
        const allText = texts.map(r => r.full_text).join('\n').toLowerCase();
        setInnuendos(
          loadedGroups.map(group => ({
            label: group.label,
            count: group.words.reduce((sum, word) => {
              const escaped = word.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
              return sum + (allText.match(new RegExp(escaped, 'g')) ?? []).length;
            }, 0),
          }))
        );
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

  async function handleDeleteGroup(label: string) {
    const previousGroups = groups;
    const previousInnuendos = innuendos;
    const nextGroups = groups.filter(g => g.label !== label);
    setGroups(nextGroups);
    setInnuendos(prev => prev.filter(i => i.label !== label));
    try {
      await setSetting('innuendo_words', JSON.stringify(nextGroups));
    } catch {
      setGroups(previousGroups);
      setInnuendos(previousInnuendos);
    }
  }

  if (loading) {
    return (
      <div className="page">
        <div className="page-header"><h2 className="page-title">{t('pages.stats.title')}</h2></div>
        <div style={{ padding: '20px' }}>{t('common.loading')}</div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">{t('pages.stats.title')}</h2>
      </div>

      {/* Aggregate speech bars */}
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
                <div style={{ width: `${s.percent}%`, height: '100%', background: getHostColor(s.speaker), borderRadius: 5, transition: 'width 0.4s ease' }} />
              </div>
            </div>
          ))
        )}
      </div>

      {/* Per-episode trend chart */}
      <HostTrendChart
        data={trend}
        host0Name={host0Name}
        host1Name={host1Name}
        host0Color={host0Color}
        host1Color={host1Color}
      />

      {/* Open topics */}
      <div className="settings-section">
        <h3 className="settings-section-title">
          {t('pages.stats.topics_title')}
          {topics.length > 0 && (
            <span style={{ marginLeft: 8, fontSize: '0.85rem', fontWeight: 400, opacity: 0.6 }}>({topics.length})</span>
          )}
        </h3>
        {topics.length === 0 ? (
          <p className="settings-row-desc">{t('pages.stats.no_topics')}</p>
        ) : (
          <ul style={{ margin: 0, padding: '0 0 0 18px' }}>
            {topics.map(topic => (
              <li key={topic.id} style={{ marginBottom: 6, fontSize: '0.9rem' }}>{topic.title}</li>
            ))}
          </ul>
        )}
      </div>

      {/* Innuendo groups — bubble visualization */}
      {groups.length > 0 && (
        <div className="settings-section">
          <h3 className="settings-section-title">{t('pages.stats.innuendo_title')}</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', paddingTop: 8 }}>
            {(() => {
              const maxCount = Math.max(...innuendos.map(i => i.count), 1);
              return groups.map(item => {
                const count = innuendos.find(i => i.label === item.label)?.count ?? 0;
                const size = 72 + Math.round((count / maxCount) * 68);
                return (
                  <div
                    key={item.label}
                    style={{
                      position: 'relative',
                      width: size,
                      height: size,
                      borderRadius: '50%',
                      background: 'var(--color-primary)',
                      opacity: 0.15 + Math.min(0.75, (count / maxCount) * 0.75),
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'default',
                      flexShrink: 0,
                    }}
                  >
                    <span style={{ fontSize: Math.max(10, Math.round(size * 0.18)), fontWeight: 600, color: 'var(--color-text)', textAlign: 'center', lineHeight: 1.2, padding: '0 8px', wordBreak: 'break-word' }}>
                      {item.label}
                    </span>
                    <strong style={{ fontSize: Math.max(9, Math.round(size * 0.16)), color: 'var(--color-primary)', filter: 'brightness(0.6)' }}>
                      {count}×
                    </strong>
                    <button
                      type="button"
                      onClick={() => handleDeleteGroup(item.label)}
                      style={{ position: 'absolute', top: 4, right: 4, background: 'none', border: 'none', cursor: 'pointer', opacity: 0.4, fontSize: '0.75rem', padding: '2px 4px', lineHeight: 1, color: 'var(--color-text)' }}
                      title="Löschen"
                    >
                      ×
                    </button>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
