import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import Database from '@tauri-apps/plugin-sql';

export interface TranscriptSegment {
  text: string;
  start_ms: number;
  end_ms: number;
}

export interface Transcript {
  id: number;
  episode_id: number;
  full_text: string;
  segments_json: string | null;
  model_name: string | null;
  language: string | null;
  created_at: string | null;
}

export interface TranscriptParagraph {
  text: string;
  startMs: number;
}

/** Gap in milliseconds between segments that triggers a new paragraph. */
const PARAGRAPH_GAP_MS = 2000;

/** Parse segments JSON and group into paragraphs based on silence gaps. */
export function groupIntoParagraphs(segmentsJson: string): TranscriptParagraph[] {
  let segments: TranscriptSegment[];
  try {
    segments = JSON.parse(segmentsJson);
  } catch {
    return [];
  }

  if (!Array.isArray(segments) || segments.length === 0) {
    return [];
  }

  const paragraphs: TranscriptParagraph[] = [];
  let currentTexts: string[] = [];
  let currentStartMs = segments[0].start_ms;
  let prevEndMs = segments[0].end_ms;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];

    if (i === 0) {
      currentTexts.push(seg.text.trim());
      prevEndMs = seg.end_ms;
      continue;
    }

    const gap = seg.start_ms - prevEndMs;

    if (gap > PARAGRAPH_GAP_MS) {
      // Flush current paragraph
      const text = currentTexts.join(' ').trim();
      if (text) {
        paragraphs.push({ text, startMs: currentStartMs });
      }
      currentTexts = [seg.text.trim()];
      currentStartMs = seg.start_ms;
    } else {
      currentTexts.push(seg.text.trim());
    }

    prevEndMs = seg.end_ms;
  }

  // Flush last paragraph
  const text = currentTexts.join(' ').trim();
  if (text) {
    paragraphs.push({ text, startMs: currentStartMs });
  }

  return paragraphs;
}

async function getDb(): Promise<InstanceType<typeof Database>> {
  return Database.load('sqlite:binky.db');
}

export function useTranscript(episodeId: number | null) {
  const [transcript, setTranscript] = useState<Transcript | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTranscript = useCallback(async (id: number) => {
    setLoading(true);
    setError(null);
    try {
      const db = await getDb();
      const rows = await db.select<Transcript[]>(
        'SELECT * FROM transcripts WHERE episode_id = ? LIMIT 1',
        [id]
      );
      setTranscript(rows.length > 0 ? rows[0] : null);
    } catch (err) {
      console.error('[useTranscript] loadTranscript error:', err);
      setError(String(err));
      setTranscript(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (episodeId === null) {
      setTranscript(null);
      setLoading(false);
      setError(null);
      return;
    }
    loadTranscript(episodeId);
  }, [episodeId, loadTranscript]);

  const deleteTranscript = useCallback(async (id: number): Promise<boolean> => {
    // Check if currently processing — block delete if so
    try {
      const status = await invoke<{ active_episode_id: number | null; queue_length: number; is_processing: boolean }>(
        'get_queue_status'
      );
      if (status.is_processing && status.active_episode_id === id) {
        return false;
      }
    } catch {
      // If invoke fails, allow delete attempt
    }

    try {
      const db = await getDb();
      await db.execute('DELETE FROM transcripts WHERE episode_id = ?', [id]);
      await db.execute(
        "UPDATE episodes SET transcription_status = 'not_started', transcription_error = NULL WHERE id = ?",
        [id]
      );
      setTranscript(null);
      return true;
    } catch (err) {
      console.error('[useTranscript] deleteTranscript error:', err);
      setError(String(err));
      return false;
    }
  }, []);

  return {
    transcript,
    loading,
    error,
    deleteTranscript,
    reload: loadTranscript,
  };
}
