import Database from '@tauri-apps/plugin-sql';
import { useState, useEffect, useCallback } from 'react';
import { getSetting, setSetting } from '../lib/settings';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SegmentRow {
  id: number;
  start_ms: number;
  end_ms: number;
  speaker_label: string;
  corrected_speaker: string | null;
  confidence: number | null;
}

export interface EpisodeStats {
  episodeId: number;
  title: string;
  publishDate: string;
  audioUrl: string; // needed for re-analyze
  host0Pct: number;
  host1Pct: number;
  host0Minutes: number;
  host1Minutes: number;
  totalSpeakingMs: number;
  host0Turns: number;
  host1Turns: number;
  diarizationStatus: string;
}

export interface AggregateStats {
  avgHost0Pct: number;
  avgHost1Pct: number;
  totalHost0Minutes: number;
  totalHost1Minutes: number;
  episodeCount: number;
}

export interface HostProfile {
  host0Name: string;
  host1Name: string;
  host0Color: string;
  host1Color: string;
  confirmed: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_HOST_PROFILE: HostProfile = {
  host0Name: 'Sprecher 1',
  host1Name: 'Sprecher 2',
  host0Color: '#d97757', // brand orange
  host1Color: '#5B8C5A', // green
  confirmed: false,
};

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useAnalytics() {
  const [episodes, setEpisodes] = useState<EpisodeStats[]>([]);
  const [aggregate, setAggregate] = useState<AggregateStats>({
    avgHost0Pct: 50,
    avgHost1Pct: 50,
    totalHost0Minutes: 0,
    totalHost1Minutes: 0,
    episodeCount: 0,
  });
  const [hostProfile, setHostProfileState] = useState<HostProfile>(DEFAULT_HOST_PROFILE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadHostProfile = useCallback(async () => {
    const [h0Name, h1Name, h0Color, h1Color, confirmed] = await Promise.all([
      getSetting('host_0_name'),
      getSetting('host_1_name'),
      getSetting('host_0_color'),
      getSetting('host_1_color'),
      getSetting('hosts_confirmed'),
    ]);
    setHostProfileState({
      host0Name: h0Name ?? DEFAULT_HOST_PROFILE.host0Name,
      host1Name: h1Name ?? DEFAULT_HOST_PROFILE.host1Name,
      host0Color: h0Color ?? DEFAULT_HOST_PROFILE.host0Color,
      host1Color: h1Color ?? DEFAULT_HOST_PROFILE.host1Color,
      confirmed: confirmed === 'true',
    });
  }, []);

  const saveHostProfile = useCallback(async (profile: HostProfile) => {
    await Promise.all([
      setSetting('host_0_name', profile.host0Name),
      setSetting('host_1_name', profile.host1Name),
      setSetting('host_0_color', profile.host0Color),
      setSetting('host_1_color', profile.host1Color),
      setSetting('hosts_confirmed', profile.confirmed ? 'true' : 'false'),
    ]);
    setHostProfileState(profile);
  }, []);

  const loadEpisodeStats = useCallback(async () => {
    const db = await Database.load('sqlite:binky.db');

    // Get episodes with diarization — one row per (episode, speaker)
    const rows = await db.select<
      Array<{
        id: number;
        title: string;
        publish_date: string;
        audio_url: string;
        diarization_status: string;
        effective_speaker: string | null;
        speaking_ms: number;
        turn_count: number;
      }>
    >(`
      SELECT e.id, e.title, e.publish_date, e.audio_url, e.diarization_status,
             COALESCE(ds.corrected_speaker, ds.speaker_label) AS effective_speaker,
             SUM(ds.end_ms - ds.start_ms) AS speaking_ms,
             COUNT(*) AS turn_count
      FROM episodes e
      LEFT JOIN diarization_segments ds ON ds.episode_id = e.id
      WHERE e.diarization_status IN ('done', 'solo')
      GROUP BY e.id, effective_speaker
      ORDER BY e.publish_date DESC
    `);

    // Group by episode
    const episodeMap = new Map<number, EpisodeStats>();

    for (const row of rows) {
      if (!episodeMap.has(row.id)) {
        episodeMap.set(row.id, {
          episodeId: row.id,
          title: row.title,
          publishDate: row.publish_date,
          audioUrl: row.audio_url,
          host0Pct: 0,
          host1Pct: 0,
          host0Minutes: 0,
          host1Minutes: 0,
          totalSpeakingMs: 0,
          host0Turns: 0,
          host1Turns: 0,
          diarizationStatus: row.diarization_status,
        });
      }

      const stats = episodeMap.get(row.id)!;

      if (row.effective_speaker === 'SPEAKER_0') {
        stats.host0Minutes = Math.round(((row.speaking_ms ?? 0) / 60000) * 10) / 10;
        stats.host0Turns = row.turn_count;
        stats.totalSpeakingMs += row.speaking_ms ?? 0;
      } else if (row.effective_speaker === 'SPEAKER_1') {
        stats.host1Minutes = Math.round(((row.speaking_ms ?? 0) / 60000) * 10) / 10;
        stats.host1Turns = row.turn_count;
        stats.totalSpeakingMs += row.speaking_ms ?? 0;
      }
    }

    // Compute percentages
    for (const stats of episodeMap.values()) {
      const total = stats.totalSpeakingMs;
      if (total > 0) {
        stats.host0Pct = Math.round((stats.host0Minutes * 60000 / total) * 100);
        stats.host1Pct = 100 - stats.host0Pct;
      } else {
        stats.host0Pct = 50;
        stats.host1Pct = 50;
      }
    }

    return Array.from(episodeMap.values());
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await loadHostProfile();
      const epStats = await loadEpisodeStats();
      setEpisodes(epStats);

      // Compute aggregate (exclude solo episodes)
      const nonSolo = epStats.filter((e) => e.diarizationStatus === 'done');
      if (nonSolo.length > 0) {
        const avgH0 = Math.round(
          nonSolo.reduce((s, e) => s + e.host0Pct, 0) / nonSolo.length
        );
        setAggregate({
          avgHost0Pct: avgH0,
          avgHost1Pct: 100 - avgH0,
          totalHost0Minutes: nonSolo.reduce((s, e) => s + e.host0Minutes, 0),
          totalHost1Minutes: nonSolo.reduce((s, e) => s + e.host1Minutes, 0),
          episodeCount: nonSolo.length,
        });
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [loadHostProfile, loadEpisodeStats]);

  const flipEpisodeSpeakers = useCallback(async (episodeId: number) => {
    const db = await Database.load('sqlite:binky.db');
    await db.execute(
      `UPDATE diarization_segments
       SET corrected_speaker = CASE
           WHEN COALESCE(corrected_speaker, speaker_label) = 'SPEAKER_0' THEN 'SPEAKER_1'
           ELSE 'SPEAKER_0'
       END
       WHERE episode_id = ?`,
      [episodeId]
    );
    await refresh();
  }, [refresh]);

  const correctSegment = useCallback(async (segmentId: number, newSpeaker: string) => {
    const db = await Database.load('sqlite:binky.db');
    await db.execute(
      'UPDATE diarization_segments SET corrected_speaker = ? WHERE id = ?',
      [newSpeaker, segmentId]
    );
    await refresh();
  }, [refresh]);

  const loadSegments = useCallback(async (episodeId: number): Promise<SegmentRow[]> => {
    const db = await Database.load('sqlite:binky.db');
    return db.select<SegmentRow[]>(
      `SELECT id, start_ms, end_ms, speaker_label, corrected_speaker, confidence
       FROM diarization_segments WHERE episode_id = ? ORDER BY start_ms`,
      [episodeId]
    );
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
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
  };
}
