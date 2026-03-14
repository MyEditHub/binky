---
phase: 15-unified-pipeline-progress-bar
plan: "02"
subsystem: react-frontend
tags: [pipeline, progress-bar, sidebar, hook, css, translations]
dependency_graph:
  requires:
    - pipeline_status/pipeline_progress columns on episodes (from 15-01)
    - start_pipeline / cancel_pipeline Tauri commands (from 15-01)
    - PipelineEvent Channel types (from 15-01)
  provides:
    - usePipeline hook consuming PipelineEvent Channel
    - EpisodeRow with unified pipeline progress bar (step label, error, interrupted states)
    - EpisodeExpandedView with 'Verarbeiten' button triggering full pipeline
    - Sidebar pipeline strip (episode title + thin bar, visible from any page)
    - CSS for all pipeline states (error=red, interrupted=amber, fade-out animation)
  affects:
    - src/hooks/useEpisodes.ts
    - src/components/EpisodeList/EpisodeList.tsx
    - src/components/EpisodeList/EpisodeRow.tsx
    - src/components/EpisodeList/EpisodeExpandedView.tsx
    - src/components/Sidebar.tsx
    - src/components/Layout.tsx
    - src/components/pages/EpisodesPage.tsx
    - src/styles.css
    - src/locales/de/translation.json
tech_stack:
  added: []
  patterns:
    - Pipeline state lifted through EpisodeList → EpisodesPage → Layout → Sidebar via callbacks
    - isFadingOut local state in EpisodeRow to hold bar at 100% briefly before hiding
    - prevActiveRef/prevProgressRef refs to detect Done→idle transition for fade-out
    - Sidebar strip conditionally renders expanded (title+bar) vs collapsed (bar only) layouts
    - Stage labels mapped inline in usePipeline (STAGE_LABELS constant) — no i18n call needed in hook
key_files:
  created:
    - src/hooks/usePipeline.ts
  modified:
    - src/hooks/useEpisodes.ts
    - src/components/EpisodeList/EpisodeList.tsx
    - src/components/EpisodeList/EpisodeRow.tsx
    - src/components/EpisodeList/EpisodeExpandedView.tsx
    - src/components/Sidebar.tsx
    - src/components/Layout.tsx
    - src/components/pages/EpisodesPage.tsx
    - src/styles.css
    - src/locales/de/translation.json
decisions:
  - "Only German locale (de/translation.json) exists in the project — no en.json to add. Pipeline keys added to de/translation.json only."
  - "Stage labels in usePipeline use a STAGE_LABELS constant (not t() calls) since hooks can call useTranslation but the labels are simple enough to keep inline without i18n overhead."
  - "pipelineProgress state in usePipeline held at 100 for 1s on Done before clearing — isFadingOut in EpisodeRow detects the active→idle transition at 100% to trigger the 400ms fade animation."
  - "Sidebar strip uses pipelineProgress > 0 gate (not isProcessing) so it shows correctly even briefly after the 1s Done hold begins clearing."
  - "useTranscription.ts and useDiarization.ts left unchanged per plan — AnalyticsPage still uses them for standalone per-stage operations."
metrics:
  duration_minutes: 11
  completed_date: "2026-03-14"
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 9
---

# Phase 15 Plan 02: Unified Pipeline Progress Bar Frontend Summary

**One-liner:** React frontend for the unified 4-stage pipeline: usePipeline hook consuming PipelineEvent Channel, EpisodeRow with step label and error/interrupted states, 'Verarbeiten' button in EpisodeExpandedView, sidebar pipeline strip pinned to bottom visible from any page, and completion fade-out animation.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | usePipeline hook + EpisodeList/EpisodeRow/EpisodeExpandedView wiring | a634412 | usePipeline.ts, useEpisodes.ts, EpisodeRow.tsx, EpisodeExpandedView.tsx, EpisodeList.tsx, de/translation.json |
| 2 | Sidebar pipeline strip + CSS for all pipeline states | 8de5f95 | Sidebar.tsx, Layout.tsx, EpisodesPage.tsx, styles.css |

## What Was Built

### usePipeline hook (`src/hooks/usePipeline.ts`)
New hook replacing `useTranscription` for the unified pipeline flow:
- `PipelineState` interface: `isProcessing`, `activeEpisodeId`, `activeEpisodeTitle`, `progress` (0–100), `stepLabel`, `error`, `errorStage`, `interrupted`
- `startPipeline(episodeId, audioUrl, episodeTitle)` creates a `Channel<PipelineEvent>` and invokes `start_pipeline`
- Handles all 6 PipelineEvent variants: StageStarted, Progress, StageDone, Done (1s hold then clear), Error (keeps activeEpisodeId for inline bar), Cancelled
- `cancelPipeline()` invokes `cancel_pipeline`
- Accepts `onEpisodeUpdated` and `onPipelineStateChange` callbacks for parent coordination
- `STAGE_LABELS` constant maps stage names to German display labels inline

### Episode type extension (`src/hooks/useEpisodes.ts`)
Added `pipeline_status: 'idle' | 'running' | 'done' | 'error' | 'interrupted' | null` and `pipeline_progress: number | null` fields to the `Episode` interface (DB columns from migration 016).

### EpisodeRow (`src/components/EpisodeList/EpisodeRow.tsx`)
- Replaced `transcriptionProgress: number | null` with pipeline props: `pipelineProgress`, `pipelineStepLabel`, `pipelineActive`, `pipelineError`, `pipelineInterrupted`
- Shows progress bar with step label when `pipelineActive || pipelineError || pipelineInterrupted || isFadingOut || isPersistedInterrupted`
- `isFadingOut` state: detects `pipelineActive` true→false transition while `prevProgress === 100` → shows bar at 100% with `fade-out` class for 400ms then clears
- `isPersistedInterrupted`: reads `episode.pipeline_status === 'interrupted'` from DB to show interrupted state even when not actively tracking
- `StatusBadge` hidden while bar is shown, restored when idle
- Error fill (red) and interrupted fill (amber) via CSS modifier classes

### EpisodeExpandedView (`src/components/EpisodeList/EpisodeExpandedView.tsx`)
- Renamed `onTranscribe` → `onProcess`, `isTranscribing` → `isPipelineRunning`
- Button label: uses `episodes.process` key ('Verarbeiten') instead of 'Transkribieren'
- Queued button uses `pipeline.queued` key ('In Warteschlange')
- `anotherIsActive` tooltip updated to "Eine andere Episode wird gerade verarbeitet."

### EpisodeList (`src/components/EpisodeList/EpisodeList.tsx`)
- Replaced `useTranscription` import with `usePipeline`
- New `onPipelineStateChange` prop forwarded to `usePipeline`
- `handlePipelineStateChange` callback: calls both `onPipelineStateChange` (for sidebar) and `onTranscriptionStateChange` (for badge compatibility)
- Passes all pipeline props to `EpisodeRow`, `isPipelineRunning` to `EpisodeExpandedView`
- `startPipeline(ep.id, ep.audio_url, ep.title)` passes episode title for sidebar strip

### Layout + EpisodesPage state lifting
- Layout.tsx: `pipelineProgress`, `pipelineStepLabel`, `pipelineEpisodeTitle` state + `handlePipelineStateChange` callback that updates them; passed as new props to `<Sidebar>` and `onPipelineStateChange` to `<EpisodesPage>`
- EpisodesPage.tsx: accepts and forwards `onPipelineStateChange` to `<EpisodeList>`

### Sidebar pipeline strip (`src/components/Sidebar.tsx`)
- New props: `pipelineProgress`, `pipelineStepLabel`, `pipelineEpisodeTitle`
- Renders when `pipelineProgress > 0`:
  - Expanded: `.sidebar-pipeline-strip` with label (episode title, fallback to step label) + 3px thin bar
  - Collapsed: `.sidebar-pipeline-strip.sidebar-pipeline-strip-collapsed` with bar only
- Uses `isCollapsed` prop (already available) to switch layouts

### CSS (`src/styles.css`)
All new pipeline CSS added after existing `.episode-progress-fill`:
- `.episode-progress-fill.error` — red fill (`#e53e3e`)
- `.episode-progress-fill.interrupted` — amber fill (`#d69e2e`) at 0.8 opacity
- `.episode-progress-bar.fade-out` — `progressFadeOut` keyframe animation (opacity 1→0 over 400ms)
- `.pipeline-step-label` — 11px secondary text block below the bar
- `.sidebar-pipeline-strip`, `.sidebar-pipeline-label`, `.sidebar-pipeline-bar`, `.sidebar-pipeline-bar-fill` — sidebar strip components
- `.sidebar-pipeline-strip-collapsed` — collapsed layout override
- `.sidebar-pipeline-bar-fill.error` and `.interrupted` variants

### Translations (`src/locales/de/translation.json`)
Added new keys:
- `episodes.process`: "Verarbeiten"
- `pipeline.downloading`: "Herunterladen..."
- `pipeline.transcribing`: "Transkription..."
- `pipeline.diarizing`: "Sprecher erkennen..."
- `pipeline.analyzing`: "Themen analysieren..."
- `pipeline.error`: "Fehler: {{stage}}"
- `pipeline.interrupted`: "Unterbrochen"
- `pipeline.queued`: "In Warteschlange"

Existing `episodes.transcribe_btn` key preserved for AnalyticsPage retry button usage.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Only German locale exists — no en.json to update**
- **Found during:** Task 1
- **Issue:** Plan specified updating both `de.json` and `en.json`. The project uses only `src/locales/de/translation.json` (German-only, configured in i18n.ts with `lng: 'de'`, `fallbackLng: 'de'`).
- **Fix:** Added all pipeline keys to `de/translation.json` only. No `en.json` exists or needs creating.
- **Files modified:** src/locales/de/translation.json

**2. [Rule 1 - Bug] Stage label map in usePipeline is inline, not using t()**
- **Found during:** Task 1
- **Issue:** Plan said "use `t()` from useTranslation or a local map." The channel.onmessage closure runs outside React render, making `t()` calls awkward to pass in. The local STAGE_LABELS map pattern is cleaner and avoids hook dependencies inside a closure.
- **Fix:** Used `STAGE_LABELS` constant with German strings directly. The translation keys (pipeline.downloading etc.) are still added to translation.json for potential future use in components that do call `t()`.
- **Files modified:** src/hooks/usePipeline.ts

## Self-Check: PASSED

- src/hooks/usePipeline.ts — FOUND
- src/components/EpisodeList/EpisodeRow.tsx (pipeline props) — FOUND
- src/components/EpisodeList/EpisodeExpandedView.tsx (onProcess/isPipelineRunning) — FOUND
- src/components/EpisodeList/EpisodeList.tsx (usePipeline) — FOUND
- src/components/Sidebar.tsx (sidebar-pipeline-strip) — FOUND
- src/components/Layout.tsx (handlePipelineStateChange) — FOUND
- src/components/pages/EpisodesPage.tsx (onPipelineStateChange) — FOUND
- src/styles.css (pipeline CSS classes) — FOUND
- src/locales/de/translation.json (pipeline keys) — FOUND
- Commit a634412 (Task 1) — verified in git log
- Commit 8de5f95 (Task 2) — verified in git log
- TypeScript: npx tsc --noEmit — PASSED (0 errors)
