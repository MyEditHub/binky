import Database from '@tauri-apps/plugin-sql';
import { useState, useEffect, useCallback } from 'react';
import { getSetting, setSetting } from '../lib/settings';
import { detectSpeakerSwap } from '../lib/speakerDetection';

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

    // Batch-load everything in parallel.
    // Speaking time is computed from raw diarization window durations (speaker-turn
    // time), which matches AssemblyAI semantics and avoids over-counting the dominant
    // speaker that Whisper-based scoring introduces when windows are sequential.
    const [episodeRows, diarRows] = await Promise.all([
      db.select<Array<{
        id: number; title: string; publish_date: string;
        audio_url: string; diarization_status: string;
      }>>(`
        SELECT id, title, publish_date, audio_url, diarization_status
        FROM episodes WHERE transcription_status = 'done'
        ORDER BY publish_date DESC
      `),
      db.select<Array<{
        episode_id: number; start_ms: number; end_ms: number;
        speaker_label: string; corrected_speaker: string | null;
      }>>(`
        SELECT ds.episode_id, ds.start_ms, ds.end_ms, ds.speaker_label, ds.corrected_speaker
        FROM diarization_segments ds
        JOIN episodes e ON e.id = ds.episode_id
        WHERE e.transcription_status = 'done'
        ORDER BY ds.episode_id, ds.start_ms
      `),
    ]);

    // Index by episode_id
    const diarByEp = new Map<number, typeof diarRows>();
    for (const r of diarRows) {
      if (!diarByEp.has(r.episode_id)) diarByEp.set(r.episode_id, []);
      diarByEp.get(r.episode_id)!.push(r);
    }

    const episodeMap = new Map<number, EpisodeStats>();
    for (const ep of episodeRows) {
      const diarSegs = diarByEp.get(ep.id) ?? [];

      let host0Ms = 0; let host1Ms = 0;
      let host0Turns = 0; let host1Turns = 0;

      for (const ds of diarSegs) {
        const eff = ds.corrected_speaker ?? ds.speaker_label;
        const dur = ds.end_ms - ds.start_ms;
        if (eff === 'SPEAKER_0') { host0Ms += dur; host0Turns++; }
        else { host1Ms += dur; host1Turns++; }
      }

      const totalMs = host0Ms + host1Ms;
      const host0Pct = totalMs > 0 ? Math.round((host0Ms / totalMs) * 100) : 50;
      episodeMap.set(ep.id, {
        episodeId: ep.id,
        title: ep.title,
        publishDate: ep.publish_date,
        audioUrl: ep.audio_url,
        host0Pct,
        host1Pct: 100 - host0Pct,
        host0Minutes: Math.round((host0Ms / 60000) * 10) / 10,
        host1Minutes: Math.round((host1Ms / 60000) * 10) / 10,
        totalSpeakingMs: totalMs,
        host0Turns,
        host1Turns,
        diarizationStatus: ep.diarization_status,
      });
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
    // Flip relative to speaker_label (idempotent toggle): if currently swapped → reset,
    // if currently at default → swap. Check by counting any corrected_speaker overrides.
    const [{ swapped_count }] = await db.select<[{ swapped_count: number }]>(
      `SELECT COUNT(*) AS swapped_count FROM diarization_segments
       WHERE episode_id = ? AND corrected_speaker IS NOT NULL AND corrected_speaker != speaker_label`,
      [episodeId],
    );
    if (swapped_count > 0) {
      // Currently swapped → reset to speaker_label
      await db.execute(
        `UPDATE diarization_segments SET corrected_speaker = speaker_label WHERE episode_id = ?`,
        [episodeId],
      );
    } else {
      // Currently at default → apply swap
      await db.execute(
        `UPDATE diarization_segments
         SET corrected_speaker = CASE
             WHEN speaker_label = 'SPEAKER_0' THEN 'SPEAKER_1'
             WHEN speaker_label = 'SPEAKER_1' THEN 'SPEAKER_0'
             ELSE speaker_label
         END
         WHERE episode_id = ?`,
        [episodeId],
      );
    }
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

  const autoDetectAllSpeakers = useCallback(async (): Promise<{
    swapped: number;
    unchanged: number;
    uncertain: number;
  }> => {
    const db = await Database.load('sqlite:binky.db');
    const [h0Name, h1Name] = await Promise.all([
      getSetting('host_0_name'),
      getSetting('host_1_name'),
    ]);

    let swapped = 0;
    let unchanged = 0;
    let uncertain = 0;

    // Idempotent swap: always derived from speaker_label, never a flip of corrected_speaker.
    // This means re-running detection always produces the same corrected_speaker values.
    const applySwap = async (episode_id: number) => {
      await db.execute(
        `UPDATE diarization_segments
         SET corrected_speaker = CASE
             WHEN speaker_label = 'SPEAKER_0' THEN 'SPEAKER_1'
             WHEN speaker_label = 'SPEAKER_1' THEN 'SPEAKER_0'
             ELSE speaker_label
         END
         WHERE episode_id = ?`,
        [episode_id],
      );
    };

    const applyNoSwap = async (episode_id: number) => {
      await db.execute(
        `UPDATE diarization_segments
         SET corrected_speaker = speaker_label
         WHERE episode_id = ?`,
        [episode_id],
      );
    };

    // Wave 1 pass: batch fetch first 30 segments per episode in ONE query.
    // Only intro pattern is checked here (earlyOnly=true). Episodes where the
    // intro is ambiguous are queued for a full-episode scan (Waves 2-4).
    const batchRows = await db.select<
      Array<{
        episode_id: number;
        speaker_label: string;
        corrected_speaker: string | null;
        text: string | null;
      }>
    >(`
      WITH ranked AS (
        SELECT episode_id, speaker_label, corrected_speaker, text,
               ROW_NUMBER() OVER (PARTITION BY episode_id ORDER BY start_ms) AS rn
        FROM diarization_segments
        WHERE text IS NOT NULL
      )
      SELECT episode_id, speaker_label, corrected_speaker, text
      FROM ranked WHERE rn <= 30
      ORDER BY episode_id, rn
    `);

    const byEpisode = new Map<
      number,
      Array<{ speaker_label: string; corrected_speaker: string | null; text: string | null }>
    >();
    for (const row of batchRows) {
      const list = byEpisode.get(row.episode_id) ?? [];
      list.push({ speaker_label: row.speaker_label, corrected_speaker: row.corrected_speaker, text: row.text });
      byEpisode.set(row.episode_id, list);
    }

    const fullScanEpisodes: number[] = [];

    for (const [episode_id, segments] of byEpisode) {
      const earlyOutcome = detectSpeakerSwap(segments, h0Name ?? '', h1Name ?? '', { earlyOnly: true });
      console.log(`[speakerDetect] ep=${episode_id} early → ${earlyOutcome.result} (method=${earlyOutcome.method}, score=${earlyOutcome.score})`);
      if (earlyOutcome.result === 'swap') {
        await applySwap(episode_id);
        swapped++;
      } else if (earlyOutcome.result === 'no_swap') {
        await applyNoSwap(episode_id);
        unchanged++;
      } else {
        fullScanEpisodes.push(episode_id);
      }
    }

    // Waves 2–4 pass: fetch ALL segments for episodes not resolved by intro detection.
    // First-person anchors, direct address scoring, and positional heuristic are tried.
    for (const episode_id of fullScanEpisodes) {
      const allSegments = await db.select<
        Array<{ speaker_label: string; corrected_speaker: string | null; text: string | null }>
      >(
        `SELECT speaker_label, corrected_speaker, text
         FROM diarization_segments WHERE episode_id = ? ORDER BY start_ms`,
        [episode_id],
      );
      const outcome = detectSpeakerSwap(allSegments, h0Name ?? '', h1Name ?? '');
      console.log(`[speakerDetect] ep=${episode_id} → ${outcome.result} (method=${outcome.method}, score=${outcome.score})`);
      if (outcome.result === 'swap') {
        await applySwap(episode_id);
        swapped++;
      } else if (outcome.result === 'no_swap') {
        await applyNoSwap(episode_id);
        unchanged++;
      } else {
        uncertain++;
      }
    }

    await refresh();
    window.dispatchEvent(new CustomEvent('speaker-corrections-updated'));
    return { swapped, unchanged, uncertain };
  }, [refresh]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Poll every 3s while any episode is queued or processing
  useEffect(() => {
    const hasActive = episodes.some(
      (e) => e.diarizationStatus === 'queued' || e.diarizationStatus === 'processing'
    );
    if (!hasActive) return;
    const id = setInterval(() => refresh(), 3000);
    return () => clearInterval(id);
  }, [episodes, refresh]);

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
    autoDetectAllSpeakers,
  };
}
