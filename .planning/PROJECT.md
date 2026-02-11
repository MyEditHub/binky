# Project: Binky

## What This Is

**Binky** - Desktop Mac app for podcast management with automated transcription, speaking balance analytics, unfinished topic tracking, and bird-of-the-week randomizer.

*(Originally named "Nettgeflüster Podcast Management App", rebranded to "Binky" on 2026-02-11)*

## Why It Needs to Exist

**The Problem:**
- Podcast hosts don't know if one person dominates the conversation
- They start stories but forget to finish them
- They mention topics they want to discuss but never get to them
- They need a random bird each week from NABU's alphabetical list without repeating
- Manual tracking is tedious and interrupts their creative flow

**The Solution:**
Automatically transcribe episodes, analyze speaking patterns, detect unfinished topics, and provide a bird randomizer - all in a German-language Mac app that updates itself.

## Who It's For

**Primary Users:** Two podcast hosts (married couple)
- Need easy installation (no terminal)
- Mac users
- German-speaking
- Record weekly "bird of the week" segment using NABU's bird database
- Want to improve their podcast through data

**Builder:** Friend of the podcast hosts building this for them
- Has Tauri experience (Editor-Workshop project)
- Will handle initial setup and testing
- Hosts need auto-updates for future features

## What It Does

### Core Features

**1. Episode Management**
- Auto-fetches new episodes from podcast RSS feed (https://cdn.julephosting.de/podcasts/1188-nettgefluster-der-podcast-eines-ehepaars/feed.rss)
- Focuses on 2024-2025 episodes only
- Transcribes using local Whisper (German)
- Runs in background automatically

**2. Speaking Analytics**
- Automatic speaker diarization (distinguishes between both hosts)
- Speech share percentage (Person A: 52%, Person B: 48%)
- Per-episode and aggregate statistics

**3. Content Analysis**
- AI-generated topic summary for each episode
- Keyword/theme extraction across episodes
- Unfinished topics tracker - detects stories started but not finished, topics mentioned but not discussed

**4. Bird-of-the-Week Randomizer**
- Displays random bird from NABU database (https://www.nabu.de/tiere-und-pflanzen/voegel/portraets/index.html)
- Shows: German name, scientific name, description, image, bird call audio
- Tracks which birds have been used
- Hosts access this during recording

**5. Distribution**
- Easy PKG installer for Mac
- Auto-updater for future features (based on Editor-Workshop setup)
- German UI throughout

## Core Value

**The ONE thing that must work:**
Podcast hosts can see their speaking balance and track unfinished topics automatically through transcription and AI analysis.

This helps them improve their podcast by:
- Ensuring balanced conversation (neither person dominates)
- Remembering to finish stories across episodes
- Addressing topics they promised to cover

## Requirements

### Validated (Existing)

The codebase already has these working in web app form:

- ✓ **BIRD-DB**: Bird database with NABU data (German names, scientific names, descriptions) - existing
- ✓ **BIRD-RANDOM**: Bird randomizer with "mark as used" tracking - existing
- ✓ **TOPIC-DB**: Topic management system (create, track status) - existing
- ✓ **EPISODE-DB**: Episode database with metadata (title, date, duration, audio URL) - existing
- ✓ **RSS-FETCH**: RSS feed parser for podcast episodes - existing

### Active (v1 Requirements)

These are new capabilities needed for the desktop app:

**Desktop App Foundation**
- [ ] **APP-01**: Desktop Mac app built with Tauri
- [ ] **APP-02**: German language UI (all buttons, labels, text)
- [ ] **APP-03**: Minimal design using podcast website brand colors, no gradients
- [ ] **APP-04**: Easy PKG installer with postinstall script (based on Editor-Workshop)
- [ ] **APP-05**: Auto-updater using Tauri plugin (GitHub Pages + Releases)

**Episode Transcription**
- [ ] **TRANS-01**: Auto-fetch new episodes from RSS feed in background
- [ ] **TRANS-02**: Transcribe episodes using local Whisper (German language model)
- [ ] **TRANS-03**: Store transcripts in SQLite database
- [ ] **TRANS-04**: Only process 2024-2025 episodes

**Speaking Analytics**
- [ ] **SPEAK-01**: Speaker diarization - distinguish between both hosts automatically
- [ ] **SPEAK-02**: Calculate speech share percentage per episode
- [ ] **SPEAK-03**: Display percentage in UI (Person A: X%, Person B: Y%)

**Content Analysis**
- [ ] **CONT-01**: Generate AI topic summary for each episode
- [ ] **CONT-02**: Extract keywords/themes across episodes
- [ ] **CONT-03**: Detect unfinished topics - stories started but not finished
- [ ] **CONT-04**: Detect mentioned topics never discussed
- [ ] **CONT-05**: Display compact to-do list of pending topics

**Bird Randomizer Enhancement**
- [ ] **BIRD-01**: Display bird data in desktop app (name, scientific name, description, image)
- [ ] **BIRD-02**: Play bird call audio in app
- [ ] **BIRD-03**: Accessible during recording (window stays open)
- [ ] **BIRD-04**: Mark bird as used with date tracking

### Out of Scope

**Explicitly NOT building (at least for v1):**
- Listener-facing features - This is a tool for hosts only
- Episodes before 2024 - Too many episodes, focus on recent content
- Cloud/web version - Desktop app only
- Mobile apps - Mac desktop is the platform
- Windows/Linux support - Mac only (hosts use Mac)
- Real-time transcription during recording - Post-recording transcription only
- Multi-podcast support - Built specifically for Nettgeflüster
- Cloud transcription APIs - Using local Whisper to keep costs at zero
- Manual episode upload - Auto-fetch from RSS only
- Episode editing/cutting - View and analyze only

## Constraints

**Platform:**
- Mac only (macOS 11+)
- Apple Silicon and Intel support (universal binary)

**Cost:**
- Free/low cost priority
- Local Whisper (no API costs)
- No cloud services for transcription
- GitHub free tier (Pages, Releases, Actions)

**Language:**
- German UI and content throughout
- German language model for Whisper

**Design:**
- Minimal aesthetic
- Use colors from podcast website (https://www.podcast.de/podcast/3391341/nettgefluester-der-podcast-eines-ehepaars and https://www.newbase.de/podcasts/Nettgefl%C3%BCster)
- No gradients
- Not comical/playful - clean and functional

**User Experience:**
- No terminal required
- Easy installation (PKG installer)
- Automatic updates
- Background transcription (don't block UI)

**Technical:**
- Tauri-based (reuse Editor-Workshop infrastructure)
- Local Whisper (whisper-rs or Python subprocess)
- SQLite for data storage
- Reuse existing Python logic as reference

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| **Tech stack: Tauri** | User has proven setup from Editor-Workshop with auto-updater, signing keys, CI/CD pipeline | Pending |
| **Transcription: Local Whisper** | Free (no API costs), works offline, good German support, no privacy concerns | Pending |
| **Language: German UI** | Podcast and users are German-speaking | Pending |
| **Scope: 2024-2025 episodes** | Keep dataset manageable (~50-100 episodes), focus on recent content | Pending |
| **Distribution: PKG with auto-updater** | Proven approach from Editor-Workshop (GitHub Pages + Releases + Actions) | Pending |
| **Design: Minimal with brand colors** | User explicitly requested no gradients, use existing website colors | Pending |
| **Speaker diarization: Automatic** | Must distinguish speakers without manual tagging for speech share calculation | Pending |
| **Bird data: NABU website** | Already implemented in existing code, scrapes https://www.nabu.de/tiere-und-pflanzen/voegel/portraets/index.html | Pending |

## Success Criteria

**What does "working" look like?**

1. **Installation:** Hosts download PKG, install with one click, app appears in Applications folder
2. **First run:** App fetches episodes from RSS feed, shows 2024-2025 episodes
3. **Transcription:** Background transcription processes episodes automatically using local Whisper
4. **Analytics visible:** Hosts can view any episode and see:
   - Speech share percentage (who talked how much)
   - AI-generated topic summary
   - Keywords/themes
5. **Unfinished topics:** Hosts can see list of stories/topics that need follow-up
6. **Bird randomizer:** During recording, hosts can:
   - Click "Random Bird"
   - See bird image, name, description, hear bird call
   - Mark as used
   - Never see same bird twice
7. **Updates:** When new version is released, app shows update dialog and installs automatically
8. **German language:** Everything in app is in German
9. **Performance:** Transcription runs without blocking UI, doesn't make Mac fans spin up loudly

## Open Questions

1. **Whisper model size:** Which Whisper model (tiny/base/small/medium/large)? Tradeoff between speed and accuracy for German
2. **Speaker diarization:** Use Whisper's language detection features or separate diarization library (pyannote.audio)?
3. **AI analysis service:** For topic summaries and unfinished topic detection, use local LLM or API? (Must stay within free tier constraint)
4. **Bird call format:** What audio format does NABU provide? MP3? Need to scrape or is there an API?
5. **Existing frontend:** Reuse React components from existing web app, or start fresh with Svelte/SolidJS?
6. **Data migration:** Should existing SQLite database be migrated or start fresh?

## Technical Context

**Existing Codebase:**
- Python/FastAPI backend with SQLite
- React frontend (via CDN)
- Already implements: bird database, topic tracking, episode management, RSS parsing
- Provides reference logic for rewrite

**Tauri Infrastructure (from Editor-Workshop):**
- Tauri v2 with TypeScript frontend + Rust backend
- Auto-updater: GitHub Pages (tar.gz, sig, latest.json) + GitHub Releases (PKG installers)
- Signing keys: `~/.tauri/signing.key` + `.github/signing.key.gpg`
- GitHub Actions: Build → Sign → Release workflow
- PKG installer with postinstall script to bypass Gatekeeper
- Version bump automation: `bump-version.sh`

**Technology Stack (Planned):**
- Tauri v2 for desktop app
- Rust backend (rewrite Python logic)
- TypeScript/React or Svelte frontend
- SQLite for data storage
- Local Whisper (whisper-rs crate or Python subprocess)
- Tauri updater plugin
- GitHub Pages + Releases for distribution

**Repository Structure:**
```
nettgefluester-app/
├── backend/           # Existing Python code (reference)
├── frontend/          # Existing React code (reference)
├── docs/              # Tauri setup docs from Editor-Workshop
├── .planning/         # GSD workflow files
└── [Tauri structure to be created]
```

---

*Last updated: 2026-02-11 after initialization*
