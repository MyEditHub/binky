---
phase: 12-search-ui
plan: 02
subsystem: ui
tags: [react, typescript, tauri, transcript, deep-link, navigation, sqlite, fts5]

requires:
  - phase: 12-01
    provides: search UI with SearchResultCard emitting pendingTranscriptNav, Layout.tsx wiring
  - phase: 11-search-backend
    provides: FTS5 search index, search_transcripts invoke command

provides:
  - Deep-link navigation from search results to TranscriptViewer scrolled to matching segment
  - SpeakerBlock.startMs timing field for DOM-based scroll targeting
  - TranscriptViewer.scrollToMs prop + data-start-ms attributes on all rendered blocks
  - EpisodesPage consuming pendingTranscriptNav from Layout.tsx
  - Migration 014 backfilling topics into FTS index idempotently

affects: [phase-13, TranscriptViewer, EpisodesPage, useSpeakerBlocks]

tech-stack:
  added: []
  patterns:
    - "DOM query pattern: querySelectorAll('[data-start-ms]') + closest-ms scan for scroll targeting"
    - "Nav consumption: effect calls onNavConsumed() inside setViewingTranscript useEffect to prevent re-trigger"
    - "Timing propagation: startMs flows useSpeakerBlocks → SpeakerBlock interface → data-start-ms attr → DOM query"

key-files:
  created:
    - src-tauri/migrations/014_backfill_topics_fts.sql
  modified:
    - src/hooks/useSpeakerBlocks.ts
    - src/components/TranscriptViewer/TranscriptViewer.tsx
    - src/components/pages/EpisodesPage.tsx
    - src/components/Layout.tsx

key-decisions:
  - "scrollToMs useEffect depends on speakerBlocks AND paragraphs (not just isLoading) — fires after data arrives, not just flag flip"
  - "onTranscriptNavConsumed called inside useEffect immediately after setViewingTranscript — clears nav before next render"
  - "SpeakerBlock wrapper div pattern: SpeakerBlock.tsx does not forward data-* attrs, so outer div carries data-start-ms"
  - "Migration 014 uses NOT EXISTS guard for idempotent backfill — safe to run on any installation"

patterns-established:
  - "Deep-link nav pattern: Layout sets pending nav state, page consumes via useEffect, clears immediately after setViewingTranscript"
  - "DOM scroll targeting: data-start-ms attributes on all transcript blocks, querySelectorAll + closest-ms arithmetic"

requirements-completed: [SRCH-03]

duration: ~45min
completed: 2026-03-12
---

# Phase 12 Plan 02: Deep-Link Navigation Summary

**TranscriptViewer deep-link navigation from search results — clicking a result opens the episode transcript scrolled to the matching segment via data-start-ms DOM targeting**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-03-12T21:00:00Z
- **Completed:** 2026-03-12T21:35:00Z
- **Tasks:** 4 (3 auto + 1 human-verify)
- **Files modified:** 5

## Accomplishments

- Added `startMs: number` to SpeakerBlock interface; both RLE merge paths (Whisper and AssemblyAI fallback) now propagate `start_ms` from the first segment in each merged block
- TranscriptViewer accepts `scrollToMs?: number` prop and auto-scrolls to closest `data-start-ms` element after data loads — effect correctly depends on `speakerBlocks` and `paragraphs` so it fires after data arrives, not just on mount
- EpisodesPage consumes `pendingTranscriptNav` from Layout.tsx via useEffect — opens TranscriptViewer with `scrollToMs` and calls `onTranscriptNavConsumed()` immediately to prevent re-triggering
- Removed `@ts-expect-error` comment from Layout.tsx (Plan 01 placeholder, no longer needed)
- Migration 014 backfills AI-detected topics into FTS search index with NOT EXISTS guard — fixes installations where 012 captured 0 topic rows due to timing
- Human verified: clicking a transcript search result opens TranscriptViewer scrolled to the matching segment; topic results navigate to Themen page

## Task Commits

Each task was committed atomically:

1. **Task 1: Add startMs to SpeakerBlock interface** - `36d0dd3` (feat)
2. **Task 2: Add scrollToMs to TranscriptViewer + data-start-ms** - `4c94b65` (feat)
3. **Task 3: Extend EpisodesPage with pendingTranscriptNav** - `61ac006` (feat)
4. **Task 4: Human-verify deep-link navigation** - approved (no code commit)
5. **Migration 014 backfill topics FTS** - `59620be` (chore)

**Plan metadata commit:** (see final commit below)

## Files Created/Modified

- `src/hooks/useSpeakerBlocks.ts` — `startMs` field added to SpeakerBlock interface; both Whisper and AssemblyAI merge paths capture `start_ms` from first segment
- `src/components/TranscriptViewer/TranscriptViewer.tsx` — `scrollToMs` prop, scroll-to-segment useEffect, `data-start-ms` on speaker block wrapper divs and fallback paragraphs
- `src/components/pages/EpisodesPage.tsx` — `pendingTranscriptNav` + `onTranscriptNavConsumed` props, useEffect consuming nav, `scrollToMs` forwarded to TranscriptViewer
- `src/components/Layout.tsx` — `@ts-expect-error` comment removed (EpisodesPage now accepts the props)
- `src-tauri/migrations/014_backfill_topics_fts.sql` — idempotent NOT EXISTS backfill of topics into FTS search index

## Decisions Made

- **Scroll effect dependency array:** `[scrollToMs, isLoading, speakerBlocks, paragraphs]` — including the data arrays ensures the effect re-runs after blocks load, not just after the loading flag clears
- **SpeakerBlock wrapper div:** SpeakerBlock.tsx is purely presentational (no prop forwarding), so each block is wrapped in `<div data-start-ms={block.startMs}>` — key moved from SpeakerBlock to the outer div
- **Nav consumption timing:** `onTranscriptNavConsumed()` called inside the `pendingTranscriptNav` useEffect immediately after `setViewingTranscript` — ensures Layout.tsx clears state before next render, preventing double-open
- **Migration 014 scope:** Separate migration from 012 (not a data fix to 012) — safe for all existing installations, NOT EXISTS guard makes it idempotent

## Deviations from Plan

None — plan executed exactly as written. Migration 014 was created during Plan 01 execution (noted in checkpoint context) and committed here as specified.

## Issues Encountered

None. TypeScript check passed with 0 errors after Task 3. Human verification confirmed all 8 flow points in Task 4.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Phase 12 complete: SRCH-02 (search UI with speaker labels) and SRCH-03 (deep-link navigation) both satisfied
- Phase 13 (Cross-Episode Topic Linking) can begin — FTS topics index confirmed working, topic result navigation verified
- FTS search index fully populated: transcript segments + episode titles + topics (migration 014 ensures backfill)

---
*Phase: 12-search-ui*
*Completed: 2026-03-12*
