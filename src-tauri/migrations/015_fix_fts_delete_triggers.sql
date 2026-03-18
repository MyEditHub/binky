-- Migration 015: Add missing AFTER DELETE triggers on diarization_segments and topics
--
-- Root cause of search duplicates (Bug 1):
--   store_diarization_segments() does DELETE FROM diarization_segments WHERE episode_id = ?
--   followed by re-insertion. Migration 012 added AFTER INSERT and AFTER UPDATE triggers
--   but no AFTER DELETE trigger. Each re-diarization therefore leaves the old FTS rows
--   as orphans while the INSERT trigger adds new rows — producing N*2 FTS entries.
--
-- Root cause of empty Weitere Episoden (Bug 2):
--   analyze_episode_topics() does DELETE FROM topics WHERE detected_from_episode_id = ? AND ai_detected = 1
--   before re-inserting topics. Same missing-AFTER-DELETE pattern: old topic FTS rows are
--   orphaned, new INSERT trigger rows are added. The orphan accumulation degrades BM25 scoring
--   and causes the search_index to return stale/unmatched rows rather than current topic text,
--   making fetch_related_episodes return no matches.
--
-- Fix:
--   1. Add AFTER DELETE triggers for both tables.
--   2. Dedup existing orphaned rows in search_index (one-time cleanup).
--
-- Dedup strategy for diarization_segments:
--   FTS rowid = diarization_segment id (set explicitly in si_diarization_ai).
--   Orphans: rows in search_index WHERE segment_type='transcript' AND rowid NOT IN diarization_segments.id
--   (We check against the actual table to distinguish orphans from live rows.)
--
-- Dedup strategy for topics:
--   FTS rowid = auto-assigned (not pinned to topics.id).
--   Orphans: rows WHERE segment_type='topic' AND (episode_id, segment_text) not found in current topics.
--   Identify by NOT EXISTS match on topics table.

-- =============================================================================
-- Section 1: AFTER DELETE trigger for diarization_segments
-- =============================================================================

-- diarization_segments.id == search_index.rowid (explicit in si_diarization_ai insert).
-- A simple DELETE by rowid removes the FTS entry cleanly.

CREATE TRIGGER IF NOT EXISTS si_diarization_ad
AFTER DELETE ON diarization_segments
BEGIN
    DELETE FROM search_index WHERE rowid = OLD.id;
END;

-- =============================================================================
-- Section 2: AFTER DELETE trigger for topics
-- =============================================================================

-- topics FTS rowid is auto-assigned. Find the row by episode_id + segment_type + text match.

CREATE TRIGGER IF NOT EXISTS si_topics_ad
AFTER DELETE ON topics
WHEN OLD.ai_detected = 1
BEGIN
    DELETE FROM search_index WHERE rowid IN (
        SELECT rowid FROM search_index
        WHERE episode_id = OLD.detected_from_episode_id
          AND segment_type = 'topic'
          AND segment_text = OLD.title || ' ' || COALESCE(OLD.description, '')
    );
END;

-- =============================================================================
-- Section 3: Dedup existing orphaned diarization_segment FTS rows
-- =============================================================================
--
-- These are rows added by si_diarization_ai for segments that were subsequently
-- deleted (re-diarization) without a DELETE trigger. They have segment_type='transcript'
-- and a rowid that no longer exists in diarization_segments.
--
-- FTS5 does not support DELETE ... WHERE rowid NOT IN (...) directly.
-- Use a CTE to collect orphan rowids first, then delete by rowid.
--
-- Note: transcript rows from the fallback `transcripts.full_text` path do NOT use
-- a pinned rowid (they get auto-assigned), so we only clean rows where the rowid
-- corresponds to a diarization_segment that no longer exists.
-- We distinguish these by checking if the rowid appears in diarization_segments.id.
-- Auto-assigned transcript rowids (from the transcripts table) will be much larger
-- numbers and won't collide with diarization_segment ids in practice, but the
-- safest guard is NOT EXISTS on diarization_segments AND NOT EXISTS on transcripts.

DELETE FROM search_index
WHERE rowid IN (
    SELECT si.rowid
    FROM search_index si
    WHERE si.segment_type = 'transcript'
      AND NOT EXISTS (
          SELECT 1 FROM diarization_segments ds WHERE ds.id = si.rowid
      )
      AND NOT EXISTS (
          SELECT 1 FROM transcripts t
          WHERE t.episode_id = si.episode_id
            AND t.full_text = si.segment_text
      )
);

-- =============================================================================
-- Section 4: Dedup existing orphaned topic FTS rows
-- =============================================================================
--
-- These are rows with segment_type='topic' whose (episode_id, text) combination
-- no longer exists in the topics table (topic was deleted+re-inserted with new text,
-- or re-analyzed and the old topic title/description changed).

DELETE FROM search_index
WHERE rowid IN (
    SELECT si.rowid
    FROM search_index si
    WHERE si.segment_type = 'topic'
      AND NOT EXISTS (
          SELECT 1 FROM topics t
          WHERE t.detected_from_episode_id = si.episode_id
            AND t.ai_detected = 1
            AND t.title || ' ' || COALESCE(t.description, '') = si.segment_text
      )
);

-- =============================================================================
-- Section 5: Backfill any current topics that are missing from FTS
-- =============================================================================
--
-- After cleaning orphans, ensure every current ai_detected topic has a FTS row.
-- This covers the case where old orphans were the ONLY entries for an episode's topics
-- (the live topics never got indexed because the INSERT trigger was never fired for them
-- on this installation).

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
