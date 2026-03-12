# Roadmap: Binky

## Milestones

- ✅ **v0.1 Feature Development** — Phases 1–5 (shipped 2026-02-23)
- ✅ **v0.2 Release Polish** — Phases 6–8.2 (shipped 2026-02-27 as Binky v0.1.3)
- ✅ **v0.2.0 Speaker-Labeled Transcripts** — Phases 9–10 (shipped 2026-03-01)
- 🔄 **v0.3.0 Transkript-Suche & Themenverknüpfung** — Phases 11–13 (in progress)

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
- [ ] **Phase 12: Search UI** — Dedicated Suche page with results list, snippets, and transcript navigation
- [ ] **Phase 13: Cross-Episode Topic Linking** — Auto-derived topic connections shown in topics view with navigation

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
**Plans**: TBD

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
| 12. Search UI | v0.3.0 | 1/2 | In Progress | - |
| 13. Cross-Episode Topic Linking | v0.3.0 | 0/? | Not started | - |

---

*Roadmap created: 2026-02-11*
*v0.2 archived: 2026-02-27*
*v0.2.0 archived: 2026-03-01*
*v0.3.0 phases added: 2026-03-04*
