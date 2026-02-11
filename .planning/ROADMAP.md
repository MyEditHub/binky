# Roadmap: Binky

## Overview

This roadmap delivers **Binky**, a Mac desktop app that automatically transcribes German podcast episodes, analyzes speaking balance between hosts, tracks unfinished topics, and provides a bird-of-the-week randomizer. The journey progresses from foundational infrastructure through core transcription and analytics features to specialized tools, building incrementally on proven dependencies while addressing critical technical pitfalls early.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3, 4, 5): Planned milestone work
- Decimal phases (e.g., 2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation & Infrastructure** - Tauri app scaffold, database, permissions, auto-updater setup
- [ ] **Phase 2: Episode Management & Transcription** - RSS feed integration, episode library, German transcription engine
- [ ] **Phase 3: Speaker Analytics** - Speaker diarization, speaking balance metrics, conversation flow visualization
- [ ] **Phase 4: Content Analysis** - Unfinished topics detection, topic tracking, AI-powered content insights
- [ ] **Phase 5: Bird Randomizer & Polish** - Bird-of-the-week randomizer, final UI refinements, distribution

## Phase Details

### Phase 1: Foundation & Infrastructure
**Goal**: Establish Tauri v2 desktop app foundation with database, macOS permissions, and auto-updater infrastructure before any feature work
**Depends on**: Nothing (first phase)
**Requirements**: SETUP-01, SETUP-02, SETUP-03, UI-01, UI-02, DIST-01, DIST-02, DIST-03
**Success Criteria** (what must be TRUE):
  1. User can install app via PKG installer with one click (no terminal required)
  2. App launches successfully on macOS and requests file/audio permissions during first run
  3. App displays German-language UI with minimal design using podcast brand colors
  4. Auto-updater signing key is secured in 1Password with backup documentation
  5. App can be built and signed using existing Editor-Workshop CI/CD infrastructure
**Plans**: 6 plans

Plans:
- [ ] 01-01-PLAN.md — Scaffold Tauri v2 project, macOS permissions, SQLite database with migrations
- [ ] 01-02-PLAN.md — German UI foundation (sidebar, i18n, theme, brand colors)
- [ ] 01-03-PLAN.md — Auto-updater infrastructure, Sentry crash reporting, database backup
- [ ] 01-04-PLAN.md — CI/CD pipeline (GitHub Actions release workflow, version bump script)
- [ ] 01-05-PLAN.md — First-launch tutorial, Settings page, update notification banner
- [ ] 01-06-PLAN.md — Human verification checkpoint (visual QA, full walkthrough)

### Phase 2: Episode Management & Transcription
**Goal**: Users can auto-fetch podcast episodes from RSS feed and transcribe them using local Whisper with German language optimization
**Depends on**: Phase 1
**Requirements**: EPISODE-01, EPISODE-02, EPISODE-03, TRANS-01, TRANS-02, TRANS-03, TRANS-04, UI-03
**Success Criteria** (what must be TRUE):
  1. App automatically fetches new episodes from Nettgefluester RSS feed in background
  2. User can view episode list filtered to show only 2024-2025 episodes with title, date, duration
  3. User can select an episode and start transcription with German language model
  4. Transcription runs in background without freezing UI, showing real-time progress with cancel option
  5. User can view completed transcripts stored in SQLite database
  6. App handles large Whisper models without memory explosion (quantization, model selection UI)
**Plans**: TBD

Plans:
- [ ] 02-01: TBD

### Phase 3: Speaker Analytics
**Goal**: Users can see speaking balance metrics showing who talked how much in each episode, with automatic speaker diarization
**Depends on**: Phase 2
**Requirements**: SPEAK-01, SPEAK-02, SPEAK-03, SPEAK-04
**Success Criteria** (what must be TRUE):
  1. App automatically distinguishes between both hosts using speaker diarization
  2. User can view speaking time percentage per episode (Person A: X%, Person B: Y%)
  3. User can see visual representation of speaking balance (charts/graphs showing conversation flow)
  4. App displays confidence indicators for speaker attribution and allows manual corrections
  5. Speaking balance metrics are calculated for all transcribed episodes
**Plans**: TBD

Plans:
- [ ] 03-01: TBD

### Phase 4: Content Analysis
**Goal**: Users can track unfinished topics across episodes and see AI-powered content insights without manual work
**Depends on**: Phase 2 (requires transcripts)
**Requirements**: CONTENT-01, CONTENT-02, CONTENT-03
**Success Criteria** (what must be TRUE):
  1. App automatically detects unfinished topics from transcripts (stories mentioned but not completed)
  2. User can view compact to-do list of pending/unfinished topics across all episodes
  3. User can manually track topic status (pending, completed, deferred) with cross-episode references
  4. Topics persist in database and can be searched/filtered
**Plans**: TBD

Plans:
- [ ] 04-01: TBD

### Phase 5: Bird Randomizer & Polish
**Goal**: Users can access bird-of-the-week randomizer during recording with full NABU data and never see repeated birds
**Depends on**: Phase 1 (UI foundation)
**Requirements**: BIRD-01, BIRD-02, BIRD-03, BIRD-04, BIRD-05, BIRD-06
**Success Criteria** (what must be TRUE):
  1. User can click "Random Bird" and see random selection from NABU database (German name, scientific name, image)
  2. User can browse full NABU page content for selected bird (all facts, complete profile)
  3. User can see bird image(s) from NABU displayed in app
  4. User can mark bird as used with date tracking in database
  5. Previously used birds are excluded from future random selections
  6. Bird randomizer window stays accessible during podcast recording (always-on-top or quick access)
**Plans**: TBD

Plans:
- [ ] 05-01: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation & Infrastructure | 0/6 | Planned | - |
| 2. Episode Management & Transcription | 0/TBD | Not started | - |
| 3. Speaker Analytics | 0/TBD | Not started | - |
| 4. Content Analysis | 0/TBD | Not started | - |
| 5. Bird Randomizer & Polish | 0/TBD | Not started | - |

---

*Roadmap created: 2026-02-11*
