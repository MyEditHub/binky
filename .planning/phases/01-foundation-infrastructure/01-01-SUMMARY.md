---
phase: 01-foundation-infrastructure
plan: 01
subsystem: infra
tags: [tauri, react, typescript, sqlite, vite, rust]

# Dependency graph
requires:
  - none (foundation plan)
provides:
  - Tauri v2 desktop app scaffold with React frontend
  - SQLite database with migration system
  - macOS sandbox permissions configured
  - 5-table schema (episodes, birds, topics, settings, episode_topics)
affects: [02-ui-shell, 03-rss-parser, 04-transcription-engine]

# Tech tracking
tech-stack:
  added: [tauri@2.10.2, tauri-plugin-sql@2.3.2, react@18.2.0, vite@5.0.0, typescript@5.0.2]
  patterns: [tauri-v2-migration-system, sqlite-with-include-str-macro]

key-files:
  created:
    - src-tauri/tauri.conf.json: App configuration with window, bundle, macOS settings
    - src-tauri/src/lib.rs: Rust entry point with SQL plugin initialization
    - src-tauri/migrations/001_initial.sql: Initial schema with 5 tables
    - src-tauri/Entitlements.plist: macOS sandbox permissions
    - src-tauri/capabilities/default.json: Tauri v2 plugin permissions
    - package.json: Frontend dependencies and build scripts
    - vite.config.ts: Tauri-specific Vite configuration
  modified: []

key-decisions:
  - "Used Tauri v2 capabilities system (not v1 allowlist) for plugin permissions"
  - "Stored migrations as SQL files with include_str! macro for single-source-of-truth"
  - "Used placeholder icons (will be replaced with proper branding in Phase 2)"
  - "Fixed Tauri lib/bin crate structure to expose run() function correctly"

patterns-established:
  - "Database migrations: SQL files in src-tauri/migrations/, loaded via include_str! macro"
  - "Tauri capabilities: JSON files defining plugin permissions per window"
  - "macOS entitlements: Plist file referenced in tauri.conf.json"

# Metrics
duration: 5min
completed: 2026-02-11
---

# Phase 1 Plan 01: Tauri Scaffold Summary

**Tauri v2 desktop app with React frontend, SQLite database (5 tables), and macOS sandbox permissions configured**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-11T18:56:09Z
- **Completed:** 2026-02-11T19:00:51Z
- **Tasks:** 2
- **Files modified:** 25

## Accomplishments
- Scaffolded complete Tauri v2 project structure with React TypeScript frontend
- Configured SQLite database with migration system (5 tables: episodes, birds, topics, settings, episode_topics)
- Set up macOS sandbox permissions (network client, file access) without microphone
- Established Tauri v2 capabilities for SQL plugin security model

## Task Commits

Each task was committed atomically:

1. **Task 1: Scaffold Tauri v2 project with React TypeScript template** - `39b57b0` (feat)
2. **Task 2: Configure macOS permissions, SQLite database with migrations, and Tauri capabilities** - `1cb9f5b` (feat)

## Files Created/Modified

**Frontend:**
- `package.json` - Dependencies (React, Vite, TypeScript, Tauri CLI)
- `vite.config.ts` - Tauri-specific settings (port 1420, watch exclusions)
- `tsconfig.json`, `tsconfig.node.json` - TypeScript configuration
- `index.html` - Vite entry point
- `src/main.tsx` - React entry point
- `src/App.tsx` - Root component (minimal placeholder)
- `src/styles.css` - Base styles with light/dark mode

**Backend:**
- `src-tauri/Cargo.toml` - Rust dependencies (tauri@2.0, tauri-plugin-sql with sqlite feature)
- `src-tauri/build.rs` - Tauri build script
- `src-tauri/src/main.rs` - Binary entry point
- `src-tauri/src/lib.rs` - Library with SQL plugin initialization and migrations
- `src-tauri/tauri.conf.json` - App configuration (window 1200x800, macOS min version 12.0)
- `src-tauri/Entitlements.plist` - Sandbox permissions (network, file access)
- `src-tauri/Info.plist` - Bundle display name
- `src-tauri/capabilities/default.json` - Tauri v2 plugin permissions (sql:default, sql:allow-execute)
- `src-tauri/migrations/001_initial.sql` - Initial schema with 5 tables and 3 indexes

**Assets:**
- `src-tauri/icons/` - Placeholder icon files (32x32.png, 128x128.png, icon.icns, icon.ico)

## Decisions Made

**1. Tauri v2 capabilities system**
- Used Tauri v2 capabilities JSON files instead of v1 allowlist
- Required for proper SQL plugin permission grants
- Removed invalid `fs:default` permission (not available in Tauri v2)

**2. Database migration pattern**
- SQL files in `src-tauri/migrations/` loaded via `include_str!` macro
- Single source of truth for schema
- Tauri SQL plugin runs migrations on first app launch

**3. macOS entitlements scope**
- Network client: YES (needed for RSS feed fetching, auto-updater)
- File access: YES (user-selected read-only)
- Microphone: NO (transcribes existing episodes, not live recording)

**4. Rust crate structure**
- Fixed Cargo.toml to expose library with `[lib]` section
- Binary calls library's `run()` function (standard Tauri pattern)
- Required crate-type: `["staticlib", "cdylib", "rlib"]` for Tauri mobile support

**5. Placeholder icons**
- Used minimal valid PNGs via base64
- Real branding icons deferred to Phase 2 (UI shell)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed crate name reference in main.rs**
- **Found during:** Task 1 (Initial cargo check)
- **Issue:** main.rs referenced `nettgefluester_lib::run()` but crate is named `nettgefluester`
- **Fix:** Changed to `nettgefluester::run()`
- **Files modified:** src-tauri/src/main.rs
- **Verification:** cargo check passes
- **Committed in:** 39b57b0 (Task 1 commit)

**2. [Rule 3 - Blocking] Added [lib] section to Cargo.toml**
- **Found during:** Task 1 (cargo check)
- **Issue:** Rust compiler couldn't resolve library crate without explicit [lib] declaration
- **Fix:** Added `[lib]` section with crate-type for Tauri mobile support
- **Files modified:** src-tauri/Cargo.toml
- **Verification:** cargo check passes, library exposed correctly
- **Committed in:** 39b57b0 (Task 1 commit)

**3. [Rule 3 - Blocking] Created placeholder dist folder**
- **Found during:** Task 1 (cargo check)
- **Issue:** Tauri generate_context! macro checks frontendDist path exists at compile time
- **Fix:** Created dist/ with placeholder index.html
- **Files modified:** dist/index.html (created)
- **Verification:** cargo check no longer fails on missing dist
- **Committed in:** 39b57b0 (Task 1 commit)

**4. [Rule 3 - Blocking] Created placeholder icon files**
- **Found during:** Task 1 (cargo check)
- **Issue:** Tauri bundle config references icon files that didn't exist
- **Fix:** Created minimal valid PNG/ICO/ICNS files via base64 decoding
- **Files modified:** src-tauri/icons/ (all files created)
- **Verification:** cargo check passes icon validation
- **Committed in:** 39b57b0 (Task 1 commit)

**5. [Rule 2 - Missing Critical] Removed invalid fs:default permission**
- **Found during:** Task 2 (cargo check with capabilities)
- **Issue:** capabilities/default.json referenced `fs:default` which doesn't exist in Tauri v2
- **Fix:** Removed fs:default, kept core:default and sql permissions (file access controlled via entitlements)
- **Files modified:** src-tauri/capabilities/default.json
- **Verification:** cargo check passes, tauri info shows proper plugin config
- **Committed in:** 1cb9f5b (Task 2 commit)

---

**Total deviations:** 5 auto-fixed (2 missing critical, 3 blocking)
**Impact on plan:** All fixes necessary for compilation and correct Tauri v2 configuration. No scope creep - all changes required for basic functionality.

## Issues Encountered

**1. Tauri v2 differences from v1**
- Capabilities system replaces allowlist (solved: created capabilities/default.json)
- Permission names changed (solved: removed fs:default, used core:default)

**2. Icon generation without ImageMagick/PIL**
- macOS lacks built-in PNG creation tools
- Solved: Used base64-encoded minimal valid images
- Note: Icons are placeholders only, will be replaced in Phase 2

**3. Cargo context generation requires dist folder**
- generate_context! macro checks frontendDist path at compile time
- Solved: Created placeholder dist/index.html
- Note: Real dist built by `npm run build` before `tauri build`

## User Setup Required

None - no external service configuration required.

All dependencies install via `npm install` and cargo downloads crates automatically.

## Next Phase Readiness

**Ready for Phase 1 Plan 02 (UI Shell):**
- ✅ Tauri app compiles and launches
- ✅ SQLite database schema defined
- ✅ macOS permissions configured
- ✅ React frontend renders

**Blockers:** None

**Notes:**
- App launches with blank/minimal UI (expected - UI comes in Plan 02)
- Database created on first app launch in AppData directory
- Migrations run automatically via SQL plugin
- Icons are placeholders - proper branding needed in Plan 02

---
*Phase: 01-foundation-infrastructure*
*Completed: 2026-02-11*
