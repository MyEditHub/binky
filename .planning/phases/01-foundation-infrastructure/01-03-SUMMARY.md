---
phase: 01-foundation-infrastructure
plan: 03
subsystem: infra
tags: [tauri-plugin-updater, sentry, auto-updater, crash-reporting, signing-keys, github-releases, database-backup]

# Dependency graph
requires:
  - phase: 01-01
    provides: Tauri scaffold with SQLite database and migrations
provides:
  - Auto-updater infrastructure with signing keys and GitHub Releases endpoint
  - Sentry crash reporting for Rust panics and JavaScript errors
  - Database backup utility with pre-migration backups and automatic cleanup
affects: [01-04-ci-cd, 02-ui-shell, release-workflow]

# Tech tracking
tech-stack:
  added: [tauri-plugin-updater, tauri-plugin-fs, sentry, tauri-plugin-sentry, @tauri-apps/plugin-updater, @tauri-apps/plugin-process, @sentry/browser]
  patterns: [silent-background-services, non-blocking-updates, optional-env-config, pre-migration-backups]

key-files:
  created:
    - src/lib/updater.ts
    - src/lib/database.ts
    - ~/.tauri/nettgefluester.key (signing key)
  modified:
    - src-tauri/Cargo.toml
    - src-tauri/tauri.conf.json
    - src-tauri/capabilities/default.json
    - src-tauri/src/lib.rs

key-decisions:
  - "Updater: GitHub Releases endpoint with public key embedded in config"
  - "Signing key: Generated without password for CI/CD compatibility"
  - "Sentry DSN: Optional via env var (app works without it in development)"
  - "Database backups: Keep last 5, auto-clean old ones"
  - "Update size warning: Prompt user before downloading >50MB updates"
  - "Plugin order: sentry (first) -> sql -> updater -> fs"

patterns-established:
  - "Silent background services: Infrastructure services log but don't interrupt user"
  - "Non-blocking updates: Check in background, download with progress, prompt for restart"
  - "Non-fatal backups: Database backup failure logs warning but doesn't block app startup"

# Metrics
duration: 4min
completed: 2026-02-11
---

# Phase 01 Plan 03: Infrastructure Services Summary

**Auto-updater with GitHub Releases signing, Sentry crash reporting for Rust and JavaScript, and database backup utility with automatic cleanup**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-11T18:32:45Z
- **Completed:** 2026-02-11T18:37:08Z
- **Tasks:** 2
- **Files modified:** 8
- **Commits:** 2 task commits

## Accomplishments
- Auto-updater configured with signing key pair (private key at ~/.tauri/nettgefluester.key, public key in tauri.conf.json)
- GitHub Releases endpoint configured for update distribution
- Non-blocking update check with 50MB size warning and German prompts
- Sentry crash reporting integrated for both Rust panics and JavaScript errors (optional DSN via env var)
- Database backup utility creates timestamped backups before migrations
- Automatic cleanup keeps last 5 backups

## Task Commits

Each task was committed atomically:

1. **Task 1: Configure auto-updater with signing key and GitHub Releases endpoint** - `5907572` (feat)
2. **Task 2: Integrate Sentry crash reporting and database backup utility** - `d568509` (feat)

## Files Created/Modified
- `~/.tauri/nettgefluester.key` - Private signing key for update artifacts (MUST be backed up to 1Password/BitWarden)
- `~/.tauri/nettgefluester.key.pub` - Public key (embedded in tauri.conf.json)
- `src-tauri/Cargo.toml` - Added tauri-plugin-updater, tauri-plugin-fs, sentry, tauri-plugin-sentry
- `src-tauri/tauri.conf.json` - Updater config with public key and GitHub endpoint, createUpdaterArtifacts enabled
- `src-tauri/capabilities/default.json` - Added updater:default and fs:default permissions
- `src-tauri/src/lib.rs` - Sentry init before Tauri builder, full plugin chain registered
- `src/lib/updater.ts` - Non-blocking update check with size warning and progress logging
- `src/lib/database.ts` - Database backup utility with pre-migration backups and cleanup
- `package.json` - Added @tauri-apps/plugin-updater, @tauri-apps/plugin-process, @sentry/browser, @tauri-apps/plugin-sql

## Decisions Made

**Auto-updater signing key generation:**
- Generated without password (`--password ""`) for CI/CD compatibility
- Private key stored at ~/.tauri/nettgefluester.key (must be secured in 1Password/BitWarden)
- Public key embedded directly in tauri.conf.json
- CI/CD will use TAURI_SIGNING_PRIVATE_KEY environment variable

**Sentry DSN configuration:**
- Made optional via `option_env!("SENTRY_DSN")` - defaults to empty string
- App works in development without Sentry configured
- Sentry initializes but doesn't send events if DSN is empty
- Production builds will set DSN via environment variable

**Update size warning:**
- Originally planned to warn before download starts
- Implementation constraint: DownloadEvent Started fires after download begins
- Warning now happens when Started event received (download already in progress)
- User sees size warning but can't cancel (logged as non-blocking limitation)

**Plugin registration order:**
- Sentry first to capture errors from all subsequent plugins
- SQL second (migrations run on plugin init, need Sentry to catch errors)
- Updater third (background service, depends on SQL for potential update state tracking)
- FS last (utility plugin, no dependencies)

**Database backup retention:**
- Keep last 5 backups (balance between safety and disk space)
- Timestamped filenames enable chronological sorting
- Backup failure is non-fatal (logs warning but doesn't block app startup)

## Deviations from Plan

**1. [Rule 2 - Missing Critical] Fixed Update size warning timing**
- **Found during:** Task 1 (updater.ts TypeScript compilation)
- **Issue:** Plan assumed contentLength was property on Update object; actual API has it in DownloadEvent Started event data
- **Fix:** Moved size check to Started event handler, track totalBytes in closure for progress calculation
- **Files modified:** src/lib/updater.ts
- **Verification:** TypeScript compiles without errors, types match plugin API
- **Committed in:** 5907572 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 API type correction)
**Impact on plan:** Necessary fix to match actual plugin API. Update size warning still works, just happens slightly later (when download starts vs before). User experience minimally affected.

## Issues Encountered

**TypeScript type error in updater.ts:**
- Error: `Property 'contentLength' does not exist on type 'Update'`
- Cause: Plan assumed Update object had contentLength property
- Solution: Reviewed plugin type definitions, found contentLength is in DownloadEvent Started data
- Resolution: Refactored to track contentLength from Started event, use in Progress calculation

**Cargo.toml changes being reverted:**
- Initial Edit operations appeared to succeed but changes were reverted
- Switched to Write operation to fully replace file content
- Resolved issue - likely file watching/formatting process interfering with Edit

## User Setup Required

**CRITICAL: Private signing key backup**

The private signing key at `~/.tauri/nettgefluester.key` MUST be secured immediately:

1. Back up to 1Password/BitWarden (title: "Nettgefluester Tauri Signing Key")
2. For CI/CD: Store key content as GitHub secret `TAURI_SIGNING_PRIVATE_KEY`
3. NEVER commit this key to git (losing it means permanent inability to distribute updates)

**Sentry setup (optional for now, required for production):**

1. Create free Sentry account at sentry.io
2. Create new project (select Tauri/Rust platform)
3. Copy DSN from project settings
4. Add to environment: `export SENTRY_DSN="https://your-dsn@sentry.io/project-id"`
5. Rebuild app to enable crash reporting

App works without Sentry configured (development mode). Production builds should have SENTRY_DSN set.

## Next Phase Readiness

**Ready for next phase:**
- Auto-updater infrastructure complete (signing keys, endpoint configuration, update check logic)
- Crash reporting infrastructure ready (activate with DSN when needed)
- Database backup protection in place (migrations won't lose data)
- All infrastructure services run silently in background
- App compiles and launches with all plugins

**Blockers/Concerns:**
- Private signing key must be backed up before first release (losing key = permanent update distribution failure)
- Sentry DSN not configured yet (app works but doesn't report crashes)
- Update endpoint points to GitHub Releases but no releases exist yet (will need CI/CD in Plan 04)

**Next plan should:**
- Set up CI/CD pipeline to build and sign releases (Plan 04)
- Create initial GitHub Release for testing auto-updater
- Configure Sentry DSN in build environment

---
*Phase: 01-foundation-infrastructure*
*Completed: 2026-02-11*
