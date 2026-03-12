-- Migration 014: Backfill AI-detected topics into FTS search index
--
-- Migration 012 populated search_index from existing data at migration time.
-- If topics were already in the DB when 012 ran, they should have been indexed.
-- However, on some installations the INSERT captured 0 rows (race condition or
-- topics table populated after 012 ran). This migration backfills any missing
-- topic entries idempotently using NOT EXISTS.

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
WHERE t.ai_detected = 1
  AND NOT EXISTS (
      SELECT 1 FROM search_index si
      WHERE si.episode_id = t.detected_from_episode_id
        AND si.segment_type = 'topic'
        AND si.segment_text = t.title || ' ' || COALESCE(t.description, '')
  );
