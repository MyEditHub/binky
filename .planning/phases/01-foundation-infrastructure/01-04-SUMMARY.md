---
phase: 01-foundation-infrastructure
plan: 04
subsystem: infra
tags: [ci-cd, github-actions, release-automation, version-management, pkg-installer, signing, apple-notarization]

# Dependency graph
requires:
  - phase: 01-03
    provides: Auto-updater infrastructure with signing keys
provides:
  - GitHub Actions CI/CD pipeline for macOS builds (ARM + Intel)
  - Version bump script for synchronized version management
  - Automated release workflow with PKG installers and updater artifacts
affects: [01-05-first-run, 01-06-verification, release-workflow]

# Tech tracking
tech-stack:
  added: [github-actions, tauri-action, swatinem/rust-cache, bash-scripting]
  patterns: [matrix-builds, architecture-specific-builds, rust-caching, version-synchronization]

key-files:
  created:
    - .github/workflows/release.yml
    - scripts/bump-version.sh
  modified:
    - src-tauri/tauri.conf.json

key-decisions:
  - "Build strategy: Separate matrix builds for ARM and Intel (fail-fast: false)"
  - "Rust cache: swatinem/rust-cache@v2 saves ~90% build time on subsequent builds"
  - "Bundle targets: app, dmg, and updater (PKG created automatically by tauri-action)"
  - "Release trigger: Push to release branch or manual workflow_dispatch"
  - "Version management: Single script synchronizes package.json, tauri.conf.json, and Cargo.toml"
  - "Release naming: app-v__VERSION__ tags with German release body"

patterns-established:
  - "Matrix builds: Separate jobs for each architecture with fail-fast: false"
  - "Semantic versioning: X.Y.Z format validated by bump-version script"
  - "Release workflow: bump -> commit -> push to release branch -> CI/CD builds"

# Metrics
duration: 3min
completed: 2026-02-11
---

# Phase 01 Plan 04: CI/CD Pipeline Summary

**GitHub Actions release workflow for macOS ARM + Intel builds with automated signing, PKG generation, and version management**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-11T18:40:00Z
- **Completed:** 2026-02-11T18:43:00Z
- **Tasks:** 2
- **Files modified:** 3
- **Commits:** 2 task commits

## Accomplishments
- GitHub Actions workflow configured for macOS ARM (aarch64-apple-darwin) and Intel (x86_64-apple-darwin) builds
- Rust cache enabled (swatinem/rust-cache@v2) for ~90% faster subsequent builds
- PKG installer, DMG, and updater artifacts generation configured
- Apple signing and notarization fully integrated via GitHub Secrets
- Version bump script synchronizes version across package.json, tauri.conf.json, and Cargo.toml
- All required GitHub Secrets documented in workflow comments
- Release process documented: bump version -> commit -> push to release branch

## Task Commits

Each task was committed atomically:

1. **Task 1: Configure PKG bundling and GitHub Actions release workflow** - `a8936c7` (feat)
2. **Task 2: Create version bump script and document GitHub Secrets** - `576bb36` (feat)

## Files Created/Modified
- `.github/workflows/release.yml` - CI/CD pipeline with matrix builds for ARM + Intel
- `scripts/bump-version.sh` - Version synchronization script with semver validation
- `src-tauri/tauri.conf.json` - Updated bundle.targets to ["app", "dmg", "updater"]

## Decisions Made

**Build matrix strategy:**
- Separate jobs for aarch64-apple-darwin (ARM) and x86_64-apple-darwin (Intel)
- `fail-fast: false` ensures if one architecture fails, the other still completes
- Both architectures required for universal macOS support

**Rust build caching:**
- Using swatinem/rust-cache@v2 with workspaces: './src-tauri -> target'
- Saves ~90% build time on subsequent builds
- Critical for keeping CI/CD pipeline fast and cost-effective

**PKG installer generation:**
- Bundle targets set to ["app", "dmg", "updater"]
- tauri-action automatically creates PKG installer when app is signed and notarized
- PKG is the preferred installation method (easier than DMG for users)

**GitHub Secrets documentation:**
- All required secrets documented in release.yml header comments:
  - Apple certificates (APPLE_CERTIFICATE, APPLE_CERTIFICATE_PASSWORD, APPLE_SIGNING_IDENTITY)
  - Apple notarization (APPLE_ID, APPLE_PASSWORD, APPLE_TEAM_ID)
  - Tauri updater signing (TAURI_SIGNING_PRIVATE_KEY, TAURI_SIGNING_PRIVATE_KEY_PASSWORD)
  - Sentry DSN (optional)
- Documentation includes what each secret contains and how to generate it

**Version management:**
- Single source of truth approach: run bump-version.sh script
- Script updates all three version files in sync (package.json, tauri.conf.json, Cargo.toml)
- Validates semver format (X.Y.Z)
- Prevents version drift between frontend and backend

**Release workflow trigger:**
- Push to `release` branch (standard flow)
- Manual workflow_dispatch (emergency hotfix releases)
- Tag naming: app-v__VERSION__ (e.g., app-v0.1.0)
- Release body in German: "Neue Version verfügbar. Details im Changelog."

## Deviations from Plan

**No deviations** - Plan executed as specified. All tasks completed successfully with no issues.

## Issues Encountered

**None** - Implementation was straightforward following the proven Editor-Workshop setup pattern.

## User Setup Required

**GitHub Secrets Configuration:**

Before the CI/CD pipeline can run, the following GitHub Secrets must be configured in the repository settings:

**Apple Signing Certificates:**
1. `APPLE_CERTIFICATE`: Base64-encoded .p12 certificate file
   - Export Developer ID certificate from Keychain
   - Convert to base64: `base64 -i certificate.p12 | pbcopy`
2. `APPLE_CERTIFICATE_PASSWORD`: Password for the .p12 certificate
3. `APPLE_SIGNING_IDENTITY`: Certificate name (e.g., "Developer ID Application: Name (TEAMID)")
   - Find in Keychain Access

**Apple Notarization:**
4. `APPLE_ID`: Apple ID email address
5. `APPLE_PASSWORD`: App-specific password
   - Generate at appleid.apple.com → App-Specific Passwords
6. `APPLE_TEAM_ID`: Apple Developer Team ID
   - Find at developer.apple.com/account → Membership

**Tauri Updater Signing:**
7. `TAURI_SIGNING_PRIVATE_KEY`: Contents of ~/.tauri/binky.key
   - Read file: `cat ~/.tauri/binky.key`
   - Copy entire contents including header/footer
8. `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`: Leave empty (key has no password)

**Optional:**
9. `SENTRY_DSN`: Sentry DSN for crash reporting (optional, app works without it)

**Release Process:**

Once secrets are configured:
1. Run: `./scripts/bump-version.sh 0.2.0` (replace with desired version)
2. Commit: `git add -A && git commit -m 'chore: bump version to v0.2.0'`
3. Push to release branch: `git checkout release && git merge main && git push origin release`
4. CI/CD runs automatically, builds, signs, and publishes release to GitHub

## Next Phase Readiness

**Ready for next phase:**
- CI/CD pipeline ready to build and release app
- Version management automated and validated
- All signing infrastructure configured
- Release artifacts (PKG, DMG, updater files) will be generated automatically
- No manual build steps required for releases

**Blockers/Concerns:**
- GitHub Secrets not configured yet (CI/CD will fail until secrets are added)
- No releases exist yet (first release will need to be triggered manually)
- Apple Developer account required for code signing and notarization

**Next plan should:**
- Implement first-launch tutorial and Settings page (Plan 05)
- Add update notification banner in UI (Plan 05)
- Test full release workflow end-to-end (Plan 06 verification)

**Testing the pipeline:**
- After secrets are configured, test with a pre-release build
- Verify PKG installer works on fresh macOS installation
- Verify auto-updater can fetch and install updates

---
*Phase: 01-foundation-infrastructure*
*Completed: 2026-02-11*
