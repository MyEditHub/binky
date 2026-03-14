# Roadmap: Binky

## Milestones

- ✅ **v0.1 Feature Development** — Phases 1–5 (shipped 2026-02-23)
- ✅ **v0.2 Release Polish** — Phases 6–8.2 (shipped 2026-02-27 as Binky v0.1.3)
- ✅ **v0.2.0 Speaker-Labeled Transcripts** — Phases 9–10 (shipped 2026-03-01)
- 🔄 **v0.3.0 Transkript-Suche, Themenverknüpfung & Vogelstimmen-Mix** — Phases 11–16 (in progress)

## Phases

<details>
<summary>✅ v0.1 Feature Development + v0.2 Release Polish (Phases 1–8.2) — SHIPPED 2026-02-27</summary>

All phases complete. Full archive: `.planning/milestones/v0.2-ROADMAP.md`

- [x] Phase 1: Foundation & Infrastructure (6/6 plans) — 2026-02-13
- [x] Phase 2: Episode Management & Transcription (6/6 plans) — 2026-02-15
- [x] Phase 3: Speaker Analytics (5/5 plans) — 2026-02-16
- [x] Phase 4: Content Analysis (4/4 plans) — 2026-02-17
- [x] Phase 5: Bird Randomizer & Polish (4/4 plans) — 2026-02-23
- [x] Phase 6: UI & Bird Fixes (2/2 plans) — 2026-02-22
- [x] Phase 7: Analytics & Word Tracker (2/2 plans) — 2026-02-23
- [x] Phase 7.1: AssemblyAI Backlog Processing (2/2 plans) — 2026-02-23
- [x] Phase 8: QA & Release (3/3 plans) — 2026-02-27
- [x] Phase 8.1: Word Tracker UX Redesign (2/2 plans) — 2026-02-24
- [x] Phase 8.2: Pre-Release UX Completion (4/4 plans) — 2026-02-27

</details>

<details>
<summary>✅ v0.2.0 Speaker-Labeled Transcripts (Phases 9–10) — SHIPPED 2026-03-01</summary>

All phases complete. Full archive: `.planning/milestones/v0.2.0-ROADMAP.md`

- [x] Phase 9: Utterance Text Migration (2/2 plans) — 2026-02-28
- [x] Phase 10: Speaker-Labeled Transcript Viewer (2/2 plans) — 2026-02-28

</details>

### v0.3.0 — Transkript-Suche & Themenverknüpfung

- [x] **Phase 11: FTS Infrastructure** — SQLite FTS5 index + Rust search command covering transcripts, titles, and topics
- [x] **Phase 12: Search UI** — Dedicated Suche page with results list, snippets, and transcript navigation (completed 2026-03-12)
- [x] **Phase 13: Cross-Episode Topic Linking** — Auto-derived topic connections shown in topics view with navigation (completed 2026-03-13)
- [x] **Phase 14: Integration Gap Closure** — Register migration 014 in lib.rs and fix TopicsList scroll race (gap closure) (completed 2026-03-13)
- [ ] **Phase 15: Unified Pipeline Progress Bar** — Single 0–100% progress bar across download → transcription → diarization → topics
- [ ] **Phase 16: Vogelstimmen-Mix** — Extract Nadine's bird imitation from episode audio, mix with bundled ambience, play + export

## Phase Details

### Phase 11: FTS Infrastructure
**Goal**: Podcast hosts can execute keyword searches against all transcript text, episode titles, and AI topic summaries via a Rust backend command backed by SQLite FTS5.
**Depends on**: Phase 10 (transcript data in diarization_segments.text and transcript_segments)
**Requirements**: SRCH-01, SRCH-04, SRCH-05
**Success Criteria** (what must be TRUE):
  1. A keyword containing umlauts (ä, ö, ü) or ß returns correct matches from transcript segments
  2. A search query returns results that span transcript text, episode titles, and AI topic summaries in a single response
  3. The Rust `search_transcripts` command returns structured results (episode_id, title, speaker, snippet, segment type) callable via `invoke()` from the frontend
  4. The FTS5 virtual table is populated via a SQLite migration that indexes all existing transcript and topic data
**Plans**: 2 plans
Plans:
- [x] 11-01-PLAN.md — FTS5 migration 012: virtual table creation, bulk populate, triggers
- [x] 11-02-PLAN.md — Rust search commands: search_transcripts, rebuild_search_index, SearchResult contract

### Phase 12: Search UI
**Goal**: Users can type a query into a dedicated Suche page, see ranked results with episode title, speaker label, and highlighted snippets, and navigate directly to the matching transcript segment.
**Depends on**: Phase 11
**Requirements**: SRCH-02, SRCH-03
**Success Criteria** (what must be TRUE):
  1. User opens the Suche page from the sidebar and types a search term — results appear without a page reload
  2. Each result card shows the episode title, speaker label (or fallback "Sprecher A/B"), and a text snippet with the matching term visible
  3. User clicks a result and the episode's transcript opens with the view scrolled to the matching segment
  4. Searching for a term that appears only in a topic summary returns that episode as a result with a snippet from the summary
**Plans**: 2 plans
Plans:
- [x] 12-01-PLAN.md — SearchPage + useSearch hook + Sidebar/Layout wiring + translations
- [ ] 12-02-PLAN.md — Deep-link navigation: EpisodesPage pendingTranscriptNav, TranscriptViewer scrollToMs, useSpeakerBlocks startMs

### Phase 13: Cross-Episode Topic Linking
**Goal**: Users viewing a topic in the topics page can see other episodes where the same theme recurs, with those connections derived automatically from transcript and topic content — no manual tagging required.
**Depends on**: Phase 11
**Requirements**: LINK-01, LINK-02, LINK-03
**Success Criteria** (what must be TRUE):
  1. Each expanded episode topic in the topics view shows a "Weitere Episoden" section listing episodes that share overlapping themes
  2. The related-episode links are generated automatically from topic keyword overlap — no manual configuration needed
  3. User clicks a related episode link and navigates directly to that episode's content (topics or transcript view)
  4. Episodes with no thematic overlap show no related-episodes section rather than an empty list
**Plans**: 2 plans
Plans:
- [ ] 13-01-PLAN.md — Rust fetch_related_episodes command: RelatedEpisode struct, stop-word filtering, FTS5 batch query, deduplication, lib.rs registration
- [ ] 13-02-PLAN.md — Frontend: TopicRow "Weitere Episoden" section, TopicsList relatedMap threading + collapsedGroups refactor, TopicsPage batch fetch, Layout deep-link nav, translations

### Phase 14: Integration Gap Closure
**Goal**: All existing installations execute migration 014 to backfill AI topics into the search index, and navigating from a search result to the Topics page scrolls to the target episode group correctly.
**Requirements**: SRCH-05, LINK-01, LINK-02, LINK-03
**Gap Closure**: Closes gaps INT-01 and INT-02 from v0.3.0 audit
**Plans**: 1 plan
Plans:
- [x] 14-01-PLAN.md — Register migration 014 in lib.rs migrations vec; fix TopicsList scroll race by re-triggering scroll after topics load when externalNav is still set

### Phase 15: Unified Pipeline Progress Bar
**Goal**: A single progress bar per episode shows percentage and current step across the full processing pipeline (download → transcription → diarization → topic analysis), replacing the current separate status indicators.
**Depends on**: Phases 2, 9, 10
**Success Criteria** (what must be TRUE):
  1. While an episode is being processed, a single progress bar shows 0–100% with the current step name
  2. Transcription progress reflects chunk-level granularity (not just "started/done")
  3. Diarization and topic analysis each contribute a weighted share of the total percentage
  4. Progress state survives app restart (persisted in DB, not just in-memory)
**Plans**: 2 plans
Plans:
- [x] 15-01-PLAN.md — DB schema + Rust: unified progress column on episodes, weight constants, progress emission per stage (awaiting human-verify)
- [ ] 15-02-PLAN.md — Frontend: replace separate status indicators with single ProgressBar component, wiring to Tauri events

### Phase 16: Vogelstimmen-Mix
**Goal**: For each "Vogel der Woche" episode, users can generate and play a short audio track mixing Nadine's bird imitation (extracted from the episode) over a bundled atmospheric background — and export it as an audio file.
**Depends on**: Phase 15 (episode audio cache), diarization (Nadine speaker label), topics (Vogel der Woche timestamps)
**Success Criteria** (what must be TRUE):
  1. User triggers "Mix generieren" on a bird episode and Binky downloads + caches the MP3 if not already cached
  2. The imitation segment (Nadine speaking in the Vogel der Woche timeframe) is located automatically from transcript + diarization data
  3. A mini player on the bird page plays the mixed track (imitation + atmospheric background)
  4. User can export the track as an MP3 or WAV to a user-chosen location
**Plans**: 4 plans
Plans:
- [ ] 16-01-PLAN.md — Audio cache: download_episode_audio command, cached_audio_path on episodes, cache management
- [ ] 16-02-PLAN.md — Imitation detection: scan Vogel der Woche topic timeframe for Nadine segments, store imitation_start_ms/end_ms in birds table
- [ ] 16-03-PLAN.md — Audio extraction + mixing: symphonia slice, mix with bundled ambience asset (Rust, no ffmpeg)
- [ ] 16-04-PLAN.md — Player + export UI: mini player on bird page, export command, translations

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation & Infrastructure | v0.1 | 6/6 | Complete | 2026-02-13 |
| 2. Episode Management & Transcription | v0.1 | 6/6 | Complete | 2026-02-15 |
| 3. Speaker Analytics | v0.1 | 5/5 | Complete | 2026-02-16 |
| 4. Content Analysis | v0.1 | 4/4 | Complete | 2026-02-17 |
| 5. Bird Randomizer & Polish | v0.1 | 4/4 | Complete | 2026-02-23 |
| 6. UI & Bird Fixes | v0.2 | 2/2 | Complete | 2026-02-22 |
| 7. Analytics & Word Tracker | v0.2 | 2/2 | Complete | 2026-02-23 |
| 7.1. AssemblyAI Backlog Processing | v0.2 | 2/2 | Complete | 2026-02-23 |
| 8. QA & Release | v0.2 | 3/3 | Complete | 2026-02-27 |
| 8.1. Word Tracker UX Redesign | v0.2 | 2/2 | Complete | 2026-02-24 |
| 8.2. Pre-Release UX Completion | v0.2 | 4/4 | Complete | 2026-02-27 |
| 9. Utterance Text Migration | v0.2.0 | 2/2 | Complete | 2026-02-28 |
| 10. Speaker-Labeled Transcript Viewer | v0.2.0 | 2/2 | Complete | 2026-02-28 |
| 11. FTS Infrastructure | v0.3.0 | Complete    | 2026-03-10 | 2026-03-10 |
| 12. Search UI | 2/2 | Complete    | 2026-03-12 | - |
| 13. Cross-Episode Topic Linking | 2/2 | Complete    | 2026-03-13 | - |
| 14. Integration Gap Closure | 1/1 | Complete    | 2026-03-13 | - |
| 15. Unified Pipeline Progress Bar | v0.3.0 | 1/2 | In Progress | - |
| 16. Vogelstimmen-Mix | v0.3.0 | 0/4 | Planned | - |

---

*Roadmap created: 2026-02-11*
*v0.2 archived: 2026-02-27*
*v0.2.0 archived: 2026-03-01*
*v0.3.0 phases added: 2026-03-04*
