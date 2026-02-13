# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-11)

**Core value:** Podcast hosts can see their speaking balance and track unfinished topics automatically through transcription and AI analysis
**Current focus:** Phase 2: Episode Management & Transcription

## Current Position

Phase: 2 of 5 (Episode Management & Transcription)
Plan: 0 of TBD in current phase
Status: Ready to plan
Last activity: 2026-02-13 — Completed Phase 1 (Foundation & Infrastructure) — all 6 plans done, human QA approved

Progress: [██████░░░░] ~20% (Phase 1 complete, 4 phases remain)

## Performance Metrics

**Velocity:**
- Total plans completed: 6
- Average duration: ~5 min
- Total execution time: ~0.5 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation-infrastructure | 6 | ~30 min | ~5 min |

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

### Pending Todos

**CRITICAL - Before first release:**
- Back up private signing key at ~/.tauri/binky.key to 1Password/BitWarden
- Configure GitHub Secrets: GPG_PASSPHRASE and TAURI_PRIVATE_KEY_PASSWORD
- Configure Sentry DSN in production environment (optional)
- Document Gatekeeper bypass instructions for users

### Blockers/Concerns

**Before First Release:**
- ⚠️ URGENT: Private signing key at ~/.tauri/binky.key must be backed up before first release
- GitHub Secrets not configured yet
- Sentry DSN not configured yet

**Phase 2 Risk:**
- German transcription accuracy on real podcast audio needs validation
- Whisper model size vs. memory tradeoff requires hardware testing

## Session Continuity

Last session: 2026-02-13
Stopped at: Phase 1 complete — all 6 plans executed and human-verified
Next: /gsd:discuss-phase 02 or /gsd:plan-phase 02 — Episode Management & Transcription
