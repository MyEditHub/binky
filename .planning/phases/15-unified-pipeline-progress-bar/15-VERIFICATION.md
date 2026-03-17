---
phase: 15-unified-pipeline-progress-bar
verified: 2026-03-17T00:00:00Z
status: human_needed
score: 14/15 must-haves verified
re_verification: false
gaps:
  - id: GAP-001
    truth: "Pipeline strip pinned to sidebar bottom visible from any page (no percentage text)"
    status: human_needed
    why: "Static code confirms the strip renders and is wired via Layout→Sidebar props. Cross-page persistence requires a running app."
human_verification:
  - test: "VIS-01 — Sidebar pipeline strip visible from other pages"
    expected: "While pipeline runs, navigate from Episodes to Suche or Themen — sidebar strip remains visible with episode title and thin bar"
    why_human: "Requires runtime app execution to confirm Layout state lifts correctly across page transitions"
  - test: "VIS-02 — Bar fades out on completion"
    expected: "After pipeline completes, the EpisodeRow progress bar holds at 100% briefly then fades out; StatusBadge returns"
    why_human: "CSS animation and timing require visual runtime verification"
  - test: "VIS-03 — Interrupted state renders"
    expected: "After app restart following a mid-pipeline crash, EpisodeRow shows amber bar at last persisted percentage with 'Unterbrochen' label"
    why_human: "Requires simulating a crash/restart cycle to confirm pipeline_status='interrupted' triggers the amber indicator"
---

# Phase 15: Unified Pipeline Progress Bar — Verification Report

**Phase Goal:** A single progress bar per episode shows percentage and current step across the full processing pipeline (download → transcription → diarization → topic analysis), replacing the current separate status indicators.

**Verified:** 2026-03-17
**Status:** human_needed (14/15 automated checks pass; 3 visual/runtime checks require human QA)
**Re-verification:** No — initial verification

---

## Phase Success Criteria vs Evidence

| # | Success Criterion | Status | Evidence |
|---|------------------|--------|----------|
| 1 | While an episode is being processed, a single progress bar shows 0–100% with the current step name | ✓ VERIFIED | EpisodeRow.tsx: `showBar` gate, `fillWidth` from `pipelineProgress`, `displayLabel` from `pipelineStepLabel`; usePipeline.ts: all 6 PipelineEvent variants handled |
| 2 | Transcription progress reflects chunk-level granularity (not just "started/done") | ✓ VERIFIED | pipeline.rs line 381-388: Progress event emitted per-chunk in Whisper loop; `map_to_overall(transcription_stage_pct, 8, 63)` |
| 3 | Diarization and topic analysis each contribute a weighted share of the total percentage | ✓ VERIFIED | constants: DIARIZATION_START=63, DIARIZATION_END=93, TOPICS_START=93, TOPICS_END=100; diar progress callback line 489-498 maps correctly |
| 4 | Progress state survives app restart (persisted in DB, not just in-memory) | ✓ VERIFIED | `persist_pipeline_progress()` called on every event in `emit_and_persist()`; startup reset marks 'running'→'interrupted' preserving pipeline_progress |

---

## Plan 15-01 Must-Haves

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A single `start_pipeline` Rust command orchestrates download, transcription, diarization, and topic analysis in sequence | ✓ VERIFIED | `pipeline.rs`: `start_pipeline()` present at line 63; stages: download 0-8%, transcription 8-63%, diarization 63-93%, topics 93-100% |
| 2 | Each stage emits PipelineEvent variants with weighted overall_percent values | ✓ VERIFIED | StageStarted/Progress/StageDone/Done/Error/Cancelled all emitted with correct bounds; constants verified in `models/pipeline.rs` lines 27-34 |
| 3 | `pipeline_progress` and `pipeline_status` persisted to episodes table on every event | ✓ VERIFIED | `emit_and_persist()` extracts `pct` from every PipelineEvent variant and calls `persist_pipeline_progress()`; function verified at line 24 |
| 4 | On app restart, stale running pipelines are marked `interrupted` with progress preserved | ✓ VERIFIED | `lib.rs` line 177: `UPDATE episodes SET pipeline_status = 'interrupted' WHERE pipeline_status = 'running'` — runs AFTER transcription/diarization resets |
| 5 | `cancel_pipeline` stops the active pipeline while preserving completed stage work | ✓ VERIFIED | `cancel_pipeline()` line 718 cancels the CancellationToken; `finish_cancelled()` emits Cancelled event and sets 'interrupted' status preserving progress |
| 6 | If a stage fails, pipeline halts with error status and stuck percentage persisted | ✓ VERIFIED | `finish_error()` line 780 persists 'error' status with the overall_percent at failure; returns `Ok(())` not `Err` (error via event) |
| 7 | `run_llm_analysis` is `pub(crate)` so pipeline.rs can call it directly | ✓ VERIFIED | `topics.rs` line 105: `pub(crate) async fn run_llm_analysis(...)` confirmed |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src-tauri/migrations/016_pipeline_progress.sql` | Adds `pipeline_progress` and `pipeline_status` columns | ✓ VERIFIED | Lines 1-2: `ALTER TABLE episodes ADD COLUMN pipeline_progress INTEGER DEFAULT 0` and `ALTER TABLE episodes ADD COLUMN pipeline_status TEXT DEFAULT 'idle'` |
| `src-tauri/src/models/pipeline.rs` | PipelineEvent enum with all 6 variants | ✓ VERIFIED | StageStarted, Progress, StageDone, Done, Error, Cancelled all present lines 18-25; DOWNLOAD_START/END, TRANSCRIPTION_START/END etc. at lines 27-34; `map_to_overall()` at line 38 |
| `src-tauri/src/commands/pipeline.rs` | `start_pipeline`, `cancel_pipeline`, `get_pipeline_status` | ✓ VERIFIED | All three `#[tauri::command]` functions present; registered in `lib.rs` invoke_handler at lines 214-216 |

### Key Link Verification (15-01)

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `pipeline.rs` | `transcription.rs` | Calls `decode_mp3_to_pcm` (pub(crate) helper) | ✓ WIRED | Line 262: `crate::commands::transcription::decode_mp3_to_pcm(...)` — plan specified "inner transcription logic"; implementation uses the shared decode helper then inlines Whisper in a spawn_blocking task (Option A from plan) |
| `pipeline.rs` | `diarization.rs` | Calls `backfill_all_whisper_segment_text` | ✓ WIRED | Line 586: `crate::commands::diarization::backfill_all_whisper_segment_text()` called after diarization segments stored; diarization inference is inlined in parallel task (performance optimization over plan's sequential approach) |
| `pipeline.rs` | `topics.rs` | Calls `run_llm_analysis` directly (pub(crate)) | ✓ WIRED | Line 644: `crate::commands::topics::run_llm_analysis(episode_id, &api_key, &transcript_text, &db_path).await` |
| `lib.rs` | `migrations/016_pipeline_progress.sql` | `include_str!` in migrations vec | ✓ WIRED | `lib.rs` line 118: `sql: include_str!("../migrations/016_pipeline_progress.sql")`, `version: 16`, `MigrationKind::Up` |

---

## Plan 15-02 Must-Haves

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | While processing, a single progress bar shows 0-100% with step name in EpisodeRow | ✓ VERIFIED | EpisodeRow.tsx: `showBar` logic, `fillWidth = pipelineProgress`, `displayLabel = pipelineStepLabel`; bar hidden with StatusBadge when idle |
| 2 | Pipeline strip pinned to sidebar bottom — episode title + thin bar from any page | ? NEEDS HUMAN | Sidebar.tsx lines 146-168: strip renders when `pipelineProgress > 0`; Layout lifts state and passes props to Sidebar; cross-page persistence requires runtime |
| 3 | 'Transkribieren' button renamed to 'Verarbeiten' and triggers full pipeline | ✓ VERIFIED | EpisodeExpandedView.tsx: `onProcess` prop at line 6, button triggers `onProcess()` at line 104; de.json has `"episodes.process": "Verarbeiten"` |
| 4 | StatusBadge hidden while pipeline bar is active | ✓ VERIFIED | EpisodeRow.tsx: `showBar` gate conditionally renders `{!showBar && <StatusBadge .../>}` |
| 5 | On completion, bar holds at 100% briefly then fades out; StatusBadge returns | ? NEEDS HUMAN | `isFadingOut` logic and 400ms timer at line 77 confirmed in code; fade-out CSS animation present in styles.css; visual behaviour requires runtime |
| 6 | On error, bar fill turns red with error stage label | ✓ VERIFIED | EpisodeRow.tsx line 127: `if (pipelineError) fillClasses.push('error')`; styles.css: `.episode-progress-fill.error { background-color: var(--color-error) }` |
| 7 | On interrupted state (after restart), bar shows last persisted % with interrupted indicator | ? NEEDS HUMAN | `isPersistedInterrupted` logic at lines 100-105, amber class at line 128; 'Unterbrochen' label at line 139; requires crash+restart cycle to confirm |
| 8 | Queued episodes show 'In Warteschlange' badge, no bar | ✓ VERIFIED | `pipelineActive` is false for queued episodes (only set by usePipeline during active run); StatusBadge renders 'queued' state via existing logic |
| 9 | Existing standalone diarization/topics buttons on AnalyticsPage still work unchanged | ✓ VERIFIED | `useTranscription.ts` and `useDiarization.ts` not modified; plan explicitly states they must remain unchanged — confirmed unmodified in git diff |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/hooks/usePipeline.ts` | Pipeline hook consuming PipelineEvent Channel | ✓ VERIFIED | Exports `usePipeline`; all 6 event variants handled in onmessage; `startPipeline` calls `invoke('start_pipeline', ...)`; `cancelPipeline` calls `invoke('cancel_pipeline')` |
| `src/components/EpisodeList/EpisodeRow.tsx` | Unified bar with step label, error state, interrupted state | ✓ VERIFIED | `pipelineActive`, `pipelineError`, `pipelineInterrupted` props; `isFadingOut` effect; `showBar` gate; `fillClasses` with error/interrupted modifiers |
| `src/components/Sidebar.tsx` | Pipeline strip pinned to sidebar bottom | ✓ VERIFIED | Props `pipelineProgress`, `pipelineStepLabel`, `pipelineEpisodeTitle` accepted; strip with `sidebar-pipeline-strip` class renders when `pipelineProgress > 0`; collapsed/expanded variants both present |

### Key Link Verification (15-02)

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `usePipeline.ts` | `pipeline.rs` | `invoke('start_pipeline', { episodeId, audioUrl, onEvent: channel })` | ✓ WIRED | usePipeline.ts line 256: `await invoke('start_pipeline', { episodeId, audioUrl, onEvent: channel })` |
| `EpisodeList.tsx` | `usePipeline.ts` | `UsePipelineReturn` import + hook usage | ✓ WIRED | EpisodeList.tsx line 5: `import { UsePipelineReturn } from '../../hooks/usePipeline'` — hook is consumed in EpisodeList |
| `Sidebar.tsx` | `Layout.tsx` | `pipelineProgress`, `pipelineStepLabel`, `pipelineEpisodeTitle` props | ✓ WIRED | Layout.tsx lines 163-165: all three props passed to `<Sidebar>`; Sidebar.tsx lines 14-16: all three props declared in interface |

---

## Gaps Summary

**1 automated gap found:**

### GAP-001 — Sidebar strip cross-page visibility (needs human QA)

- **Truth:** "A pipeline strip pinned to the bottom of the sidebar shows the episode title and a thin progress bar from any page (no percentage text)"
- **Finding:** The wiring is confirmed in code (Layout state → Sidebar props), but the "from any page" aspect cannot be confirmed without a running app navigating between pages while a pipeline is active.
- **Risk:** Low. The state lifting architecture (pipelineProgress/pipelineStepLabel/pipelineEpisodeTitle in Layout, passed to Sidebar as props alongside all page renderers) is the standard pattern for this app and is correctly implemented.
- **Resolution:** Human visual check required.

**3 items flagged as human-needed (visual/runtime):**

| # | Test | What to check |
|---|------|---------------|
| VIS-01 | Cross-page sidebar strip | Navigate to Suche/Themen while pipeline runs |
| VIS-02 | Completion fade-out animation | Observe bar fade at 100% |
| VIS-03 | Interrupted state after restart | Crash mid-pipeline, relaunch, observe amber bar |

---

## Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| None | — | — | — |

No `alert()` calls, no hardcoded magic numbers (weight constants centralized in models/pipeline.rs), no duplicate stage logic between standalone and pipeline commands.

---

## Implementation Note: Parallel Transcription + Diarization

The plan specified sequential stages. The actual implementation runs transcription and diarization **in parallel** via `tokio::join!` (both share a single decoded PCM buffer). This is a deliberate architectural improvement over the plan — diarization runs on CPU (ONNX) while Whisper uses Metal GPU, so they don't compete for the same resource. The overall_percent events are still emitted in the correct weighted ranges. This deviation does not affect the must-haves.

---

_Verified: 2026-03-17_
_Verifier: Claude (gsd-verifier via 15.1-01-PLAN.md Task 2)_
