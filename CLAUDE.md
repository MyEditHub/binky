# Binky — Claude Instructions

## Project Overview

**Binky** is a native macOS podcast manager (Tauri v2) for the Nettgeflüster podcast.

Stack: **TypeScript + React** (frontend) · **Rust** (backend) · **SQLite** (database)

Do not suggest or attempt Python/FastAPI approaches. The app is a desktop Tauri app, not a web app.

---

## Architecture

### Frontend (`src/`)
- React 18 + TypeScript, built with Vite
- Navigation via sidebar state (no React Router — state-based routing)
- Translations: `i18next` with `src/locales/de.json` + `src/locales/en.json`
- Settings: `getSetting` / `setSetting` via `src/lib/settings.ts` → SQLite
- External URLs: `@tauri-apps/plugin-opener` (not plugin-shell)
- Charts: `recharts`

### Backend (`src-tauri/src/`)
- Tauri commands in `commands/` — called via `invoke()` from the frontend
- Data models in `models/`
- App state (transcription queue, diarization queue) in `state/`
- SQLite migrations in `src-tauri/migrations/`
- Startup hook in `lib.rs` `.setup()` — resets stale queue entries on launch

### Key Files
| File | Purpose |
|---|---|
| `src-tauri/src/lib.rs` | Tauri setup, command registration, startup reset |
| `src-tauri/src/commands/transcription.rs` | Whisper transcription (chunked, Metal) |
| `src-tauri/src/commands/diarization.rs` | Speaker diarization with sherpa-rs |
| `src-tauri/src/commands/episodes.rs` | RSS import, episode management |
| `src-tauri/tauri.conf.json` | App identifier `de.binky.app`, window config |
| `src/lib/settings.ts` | getSetting/setSetting via SQLite |
| `src/i18n.ts` | i18next configuration |

### Key Rust Crates
- `whisper-rs 0.15` — local transcription (Metal GPU)
- `sherpa-rs 0.6.8` — speaker diarization (ONNX)
- `symphonia` — audio decoding (MP3 → PCM)
- `rubato` — audio resampling to 16kHz for Whisper
- `tauri-plugin-sql` — SQLite access
- `tauri-plugin-updater` — auto-update via GitHub Releases

---

## Critical: Known Bugs & Workarounds

### whisper-rs 0.15 — NEVER use these APIs
- `set_abort_callback_safe`: **type-confusion UB** — stores `*mut Box<Box<dyn FnMut>>` but trampoline casts as `*mut F` → SIGSEGV/SIGABRT
- `set_progress_callback_safe`: memory leak — Box::into_raw never freed
- **Fix**: use no callbacks; send progress manually from Rust after each chunk

### Transcription — Architecture Decisions
- Audio decoding: streaming via symphonia→rubato (no full buffer) — avoids 635MB RAM peak
- Whisper: 20-minute chunks, **fresh `WhisperState` per chunk** (reusing state → dangling C pointers)
- `WhisperContext` reused across all chunks (model weights stay in memory)
- Startup: stale `queued`/`downloading`/`transcribing` statuses reset in `.setup()`

### Tauri Dev Mode Panic
- Symptom: `panic in a function that cannot unwind`
- Cause: corrupt `icon.icns` (e.g. 8-byte stub) → NSImage init crashes
- Fix: regenerate icons with `sips + iconutil` from PNG assets

---

## Development Commands

```bash
# Dev mode (hot-reload)
npm run tauri dev

# Production build
npm run tauri build

# TypeScript check only
npx tsc --noEmit

# Rust compile check (no link)
cd src-tauri && cargo check
```

---

## Workflow Rules

When executing phase plans, always verify prerequisites (planning, context files) exist before attempting execution. Never re-run discuss or plan phases that are already completed.

## GSD Workflow Rules

After executing wave-based plans, always run a verification pass checking must-have completion percentage before reporting success. Do not mark phases complete with gaps.

## Debugging Guidelines

When debugging, limit yourself to 3 hypotheses before stopping to reassess with the user. List your top hypotheses ranked by likelihood before diving in.

## Error Handling

When hitting rate limits or usage limits mid-workflow, save current progress state to a tracking file before stopping so the workflow can resume cleanly.
