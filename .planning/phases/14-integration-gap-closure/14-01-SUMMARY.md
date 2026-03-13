---
phase: 14-integration-gap-closure
plan: "01"
subsystem: database, ui
tags: [sqlite, fts5, migrations, react, typescript, deep-link, scroll]

# Dependency graph
requires:
  - phase: 13-cross-episode-topic-linking
    provides: "fetch_related_episodes command, TopicsList forceExpandEpisodeId deep-link pattern, 014_backfill_topics_fts.sql migration file"
  - phase: 12-search-ui
    provides: "FTS5 search_index infrastructure, search_transcripts command"
provides:
  - "Migration 014 registered in lib.rs — AI topic summaries now backfilled into FTS search index on next app launch for all existing installations"
  - "TopicsList scroll race eliminated — deep-link nav from Search page reliably scrolls to correct episode group after topics have loaded"
  - "Nav consumption is event-driven (onNavConsumed callback after scroll fires) — 800ms timer removed"
affects: [search, topics, deep-link-nav, fts5]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Loading-gated scroll: useEffect guards on !loading before firing scrollIntoView to avoid null querySelector"
    - "Idempotency ref pattern: scrolledForRef tracks which nav event was last scrolled so relatedMap updates do not re-fire scroll"
    - "Event-driven nav consumption: child component calls onNavConsumed after DOM action completes rather than parent using a fixed timer"

key-files:
  created: []
  modified:
    - src-tauri/src/lib.rs
    - src/components/Topics/TopicsList.tsx
    - src/components/pages/TopicsPage.tsx

key-decisions:
  - "topics dep added to scroll useEffect so effect re-evaluates after async topics populate DOM nodes (required for loading-gate to work)"
  - "onNavConsumed threaded as stable callback reference (not wrapped in arrow function) to avoid new function identity on every TopicsPage render"
  - "scrolledForRef.current cleared to null when forceExpandEpisodeId becomes falsy — ensures next nav event always fires"

patterns-established:
  - "Loading-gated effect with idempotency ref: guard on loading flag + ref storing last-fired value prevents double-scroll on derived state updates"
  - "Event-driven consumption: child fires callback after DOM operation instead of parent using setTimeout — eliminates timing-dependent nav state clears"

requirements-completed: [SRCH-05, LINK-01, LINK-02, LINK-03]

# Metrics
duration: 25min
completed: 2026-03-13
---

# Phase 14 Plan 01: Integration Gap Closure Summary

**Migration 014 registered in lib.rs for FTS topic backfill, and TopicsList deep-link scroll race fixed with loading-gated idempotency ref replacing 800ms timer**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-03-13
- **Completed:** 2026-03-13
- **Tasks:** 3 (2 auto + 1 human-verify)
- **Files modified:** 3

## Accomplishments

- Existing installations now run migration 014 on next app launch, backfilling AI topic summaries into FTS search index so SRCH-05 (topic summaries searchable) is fully live
- TopicsList scroll race eliminated: effect now waits for `loading === false` before firing scrollIntoView, preventing the silent null querySelector that occurred when topics had not yet loaded
- Nav consumption made event-driven: TopicsList calls `onNavConsumed` after scroll fires, removing the 800ms setTimeout from TopicsPage and ensuring Layout clears nav state exactly when scroll completes

## Task Commits

Each task was committed atomically:

1. **Task 1: Register migration 014 in lib.rs migrations vec (INT-01)** - `75ebf45` (feat)
2. **Task 2: Fix TopicsList scroll race and event-driven nav consumption (INT-02)** - `3e366c0` (fix)
3. **Task 3: Human QA — verify both gap fixes in dev mode** - human-verify checkpoint (no code commit)

## Files Created/Modified

- `src-tauri/src/lib.rs` - Added Migration version 14 entry (`014_backfill_topics_fts.sql`) to migrations vec after version 13
- `src/components/Topics/TopicsList.tsx` - Added `onNavConsumed` prop, `scrolledForRef` idempotency ref, replaced scroll useEffect with loading-gated version (deps: `[forceExpandEpisodeId, loading, topics, onNavConsumed]`)
- `src/components/pages/TopicsPage.tsx` - Removed 800ms setTimeout from externalNav effect, added `onNavConsumed={onTopicGroupNavConsumed}` prop to TopicsList

## Decisions Made

- `topics` included in scroll effect dependency array so the effect re-evaluates after the async topics array populates the DOM — without this, the loading guard fires once at `loading=true` and never re-runs when loading resolves
- `onNavConsumed` passed as a direct prop reference (not wrapped in an arrow function) to keep callback identity stable and prevent the scroll effect from re-running on every TopicsPage render
- `scrolledForRef.current` cleared to `null` when `forceExpandEpisodeId` is falsy so the next nav event always fires scroll even when navigating to the same episode group twice

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

Human QA noted two pre-existing FTS bugs unrelated to phase 14 changes:
1. Search results may include duplicates for re-diarized episodes (pre-existing FTS trigger issue from phase 12/13)
2. "Weitere Episoden" rows were empty in one test case (pre-existing data issue, not a regression from this plan)

Both items are out of scope for plan 14-01 and will be addressed separately. No issues were encountered during plan execution itself.

## User Setup Required

None — no external service configuration required. Migration 014 runs automatically on next app launch for existing installations.

## Next Phase Readiness

- v0.3.0 integration gaps closed: SRCH-05, LINK-01, LINK-02, LINK-03 all satisfied
- Two deferred pre-existing bugs noted (FTS duplicate results, Weitere Episoden empty) — candidates for a follow-up bug-fix plan if needed
- Ready for v0.3.0 release or new milestone planning

---
*Phase: 14-integration-gap-closure*
*Completed: 2026-03-13*

## Self-Check: PASSED

- `src-tauri/src/lib.rs` — modified in commit 75ebf45: FOUND
- `src/components/Topics/TopicsList.tsx` — modified in commit 3e366c0: FOUND
- `src/components/pages/TopicsPage.tsx` — modified in commit 3e366c0: FOUND
- Commit 75ebf45: FOUND
- Commit 3e366c0: FOUND
