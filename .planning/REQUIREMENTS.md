# Requirements

## v1 Requirements

### Setup & Configuration

- [ ] **SETUP-01**: Initial app setup wizard guides first-run configuration
- [ ] **SETUP-02**: macOS permissions handling for file access and audio
- [ ] **SETUP-03**: Auto-updater signing key configuration and backup

### Episode Management

- [x] **EPISODE-01**: Auto-fetch episodes from RSS feed in background (https://cdn.julephosting.de/podcasts/1188-nettgefluster-der-podcast-eines-ehepaars/feed.rss)
- [x] **EPISODE-02**: Display episode list with title, date, duration, episode number
- [x] **EPISODE-03**: Filter to show only 2024-2025 episodes

### Transcription

- [x] **TRANS-01**: Transcribe episodes using local Whisper with German language model
- [x] **TRANS-02**: Background processing without blocking UI (async with tokio)
- [x] **TRANS-03**: Store transcripts in SQLite database with compression
- [x] **TRANS-04**: Display transcription progress with cancel button

### Speaker Analytics (Core Differentiator)

- [ ] **SPEAK-01**: Speaker diarization to automatically distinguish between two hosts
- [ ] **SPEAK-02**: Calculate speech share percentage per episode (Person A: X%, Person B: Y%)
- [ ] **SPEAK-03**: Display per-episode speaking balance metrics in UI
- [ ] **SPEAK-04**: Visual representation of speaking time (charts/graphs)

### Content Analysis

- [x] **CONTENT-01**: Detect unfinished topics from transcripts (stories mentioned but not completed)
- [x] **CONTENT-02**: Track topics across multiple episodes with status
- [x] **CONTENT-03**: Display compact to-do list of pending/unfinished topics

### Bird-of-the-Week Randomizer

- [ ] **BIRD-01**: Random bird selection from NABU database (https://www.nabu.de/tiere-und-pflanzen/voegel/portraets/index.html)
- [ ] **BIRD-02**: Display full NABU page content for selected bird (all facts, complete profile)
- [ ] **BIRD-03**: Display bird image(s) from NABU
- [ ] **BIRD-04**: Track used birds with dates in database
- [ ] **BIRD-05**: Host can browse all available facts (not pre-selected key points)
- [ ] **BIRD-06**: Mark bird as used after selection

### User Interface

- [ ] **UI-01**: German language throughout entire app (all buttons, labels, text)
- [ ] **UI-02**: Minimal design using podcast brand colors from website, no gradients
- [x] **UI-03**: Responsive, non-blocking UI interactions (no freezing during transcription)

### Distribution

- [ ] **DIST-01**: PKG installer for macOS (Apple Silicon + Intel)
- [ ] **DIST-02**: Auto-updater using Tauri plugin (GitHub Pages + Releases)
- [ ] **DIST-03**: Code signing with existing keys from Editor-Workshop setup

## v2 Requirements (Deferred)

### Episode Management
- [ ] **EPISODE-04**: Audio download for offline episode storage
- [ ] **EPISODE-05**: Episode search by title/date

### Transcription
- [ ] **TRANS-05**: Multiple Whisper model size options (tiny/base/small/medium/large)
- [ ] **TRANS-06**: Batch transcription of multiple episodes
- [ ] **TRANS-07**: Re-transcribe option if quality is poor

### Speaker Analytics
- [ ] **SPEAK-05**: Aggregate speaking balance across all episodes (lifetime stats)
- [ ] **SPEAK-06**: Speaking time trends over time (improving balance?)
- [ ] **SPEAK-07**: Export analytics to CSV/PDF

### Content Analysis
- [ ] **CONTENT-04**: AI-generated topic summary per episode
- [ ] **CONTENT-05**: Keyword/theme extraction across episodes
- [ ] **CONTENT-06**: Full-text search across all transcripts

### Bird Randomizer
- [ ] **BIRD-07**: Play bird call audio in app
- [ ] **BIRD-08**: Filter birds by category/habitat
- [ ] **BIRD-09**: Bird history view (all previously used birds)

### User Interface
- [ ] **UI-04**: Audio playback controls for episodes in app
- [ ] **UI-05**: Dark mode theme
- [ ] **UI-06**: Keyboard shortcuts for common actions

## Out of Scope

**Explicitly NOT building (at least for v1):**

- **Listener-facing features** — This is a tool for podcast hosts only, not a listener app
- **Episodes before 2024** — Too many episodes, focus on recent 2024-2025 content only
- **Cloud/web version** — Desktop Mac app only, no web interface
- **Mobile apps** — Mac desktop is the platform, no iOS/Android
- **Windows/Linux support** — Mac only (hosts use Mac)
- **Real-time transcription during recording** — Post-recording transcription only
- **Multi-podcast support** — Built specifically for Nettgeflüster, not a multi-podcast manager
- **Cloud transcription APIs** — Using local Whisper to keep costs at zero, no Deepgram/AssemblyAI/Rev.ai
- **Manual episode upload** — Auto-fetch from RSS only, no drag-and-drop audio files
- **Episode editing/cutting** — View and analyze only, not an audio editor
- **Publishing/distribution features** — Not a podcast host (Buzzsprout/Libsyn replacement)
- **Social media integration** — No auto-posting to Twitter/Instagram
- **Commenting/collaboration** — Single-user tool, no shared workspaces
- **Custom branding/white-label** — Nettgeflüster-specific design
- **Analytics for other metrics** — Focus on speaking balance, not listener stats/downloads
- **Monetization features** — No ads, sponsors, premium tiers
- **Live streaming** — Recorded podcasts only

## Traceability

This section maps requirements to roadmap phases for full coverage validation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SETUP-01 | Phase 1 | Pending |
| SETUP-02 | Phase 1 | Pending |
| SETUP-03 | Phase 1 | Pending |
| EPISODE-01 | Phase 2 | Complete |
| EPISODE-02 | Phase 2 | Complete |
| EPISODE-03 | Phase 2 | Complete |
| TRANS-01 | Phase 2 | Complete |
| TRANS-02 | Phase 2 | Complete |
| TRANS-03 | Phase 2 | Complete |
| TRANS-04 | Phase 2 | Complete |
| SPEAK-01 | Phase 3 | Pending |
| SPEAK-02 | Phase 3 | Pending |
| SPEAK-03 | Phase 3 | Pending |
| SPEAK-04 | Phase 3 | Pending |
| CONTENT-01 | Phase 4 | Pending |
| CONTENT-02 | Phase 4 | Pending |
| CONTENT-03 | Phase 4 | Pending |
| BIRD-01 | Phase 5 | Pending |
| BIRD-02 | Phase 5 | Pending |
| BIRD-03 | Phase 5 | Pending |
| BIRD-04 | Phase 5 | Pending |
| BIRD-05 | Phase 5 | Pending |
| BIRD-06 | Phase 5 | Pending |
| UI-01 | Phase 1 | Pending |
| UI-02 | Phase 1 | Pending |
| UI-03 | Phase 2 | Complete |
| DIST-01 | Phase 1 | Pending |
| DIST-02 | Phase 1 | Pending |
| DIST-03 | Phase 1 | Pending |

---

## Summary

**Total v1 Requirements:** 27 requirements across 7 categories
- Setup & Configuration: 3 requirements
- Episode Management: 3 requirements
- Transcription: 4 requirements
- Speaker Analytics: 4 requirements (core differentiator)
- Content Analysis: 3 requirements
- Bird Randomizer: 6 requirements
- User Interface: 3 requirements
- Distribution: 3 requirements

**Total v2 Requirements:** 18 requirements (deferred)

**Out of Scope:** 15 explicit exclusions

**Traceability Coverage:** 27/27 v1 requirements mapped (100%)

---

*Requirements defined: 2026-02-11*
*Traceability updated: 2026-02-11*
