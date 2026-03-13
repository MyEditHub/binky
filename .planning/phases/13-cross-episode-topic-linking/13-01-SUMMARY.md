---
phase: 13-cross-episode-topic-linking
plan: 01
subsystem: api
tags: [rust, tauri, sqlite, fts5, search]

# Dependency graph
requires:
  - phase: 12-search-ui
    provides: FTS5 search_index with segment_type='topic' rows indexed by 014_backfill_topics_fts.sql
provides:
  - fetch_related_episodes Tauri command (synchronous, HashMap<i64, Vec<RelatedEpisode>>)
  - RelatedEpisode struct with episode_id, episode_title, episode_number fields
affects:
  - 13-02 (frontend that calls fetch_related_episodes)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Synchronous Tauri command (fn not async fn) for FTS5 batch queries — same pattern as search_transcripts"
    - "German stop-word stripping before FTS5 OR query construction"
    - "BM25-ranked deduplication: LIMIT 10 candidates, deduplicate by episode_id, take top 3"

key-files:
  created: []
  modified:
    - src-tauri/src/commands/search.rs
    - src-tauri/src/lib.rs

key-decisions:
  - "Synchronous fn chosen over async fn — FTS5 topic queries are <5ms, matches search_transcripts pattern"
  - "OR query over AND query for topic keywords — broader recall better for related-episode discovery"
  - "exclude_id = -1 fallback for topics without detected_from_episode_id — -1 never matches a real id"
  - "LIMIT 10 before dedup to ensure 3 unique episodes available even when one episode has many topic rows"

patterns-established:
  - "STOP_WORDS constant as &[&str] with .to_lowercase() comparison — handles mixed-case topic titles"
  - "Per-topic errors stored as empty Vec and continued — never propagate per-topic DB errors to caller"
  - "stmt declared outside of rows binding block to satisfy Rust borrow checker (MappedRows borrows stmt)"

requirements-completed:
  - LINK-01
  - LINK-03

# Metrics
duration: 2min
completed: 2026-03-13
---

# Phase 13 Plan 01: Rust fetch_related_episodes Command Summary

**Synchronous Tauri command `fetch_related_episodes` using FTS5 BM25 + German stop-word stripping to return top-3 related episodes per topic as HashMap<i64, Vec<RelatedEpisode>>**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-13T06:53:24Z
- **Completed:** 2026-03-13T06:55:24Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- `fetch_related_episodes` Rust command compiled and registered — LINK-03 backend live
- German stop-word stripping prevents high-frequency words from dominating BM25 results
- Source episode excluded from results (no self-referencing links), deduplication ensures unique episodes

## Task Commits

Each task was committed atomically:

1. **Task 1: Add RelatedEpisode struct and fetch_related_episodes command** - `bea317b` (feat)
2. **Task 2: Register fetch_related_episodes in lib.rs invoke_handler** - `2d569ea` (feat)

## Files Created/Modified

- `src-tauri/src/commands/search.rs` - Added RelatedEpisode struct, STOP_WORDS, build_topic_fts_query helper, fetch_related_episodes command
- `src-tauri/src/lib.rs` - Registered fetch_related_episodes in generate_handler! list

## Decisions Made

- Synchronous `fn` chosen over `async fn` — FTS5 topic queries on 55 episodes are <5ms, consistent with `search_transcripts` pattern
- OR query semantics for topic keywords (broader recall) rather than AND (too restrictive for short topic titles)
- `exclude_id = source_episode_id.unwrap_or(-1)` — -1 never matches a real SQLite row id, clean fallback

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Rust borrow checker error in rows collection block**
- **Found during:** Task 1 (fetch_related_episodes implementation)
- **Issue:** Plan code wrapped `stmt` declaration inside a block with `{}`, causing `MappedRows<'_>` to borrow `stmt` across the block boundary — Rust E0597 lifetime error
- **Fix:** Moved `stmt` declaration outside the block (no inner block needed), allowing borrow checker to see stmt lives long enough for the mapped rows to be collected
- **Files modified:** src-tauri/src/commands/search.rs
- **Verification:** `cargo check` exits 0 with no errors
- **Committed in:** bea317b (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug in plan's code pattern)
**Impact on plan:** Trivial structural fix. Semantics identical to plan's intent.

## Issues Encountered

None beyond the Rust borrow checker fix documented above.

## Next Phase Readiness

- `fetch_related_episodes` is registered and ready to invoke from frontend
- TypeScript contract: `invoke('fetch_related_episodes', { topicIds: number[] })` returns `Record<number, RelatedEpisode[]>`
- 13-02 frontend plan can proceed immediately

---
*Phase: 13-cross-episode-topic-linking*
*Completed: 2026-03-13*
