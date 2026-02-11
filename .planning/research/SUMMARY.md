# Project Research Summary

**Project:** Nettgeflüster Podcast Management Desktop App
**Domain:** Podcast management with transcription, speaker analytics, and content analysis
**Researched:** 2026-02-11
**Confidence:** HIGH

## Executive Summary

Nettgeflüster is a desktop podcast management app focused on post-production content analysis for podcast hosts who want to improve their shows. The research reveals this is a **three-layer architecture** (React frontend, Rust backend, ML services) built on Tauri v2 with local-first ML processing. The recommended approach uses Tauri 2.x + Rust + React 19 for the app shell, whisper-rs for German audio transcription, pyannote-audio for speaker diarization, and Ollama for content analysis—all running locally to meet the "free/low cost" constraint.

The core value proposition is **speaker balance analytics** (speaking time per person) and **unfinished topics tracking**—features that don't exist in competing tools like Descript, Riverside, or Podcastle. Competitors focus on production (recording/editing) or distribution (hosting); none provide post-production analysis for hosts wanting to improve conversation dynamics.

Key risks include UI thread blocking during CPU-intensive transcription (must use async + spawn_blocking), memory explosion from large Whisper models (use whisper.cpp with quantization), and German language accuracy (requires German-specific models or explicit language parameter). The auto-updater signing key must be secured in Phase 0—losing it means permanent inability to distribute updates. Speaker diarization accuracy is inherently uncertain (10-20% error rate), requiring confidence indicators and manual editing UI.

## Key Findings

### Recommended Stack

The stack centers on Tauri v2 as the desktop framework (user has prior experience from Editor-Workshop), backed by Rust for performance and type safety in ML workloads. React 19 + TypeScript 5.x provides the frontend with tauri-specta for end-to-end type safety across the IPC boundary. Vite 6.x handles builds (40x faster than Create React App).

**Core technologies:**
- **Tauri 2.x**: Desktop framework using OS WebView — 10-100x smaller binaries than Electron, native performance, security model fits ML workloads
- **Rust 1.49+**: Backend runtime with strong type safety and memory safety — required for Tauri, excellent for audio/ML processing
- **React 19.x + TypeScript 5.x**: Frontend with compile-time checking — largest Tauri ecosystem, tauri-specta generates TypeScript bindings from Rust
- **rusqlite 0.38.x**: Local SQLite database — simple, battle-tested, no file-watching issues like SeaORM in Tauri dev mode
- **whisper-rs 0.15.x**: Speech-to-text transcription — Rust bindings for whisper.cpp, local processing, Metal GPU acceleration on Mac
- **pyannote-audio 4.x (Python subprocess)**: Speaker diarization — state-of-the-art for German language, run via subprocess initially (migrate to pyannote-rs later)
- **Ollama + ollama-rs 0.3.x**: Local LLM runtime for content analysis — free, excellent Mac support (Metal), runs Llama 3.2/Mistral models for German
- **tauri-plugin-updater 2.x**: Auto-update functionality — integrates with GitHub Releases (user has Editor-Workshop experience)

**Critical version requirements:**
- Tauri@2.x must match @tauri-apps/api@2.x (major versions)
- Use rusqlite with "bundled" feature to avoid system SQLite version issues
- React 19 requires @vitejs/plugin-react@4.3+ for support

**Alternative considerations:**
- OpenAI Whisper API if local GPU insufficient (~$0.006/min ongoing cost)
- OpenAI GPT-4o-mini if Ollama too slow (~$0.002/1K tokens)
- HTML5 `<audio>` element instead of rodio for simpler audio playback in MVP

### Expected Features

MVP focuses on validating the core value proposition: **speaker balance insights** while solving the specific bird randomizer problem. Post-validation features add content analysis depth.

**Must have (table stakes):**
- RSS feed integration — industry standard for podcasters
- Episode metadata display (title, date, duration) — users expect to browse
- Audio playback — users need to listen to episodes within app
- Episode transcription (German-optimized) — in 2026, automated transcription is expected not premium
- Search within episodes — find specific moments/topics in transcripts
- Export/backup capability — creators need to own their data

**Should have (competitive differentiators):**
- **Speaker analytics** (CORE) — speaking time per person, balance metrics, conversation flow visualization
- **Unfinished topics tracking** (UNIQUE) — track stories mentioned but not completed across episodes
- **Bird-of-the-week randomizer** (UNIQUE) — custom tool without repetition, highly personal/delightful
- Content analysis (themes, topics) — AI-powered understanding of episode content
- Episode summaries — AI-generated overviews without manual work
- Multi-language transcript support — German with proper accuracy (not just multilingual generic)

**Defer (v2+):**
- Cross-episode content linking ("You mentioned this in episode 12")
- Speaking pattern insights (filler words, interruptions, pause analysis)
- Multi-show support (manage multiple podcasts)
- Advanced filtering (by speaker, topic, date ranges)
- Custom randomizer templates (generalize bird randomizer)

**Anti-features (commonly requested but problematic):**
- Built-in recording/editing — massive scope creep, overlaps with specialized tools
- Social media auto-posting — high maintenance, low value
- Built-in hosting/distribution — infrastructure complexity
- Real-time collaboration — requires backend infrastructure
- Video podcast support — different analysis needs, file size complexity

### Architecture Approach

Standard Tauri v2 three-layer architecture: Web presentation layer (React) communicates via IPC boundary (commands/events/channels) with Rust core process (business logic + services), which manages data layer (SQLite + file storage + in-memory state). Long-running ML services (transcription, diarization, LLM) run as CPU workers using spawn_blocking to prevent async runtime blocking.

**Major components:**
1. **Frontend UI (React/TypeScript)** — User interface, visualization, interactions, audio playback via HTML5
2. **Tauri Commands (Rust)** — Request-response handlers for RSS, download, transcription, analytics queries
3. **Background Services (Rust)** — RSS poller (adaptive polling every 5+ min), download queue, transcription queue
4. **CPU Workers (Rust/Python)** — Whisper transcription (whisper-rs), speaker diarization (pyannote subprocess), content analysis (ollama-rs)
5. **Database (rusqlite)** — Episodes, transcripts, metadata with raw SQL (no ORM to avoid SeaORM file-watching bugs)
6. **File Storage** — Audio files, cached data via tokio::fs (async I/O) or std::fs in spawn_blocking

**Key patterns:**
- **Command Pattern**: Frontend invokes Rust functions via `invoke()`, type-safe with tauri-specta
- **Event-Driven**: Backend emits progress/status events to frontend (one-way notifications)
- **Channel Pattern**: Stream transcription progress chunks from backend to frontend
- **Managed State**: Database connection pool + config in Arc<Mutex<T>>, accessible across commands
- **Background Service**: Tokio tasks spawned at startup for RSS polling, queue processing
- **CPU Worker Pattern**: spawn_blocking for Whisper/pyannote to prevent blocking async runtime

**Data flows:**
- RSS updates: Background poller → HTTP fetch → parse XML → check new episodes → SQLite → emit event → frontend updates
- Transcription: User action → invoke command → add to queue → load audio → spawn_blocking → Whisper → channel progress → SQLite → emit event → frontend displays
- Download: User action → invoke command → HTTP download → stream chunks → emit progress via channel → write file → SQLite → emit complete → frontend updates

### Critical Pitfalls

1. **Blocking UI Thread with CPU-Intensive Transcription** — Whisper runs on main thread, freezing UI for minutes/hours. Use async commands + tokio::spawn_blocking + progress channels. Must be addressed in Phase 1 (Core Transcription Engine) from the start—refactoring later means rewriting the system.

2. **Memory Explosion from Large Whisper Models** — Models require 1GB (tiny/small) to 10GB (large), causing crashes or system-wide slowdown. Use whisper.cpp instead of Python Whisper (50-75% less memory), implement int8 quantization (4x reduction), unload models after use, provide model selection UI with memory requirements. Address in Phase 1 for architecture, Phase 2 for optimization.

3. **Ignoring Tauri Message Queue Limits** — Rapid user interactions overwhelm IPC queue, causing "PostMessage failed" errors and crashes. Debounce UI interactions (300ms), disable buttons during processing, queue requests sequentially, throttle progress updates to max 2/second. Address in Phase 1 for backend, Phase 2 for frontend UX.

4. **Auto-Updater Loses Private Key** — Losing the signing key means permanent inability to distribute updates to existing users. Store in 1Password/BitWarden immediately, backup to encrypted cloud, never use .env files (they don't work). Must be addressed in Phase 0 (Project Setup) BEFORE first release—no recovery possible.

5. **SQLite Database Growth Without Vacuuming** — Transcripts (10K-50K chars each) cause database to grow to 500MB+ for 100 podcasts, never shrinks even when deleted. Implement VACUUM on schedule (monthly or when free space >20%), enable auto_vacuum mode, compress transcript text. Address in Phase 1 for schema, Phase 3 for automation.

6. **Speaker Diarization False Confidence** — Models label speakers incorrectly but display 100% confidence, causing wrong speaker attribution in published transcripts. Force speaker count when known (num_speakers=2 improves accuracy 20-30%), display confidence warnings, provide speaker editing UI. Address in Phase 2 (Speaker Diarization).

7. **German Language Model Selection** — Generic multilingual models give poor German accuracy (WER 20-30% vs 8-15% for German-specific). Use German fine-tuned models (whisper-large-v2-german), set language="de" explicitly, test on dialects (Bavarian/Austrian/Swiss). Address in Phase 1 (Core Transcription Engine).

8. **macOS Permissions Not Requested at Right Time** — File access fails silently, no permission prompt, users must manually grant in System Settings. Add entitlements in tauri.conf.json, use Tauri dialog API for file selection (grants temporary access), test on fresh macOS install. Address in Phase 0 for entitlements, Phase 1 for runtime requests.

## Implications for Roadmap

Based on research, suggested 5-phase structure with MVP delivery in Phase 3:

### Phase 0: Foundation & Setup
**Rationale:** Critical infrastructure must be established before any feature work to avoid irreversible mistakes (lost signing key, wrong permissions model).

**Delivers:** Project scaffolding, Tauri v2 configuration, database schema, macOS entitlements, auto-updater signing key secured.

**Addresses pitfalls:**
- Pitfall 4: Auto-updater key management (store in 1Password, document location)
- Pitfall 8: macOS file access permissions (add entitlements to tauri.conf.json)

**Research flags:** Standard setup, no additional research needed. Use Tauri v2 templates and official documentation.

---

### Phase 1: Core Transcription Engine
**Rationale:** Transcription is the foundation—everything else (speaker analytics, content analysis, search) depends on having transcripts. Must handle async processing, memory management, and German language correctly from the start.

**Delivers:** German podcast transcription with progress updates, cancellation, model selection UI, memory-efficient processing.

**Addresses features:**
- Episode transcription (German-optimized) — table stakes
- Audio file handling and storage

**Uses stack:**
- whisper-rs 0.15.x with whisper.cpp backend
- tokio::spawn_blocking for CPU isolation
- Tauri channels for progress streaming
- rusqlite for transcript storage with compression

**Addresses pitfalls:**
- Pitfall 1: Async commands + spawn_blocking to prevent UI freezing
- Pitfall 2: Model selection, quantization, unload after use
- Pitfall 3: Throttled progress updates (max 2/second)
- Pitfall 5: Database schema with compression for transcripts
- Pitfall 7: German language parameter, test on dialects

**Architecture components:**
- Transcription Manager (business logic)
- CPU Worker (Whisper integration)
- Managed State (model lifecycle)

**Research flags:** Standard Whisper integration. May need phase-specific research for German model fine-tuning if accuracy insufficient.

---

### Phase 2: Speaker Diarization & Analytics
**Rationale:** Core differentiator—speaker balance analysis is the unique value proposition. Requires transcription foundation from Phase 1. Diarization is hardest ML problem, needs careful quality validation.

**Delivers:** Speaker separation, speaking time calculation, balance metrics visualization, speaker editing UI with confidence indicators.

**Addresses features:**
- Speaker analytics (CORE DIFFERENTIATOR) — speaking time per person
- Speaker identification with labels

**Uses stack:**
- pyannote-audio 4.x (Python subprocess initially)
- num_speakers=2 parameter for known speaker count
- rusqlite for speaker segment storage

**Addresses pitfalls:**
- Pitfall 6: Force speaker count, display confidence warnings, editing UI

**Architecture components:**
- Diarization Worker (pyannote subprocess integration)
- Speaker Analytics Service (time calculation, aggregations)

**Research flags:** NEEDS RESEARCH. Speaker diarization for German podcasts has medium confidence from research. May need deeper research on:
- pyannote German language performance benchmarks
- Alternative diarization models/APIs
- Confidence score interpretation
- Real-world accuracy validation methods

---

### Phase 3: RSS Integration & Library Management (MVP)
**Rationale:** With transcription + speaker analytics working, add podcast management layer to create complete workflow. This completes MVP—users can import their show, transcribe episodes, analyze speaker balance.

**Delivers:** RSS feed import, episode list, metadata display, audio playback, export/backup. First usable version for real podcast workflow.

**Addresses features:**
- RSS feed integration — table stakes
- Episode metadata display — table stakes
- Episode list/library — table stakes
- Audio playback — table stakes (using HTML5 audio for simplicity)
- Export/backup capability — table stakes

**Uses stack:**
- feed-rs 2.3.x for RSS parsing (handles RSS 2.0, Atom, JSON Feed)
- reqwest 0.13.x for HTTP feed fetching
- Background RSS poller service (adaptive polling)
- Download queue for audio files

**Addresses pitfalls:**
- Pitfall 3: Debounced UI interactions, sequential request queuing

**Architecture components:**
- RSS Manager (feed parsing, episode extraction)
- Download Manager (HTTP downloads with progress)
- Background RSS Poller Service
- File Storage layer

**Research flags:** Standard RSS/download patterns, no additional research needed.

---

### Phase 4: Content Analysis & Search
**Rationale:** Builds on transcription foundation to add AI-powered content understanding. Enables search, summaries, and themes—high user value with moderate complexity.

**Delivers:** Search within episodes, AI-generated summaries, theme/topic extraction, content timeline.

**Addresses features:**
- Search within episodes — table stakes
- Episode summaries — differentiator
- Content analysis (themes, topics) — differentiator

**Uses stack:**
- Ollama + ollama-rs 0.3.x for local LLM
- Llama 3.2 (3B/8B) or Mistral (7B) models
- Full-text search in SQLite transcripts

**Architecture components:**
- LLM Service (Ollama integration)
- Search indexer (SQLite FTS5 virtual tables)

**Research flags:** Standard LLM integration. May need phase-specific research if Ollama German quality insufficient (fallback to OpenAI API).

---

### Phase 5: Custom Tools & Polish
**Rationale:** Adds delightful custom features (bird randomizer) and unfinished topics tracking. Lower priority than core analytics, but high user satisfaction.

**Delivers:** Bird-of-the-week randomizer, unfinished topics tracking, conversation flow visualization, auto-updater deployment.

**Addresses features:**
- Bird-of-the-week randomizer (UNIQUE) — delightful custom tool
- Unfinished topics tracking (UNIQUE) — cross-episode state management
- Conversation flow visualization — differentiator

**Uses stack:**
- tauri-plugin-updater 2.x with GitHub Actions (tauri-action)
- Simple randomizer state management (SQLite table)

**Architecture components:**
- Auto-updater configuration
- Custom tools module (randomizers, topic tracking)

**Research flags:** Mostly standard patterns. May need research on natural language processing for "unfinished topics" detection accuracy.

---

### Phase Ordering Rationale

**Dependency-driven order:**
- Phase 0 must come first—losing signing key or wrong permissions cannot be fixed later
- Phase 1 (transcription) unlocks Phases 2 (diarization), 4 (content analysis), 4 (search)
- Phase 2 (speaker analytics) is independent of RSS integration—can run on local audio files
- Phase 3 creates MVP by connecting transcription + analytics to real podcast workflow
- Phases 4-5 add value incrementally but aren't blocking for core use case

**Pitfall mitigation:**
- Critical pitfalls (1, 4, 8) addressed in Phases 0-1 before they become entrenched
- Memory/performance issues (2, 5) built into architecture from start
- UX issues (3, 6) refined in later phases after core functionality validated

**Research complexity:**
- Phases 0, 1, 3 use well-documented patterns (Tauri setup, Whisper, RSS)
- Phase 2 (diarization) needs deeper research—German performance uncertain
- Phase 4 (LLM) may need fallback research if Ollama insufficient
- Phase 5 (topic detection) may need NLP research for accuracy

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2 (Speaker Diarization):** pyannote German performance benchmarks scarce, need to validate accuracy on real German podcasts with similar voices/crosstalk. Consider testing alternatives (AssemblyAI API, WhisperX diarization).
- **Phase 4 (Content Analysis):** Ollama German quality for topic extraction/summarization not verified—may need GPT-4o-mini fallback if local models insufficient.
- **Phase 5 (Unfinished Topics):** Detecting "unfinished" topics requires semantic understanding + cross-episode context—may need research on prompt engineering or RAG patterns.

Phases with standard patterns (skip research-phase):
- **Phase 0 (Foundation):** Tauri v2 setup well-documented, use official templates
- **Phase 1 (Transcription):** Whisper integration patterns proven, abundant examples
- **Phase 3 (RSS Integration):** RSS parsing + HTTP downloads are solved problems

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Tauri v2, Rust, React 19, whisper-rs verified via official docs + crates.io. User has Tauri experience from Editor-Workshop. |
| Features | MEDIUM | Table stakes features verified via competitor analysis. Speaker analytics uniqueness confirmed. Unfinished topics tracking is novel—user demand uncertain. |
| Architecture | HIGH | Tauri v2 architecture patterns from official docs, three-layer structure is standard, data flows match Tauri recommendations. |
| Pitfalls | HIGH | UI blocking, memory explosion, message queue, key management, SQLite growth all documented in Tauri/Whisper communities with proven solutions. German accuracy and diarization confidence are validated concerns. |

**Overall confidence:** HIGH

The core stack (Tauri + Rust + Whisper) is well-established with abundant resources. The main uncertainties are:
1. German language transcription accuracy on real podcast audio (dialects, crosstalk)
2. Speaker diarization accuracy for German two-person podcasts
3. Ollama vs OpenAI quality tradeoff for German content analysis

These can be validated incrementally during implementation with fallback options (OpenAI API) if local processing insufficient.

### Gaps to Address

**German language performance validation:**
- Research shows Whisper supports German but real-world accuracy (especially dialects) needs testing on actual Nettgeflüster episodes. Test transcription in Phase 1 on 3-5 representative episodes covering different contexts (studio vs remote, quiet vs noisy).

**Speaker diarization German benchmarks:**
- pyannote-audio is state-of-the-art but German-specific DER metrics not found in research. In Phase 2, test on 5 Nettgeflüster episodes, measure DER manually, compare with/without num_speakers=2 parameter.

**Ollama German content quality:**
- Llama 3.2 and Mistral have "good German support" per docs but quality for topic extraction/summarization not validated. In Phase 4, compare Ollama summaries vs GPT-4o-mini on 10 episodes—if Ollama quality insufficient (<80% user satisfaction), add OpenAI fallback option.

**Unfinished topics detection approach:**
- No clear pattern for detecting "stories mentioned but not completed." During Phase 5 planning, research prompt engineering for "identify incomplete narratives" or semantic search for topic continuity across episodes.

**Model memory requirements on target hardware:**
- User's Mac specs unknown. In Phase 1, test whisper-rs memory usage on small/medium/large models, provide auto-detection of available RAM with model recommendations (e.g., "Your Mac has 16GB RAM—recommended: medium model").

## Sources

### Primary (HIGH confidence)
- [Tauri v2 Official Documentation](https://v2.tauri.app/) — Architecture, IPC, state management, updater
- [Crates.io API](https://crates.io/api/v1/crates/) — Verified versions: whisper-rs 0.15.1, feed-rs 2.3.1, rusqlite 0.38.0, tokio 1.49.0, ollama-rs 0.3.3
- [whisper-rs GitHub](https://github.com/tazz4843/whisper-rs) — Rust bindings documentation
- [pyannote-audio GitHub](https://github.com/pyannote/pyannote-audio) — Speaker diarization official repo
- [Ollama Documentation](https://ollama.com) — Local LLM runtime
- [SQLite Documentation](https://sqlite.org/arch.html) — Database architecture, VACUUM, auto_vacuum

### Secondary (MEDIUM confidence)
- [Tauri vs Electron Guide (2026)](https://blog.nishikanta.in/tauri-vs-electron-the-complete-developers-guide-2026) — Performance comparison
- [Tauri Template (Production-Ready)](https://github.com/dannysmith/tauri-template) — React 19 + TypeScript best practices
- [How to make automatic updates work with Tauri v2](https://thatgurjot.com/til/tauri-auto-updater/) — Updater configuration
- [The Best Podcast Analytics Tools in 2026](https://www.cohostpodcasting.com/resources/best-podcast-analytics-tools) — Competitor feature analysis
- [Top 6 AI Podcast Transcription Tools 2026](https://cleanvoice.ai/blog/ai-podcast-transcription-software/) — Transcription landscape
- [Building an Intelligent Web Crawler: How I Optimized My RSS Reader App](https://nikolajjsj.medium.com/building-an-intelligent-rss-feed-fetcher-how-i-optimized-my-rss-reader-app-1a21e040d6bf) — Adaptive RSS polling patterns
- [Faster Whisper GitHub](https://github.com/SYSTRAN/faster-whisper) — Performance optimization alternative
- [AssemblyAI: What is Speaker Diarization](https://www.assemblyai.com/blog/what-is-speaker-diarization-and-how-does-it-work) — Diarization concepts
- [SQLite Performance Tuning](https://phiresky.github.io/blog/2020/sqlite-performance-tuning/) — Optimization patterns

### Tertiary (LOW confidence)
- German language Whisper performance on dialects — inferred from general multilingual benchmarks, not German-specific podcast testing
- Speaker diarization accuracy for two-person German podcasts — pyannote DER 11-19% from academic benchmarks, real-world German performance not verified
- Ollama German quality for podcast summaries — "good German support" from model cards, not validated on actual podcast content

---

*Research completed: 2026-02-11*
*Ready for roadmap: YES*
