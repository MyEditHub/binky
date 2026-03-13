---
gsd_state_version: 1.0
milestone: v0.1
milestone_name: milestone
status: unknown
last_updated: "2026-03-12T21:41:36.158Z"
progress:
  total_phases: 2
  completed_phases: 2
  total_plans: 4
  completed_plans: 4
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-01)

**Core value:** Podcast hosts can see their speaking balance and track unfinished topics automatically through transcription and AI analysis
**Current focus:** v0.3.0 — Transkript-Suche & Themenverknüpfung (phases 11–13)

## Current Position

Phase: 13 — Cross-Episode Topic Linking (IN PROGRESS — awaiting human verify)
Plan: 02 — executed (13-02-PLAN.md: Frontend related episodes UI)
Status: 13-02 automated tasks complete; awaiting checkpoint:human-verify (task 5)
Last activity: 2026-03-13 — 13-02 executed (frontend Weitere Episoden UI + deep-link nav)

Progress: [Phase 11: ##########] [Phase 12: ##########] [Phase 13: ##########]

## Accumulated Context

### Key Decisions (carry forward)

- Tech stack: Tauri v2, React/TypeScript frontend, Rust backend, SQLite
- App identifier: `de.binky.app`, database: `binky.db`
- Brand color: warm orange `#d97757`
- Distribution: PKG installer + auto-updater via GitHub Releases
- Signing key: `~/.tauri/binky.key` (must be backed up to 1Password)
- Version management: `bump-version.sh` syncs package.json, tauri.conf.json, Cargo.toml
- Migration pattern: create .sql file, register in lib.rs migrations vec with next sequential version (current highest is 014 — next migration is 015)
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
- pendingTranscriptNav shape in Layout.tsx: { episodeId: number; startMs: number | null; title: string } — consumed by EpisodesPage via useEffect
- indexOf-based snippet highlighting in SearchResultCard (RegExp-safe, handles German umlauts)
- EpisodesPage accepts pendingTranscriptNav + onTranscriptNavConsumed props — @ts-expect-error comment removed from Layout.tsx
- Speaker labels in SearchResultCard resolved from host_0_name/host_1_name settings (mirrors useSpeakerBlocks), raw SPEAKER_* labels never shown to user
- Episodes nav item is devOnly: true — hidden from regular users, accessible in dev mode only
- Deep-link scroll pattern: data-start-ms on all TranscriptViewer blocks, querySelectorAll + closest-ms arithmetic in useEffect depending on speakerBlocks + paragraphs
- SpeakerBlock startMs: number field propagated from first segment in each RLE-merged block (both Whisper and AssemblyAI paths)
- fetch_related_episodes invoke shape: invoke('fetch_related_episodes', { topicIds: number[] }) → Record<number, RelatedEpisode[]>
- RelatedEpisode TS interface exported from TopicRow.tsx: { episode_id: number; episode_title: string; episode_number: number | null }
- TopicsList.collapsedGroups uses Set<number> (episode_id) not Set<string> — enables forceExpandEpisodeId to delete exact key
- deep-link group expand pattern: navigate-to-episode-topics CustomEvent detail.episodeId → Layout.pendingTopicGroupNav → TopicsPage externalNav prop → TopicsList forceExpandEpisodeId → useEffect(delete from collapsedGroups + scrollIntoView)
- fetch_related_episodes called once per topics state change in TopicsPage (useEffect on topics) — batch, never per-card
- pendingTopicGroupNav consumed after 800ms timeout to allow TopicsList re-render before clearing forceExpandEpisodeId
- RelatedEpisode TS contract: { episode_id: number; episode_title: string; episode_number: number | null }
- fetch_related_episodes is SYNCHRONOUS (fn not async fn) — FTS5 OR topic queries <5ms
- German stop-word stripping applied before building FTS5 OR query — prevents noise results from high-freq words
- Source episode excluded via exclude_id = detected_from_episode_id || -1 (−1 never matches real SQLite id)

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

Last session: 2026-03-13
Stopped at: Checkpoint task 5 of 13-02-PLAN.md (human-verify: Weitere Episoden visible + navigation works)
Resume file: None
Next: Human verify app in dev mode — Weitere Episoden section renders, navigation to episode groups works
