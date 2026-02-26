import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
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

      {/* Open topics — capped at 10, link to full Topics page */}
      <div className="settings-section">
        <h3 className="settings-section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {t('pages.stats.topics_title')}
          {topics.length > 0 && (
            <span style={{ fontSize: '0.85rem', fontWeight: 400, opacity: 0.6 }}>({topics.length})</span>
          )}
          {topics.length > 0 && (
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('navigate-topics'))}
              style={{ marginLeft: 'auto', fontSize: '0.75rem', background: 'none', border: '1px solid var(--color-border)', borderRadius: 6, padding: '2px 8px', cursor: 'pointer', color: 'var(--color-text)', opacity: 0.7 }}
            >
              {t('pages.stats.topics_open_all')}
            </button>
          )}
        </h3>
        {topics.length === 0 ? (
          <p className="settings-row-desc">{t('pages.stats.no_topics')}</p>
        ) : (
          <>
            <ul style={{ margin: 0, padding: '0 0 0 18px' }}>
              {topics.slice(0, 10).map(topic => (
                <li key={topic.id} style={{ marginBottom: 5, fontSize: '0.875rem' }}>{topic.title}</li>
              ))}
            </ul>
            {topics.length > 10 && (
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent('navigate-topics'))}
                style={{ marginTop: 8, fontSize: '0.8rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-primary)', padding: 0, opacity: 0.85 }}
              >
                + {topics.length - 10} {t('pages.stats.topics_more')}
              </button>
            )}
          </>
        )}
      </div>

      {/* Word-Tracker — horizontal bar chart sorted by count */}
      {groups.length > 0 && (
        <div className="settings-section">
          <h3 className="settings-section-title">{t('pages.stats.innuendo_title')}</h3>
          {(() => {
            const chartData = groups
              .map(item => ({
                label: item.label,
                count: innuendos.find(i => i.label === item.label)?.count ?? 0,
              }))
              .sort((a, b) => b.count - a.count);

            const barColors = [
              '#d97757', '#5B8C5A', '#5B7BA8', '#A8835B', '#8B5BA8',
              '#5BA8A2', '#A85B6B', '#A8A25B', '#5B8CA8', '#A87C5B',
            ];

            const barHeight = 36;
            const chartHeight = Math.max(120, chartData.length * barHeight + 40);

            return (
              <>
                <ResponsiveContainer width="100%" height={chartHeight} style={{ background: 'transparent' }}>
                  <BarChart
                    data={chartData}
                    layout="vertical"
                    margin={{ top: 4, right: 48, left: 8, bottom: 4 }}
                    barSize={20}
                    style={{ background: 'transparent' }}
                  >
                    <XAxis
                      type="number"
                      tick={{ fontSize: 11, fill: 'var(--color-text-secondary, #aaa)' }}
                      axisLine={{ stroke: 'var(--color-border)' }}
                      tickLine={{ stroke: 'var(--color-border)' }}
                      allowDecimals={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="label"
                      width={110}
                      tick={{ fontSize: 12, fill: 'var(--color-text)' }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      formatter={(value) => [`${value ?? 0}×`, t('pages.stats.innuendo_count')]}
                      contentStyle={{ background: 'var(--color-surface, #1a1a1a)', border: '1px solid var(--color-border)', borderRadius: 6, fontSize: 12 }}
                      labelStyle={{ color: 'var(--color-text)' }}
                      itemStyle={{ color: 'var(--color-text)' }}
                      cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                    />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                      {chartData.map((entry, index) => (
                        <Cell key={entry.label} fill={barColors[index % barColors.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>

                {/* Delete buttons below chart */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
                  {chartData.map((item, index) => (
                    <span
                      key={item.label}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '2px 8px 2px 6px',
                        borderRadius: 12,
                        background: barColors[index % barColors.length] + '22',
                        border: `1px solid ${barColors[index % barColors.length]}44`,
                        fontSize: 12,
                      }}
                    >
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: barColors[index % barColors.length], flexShrink: 0 }} />
                      {item.label}
                      <button
                        type="button"
                        onClick={() => handleDeleteGroup(item.label)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.5, fontSize: '0.8rem', padding: '0 2px', lineHeight: 1, color: 'var(--color-text)' }}
                        title="Löschen"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}
