# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-11)

**Core value:** Podcast hosts can see their speaking balance and track unfinished topics automatically through transcription and AI analysis
**Current focus:** Phase 2: Episode Management & Transcription

## Current Position

Phase: 2 of 5 (Episode Management & Transcription)
Plan: 5 of TBD in current phase
Status: In progress
Last activity: 2026-02-14 — Completed Plan 02-05 (Transcript Viewer UI)

Progress: [████████████░░] ~45% (Phase 1 complete + Plans 02-01, 02-02, 02-03, 02-04, 02-05 done)

## Performance Metrics

**Velocity:**
- Total plans completed: 11
- Average duration: ~4.6 min
- Total execution time: ~0.85 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation-infrastructure | 6 | ~30 min | ~5 min |
| 02-episode-management | 5 | ~20 min | ~4 min |

*Updated after each plan completion*

## Accumulated Context

### Decisions

- Tech stack: Tauri v2 (proven setup from Editor-Workshop with auto-updater, signing keys, CI/CD pipeline)
- Transcription: Local Whisper (free, works offline, good German support, no privacy concerns)
- Language: German UI throughout (podcast and users are German-speaking)
- Scope: 2024-2025 episodes only
- Distribution: PKG with auto-updater (GitHub Pages + Releases + Actions)
- Design: Minimal with brand colors (no gradients)

**From Plan 01-01 (2026-02-11):**
- Tauri v2 capabilities system: Using JSON capabilities files for plugin permissions (not v1 allowlist)
- Database migrations: SQL files in src-tauri/migrations/ loaded via include_str! macro
- macOS entitlements: Network + file access, NO microphone

**From Plan 01-02 (2026-02-11):**
- i18n TypeScript types: Compile-time checking prevents typo bugs
- Emoji icons: Simple navigation icons without icon library dependency

**Rebrand (2026-02-11):**
- App name: Binky (was Nettgeflüster)
- Bundle ID: de.binky.app
- Database: binky.db
- Warm orange brand color (#d97757)
- Disabled features: Grayed-out nav items with "kommt bald" tooltips

**From Plan 01-03 (2026-02-11):**
- Updater signing key: Generated without password for CI/CD (~/.tauri/binky.key)
- Sentry DSN: Optional via env var
- Plugin order: sentry → sql → updater → fs

**From Plan 01-04 (2026-02-11):**
- Signing: GPG-encrypted Tauri key (.github/signing.key.gpg) — no Apple Developer account needed
- GitHub Actions matrix: ARM + Intel, fail-fast: false
- Version management: bump-version.sh syncs package.json, tauri.conf.json, Cargo.toml

**From Plan 01-05 (2026-02-11):**
- Settings pattern: getSetting/setSetting via Database.load('sqlite:binky.db')
- Tutorial: modal overlay, 3 screens, markFirstLaunchComplete on finish
- Update banner: self-contained, polls checkForUpdates on mount
- Plugin opener: @tauri-apps/plugin-opener (Tauri v2) for external URLs

**From Plan 01-06 QA (2026-02-13):**
- German umlauts: All translation strings use proper Unicode (ü, ä, ö, ß)
- Collapsible sidebar: 200px expanded / 52px collapsed, ‹/› toggle in header
- Settings page: No website link; description uses correct German with umlauts

**From Plan 02-01 (2026-02-14):**
- whisper-rs 0.15 with metal feature: GPU-accelerated transcription (3-6x faster on Apple Silicon)
- tauri-plugin-http placed BEFORE sql plugin in Builder chain for correct entitlement scoping
- ALTER TABLE without IF NOT EXISTS: safe in migration system that guarantees single execution
- CancellationToken over JoinHandle::abort: whisper runs in spawn_blocking, abort() has no effect
- cmake required: whisper-rs-sys build requires cmake (installed via Homebrew)
- Module stubs: command stubs created now, implemented in dedicated plans (02-02, 02-04)

**From Plan 02-02 (2026-02-14):**
- sync_rss returns Vec<EpisodeMetadata> to frontend (not Rust-side SQL): consistent with plugin-sql JS pattern from Phase 1
- duration_minutes computed in Rust during RSS parse: avoids re-parsing duration strings in TypeScript
- INSERT OR IGNORE upsert on (title, publish_date): idempotent, no duplicate rows on repeated sync
- Background RSS sync on mount: load DB first (instant render), then network sync, then reload
- Episode list uses single expandedId state: collapse current on second click or new selection
- tauri_plugin_http::reqwest (not raw reqwest): required for macOS sandbox entitlement compliance

**From Plan 02-03 (2026-02-14):**
- tauri-plugin-http stream feature: bytes_stream() requires features = ["stream"] in Cargo.toml
- tauri::Manager import: app.path() requires explicit `use tauri::Manager` in Rust files
- Single model policy: delete existing ggml-*.bin before downloading new one
- Whisper model path convention: app_local_data_dir/models/ggml-{name}.bin
- Upsert for settings: INSERT ... ON CONFLICT(key) DO UPDATE SET value = excluded.value
- useModelManager hook pattern: encapsulates all Tauri invocations + state for model management

**From Plan 02-05 (2026-02-14):**
- Paragraph gap threshold 2000ms: natural podcast speech pause grouping from segments_json
- Full-page swap for transcript viewer (not modal): cleaner on small macOS window
- reloadKey pattern on EpisodeList: bump key to force reload after transcript deletion
- Delete guarded by get_queue_status: blocks if active_episode_id matches episode being deleted
- groupIntoParagraphs exported from useTranscript.ts: reusable in Phase 3/4

**From Plan 02-04 (2026-02-14):**
- Arc<TranscriptionState> managed in Tauri: allows `.inner().clone()` in async tasks without unsafe Send/Sync
- whisper-rs 0.15 iterator API: state.as_iter() → WhisperSegment with .to_string(), .start_timestamp(), .end_timestamp()
- rusqlite 0.32 (bundled) for Rust-side DB writes: avoids JS bridge for background queue operations
- Download progress 0-50 + whisper progress 50-100: unified bar for seamless visual progress
- Model status fetched in EpisodeList directly: avoids prop-drilling through Layout/SettingsPage
- Episode status progression: queued → downloading → transcribing → done/error/not_started (cancelled)
- Sequential queue: processing loop dequeues until empty, then sets is_processing=false

### Pending Todos

**CRITICAL - Before first release:**
- Back up private signing key at ~/.tauri/binky.key to 1Password/BitWarden
- Configure GitHub Secrets: GPG_PASSPHRASE and TAURI_PRIVATE_KEY_PASSWORD
- Configure Sentry DSN in production environment (optional)
- Document Gatekeeper bypass instructions for users

### Blockers/Concerns

**Before First Release:**
- URGENT: Private signing key at ~/.tauri/binky.key must be backed up before first release
- GitHub Secrets not configured yet
- Sentry DSN not configured yet

**Phase 2 Risk:**
- German transcription accuracy on real podcast audio needs validation (Plan 02-04 complete, testing needed)
- Whisper model size vs. memory tradeoff requires hardware testing
- macOS sandbox network access in production builds needs verification (Tauri issue #13878)

## Session Continuity

Last session: 2026-02-14
Stopped at: Completed Plan 02-05 (Transcript Viewer UI)
Resume file: None
Next: /gsd:execute-phase 02 plan 06 — next Phase 2 plan or Phase 3 planning
