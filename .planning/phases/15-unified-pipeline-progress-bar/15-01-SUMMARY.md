---
phase: 15-unified-pipeline-progress-bar
plan: "01"
subsystem: rust-backend
tags: [pipeline, transcription, diarization, topics, progress, sqlite]
dependency_graph:
  requires: []
  provides:
    - pipeline_progress column on episodes table
    - pipeline_status column on episodes table
    - PipelineEvent model with 6 variants
    - start_pipeline / cancel_pipeline / get_pipeline_status Tauri commands
  affects:
    - src-tauri/src/lib.rs
    - src-tauri/src/models/mod.rs
    - src-tauri/src/commands/mod.rs
    - src-tauri/src/commands/topics.rs
    - src-tauri/src/state/mod.rs
tech_stack:
  added: []
  patterns:
    - emit_and_persist pattern: send Channel event + DB update in one call
    - CancellationToken checked at every stage boundary
    - Fresh WhisperState per chunk (whisper-rs 0.15 dangling pointer prevention)
    - Option<(seg_path, emb_path)> for diarization: skipped gracefully when models absent
    - Topics skipped gracefully when OpenAI key not configured
key_files:
  created:
    - src-tauri/migrations/016_pipeline_progress.sql
    - src-tauri/src/models/pipeline.rs
    - src-tauri/src/state/pipeline.rs
    - src-tauri/src/commands/pipeline.rs
  modified:
    - src-tauri/src/models/mod.rs
    - src-tauri/src/state/mod.rs
    - src-tauri/src/commands/mod.rs
    - src-tauri/src/commands/topics.rs
    - src-tauri/src/lib.rs
decisions:
  - "Approach (a) chosen for inner logic: pipeline.rs replicates key steps using pub(crate) helpers (decode_mp3_to_pcm, is_duplicate_segment, backfill_all_whisper_segment_text) rather than calling private process_episode/process_diarization_episode. Avoids restructuring the existing queue-based state machines."
  - "Diarization is optional in the pipeline: if models are not downloaded, the stage emits StageDone at 93% and moves on — no hard failure."
  - "Topics are optional: if no OpenAI API key is configured, the stage is skipped. A topic analysis error does not halt the pipeline — it emits Error then completes at 100% (transcription+diarization are the valuable work)."
  - "Error events return Ok(()) from the command — errors are communicated via PipelineEvent::Error, not via Result::Err, matching the existing transcription/diarization pattern."
  - "Diarization in the pipeline re-downloads the audio file separately (diarize_pipeline_{id}.mp3) rather than reusing the transcription temp file, because the transcription stage deletes the temp file on completion."
metrics:
  duration_minutes: 16
  completed_date: "2026-03-14"
  tasks_completed: 2
  tasks_total: 2
  files_created: 4
  files_modified: 5
---

# Phase 15 Plan 01: Unified Pipeline Backend Summary

**One-liner:** Rust pipeline backend with 4-stage orchestration (download 0-8%, transcription 8-63%, diarization 63-93%, topics 93-100%), weighted PipelineEvent emissions, per-event DB persistence, graceful cancellation, and interrupted-state preservation on restart.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Migration 016 + PipelineEvent model + pipeline state | c05101a | 016_pipeline_progress.sql, models/pipeline.rs, state/pipeline.rs, lib.rs |
| 2 | start_pipeline, cancel_pipeline, get_pipeline_status | 8e79069 | commands/pipeline.rs, commands/topics.rs (pub(crate)), lib.rs |

## What Was Built

### Migration 016 (`016_pipeline_progress.sql`)
Adds two columns to the `episodes` table:
- `pipeline_progress INTEGER DEFAULT 0` — 0–100 overall progress
- `pipeline_status TEXT DEFAULT 'idle'` — idle / running / done / error / interrupted

Backfills `pipeline_status = 'done', pipeline_progress = 100` for episodes where `transcription_status = 'done'`.

### PipelineEvent model (`models/pipeline.rs`)
Six variants with `#[serde(tag = "event", content = "data")]`:
- `StageStarted { stage, overall_percent }`
- `Progress { stage, stage_percent, overall_percent }`
- `StageDone { stage, overall_percent }`
- `Done { episode_id }`
- `Error { stage, message, overall_percent }`
- `Cancelled { completed_stages, overall_percent }`

Weight constants: `DOWNLOAD_START=0`, `DOWNLOAD_END=8`, `TRANSCRIPTION_START=8`, `TRANSCRIPTION_END=63`, `DIARIZATION_START=63`, `DIARIZATION_END=93`, `TOPICS_START=93`, `TOPICS_END=100`.

`map_to_overall(stage_pct, stage_start, stage_end)` converts local 0–100% to global range.

### PipelineState (`state/pipeline.rs`)
```rust
pub struct PipelineState {
    pub cancel_token: Arc<Mutex<Option<CancellationToken>>>,
    pub active_episode_id: Arc<Mutex<Option<i64>>>,
}
```
Implements `Default`. Managed in `lib.rs` as a plain (non-Arc) value.

### Startup reset (`lib.rs`)
New SQL added after existing transcription/diarization resets:
```sql
UPDATE episodes SET pipeline_status = 'interrupted'
WHERE pipeline_status = 'running';
```
Preserves `pipeline_progress` so the frontend can show where the pipeline stopped.

### `start_pipeline` command (`commands/pipeline.rs`)
Four-stage sequential orchestrator:

1. **Download (0–8%):** Streams audio to `pipeline_{id}.mp3`, emits `Progress` per chunk mapped to 0–8%.
2. **Transcription (8–63%):** Uses `decode_mp3_to_pcm` + fresh `WhisperState` per 20-min chunk (whisper-rs 0.15 safety). Progress per chunk mapped to 8–63%. Stores result via `INSERT OR REPLACE INTO transcripts`.
3. **Diarization (63–93%):** Downloads audio again to `diarize_pipeline_{id}.mp3`, runs sherpa-rs `Diarize::compute`, maps inference completion to 63–93%. Updates `diarization_status`. Skipped if models are not downloaded.
4. **Topics (93–100%):** Calls `crate::commands::topics::run_llm_analysis(...)` (now `pub(crate)`). Skipped if no OpenAI key. Topic failure emits `Error` but does not prevent `Done` — transcription+diarization data is preserved.

`emit_and_persist` helper sends the channel event AND persists `pipeline_progress` + `pipeline_status = 'running'` atomically on every event.

### `cancel_pipeline` command
Calls `.cancel()` on the stored `CancellationToken`. The running `start_pipeline` detects cancellation at each stage boundary, emits `Cancelled { completed_stages, overall_percent }`, persists `pipeline_status = 'interrupted'`.

### `get_pipeline_status` command
Returns `(pipeline_progress: i32, pipeline_status: String)` from DB for a given `episode_id`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing functionality] Diarization audio re-download**
- **Found during:** Task 2 implementation
- **Issue:** The plan says Stage 2 calls inner diarization logic, but `process_episode` in transcription.rs deletes the temp audio file after decoding. Diarization needs its own copy of the audio.
- **Fix:** Pipeline downloads audio a second time to `diarize_pipeline_{id}.mp3` for diarization, then deletes it after decoding. Matches how the existing standalone diarization flow works.
- **Files modified:** commands/pipeline.rs

**2. [Rule 2 - Missing functionality] Graceful diarization skip when models absent**
- **Found during:** Task 2 implementation
- **Issue:** Plan says "call inner diarization logic" without specifying what to do if models are not downloaded (standalone `start_diarization` returns an Err in that case, which would halt the pipeline).
- **Fix:** `find_diarization_models` wrapped in `.ok()` — `None` skips diarization stage gracefully and emits `StageDone` at 93%, pipeline continues to topics.
- **Files modified:** commands/pipeline.rs

**3. [Rule 2 - Missing functionality] Graceful topics skip when API key absent**
- **Found during:** Task 2 implementation
- **Issue:** Plan doesn't specify behavior when OpenAI key is not configured.
- **Fix:** `read_openai_key` returns `None` → topics stage skips and emits `StageDone` at 100% immediately.
- **Files modified:** commands/pipeline.rs

## Self-Check: PASSED

All created files exist on disk. Both task commits (c05101a, 8e79069) verified in git log. cargo check reports no errors.
