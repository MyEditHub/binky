# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-11)

**Core value:** Podcast hosts can see their speaking balance and track unfinished topics automatically through transcription and AI analysis
**Current focus:** Phase 1: Foundation & Infrastructure

## Current Position

Phase: 1 of 5 (Foundation & Infrastructure)
Plan: 3 of TBD in current phase
Status: In progress
Last activity: 2026-02-11 — Completed 01-03-PLAN.md (Auto-updater, Sentry, database backup)

Progress: [███░░░░░░░] 30%

## Performance Metrics

**Velocity:**
- Total plans completed: 3
- Average duration: 4 min
- Total execution time: 0.20 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation-infrastructure | 3 | 12 min | 4 min |

**Recent Trend:**
- Last 5 plans: 01-01 (5min), 01-02 (3min), 01-03 (4min)
- Trend: Steady at ~4min average

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Tech stack: Tauri v2 (proven setup from Editor-Workshop with auto-updater, signing keys, CI/CD pipeline)
- Transcription: Local Whisper (free, works offline, good German support, no privacy concerns)
- Language: German UI throughout (podcast and users are German-speaking)
- Scope: 2024-2025 episodes only (keep dataset manageable, focus on recent content)
- Distribution: PKG with auto-updater (proven approach from Editor-Workshop using GitHub Pages + Releases + Actions)
- Design: Minimal with brand colors (no gradients, use existing website colors)

**From Plan 01-01 (2026-02-11):**
- Tauri v2 capabilities system: Using JSON capabilities files for plugin permissions (not v1 allowlist)
- Database migrations: SQL files in src-tauri/migrations/ loaded via include_str! macro
- macOS entitlements: Network + file access, NO microphone (transcribes existing episodes)
- Placeholder icons: Minimal valid images via base64, proper branding deferred to Plan 02

**From Plan 01-02 (2026-02-11):**
- i18n TypeScript types: Compile-time checking prevents typo bugs where raw keys show in UI
- Emoji icons: Simple navigation icons without icon library dependency
- CSS custom properties: Theme support via @media (prefers-color-scheme: dark) for macOS auto-detection
- Warm orange brand color (#d97757): Friendly, minimal aesthetic matching podcast brand
- Disabled features pattern: Grayed-out nav items with tooltips explaining "kommt bald"

**From Plan 01-03 (2026-02-11):**
- Updater signing key: Generated without password for CI/CD compatibility (stored at ~/.tauri/nettgefluester.key)
- Sentry DSN: Optional via env var - app works without it in development
- Update size warning: Prompt user before downloading >50MB updates (German text)
- Database backups: Keep last 5, auto-clean old ones (non-fatal if backup fails)
- Plugin order: sentry (first) -> sql -> updater -> fs (Sentry catches errors from all subsequent plugins)

### Pending Todos

**CRITICAL - Before first release:**
- Back up private signing key at ~/.tauri/nettgefluester.key to 1Password/BitWarden
- Store signing key as GitHub secret TAURI_SIGNING_PRIVATE_KEY for CI/CD
- Configure Sentry DSN in production environment

### Blockers/Concerns

**Phase 1 Critical:**
- ⚠️ URGENT: Private signing key at ~/.tauri/nettgefluester.key must be backed up to 1Password/BitWarden BEFORE first release — losing it means permanent inability to distribute updates
- ✅ RESOLVED: macOS file access permissions configured correctly in Entitlements.plist (network client + user-selected file read)

**Phase 1 Infrastructure:**
- Sentry DSN not configured yet (app works but doesn't report crashes until DSN is set)
- Update endpoint points to GitHub Releases but no releases exist yet (need CI/CD pipeline in next plan)

**Phase 2 Risk:**
- German language transcription accuracy on real podcast audio (dialects, crosstalk) needs validation on actual Nettgefluester episodes
- Whisper model size vs. memory usage tradeoff requires testing on user's Mac hardware (specs unknown)

**Phase 3 Risk:**
- pyannote-audio speaker diarization accuracy for German two-person podcasts uncertain (10-20% DER expected, real-world performance needs validation)

**Phase 1 Observations:**
- Tauri v2 capabilities system differs from v1 allowlist (documentation accurate, but takes learning)
- Icon generation without standard tools (ImageMagick/PIL) required base64 workaround
- Cargo generate_context! macro requires dist folder at compile time (not mentioned in most Tauri docs)
- Update plugin API: contentLength is in DownloadEvent Started data, not on Update object (plan assumed wrong location)

## Session Continuity

Last session: 2026-02-11 18:37:08 UTC
Stopped at: Completed 01-03-PLAN.md (Auto-updater, Sentry, database backup)
Resume file: None
Next: Plan 04 - CI/CD pipeline for building and distributing releases
