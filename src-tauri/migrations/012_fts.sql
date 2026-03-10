-- Migration 012: FTS5 full-text search index
-- Creates a virtual FTS5 table `search_index` that indexes episode titles,
-- diarization segments, fallback transcripts, and AI-detected topics.
-- Tokenizer: unicode61 (remove_diacritics=1 default) — umlaut-tolerant German search.

-- =============================================================================
-- Section 1: Create the FTS5 virtual table
-- =============================================================================
-- Column index reference (0-based, used by snippet() in Plan 02):
--   0: episode_id   (UNINDEXED — metadata only)
--   1: episode_title (indexed)
--   2: speaker       (UNINDEXED — metadata only)
--   3: segment_text  (indexed — PRIMARY search column)
--   4: segment_type  (UNINDEXED — 'title' | 'transcript' | 'topic')
--   5: start_ms      (UNINDEXED — playback seek position)
--   6: end_ms        (UNINDEXED — playback seek position)

CREATE VIRTUAL TABLE IF NOT EXISTS search_index USING fts5(
    episode_id UNINDEXED,
    episode_title,
    speaker UNINDEXED,
    segment_text,
    segment_type UNINDEXED,
    start_ms UNINDEXED,
    end_ms UNINDEXED,
    tokenize = 'unicode61'
);

-- =============================================================================
-- Section 2: Bulk populate from existing data
-- =============================================================================

-- 1. Episode titles (segment_type = 'title')
INSERT INTO search_index(episode_id, episode_title, speaker, segment_text, segment_type, start_ms, end_ms)
SELECT e.id, e.title, NULL, e.title, 'title', NULL, NULL
FROM episodes e;

-- 2. Diarization segments — primary transcript source with speaker attribution
INSERT INTO search_index(episode_id, episode_title, speaker, segment_text, segment_type, start_ms, end_ms)
SELECT ds.episode_id,
       e.title,
       COALESCE(ds.corrected_speaker, ds.speaker_label),
       ds.text,
       'transcript',
       ds.start_ms,
       ds.end_ms
FROM diarization_segments ds
JOIN episodes e ON e.id = ds.episode_id
WHERE ds.text IS NOT NULL AND ds.text != '';

-- 3. Fallback: transcripts.full_text for episodes with NO diarization segments
-- NOT EXISTS guard prevents duplicating episodes that already have diarization text.
INSERT INTO search_index(episode_id, episode_title, speaker, segment_text, segment_type, start_ms, end_ms)
SELECT t.episode_id, e.title, NULL, t.full_text, 'transcript', NULL, NULL
FROM transcripts t
JOIN episodes e ON e.id = t.episode_id
WHERE t.full_text IS NOT NULL AND t.full_text != ''
  AND NOT EXISTS (
      SELECT 1 FROM diarization_segments ds
      WHERE ds.episode_id = t.episode_id AND ds.text IS NOT NULL AND ds.text != ''
  );

-- 4. Topics (title + description concatenated, AI-detected only)
INSERT INTO search_index(episode_id, episode_title, speaker, segment_text, segment_type, start_ms, end_ms)
SELECT t.detected_from_episode_id,
       e.title,
       NULL,
       t.title || ' ' || COALESCE(t.description, ''),
       'topic',
       NULL,
       NULL
FROM topics t
JOIN episodes e ON e.id = t.detected_from_episode_id
WHERE t.ai_detected = 1;

-- =============================================================================
-- Section 3: Triggers to keep the index fresh on future inserts/updates
-- =============================================================================

-- ---- diarization_segments ----

CREATE TRIGGER IF NOT EXISTS si_diarization_ai
AFTER INSERT ON diarization_segments
WHEN NEW.text IS NOT NULL AND NEW.text != ''
BEGIN
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

CREATE TRIGGER IF NOT EXISTS si_diarization_au
AFTER UPDATE OF text, corrected_speaker ON diarization_segments
WHEN NEW.text IS NOT NULL AND NEW.text != ''
BEGIN
    INSERT INTO search_index(search_index, rowid, episode_title, segment_text)
    VALUES('delete', OLD.id, OLD.text, OLD.text);
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

-- ---- transcripts ----

CREATE TRIGGER IF NOT EXISTS si_transcripts_ai
AFTER INSERT ON transcripts
WHEN NEW.full_text IS NOT NULL AND NEW.full_text != ''
  AND NOT EXISTS (
      SELECT 1 FROM diarization_segments ds
      WHERE ds.episode_id = NEW.episode_id AND ds.text IS NOT NULL AND ds.text != ''
  )
BEGIN
    INSERT INTO search_index(episode_id, episode_title, speaker, segment_text, segment_type, start_ms, end_ms)
    SELECT NEW.episode_id, e.title, NULL, NEW.full_text, 'transcript', NULL, NULL
    FROM episodes e WHERE e.id = NEW.episode_id;
END;

CREATE TRIGGER IF NOT EXISTS si_transcripts_au
AFTER UPDATE OF full_text ON transcripts
WHEN NEW.full_text IS NOT NULL AND NEW.full_text != ''
  AND NOT EXISTS (
      SELECT 1 FROM diarization_segments ds
      WHERE ds.episode_id = NEW.episode_id AND ds.text IS NOT NULL AND ds.text != ''
  )
BEGIN
    INSERT INTO search_index(search_index, rowid, episode_title, segment_text)
    VALUES('delete', OLD.rowid, OLD.full_text, OLD.full_text);
    INSERT INTO search_index(episode_id, episode_title, speaker, segment_text, segment_type, start_ms, end_ms)
    SELECT NEW.episode_id, e.title, NULL, NEW.full_text, 'transcript', NULL, NULL
    FROM episodes e WHERE e.id = NEW.episode_id;
END;

-- ---- topics ----

CREATE TRIGGER IF NOT EXISTS si_topics_ai
AFTER INSERT ON topics
WHEN NEW.ai_detected = 1
BEGIN
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

CREATE TRIGGER IF NOT EXISTS si_topics_au
AFTER UPDATE OF title, description ON topics
WHEN NEW.ai_detected = 1
BEGIN
    INSERT INTO search_index(search_index, rowid, episode_title, segment_text)
    VALUES('delete', OLD.rowid, OLD.title || ' ' || COALESCE(OLD.description, ''), OLD.title || ' ' || COALESCE(OLD.description, ''));
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
