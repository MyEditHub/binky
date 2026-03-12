-- Migration 013: Fix broken FTS5 AU triggers
--
-- The original AU triggers in migration 012 used the partial-column special
-- INSERT form for FTS5 deletions:
--
--   INSERT INTO search_index(search_index, rowid, episode_title, segment_text)
--   VALUES('delete', OLD.id, OLD.text, OLD.text);
--
-- FTS5's 'delete' special command requires ALL content columns to be specified.
-- Providing only 2 of 7 columns causes: SQL logic error (code: 1)
--
-- Since SQLite triggers run in the same transaction as the originating DML,
-- the error rolls back the UPDATE that fired the trigger (e.g. corrected_speaker
-- updates from autoDetectAllSpeakers were silently discarded).
--
-- Fix: replace the broken special-insert-delete form with:
--   • diarization_segments: DELETE FROM search_index WHERE rowid = OLD.id
--     (diarization segment id == search_index rowid, set explicitly in migration 012)
--   • transcripts / topics: subquery to find the auto-assigned rowid first

-- ─── diarization_segments ─────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS si_diarization_au;

CREATE TRIGGER si_diarization_au
AFTER UPDATE OF text, corrected_speaker ON diarization_segments
WHEN NEW.text IS NOT NULL AND NEW.text != ''
BEGIN
    DELETE FROM search_index WHERE rowid = OLD.id;
    INSERT INTO search_index(rowid, episode_id, episode_title, speaker, segment_text, segment_type, start_ms, end_ms)
    SELECT NEW.id,
           NEW.episode_id,
           e.title,
           COALESCE(NEW.corrected_speaker, NEW.speaker_label),
           NEW.text,
           'transcript',
           NEW.start_ms,
           NEW.end_ms
    FROM episodes e WHERE e.id = NEW.episode_id;
END;

-- ─── transcripts ──────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS si_transcripts_au;

CREATE TRIGGER si_transcripts_au
AFTER UPDATE OF full_text ON transcripts
WHEN NEW.full_text IS NOT NULL AND NEW.full_text != ''
  AND NOT EXISTS (
      SELECT 1 FROM diarization_segments ds
      WHERE ds.episode_id = NEW.episode_id AND ds.text IS NOT NULL AND ds.text != ''
  )
BEGIN
    -- Delete prior entry (rowid was auto-assigned at insert time; find it via episode_id + segment_type)
    DELETE FROM search_index WHERE rowid IN (
        SELECT rowid FROM search_index
        WHERE episode_id = OLD.episode_id AND segment_type = 'transcript'
    );
    INSERT INTO search_index(episode_id, episode_title, speaker, segment_text, segment_type, start_ms, end_ms)
    SELECT NEW.episode_id, e.title, NULL, NEW.full_text, 'transcript', NULL, NULL
    FROM episodes e WHERE e.id = NEW.episode_id;
END;

-- ─── topics ───────────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS si_topics_au;

CREATE TRIGGER si_topics_au
AFTER UPDATE OF title, description ON topics
WHEN NEW.ai_detected = 1
BEGIN
    -- Delete prior entry (rowid auto-assigned; find it via episode_id + segment_type + text match)
    DELETE FROM search_index WHERE rowid IN (
        SELECT rowid FROM search_index
        WHERE episode_id = OLD.detected_from_episode_id
          AND segment_type = 'topic'
          AND segment_text = OLD.title || ' ' || COALESCE(OLD.description, '')
    );
    INSERT INTO search_index(episode_id, episode_title, speaker, segment_text, segment_type, start_ms, end_ms)
    SELECT NEW.detected_from_episode_id,
           e.title,
           NULL,
           NEW.title || ' ' || COALESCE(NEW.description, ''),
           'topic',
           NULL,
           NULL
    FROM episodes e WHERE e.id = NEW.detected_from_episode_id;
END;
