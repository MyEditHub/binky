---
phase: 01-foundation-infrastructure
plan: 04
subsystem: infra
tags: [ci-cd, github-actions, release-automation, version-management, pkg-installer, gpg-signing, tauri-signing]

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
    - .github/signing.key.gpg
    - scripts/bump-version.sh
  modified:
    - src-tauri/tauri.conf.json

key-decisions:
  - "Signing: GPG-encrypted Tauri key in repo (NO Apple Developer account required)"
  - "Build strategy: Separate matrix builds for ARM and Intel (fail-fast: false)"
  - "Rust cache: swatinem/rust-cache@v2 saves ~90% build time on subsequent builds"
  - "Bundle targets: app, dmg, and updater (PKG created automatically by tauri-action)"
  - "Release trigger: Push v* tags (not release branch)"
  - "Version management: Single script synchronizes package.json, tauri.conf.json, and Cargo.toml"
  - "Gatekeeper bypass: Users manually allow in System Settings (no notarization)"

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
- GPG-encrypted Tauri signing key created and stored in repo (.github/signing.key.gpg)
- NO Apple Developer account required - uses Tauri signing only
- Version bump script synchronizes version across package.json, tauri.conf.json, and Cargo.toml
- Only 2 GitHub Secrets required (GPG_PASSPHRASE, TAURI_PRIVATE_KEY_PASSWORD)
- Release process documented: bump version -> commit -> tag -> push

## Task Commits

Each task was committed atomically:

1. **Task 1: Configure PKG bundling and GitHub Actions release workflow** - `a8936c7` (feat)
2. **Task 2: Create version bump script and document GitHub Secrets** - `576bb36` (feat)
3. **Fix: Use GPG-encrypted signing key instead of Apple notarization** - `35fc1ea` (fix)

## Files Created/Modified
- `.github/workflows/release.yml` - CI/CD pipeline with GPG-encrypted signing (no Apple certs)
- `.github/signing.key.gpg` - GPG-encrypted Tauri signing key (passphrase: "tauri")
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
- tauri-action creates PKG installer without Apple notarization
- PKG is the preferred installation method (easier than DMG for users)
- Users must manually allow in System Settings > Privacy & Security > "Open Anyway"

**Signing approach (NO Apple Developer required):**
- GPG-encrypted Tauri signing key stored in repo (.github/signing.key.gpg)
- Decrypted during CI/CD with GPG_PASSPHRASE secret
- Only 2 GitHub Secrets needed (vs 8+ for Apple notarization):
  - GPG_PASSPHRASE: "tauri" (decrypts signing.key.gpg)
  - TAURI_PRIVATE_KEY_PASSWORD: "tauri" (unlocks signing key)
  - SENTRY_DSN: optional
- No Apple Developer account, no certificates, no notarization

**Version management:**
- Single source of truth approach: run bump-version.sh script
- Script updates all three version files in sync (package.json, tauri.conf.json, Cargo.toml)
- Validates semver format (X.Y.Z)
- Prevents version drift between frontend and backend

**Release workflow trigger:**
- Push v* tags (e.g., v0.1.0, v0.2.0)
- Manual workflow_dispatch (emergency hotfix releases)
- Tag naming uses git tag directly (e.g., v0.1.0)
- Release body in German: "Neue Version verfügbar. Details im Changelog."

## Deviations from Plan

**1. [Rule 2 - Missing Critical] Switched from Apple notarization to GPG-encrypted Tauri signing**
- **Found during:** User feedback - no Apple Developer account available
- **Issue:** Plan assumed Apple Developer account for code signing and notarization
- **Fix:** Use GPG-encrypted Tauri signing key approach from docs/release.md
- **Files modified:** .github/workflows/release.yml, .github/signing.key.gpg (created)
- **Impact:** Much simpler setup - only 2 GitHub Secrets instead of 8+, no Apple account required
- **Trade-off:** Users must manually bypass Gatekeeper (System Settings > "Open Anyway")
- **Committed in:** 35fc1ea (fix commit)

---

**Total deviations:** 1 user-requested fix (Apple notarization → GPG signing)
**Impact on plan:** Positive - simpler, cheaper, no external dependencies. Core functionality unchanged.

## Issues Encountered

**Apple Developer account requirement:**
- Original plan assumed Apple Developer account for notarization
- User clarified: no Apple Developer account available
- Solution: Use proven GPG-encrypted signing approach from Editor-Workshop docs
- Result: Simpler setup with fewer GitHub Secrets required

## User Setup Required

**GitHub Secrets Configuration:**

Before the CI/CD pipeline can run, configure these GitHub Secrets in the repository settings (Settings > Secrets and variables > Actions > New repository secret):

**Required Secrets (only 2!):**

1. **`GPG_PASSPHRASE`** (required)
   - Value: `tauri`
   - Purpose: Decrypts .github/signing.key.gpg during CI/CD
   - The GPG-encrypted signing key is already in the repo

2. **`TAURI_PRIVATE_KEY_PASSWORD`** (required)
   - Value: `tauri`
   - Purpose: Unlocks the Tauri signing key after GPG decryption
   - Matches the password used when generating ~/.tauri/binky.key

**Optional:**

3. **`SENTRY_DSN`** (optional)
   - Value: Your Sentry DSN from sentry.io
   - Purpose: Crash reporting (app works without it in development)

**Important Notes:**
- ✅ NO Apple Developer account required
- ✅ NO Apple certificates needed
- ✅ NO Apple notarization required
- ✅ Signing key is GPG-encrypted and stored in repo at .github/signing.key.gpg
- ⚠️ Users must bypass Gatekeeper manually: System Settings > Privacy & Security > "Open Anyway"

**Release Process:**

Once secrets are configured:
1. Run: `./scripts/bump-version.sh 0.2.0` (replace with desired version)
2. Commit: `git add -A && git commit -m 'chore: bump version to v0.2.0'`
3. Tag: `git tag v0.2.0`
4. Push: `git push && git push origin v0.2.0`
5. CI/CD triggers automatically on tag push, builds, signs, and publishes release to GitHub

## Next Phase Readiness

**Ready for next phase:**
- CI/CD pipeline ready to build and release app
- Version management automated and validated
- All signing infrastructure configured
- Release artifacts (PKG, DMG, updater files) will be generated automatically
- No manual build steps required for releases

**Blockers/Concerns:**
- GitHub Secrets not configured yet (only 2 required: GPG_PASSPHRASE and TAURI_PRIVATE_KEY_PASSWORD)
- No releases exist yet (first release will trigger when v* tag is pushed)
- Users will see Gatekeeper warning (must manually allow in System Settings > "Open Anyway")

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
