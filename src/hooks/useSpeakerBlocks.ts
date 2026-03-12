import Database from '@tauri-apps/plugin-sql';
import { useState, useEffect, useCallback } from 'react';
import { getSetting } from '../lib/settings';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SpeakerBlock {
  speaker: string;      // raw label: 'SPEAKER_0', 'SPEAKER_1', etc.
  displayName: string;  // resolved: 'Nadine', 'Philipp', or fallback 'Sprecher A'/'Sprecher B'
  color: string;        // resolved color from settings or defaults
  text: string;         // merged paragraph text (all consecutive lines joined with space)
}

interface DiarizationSegmentRow {
  id: number;
  start_ms: number;
  end_ms: number;
  speaker_label: string;
  corrected_speaker: string | null;
  confidence: number | null;
  text: string | null;
}

interface WhisperSegment {
  text: string;
  start_ms: number;
  end_ms: number;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const DEFAULT_COLORS: Record<string, string> = {
  SPEAKER_0: '#d97757',
  SPEAKER_1: '#5B8C5A',
};

const DEFAULT_NAMES: Record<string, string> = {
  SPEAKER_0: 'Sprecher A',
  SPEAKER_1: 'Sprecher B',
};

// ─── Name / color resolution ──────────────────────────────────────────────────

function resolveName(
  speaker: string,
  host0Name: string | null,
  host1Name: string | null,
): string {
  if (speaker === 'SPEAKER_0') return host0Name ?? DEFAULT_NAMES.SPEAKER_0;
  if (speaker === 'SPEAKER_1') return host1Name ?? DEFAULT_NAMES.SPEAKER_1;
  if (/^SPEAKER_\d+$/.test(speaker)) return 'Gast';
  return 'Unbekannt';
}

function resolveColor(
  speaker: string,
  host0Color: string | null,
  host1Color: string | null,
): string {
  if (speaker === 'SPEAKER_0') return host0Color ?? DEFAULT_COLORS.SPEAKER_0;
  if (speaker === 'SPEAKER_1') return host1Color ?? DEFAULT_COLORS.SPEAKER_1;
  return 'var(--color-border)';
}

// ─── Proportional overlap speaker assignment ───────────────────────────────────
//
// sherpa-rs produces overlapping/nested diarization windows: one large SPEAKER_0
// window (e.g. 30ms-48462ms) contains many short SPEAKER_1 interjection windows
// (300-1000ms). Whisper segments are always sequential and non-overlapping, so
// we use them as the atomic display unit and assign each one a speaker via
// proportional overlap against the diarization windows.
//
// Proportional = overlap_ms / diarization_window_duration_ms
// A 1s Whisper segment covering 99% of a 1s SPEAKER_1 window scores 0.99 vs
// ~0.04 for a surrounding 48s SPEAKER_0 window — correctly attributing it to
// SPEAKER_1.

function assignSpeakersToWhisperSegments(
  whisperSegs: WhisperSegment[],
  diarSegs: DiarizationSegmentRow[],
): Array<{ text: string; speaker: string }> {
  return whisperSegs
    .filter((ws) => ws.text.trim() !== '')
    .map((ws) => {
      const wsDur = ws.end_ms - ws.start_ms;
      if (wsDur <= 0) return null;

      let bestScore = -1;
      let bestSpeaker = 'SPEAKER_0';

      for (const ds of diarSegs) {
        const overlapStart = Math.max(ws.start_ms, ds.start_ms);
        const overlapEnd = Math.min(ws.end_ms, ds.end_ms);
        const overlap = overlapEnd - overlapStart;
        const dsDur = ds.end_ms - ds.start_ms;
        if (overlap > 0 && dsDur > 0) {
          // Precision-primary scoring: matches the Rust backfill in diarization.rs.
          // sherpa-rs produces NESTED windows — SPEAKER_0 is a large ~14s window that
          // envelops many tiny ~0.9s SPEAKER_1 interjection windows. Using Whisper
          // coverage as primary caused SPEAKER_0 to win every Whisper segment (it always
          // covers 100%), collapsing the entire transcript into one block.
          //
          // Precision (overlap / ds_dur) favors the smaller, more precise window
          // (SPEAKER_1), matching how the Rust backfill assigns text to diar segments.
          const score = (overlap * 1_000_000) / dsDur;
          if (score > bestScore) {
            bestScore = score;
            bestSpeaker = ds.corrected_speaker ?? ds.speaker_label;
          }
        }
      }

      return { text: ws.text.trim(), speaker: bestSpeaker };
    })
    .filter((x): x is { text: string; speaker: string } => x !== null);
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useSpeakerBlocks(episodeId: number | null): {
  blocks: SpeakerBlock[];
  loading: boolean;
} {
  const [blocks, setBlocks] = useState<SpeakerBlock[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (id: number) => {
    setLoading(true);
    try {
      const db = await Database.load('sqlite:binky.db');

      const [diarRows, transcriptRows, host0Name, host1Name, host0Color, host1Color] = await Promise.all([
        db.select<DiarizationSegmentRow[]>(
          `SELECT id, start_ms, end_ms, speaker_label, corrected_speaker, confidence, text
           FROM diarization_segments WHERE episode_id = ? ORDER BY start_ms`,
          [id],
        ),
        db.select<Array<{ segments_json: string | null }>>(
          `SELECT segments_json FROM transcripts WHERE episode_id = ? LIMIT 1`,
          [id],
        ),
        getSetting('host_0_name'),
        getSetting('host_1_name'),
        getSetting('host_0_color'),
        getSetting('host_1_color'),
      ]);

      if (diarRows.length === 0) {
        setBlocks([]);
        return;
      }

      // ── Whisper path ─────────────────────────────────────────────────────────
      // For Whisper episodes (segments_json present), use Whisper segments as the
      // atomic display unit ordered by their own start_ms. This avoids the
      // overlap ordering bug where a large SPEAKER_0 diarization window [30ms-48s]
      // would appear before all nested SPEAKER_1 interjection windows in ORDER BY
      // start_ms, causing all SPEAKER_0 text (pre- and post-interjection) to merge
      // into one block shown before SPEAKER_1's interjections.
      const segmentsJson = transcriptRows[0]?.segments_json ?? null;

      if (segmentsJson) {
        let whisperSegs: WhisperSegment[] = [];
        try {
          whisperSegs = JSON.parse(segmentsJson);
        } catch {
          whisperSegs = [];
        }

        if (Array.isArray(whisperSegs) && whisperSegs.length > 0) {
          const labeled = assignSpeakersToWhisperSegments(whisperSegs, diarRows);

          // RLE merge: consecutive same-speaker Whisper segments → one SpeakerBlock
          const merged: SpeakerBlock[] = [];
          for (const { text, speaker } of labeled) {
            const last = merged[merged.length - 1];
            if (last && last.speaker === speaker) {
              last.text = last.text + ' ' + text;
            } else {
              merged.push({
                speaker,
                displayName: resolveName(speaker, host0Name, host1Name),
                color: resolveColor(speaker, host0Color, host1Color),
                text,
              });
            }
          }

          setBlocks(merged);
          return;
        }
      }

      // ── AssemblyAI fallback path ─────────────────────────────────────────────
      // AssemblyAI diarization segments are sequential (non-overlapping), so
      // ORDER BY start_ms gives correct display order. Use diarization_segments.text
      // as before.
      const merged: SpeakerBlock[] = [];

      for (const row of diarRows) {
        if (row.text == null || row.text.trim() === '') continue;

        const effectiveSpeaker = row.corrected_speaker ?? row.speaker_label;
        const trimmedText = row.text.trim();

        const last = merged[merged.length - 1];
        if (last && last.speaker === effectiveSpeaker) {
          last.text = last.text + ' ' + trimmedText;
        } else {
          merged.push({
            speaker: effectiveSpeaker,
            displayName: resolveName(effectiveSpeaker, host0Name, host1Name),
            color: resolveColor(effectiveSpeaker, host0Color, host1Color),
            text: trimmedText,
          });
        }
      }

      setBlocks(merged);
    } catch (err) {
      console.error('[useSpeakerBlocks] load error:', err);
      setBlocks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (episodeId === null) {
      setBlocks([]);
      setLoading(false);
      return;
    }
    load(episodeId);
  }, [episodeId, load]);

  // Reload settings when window regains focus (user may have changed names in Settings)
  useEffect(() => {
    if (episodeId === null) return;

    const handleFocus = () => {
      load(episodeId);
    };

    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [episodeId, load]);

  // Reload when speaker corrections are updated (e.g. after "Sprecher erkennen")
  useEffect(() => {
    if (episodeId === null) return;

    const handleCorrections = () => {
      load(episodeId);
    };

    window.addEventListener('speaker-corrections-updated', handleCorrections);
    return () => {
      window.removeEventListener('speaker-corrections-updated', handleCorrections);
    };
  }, [episodeId, load]);

  return { blocks, loading };
}
