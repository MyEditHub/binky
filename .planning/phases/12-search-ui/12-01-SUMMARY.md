---
phase: 12-search-ui
plan: 01
subsystem: ui
tags: [react, typescript, tauri, sqlite, fts5, search, i18n]

# Dependency graph
requires:
  - phase: 11-fts-infrastructure
    provides: search_transcripts Tauri command returning SearchResult[] with BM25 ranking
provides:
  - useSearch hook (debounced invoke, episode grouping, BM25 order preserved)
  - SearchPage component with input, loading, empty/no-results states
  - SearchResultCard with snippet highlighting and CustomEvent dispatch
  - SearchResultGroup episode grouping component
  - Layout.tsx pendingTranscriptNav state + navigate-to-transcript/navigate-to-episode-topics handlers
  - Sidebar 'Suche' nav item
  - German translation keys for search page
  - Search-specific CSS classes
affects: [12-02-transcript-deep-link, phase-13-topic-linking]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "useSearch: debounce via useRef+setTimeout, Map for BM25-order-preserving grouping"
    - "highlightSnippet: indexOf-based (not RegExp) for special-char-safe highlighting"
    - "Cross-page navigation via window CustomEvent dispatch pattern"
    - "@ts-expect-error to bridge Plan 01 → Plan 02 prop gap without TS errors"

key-files:
  created:
    - src/hooks/useSearch.ts
    - src/components/Search/SearchResultCard.tsx
    - src/components/Search/SearchResultGroup.tsx
    - src/components/pages/SearchPage.tsx
  modified:
    - src/components/Layout.tsx
    - src/components/Sidebar.tsx
    - src/locales/de/translation.json
    - src/styles.css

key-decisions:
  - "Map insertion order used (not sort()) to preserve BM25 ranking from backend"
  - "indexOf-based snippet highlighting avoids RegExp special-char escaping bugs"
  - "@ts-expect-error on EpisodesPage pendingTranscriptNav props — Plan 02 removes this"
  - "pendingTranscriptNav shape: { episodeId: number; startMs: number | null; title: string }"

patterns-established:
  - "Search navigation: window.dispatchEvent(new CustomEvent(...)) from SearchResultCard, Layout.tsx listens"
  - "pendingTranscriptNav: nullable state in Layout, passed to EpisodesPage, consumed via onTranscriptNavConsumed callback"

requirements-completed: [SRCH-02, SRCH-03]

# Metrics
duration: 15min
completed: 2026-03-12
---

# Phase 12 Plan 01: Search UI Summary

**React search page with debounced FTS5 invoke, BM25-order-preserved episode grouping, indexOf snippet highlighting, and CustomEvent deep-link navigation**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-12T20:07:00Z
- **Completed:** 2026-03-12T20:22:33Z
- **Tasks:** 2/3 auto tasks complete (Task 3 is checkpoint:human-verify)
- **Files modified:** 8

## Accomplishments
- useSearch hook: 300ms debounce, BM25-order-preserving Map grouping, query < 2 chars early-exit
- SearchResultCard: indexOf-based highlighting with `<mark className="transcript-highlight">`, CustomEvent dispatch for transcript and topic deep links
- SearchResultGroup: episode group header + card list
- SearchPage: input → loading spinner → grouped results → "Keine Ergebnisse" empty state
- Layout.tsx: pendingTranscriptNav state + navigate-to-transcript + navigate-to-episode-topics event listeners
- Sidebar: 'Suche' nav item added (not devOnly)
- Full German i18n: nav.search + pages.search.* keys
- CSS: search-input, search-result-card, search-result-badge, search-result-group, search-result-snippet
- npx tsc --noEmit: 0 errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Create useSearch hook and Search sub-components** - `47a6274` (feat)
2. **Task 2: Create SearchPage and wire into Layout + Sidebar + translations** - `56279f0` (feat)
3. **Task 3: Verify search page renders and returns results** - checkpoint:human-verify (pending)

## Files Created/Modified
- `src/hooks/useSearch.ts` - Debounced search hook, SearchResult + EpisodeGroup types
- `src/components/Search/SearchResultCard.tsx` - Result card with highlight, event dispatch
- `src/components/Search/SearchResultGroup.tsx` - Episode group header + card list
- `src/components/pages/SearchPage.tsx` - Search page with input, states, result groups
- `src/components/Layout.tsx` - Added 'search' page, pendingTranscriptNav, two new event listeners
- `src/components/Sidebar.tsx` - Added 'search' to Page type + allNavItems array
- `src/locales/de/translation.json` - nav.search + pages.search.* keys
- `src/styles.css` - Search-specific CSS classes

## Decisions Made
- Map insertion order used (not sort()) to preserve BM25 ranking from backend
- indexOf-based snippet highlighting avoids RegExp special-char escaping issues (e.g. German umlauts, Klammern)
- @ts-expect-error on EpisodesPage pendingTranscriptNav props to allow Plan 01 to compile without Plan 02's EpisodesPage changes
- pendingTranscriptNav shape: `{ episodeId: number; startMs: number | null; title: string }` — Plan 02 will consume this

## Deviations from Plan

None - plan executed exactly as written.

## Notes for Plan 02

- `pendingTranscriptNav` is typed as `{ episodeId: number; startMs: number | null; title: string } | null` in Layout.tsx
- The `@ts-expect-error Plan 02 adds these props` comment sits above the two new EpisodesPage props in Layout.tsx renderPage()
- Plan 02 must add `pendingTranscriptNav` and `onTranscriptNavConsumed` to EpisodesPage's props interface and remove the @ts-expect-error comment

## Issues Encountered
None.

## Next Phase Readiness
- Search UI complete: Suche nav item, search input, grouped results with highlighting, empty states
- Deep-link navigation infrastructure in place (pendingTranscriptNav state + event listeners in Layout.tsx)
- Plan 02 can immediately add EpisodesPage prop handling to consume pendingTranscriptNav

---
*Phase: 12-search-ui*
*Completed: 2026-03-12*

## Self-Check: PASSED
- All 4 created files verified on disk
- Both task commits verified in git log (47a6274, 56279f0)
- TypeScript: 0 errors
