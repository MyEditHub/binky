---
phase: 13-cross-episode-topic-linking
plan: 02
subsystem: ui
tags: [react, typescript, tauri, topics, deep-link, navigation, i18n]

# Dependency graph
requires:
  - phase: 13-01
    provides: fetch_related_episodes Rust command returning RelatedEpisode[] per topic_id
provides:
  - RelatedEpisode interface exported from TopicRow.tsx
  - "Weitere Episoden" inline section in topic cards (shows related episodes from FTS5)
  - Deep-link navigation: clicking related episode navigates to that episode's group in TopicsPage
  - TopicsList collapsedGroups refactored to Set<number> keyed by episode_id
  - data-episode-group attribute on group divs for smooth scroll targeting
  - TopicsPage batch-invokes fetch_related_episodes once per topics state change
  - Layout passes pendingTopicGroupNav + onTopicGroupNavConsumed to TopicsPage
affects: [TopicsPage, TopicsList, TopicRow, Layout]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Prop-threading pattern: relatedMap flows TopicsPage → TopicsList → TopicRow
    - Deep-link pattern: CustomEvent with detail.episodeId → Layout state → forceExpandEpisodeId prop → useEffect scroll
    - Batch invoke pattern: fetch once per topics state change, not per-card
    - Sentinel key pattern: -1 for "no episode" group in Set<number> collapsedGroups

key-files:
  created: []
  modified:
    - src/components/Topics/TopicRow.tsx
    - src/components/Topics/TopicsList.tsx
    - src/components/pages/TopicsPage.tsx
    - src/components/Layout.tsx
    - src/locales/de/translation.json
    - src/styles.css

key-decisions:
  - "collapsedGroups key refactored from Set<string> to Set<number> (episode_id) — enables forceExpandEpisodeId to reliably delete the correct key without string comparison"
  - "fetch_related_episodes called once per topics state change (useEffect on topics), never per-card — prevents N+1 invoke calls"
  - "pendingTopicGroupNav consumed after 800ms timeout — gives TopicsList time to re-render expanded group before clearing forceExpandEpisodeId"
  - "useEffect moved above early returns in TopicsList — fixes React rules of hooks violation (hooks cannot be called conditionally)"

patterns-established:
  - "Deep-link group expand: CustomEvent detail → Layout state → externalNav prop → useEffect(setViewMode + timer) + forceExpandEpisodeId → TopicsList useEffect(delete from collapsedGroups + scrollIntoView)"
  - "Batch related data fetch: single invoke after state change, Map<number, T[]> stored in page state, passed via prop threading"

requirements-completed: [LINK-01, LINK-02, LINK-03]

# Metrics
duration: 15min
completed: 2026-03-13
---

# Phase 13 Plan 02: Frontend — Related Episodes UI + Deep-Link Navigation Summary

**Related-episodes inline section in topic cards with FTS5-backed cross-episode navigation via prop-threaded relatedMap and deep-link group expand/scroll**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-13T00:00:00Z
- **Completed:** 2026-03-13T00:15:00Z
- **Tasks:** 5 of 5 (4 automated + 1 human-verify — all approved)
- **Files modified:** 6

## Accomplishments
- Added `RelatedEpisode` interface (exported from TopicRow.tsx) and "Weitere Episoden" inline section rendered only when results exist
- Wired `fetch_related_episodes` batch invoke in TopicsPage — called once per `topics` state change, never per-card
- Implemented full deep-link navigation: clicking a related episode dispatches `navigate-to-episode-topics` → Layout reads `episodeId` → TopicsPage switches to grouped view + expands target group + scrolls to it
- Added 3 German translation keys: `related_episodes_label`, `related_episode_entry`, `related_episodes_none`

## Task Commits

1. **Task 1: TopicRow RelatedEpisode interface + Weitere Episoden section** - `a28e96b` (feat)
2. **Task 2: TopicsList collapsedGroups refactor + forceExpand/scroll** - `c6d891c` (feat)
3. **Task 3: TopicsPage batch fetch + Layout event extension** - `ada5438` (feat)
4. **Task 4: German translation keys** - `4a70d28` (feat)
5. **Task 5: Human verify checkpoint** — approved by user (all 6 verification items passed; no code changes)

## Files Created/Modified
- `src/components/Topics/TopicRow.tsx` - Added RelatedEpisode interface, relatedEpisodes prop, Weitere Episoden JSX section
- `src/components/Topics/TopicsList.tsx` - Refactored to Set<number>, added relatedMap/forceExpandEpisodeId props, useEffect for expand+scroll, data-episode-group attr
- `src/components/pages/TopicsPage.tsx` - Added TopicsPageProps, relatedMap state, fetchRelatedForTopics, useEffect on topics + externalNav
- `src/components/Layout.tsx` - Added pendingTopicGroupNav state, extended handleNavigateToEpisodeTopics to read episodeId, passes props to TopicsPage
- `src/locales/de/translation.json` - Added related_episodes_label, related_episode_entry, related_episodes_none under pages.topics
- `src/styles.css` - Added CSS for .topic-related-episodes, .topic-related-episodes-label, .topic-related-episodes-list, .topic-related-episode-btn

## Decisions Made
- `collapsedGroups` key changed from `Set<string>` to `Set<number>` (episode_id) — enables `forceExpandEpisodeId` to delete the exact key without fragile string-matching
- `fetch_related_episodes` called once per `topics` state change — batch invoke avoids N+1 Tauri invocations
- 800ms timeout before consuming `pendingTopicGroupNav` — allows TopicsList to re-render the expanded group before clearing `forceExpandEpisodeId`
- `useEffect` placed above early returns in TopicsList — required by React rules of hooks; original plan placed it after guard clauses which would be a rules violation

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Moved useEffect above early returns in TopicsList**
- **Found during:** Task 2 (TopicsList refactor)
- **Issue:** Plan's step 6 placed the `forceExpand useEffect` after the `loading`/`topics.length === 0` early return guards. React requires hooks to be called unconditionally at the top level.
- **Fix:** Moved `useState(collapsedGroups)`, `toggleGroup`, and `useEffect(forceExpandEpisodeId)` above all early returns before the conditional render blocks.
- **Files modified:** src/components/Topics/TopicsList.tsx
- **Verification:** `npx tsc --noEmit` exits 0; no React hooks lint warnings
- **Committed in:** c6d891c (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug prevention)
**Impact on plan:** Essential fix — hooks after conditional returns would cause React to throw at runtime. No scope creep.

## Issues Encountered
None beyond the hooks placement fix above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 3 LINK requirements satisfied (frontend wired to 13-01 backend)
- Phase 13 complete — human verification (task 5) approved
- v0.3.0 features complete: FTS search (phase 11), search UI (phase 12), topic linking (phase 13)
