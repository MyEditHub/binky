---
phase: 11-fts-infrastructure
plan: 02
subsystem: api
tags: [rust, tauri, fts5, sqlite, search, rusqlite]

# Dependency graph
requires:
  - phase: 11-01
    provides: "FTS5 search_index virtual table (migration 012)"
provides:
  - "search_transcripts Tauri command — synchronous, BM25-ranked, prefix-matching FTS5 search"
  - "rebuild_search_index Tauri command — FTS5 rebuild special command"
  - "SearchResult struct — Phase 12 API contract (7 fields)"
  - "build_fts_query helper — input sanitization + prefix * for type-as-you-search"
affects:
  - "Phase 12 (Search UI) — consumes invoke('search_transcripts') and SearchResult contract"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Synchronous Tauri command (fn not async fn) for fast in-process SQLite queries"
    - "FTS5 MATCH with BM25 ordering — ORDER BY bm25(search_index) returns best-match-first"
    - "snippet() with column index 3 (segment_text), no HTML markup, max_tokens=40"
    - "Ok([]) not Err for FTS5 syntax errors — prevents frontend error toasts on malformed input"
    - "build_fts_query: strips FTS5 reserved chars, appends * to last token for prefix matching"

key-files:
  created:
    - src-tauri/src/commands/search.rs
  modified:
    - src-tauri/src/commands/mod.rs
    - src-tauri/src/lib.rs

key-decisions:
  - "search_transcripts is synchronous (fn, not async fn) — FTS5 on 55 episodes takes <5ms, avoids spawn_blocking complexity"
  - "snippet() uses column 3 (segment_text, 0-based), no HTML markup — Phase 12 handles highlight rendering"
  - "FTS5 syntax errors return Ok([]) not Err — prevents frontend error toasts for edge-case user input"
  - "build_fts_query strips chars outside [alphanumeric, whitespace, hyphen] to prevent FTS5 injection"
  - "Prefix * appended to last token only — earlier tokens are exact-match for AND semantics"
  - "invoke shape: invoke('search_transcripts', { query: string, limit?: number }) — Phase 12 contract"

patterns-established:
  - "FTS5 query error handling: match stmt.query_map(...) { Ok(mapped) => ... Err(_) => vec![] }"
  - "Minimum 2-char guard on query length before any DB access"
  - "rusqlite::Connection::open via app.path().app_data_dir().join('binky.db') — same pattern as topics.rs"

requirements-completed: [SRCH-01, SRCH-04, SRCH-05]

# Metrics
duration: 1min
completed: 2026-03-10
---

# Phase 11 Plan 02: Search Backend Commands Summary

**Synchronous search_transcripts Tauri command with BM25-ranked FTS5 MATCH queries, prefix matching, and SearchResult contract for Phase 12 integration**

## Performance

- **Duration:** ~1 min
- **Started:** 2026-03-10T20:36:21Z
- **Completed:** 2026-03-10T20:37:38Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Created `search.rs` with `SearchResult` struct (7 fields — Phase 12 API contract), `search_transcripts` command (synchronous, 2-char min guard, BM25 ordering, snippet extraction), and `rebuild_search_index` command
- Implemented `build_fts_query` helper that sanitizes input and appends `*` to last token for prefix/type-ahead matching
- Wired `pub mod search` into `commands/mod.rs` and registered both commands in `lib.rs` invoke_handler
- Verified `cargo check` passes with zero errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Create search.rs** - `d00bba3` (feat)
2. **Task 2: Wire search module into mod.rs and lib.rs invoke_handler** - `ec3a6b3` (feat)

## Files Created/Modified

- `src-tauri/src/commands/search.rs` - New file: SearchResult struct, build_fts_query, search_transcripts, rebuild_search_index
- `src-tauri/src/commands/mod.rs` - Added `pub mod search;`
- `src-tauri/src/lib.rs` - Added search_transcripts and rebuild_search_index to invoke_handler

## Decisions Made

- **Synchronous command:** `fn` not `async fn` — FTS5 queries on 55 episodes complete in under 5ms, avoids spawn_blocking complexity
- **snippet() column 3:** segment_text (0-based index), no HTML markup, max_tokens=40 (~250 chars) — Phase 12 handles highlight rendering client-side
- **Ok([]) for errors:** FTS5 syntax errors return empty array not Err — prevents frontend error toast for edge-case user input after sanitization
- **Prefix matching:** `*` appended only to last token — earlier tokens use FTS5 AND semantics (exact match required)
- **invoke shape fixed:** `invoke("search_transcripts", { query: string, limit?: number })` — Phase 12 must use this exact signature

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - cargo check passed on first attempt.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 12 (Search UI) can now call `invoke("search_transcripts", { query, limit })` and receive `SearchResult[]`
- `invoke("rebuild_search_index")` available for admin use
- SearchResult fields: `episode_id`, `title`, `speaker`, `snippet`, `segment_type`, `start_ms`, `end_ms`
- Phase 12 must handle `snippet` as plain text (no HTML markup) and apply its own highlight logic

---
*Phase: 11-fts-infrastructure*
*Completed: 2026-03-10*
