# Plan 08-02 Summary: Pre-Release CI Hardening

**Status:** Complete
**Completed:** 2026-02-24

## What Was Built

Pre-release preparation: PKG build step added to CI workflow, postinstall Gatekeeper script created, signing key backed up, repo visibility decision made.

## Tasks Completed

| Task | Commit | Files |
|------|--------|-------|
| Task 1: PKG build step + cmake safety | `6f49a8b` | `.github/workflows/release.yml`, `.github/scripts/postinstall` |
| Task 2: Repo visibility decision | (human decision) | — |
| Task 3: Signing key backup | (human action) | — |

## Deliverables

- `.github/scripts/postinstall` — strips quarantine xattr after PKG install so Gatekeeper never blocks launch
- `.github/workflows/release.yml` — cmake safety step + pkgbuild step + PKG upload step added
- Repo decision: **make-public** before release (auto-updater requires public repo for unauthenticated access)
- Signing key: backed up to 1Password (key generated without password; TAURI_PRIVATE_KEY_PASSWORD is empty)

## Deviations

None.
