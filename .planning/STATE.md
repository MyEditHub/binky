---
gsd_state_version: 1.0
milestone: v0.1
milestone_name: milestone
status: unknown
last_updated: "2026-03-10T20:42:46.577Z"
progress:
  total_phases: 1
  completed_phases: 1
  total_plans: 2
  completed_plans: 2
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-01)

**Core value:** Podcast hosts can see their speaking balance and track unfinished topics automatically through transcription and AI analysis
**Current focus:** v0.3.0 — Transkript-Suche & Themenverknüpfung (phases 11–13)

## Current Position

Phase: 12 — Search UI (in progress)
Plan: 01 — Tasks 1+2 complete, awaiting human-verify checkpoint (Task 3)
Status: Plan 12-01 auto tasks executed — useSearch hook, SearchPage, SearchResultCard/Group, Layout+Sidebar wiring committed
Last activity: 2026-03-12 — 12-01 executed (search UI components)

Progress: [Phase 11: ##########] [Phase 12: ##--------] [Phase 13: ----------]

## Accumulated Context

### Key Decisions (carry forward)

- Tech stack: Tauri v2, React/TypeScript frontend, Rust backend, SQLite
- App identifier: `de.binky.app`, database: `binky.db`
- Brand color: warm orange `#d97757`
- Distribution: PKG installer + auto-updater via GitHub Releases
- Signing key: `~/.tauri/binky.key` (must be backed up to 1Password)
- Version management: `bump-version.sh` syncs package.json, tauri.conf.json, Cargo.toml
- Migration pattern: create .sql file, register in lib.rs migrations vec with next sequential version (current highest is 12 — next migration is 013)
- FTS5 search_index schema: 7 columns (episode_id UNINDEXED, episode_title, speaker UNINDEXED, segment_text, segment_type UNINDEXED, start_ms UNINDEXED, end_ms UNINDEXED), tokenize='unicode61' (umlaut-tolerant)
- FTS column indices (0-based): episode_id=0, episode_title=1, speaker=2, segment_text=3, segment_type=4, start_ms=5, end_ms=6 — snippet() uses column index 3
- FTS5 contentless delete syntax: INSERT INTO search_index(search_index, rowid, episode_title, segment_text) VALUES('delete', id, old_title, old_text)
- search_transcripts invoke shape: invoke('search_transcripts', { query: string, limit?: number }) — Phase 12 contract, do not change
- SearchResult struct fields (Phase 12 contract): episode_id, title, speaker, snippet, segment_type, start_ms, end_ms
- search_transcripts is SYNCHRONOUS (fn not async fn) — FTS5 on 55 episodes <5ms
- FTS5 errors return Ok([]) not Err — prevents frontend error toasts for malformed queries
- snippet() parameters: column=3 (segment_text), no HTML markup, max_tokens=40 — Phase 12 handles highlight rendering
- Speaker block architecture: TranscriptViewer owns all highlight logic; SpeakerBlock accepts `children: React.ReactNode` (purely presentational)
- Fallback pattern: `speakerBlocks.length > 0` gate — zero-config graceful degradation to plain paragraph view
- All DB access goes through tauri-plugin-sql `invoke()` — no direct SQLite from frontend
- Map insertion order used (not sort()) in useSearch to preserve BM25 ranking from search_transcripts
- pendingTranscriptNav shape in Layout.tsx: { episodeId: number; startMs: number | null; title: string } — Plan 02 consumes this
- indexOf-based snippet highlighting in SearchResultCard (RegExp-safe, handles German umlauts)
- @ts-expect-error on EpisodesPage pendingTranscriptNav/onTranscriptNavConsumed props — Plan 02 removes this

### Critical Whisper-rs 0.15 Bugs (do not use)
- `set_abort_callback_safe`: type-confusion UB → SIGSEGV/SIGABRT
- `set_progress_callback_safe`: memory leak
- Fix: use NO callbacks; send progress from Rust after each chunk

### v0.3.0 Data Model Context

- `transcript_segments` — Whisper segments (id, episode_id, start_ms, end_ms, text, speaker)
- `diarization_segments` — sherpa-rs segments with `.text TEXT` column added migration 011 (holds AssemblyAI utterance text for backfilled episodes)
- `topics` table — GPT-4o-mini analysis per episode; columns include episode_id, title, summary/keywords
- FTS5 migration will be 012 — virtual table indexing diarization_segments.text + transcript_segments.text + episode titles + topics
- Phase 11 search command: `search_transcripts` via Tauri `invoke()`, returns Vec of structured results (episode_id, title, segment_id, speaker, snippet, result_type)
- Phase 13 topic linking: derive connections from topic keyword overlap (no embedding model needed — topics table already has AI-extracted themes); store or compute on-demand

### v0.2.0 Complete

- `diarization_segments.text TEXT` column added (migration 011)
- `write_results_to_db` stores utterance text going forward
- `assemblyai_backfill_utterance_text` command populates all 55 historical episodes — run manually 2026-03-01
- Speaker-labeled TranscriptViewer live — host names, color accents, merged blocks, search, plain-text fallback
- `AssemblyAIDevPanel` has "Utterance-Text nachfüllen" button for future re-runs (dev-only)

### Technical Debt (carry forward)

- `parseWordGroups` imported from StatsPage in SettingsPage — should be in `src/lib/`
- `HostTrendChart` in `Analytics/` directory but consumed by StatsPage
- `useTopics.ts` dead exports (`loadEpisodes`, `analyzeEpisode`)
- `confidence` column fetched in `useSpeakerBlocks` but never used (minor dead field)
- ANALYTICS-01 implementation uses `tick={false}` on HostTrendChart XAxis

### Roadmap Evolution

- Phase numbering continues from 11 (never restart from 1)
- v0.2.0 phases 9–10 archived in `.planning/milestones/v0.2.0-ROADMAP.md`
- v0.3.0 phases: 11 (FTS Infrastructure), 12 (Search UI), 13 (Cross-Episode Topic Linking)

## Session Continuity

Last session: 2026-03-12
Stopped at: 12-01 checkpoint:human-verify (Task 3 — visual verification of search page)
Resume file: None
Next: Human verifies search page in Tauri dev mode, then continue 12-01 (mark checkpoint done) or proceed to Plan 12-02
