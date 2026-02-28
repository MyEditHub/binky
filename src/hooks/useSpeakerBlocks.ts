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

      const [rows, host0Name, host1Name, host0Color, host1Color] = await Promise.all([
        db.select<DiarizationSegmentRow[]>(
          `SELECT id, start_ms, end_ms, speaker_label, corrected_speaker, confidence, text
           FROM diarization_segments WHERE episode_id = ? ORDER BY start_ms`,
          [id],
        ),
        getSetting('host_0_name'),
        getSetting('host_1_name'),
        getSetting('host_0_color'),
        getSetting('host_1_color'),
      ]);

      // Run-length encoding merge: consecutive same-speaker segments with text
      const merged: SpeakerBlock[] = [];

      for (const row of rows) {
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

  return { blocks, loading };
}
