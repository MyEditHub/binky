# Release Workflow

## Quick Release

```bash
./bump-version.sh patch --release  # Bumps, builds, commits, tags, and pushes
```

## Re-release Same Version

```bash
./bump-version.sh --retag  # Deletes tag and recreates it
```

## Manual Steps

```bash
./bump-version.sh patch      # 0.1.5 → 0.1.6
git add . && git commit -m "Bump version to 0.1.6"
git tag v0.1.6 && git push && git push origin v0.1.6
```

## What bump-version.sh Updates

- package.json
- tauri.conf.json
- Cargo.toml
- App.tsx
- Dashboard.tsx
- README.md
- changelog.md

## What GitHub Actions Does

1. Builds app for Apple Silicon (arm64) and Intel (x64)
2. Signs with GPG-encrypted private key
3. Creates PKG installers and uploads to GitHub Release
4. Deploys updater files (tar.gz, sig, latest.json) to GitHub Pages

## Required GitHub Secrets

| Secret | Value |
|--------|-------|
| `GPG_PASSPHRASE` | `tauri` |
| `TAURI_PRIVATE_KEY_PASSWORD` | `tauri` |
| `VITE_SENTRY_DSN` | Sentry DSN for frontend |
| `VITE_POSTHOG_KEY` | PostHog API key |
| `SENTRY_DSN` | Sentry DSN for Rust backend |

## Signing Keys

- **Private key**: `~/.tauri/signing.key` (password: `tauri`)
- **Public key**: `~/.tauri/signing.key.pub`
- **Encrypted for CI**: `.github/signing.key.gpg`

### Generate New Signing Key

```bash
npm run tauri signer generate -- -w ~/.tauri/signing.key
# Enter password when prompted

# Encrypt for CI
gpg --symmetric --cipher-algo AES256 -o .github/signing.key.gpg ~/.tauri/signing.key
```

## Tauri Auto-Updater Setup

### Key Learnings

**What Works:**
1. GPG-encrypted key in repo at `.github/signing.key.gpg`
2. Inline env var: `TAURI_SIGNING_PRIVATE_KEY="$(cat /tmp/signing.key)"`
3. Disable artifact compression: `compression-level: 0`
4. Separate updater hosting on GitHub Pages

**What Doesn't Work:**
1. GitHub Secrets with newlines - newlines get corrupted
2. GITHUB_ENV heredoc - "Matching delimiter not found"
3. Base64 encode/decode - doesn't solve newline issue
4. Default artifact compression - corrupts DMG files

### Critical Configuration

```json
// tauri.conf.json - REQUIRED for updater artifacts
{
  "bundle": {
    "createUpdaterArtifacts": true
  }
}
```

## Archiving Old Versions

**Recommended approach:**
- Keep the last 3-5 releases with full assets on GitHub
- Delete older release assets (DMG/PKG) but keep git tags
- Users needing old versions can build from tagged source

**Download before deleting:**
```bash
gh release download v0.1.0 --dir ./archive/v0.1.0
```

## Troubleshooting

### macOS Gatekeeper Blocking

The app is not notarized. Users must:
1. Open **System Settings** > **Privacy & Security**
2. Click **"Open Anyway"** for Editor Workshop
3. Run installer again

### Build Fails on GitHub Actions

1. Check Actions tab for error logs
2. Common: version mismatch in Cargo.toml
3. Fix: Run `./bump-version.sh <version>` to sync all versions

### Signing Password Wrong

Ensure `TAURI_PRIVATE_KEY_PASSWORD` secret is set to `tauri`
