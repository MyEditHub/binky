# Requirements

## v0.2 Requirements — Release Polish

**Defined:** 2026-02-22
**Core Value:** Podcast hosts can see their speaking balance and track unfinished topics automatically through transcription and AI analysis

### UI Polish

- [x] **UIPOL-01**: Sidebar navigation displays without icons (text-only, minimal)
- [x] **UIPOL-02**: Analytics bar chart has no grey border on its sides
- [x] **UIPOL-03**: Episode name displayed below bar chart is large and clearly readable

### Bird Fixes

- [x] **BIRD-FIX-01**: Steckbrief facts display with correct line breaks between each fact (no words running together)
- [x] **BIRD-FIX-02**: Test/development bird history is cleared from the database before first release

### Analytics Enhancement

- [ ] **ANALYTICS-01**: Speech trend view shows per-episode speaking percentages over time (timeline of balance across all episodes)

### Word Tracker

- [ ] **WORD-01**: Word tracker word groups have a delete button so incorrect groups can be removed

### QA & Release

- [ ] **QA-01**: Phase 5 bird randomizer functionality is verified end-to-end (human QA checkpoint)
- [ ] **QA-02**: Full app QA pass — all pages functional, no broken states
- [ ] **RELEASE-01**: GitHub Secrets configured (GPG_PASSPHRASE, TAURI_PRIVATE_KEY_PASSWORD) and CI build produces working PKG installer

---

## v1.0 Requirements (Next Milestone — Deferred)

Features reserved for v1.0 when backlog and analytics are more populated:

### Analytics Depth
- **ANALYTICS-02**: Aggregate speaking balance across all episodes (lifetime stats)
- **ANALYTICS-03**: Speaking time trends — is balance improving over time?
- **ANALYTICS-04**: Export analytics to CSV/PDF

### Content Analysis
- **CONTENT-04**: Full-text search across all transcripts
- **CONTENT-05**: Cross-episode topic linking ("You mentioned this in episode 12")

### Bird Randomizer
- **BIRD-07**: Play bird call audio in app
- **BIRD-08**: Filter birds by category/habitat

### User Interface
- **UI-04**: Audio playback controls for episodes in app
- **UI-05**: Dark mode theme
- **UI-06**: Keyboard shortcuts for common actions

---

## Out of Scope

Carried from v0.1:

- **Listener-facing features** — hosts-only tool
- **Episodes before 2024** — too many, recent only
- **Cloud/web version** — desktop Mac only
- **Mobile apps** — Mac only
- **Windows/Linux** — Mac only
- **Real-time transcription** — post-recording only
- **Multi-podcast support** — Nettgeflüster-specific
- **Cloud transcription APIs** — local Whisper only
- **Manual episode upload** — RSS auto-fetch only
- **Episode editing** — view and analyze only

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| UIPOL-01 | Phase 6 | Complete |
| UIPOL-02 | Phase 6 | Complete |
| UIPOL-03 | Phase 6 | Complete |
| BIRD-FIX-01 | Phase 6 | Complete |
| BIRD-FIX-02 | Phase 6 | Complete |
| ANALYTICS-01 | Phase 7 | Pending |
| WORD-01 | Phase 7 | Pending |
| QA-01 | Phase 8 | Pending |
| QA-02 | Phase 8 | Pending |
| RELEASE-01 | Phase 8 | Pending |

**Coverage:**
- v0.2 requirements: 10 total
- Mapped to phases: 10
- Unmapped: 0 ✓

---

*Requirements defined: 2026-02-22*
