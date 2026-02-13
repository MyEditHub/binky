---
phase: 01-foundation-infrastructure
plan: 05
subsystem: ui
tags: [react, tauri, i18n, sqlite, tutorial, settings, updater, plugin-opener]

requires:
  - phase: 01-02
    provides: i18n setup, React component structure, CSS custom properties
  - phase: 01-03
    provides: SQLite settings table, updater plugin, database utility

provides:
  - First-launch tutorial with 3 German-language screens (welcome, roadmap, login pref)
  - Settings utility (getSetting/setSetting/isFirstLaunch/markFirstLaunchComplete) using SQLite
  - Functional Settings page with version, database status, launch-at-login toggle
  - Non-blocking UpdateBanner with available/downloading/ready/post-update states
  - Post-update version detection via lastKnownVersion stored in settings table
  - @tauri-apps/plugin-opener for external URL opening

affects:
  - All future phases that add settings
  - Phase 02 (episodes) which may need to check first-launch state

tech-stack:
  added:
    - "@tauri-apps/plugin-opener@2 (npm + Rust crate) - open external URLs"
  patterns:
    - "Settings pattern: getSetting/setSetting via Database.load('sqlite:binky.db') with graceful error defaults"
    - "Tutorial pattern: modal overlay with React state screen index, keyboard nav (Esc/Enter), markFirstLaunchComplete on finish"
    - "Update banner pattern: non-blocking, self-contained component that polls checkForUpdates on mount"
    - "Post-update detection: compare lastKnownVersion setting to getVersion() on app mount"

key-files:
  created:
    - src/lib/settings.ts
    - src/components/Tutorial.tsx
    - src/components/UpdateBanner.tsx
  modified:
    - src/components/pages/SettingsPage.tsx
    - src/App.tsx
    - src/locales/de/translation.json
    - src/styles.css
    - src-tauri/Cargo.toml
    - src-tauri/src/lib.rs
    - src-tauri/capabilities/default.json

key-decisions:
  - "Plugin opener: Used @tauri-apps/plugin-opener (Tauri v2 recommended) instead of plugin-shell for external URL opening"
  - "UpdateBanner is self-contained: polls for updates internally rather than receiving update state from App.tsx, simplifying prop flow"
  - "Post-update detection: stored as lastKnownVersion key in settings table, compared on every app mount"
  - "Tutorial keyboard support: Escape skips (marks complete), Enter advances screens"

patterns-established:
  - "macOS-style toggle: 44x26px pill with 20px thumb, CSS transform for on/off state"
  - "Settings table: INSERT OR REPLACE for upsert semantics"
  - "Tutorial: only 3 state values (screen index), completion persisted immediately on finish/skip"

duration: 3min
completed: 2026-02-13
---

# Phase 1 Plan 5: First-Launch Tutorial and Settings Summary

**First-launch tutorial with 3 German screens, functional Settings page with real version/DB status/launch-at-login, and non-blocking UpdateBanner with download progress and post-update detection.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-13T07:41:39Z
- **Completed:** 2026-02-13T07:44:39Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments

- Settings utility (getSetting/setSetting/isFirstLaunch/markFirstLaunchComplete) reads and writes from SQLite settings table with graceful error fallbacks
- Tutorial component shows 3 German-language screens: welcome with feature list, phase roadmap with "aktuell" badge, and login preference toggle
- Tutorial only shows once (persisted via `firstLaunchCompleted` key in settings table)
- Settings page loads real app version via `getVersion()`, checks database connection live, reads/writes launch-at-login preference, opens podcast website in external browser
- UpdateBanner handles four states (available, downloading with progress, ready to restart, post-update) with 10-second auto-dismiss for post-update mode
- Post-update detection compares `lastKnownVersion` setting to current version on app mount

## Task Commits

1. **Task 1: Settings utility and first-launch tutorial** - `06c622d` (feat)
2. **Task 2: Wire up Settings page and create update notification banner** - `1b126a4` (feat)

**Plan metadata:** (pending)

## Files Created/Modified

- `src/lib/settings.ts` - getSetting, setSetting, isFirstLaunch, markFirstLaunchComplete using Database.load
- `src/components/Tutorial.tsx` - 3-screen modal tutorial with keyboard support and launch-at-login toggle
- `src/components/UpdateBanner.tsx` - Self-contained non-blocking update notification banner
- `src/components/pages/SettingsPage.tsx` - Version, database status indicator, launch-at-login toggle, about section
- `src/App.tsx` - First-launch check, post-update detection, UpdateBanner and Tutorial orchestration
- `src/locales/de/translation.json` - Added tutorial.* and update.* translation sections
- `src/styles.css` - Tutorial overlay, toggle, progress bar, update banner, settings extension CSS
- `src-tauri/Cargo.toml` - Added tauri-plugin-opener = "2"
- `src-tauri/src/lib.rs` - Registered tauri_plugin_opener::init()
- `src-tauri/capabilities/default.json` - Added "opener:default" permission

## Decisions Made

- **plugin-opener over plugin-shell:** Tauri v2 recommends `@tauri-apps/plugin-opener` for opening URLs; plugin-shell is the v1 API. Used opener instead.
- **UpdateBanner is self-contained:** The component polls `check()` for updates internally on mount, rather than receiving update state from App.tsx. This keeps App.tsx simple and the banner reusable.
- **Post-update detection via settings table:** Storing `lastKnownVersion` in the SQLite settings table avoids the need for OS-level version tracking. Simple and consistent with the established settings pattern.
- **Tutorial keyboard navigation:** Escape skips the tutorial (calls markFirstLaunchComplete), Enter advances to next screen. Both follow macOS conventions.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed missing @tauri-apps/plugin-opener and registered Rust crate**

- **Found during:** Task 2 (Settings page open website button)
- **Issue:** Plan specified installing plugin-shell for external links, but Tauri v2 uses plugin-opener. Neither was in package.json or Cargo.toml.
- **Fix:** Installed `@tauri-apps/plugin-opener` via npm, added `tauri-plugin-opener = "2"` to Cargo.toml, registered `tauri_plugin_opener::init()` in lib.rs, and added `"opener:default"` to capabilities.
- **Files modified:** package.json, package-lock.json, src-tauri/Cargo.toml, src-tauri/src/lib.rs, src-tauri/capabilities/default.json
- **Verification:** TypeScript compiles cleanly, import resolves
- **Committed in:** 1b126a4 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking - missing plugin)
**Impact on plan:** Necessary for the "open website" Settings feature. Used Tauri v2 recommended plugin (opener) rather than v1 plugin-shell as the plan named. No scope creep.

## Issues Encountered

- Plan referenced `@tauri-apps/plugin-shell` but Tauri v2 uses `@tauri-apps/plugin-opener` for URL opening. Applied Rule 3 fix automatically.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All Phase 1 user-facing experience complete: tutorial, settings, update banner
- Phase 2 (Episodes & Transcription) can now build on top of the complete foundation
- The settings table is established and patterns for reading/writing preferences are in place
- Note: `launchAtLogin` preference is stored in settings table but NOT yet wired to OS login item registration (macOS `LSUIElement` / login items API). This is acceptable for Phase 1 — the toggle captures the preference for future implementation.

---
*Phase: 01-foundation-infrastructure*
*Completed: 2026-02-13*
