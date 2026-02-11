# Tauri Auto-Updater - Troubleshooting Journey

This document chronicles the issues encountered while implementing Tauri v2's auto-updater and what finally worked.

## Overview

The auto-updater allows the app to check for new versions and install them without requiring users to manually download updates. It uses signed `.tar.gz` files hosted externally and a `latest.json` manifest file.

---

## Problems Encountered & Solutions

### 1. Missing Plugin Permissions ❌ → ✅

**Problem:**
The updater didn't work at all. No update checks were happening.

**Root Cause:**
Tauri v2 requires explicit permissions for all plugins. Missing `updater:default` and `process:default` permissions.

**Solution:**
Add to `src-tauri/capabilities/default.json`:
```json
{
  "permissions": [
    "updater:default",
    "process:default"
  ]
}
```

**Commit:** `60117da` - "Fix auto-updater by adding missing plugin permissions"

---

### 2. Updater Artifacts Not Created ❌ → ✅

**Problem:**
The build process wasn't generating `.tar.gz` and `.sig` files needed for updates.

**Root Cause:**
Missing `createUpdaterArtifacts: true` in bundle config.

**Solution:**
Add to `src-tauri/tauri.conf.json`:
```json
{
  "bundle": {
    "createUpdaterArtifacts": true
  }
}
```

**Commit:** `520c84b` - "Fix updater signing with proper key format"

---

### 3. Signing Key Issues ❌ → ✅

**Problem:**
Updates were rejected due to invalid signatures.

**Root Cause:**
- Wrong public key format in `tauri.conf.json`
- Missing password for the signing key
- Initially tried using `includeUpdaterJson` flag (deprecated approach)

**Solution:**
- Generate proper signing key: `~/.tauri/signing.key` with password `tauri`
- Extract correct public key with: `cat ~/.tauri/signing.key.pub`
- Set correct pubkey in config (base64 format starting with `dW50cnVzdGVk...`)
- Add password to GitHub Secrets: `TAURI_PRIVATE_KEY_PASSWORD`
- Pass password in workflow:
  ```yaml
  TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_PRIVATE_KEY_PASSWORD }}
  ```

**Commits:**
- `9bdbceb` - "Enable includeUpdaterJson for auto-update support" (wrong approach)
- `520c84b` - "Fix updater signing with proper key format" (correct approach)

---

### 4. Artifact Compression Corruption ❌ → ✅

**Problem:**
DMG files were corrupted after being uploaded to GitHub Releases.

**Root Cause:**
GitHub Actions' `upload-artifact` was compressing binary files by default, corrupting them.

**Solution:**
Disable compression for binary files:
```yaml
- name: Upload artifacts
  uses: actions/upload-artifact@v4
  with:
    compression-level: 0  # Critical for binary files
```

**Commit:** `b8df9c8` - "Fix artifact corruption by disabling compression"

---

### 5. DMG Files in GitHub Releases ❌ → ✅

**Problem:**
Initially tried uploading DMGs through artifacts → publish job, which caused:
- Corruption issues
- Extra complexity
- Mixed files in releases (both user-facing and updater-only files)

**Solution:**
Upload DMGs (now PKGs) directly to release using `softprops/action-gh-release`:
```yaml
- name: Upload PKG to Release
  uses: softprops/action-gh-release@v1
  with:
    files: artifacts/release/*.pkg
```

**Commit:** `f18ba4e` - "Fix DMG corruption by uploading directly to release"

---

### 6. Updater File Hosting Strategy ❌ → ✅

**Problem:**
Initially tried hosting updater files (`.tar.gz`, `.sig`, `latest.json`) in GitHub Releases alongside user downloads. This:
- Cluttered the release page
- Mixed technical files with user-facing installers
- Made releases confusing

**Solution:**
Separate user-facing files from updater files:
- **GitHub Releases:** Only PKG installers (clean user experience)
- **GitHub Pages:** Host `.tar.gz`, `.sig`, and `latest.json` on `gh-pages` branch

Workflow structure:
```yaml
# Build artifacts go to two destinations
artifacts/release/   # PKG files → GitHub Releases
artifacts/updater/   # tar.gz, sig → GitHub Pages

# Separate upload steps
- name: Upload PKG to Release
  uses: softprops/action-gh-release@v1
  with:
    files: artifacts/release/*.pkg

- name: Deploy to GitHub Pages
  uses: peaceiris/actions-gh-pages@v4
  with:
    publish_dir: ./updater
```

Update endpoint in `tauri.conf.json`:
```json
{
  "plugins": {
    "updater": {
      "endpoints": [
        "https://myedithub.github.io/Editor-Workshop/latest.json"
      ]
    }
  }
}
```

**Commit:** `56e3013` - "Host updater files on GitHub Pages, show only DMGs in releases"

---

### 7. Generic Update Messages ❌ → ✅

**Problem:**
Update dialog showed generic "See the assets to download this version and install" message.

**Root Cause:**
`latest.json` didn't include actual release notes.

**Solution:**
Extract version-specific notes from `public/changelog.md` during workflow:
```yaml
- name: Create latest.json
  run: |
    VERSION="${{ steps.version.outputs.VERSION }}"
    # Extract section for current version from changelog.md
    NOTES=$(awk "/^## \\[${VERSION}\\]/{flag=1; next} /^## \\[/{flag=0} flag" public/changelog.md)

    cat > updater/latest.json << EOF
    {
      "version": "${VERSION}",
      "notes": "${NOTES}",
      ...
    }
    EOF
```

Now users see actual release notes in the update dialog.

**Commit:** `9aff193` - "Use changelog.md for auto-updater release notes"

---

### 8. DMG vs PKG Installer ❌ → ✅

**Problem:**
DMG installers required users to manually drag the app to Applications and deal with Gatekeeper warnings.

**Solution:**
Switch to PKG installers with a postinstall script:
```bash
#!/bin/bash
# .github/scripts/postinstall
xattr -cr /Applications/Editor\ Workshop.app
```

This automatically:
- Installs to `/Applications`
- Removes quarantine attributes that trigger Gatekeeper
- Provides a cleaner installation experience

**Commits:**
- `182bc54` - "Switch to PKG installer with postinstall script to bypass Gatekeeper"
- `6b5bdc0` - "Fix pkgbuild: use --component for .app bundles"

---

## Final Working Configuration

### 1. Tauri Config (`src-tauri/tauri.conf.json`)
```json
{
  "bundle": {
    "createUpdaterArtifacts": true
  },
  "plugins": {
    "updater": {
      "active": true,
      "endpoints": [
        "https://myedithub.github.io/Editor-Workshop/latest.json"
      ],
      "dialog": true,
      "pubkey": "dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IDNBMzM4QUEyNTBFRDE3OTMKUldTVEYrMVFvb296T3IvbUlBeDFIaE1McmJvMnF4Z0hBYmpISERrZW96UlNZeVBBVzhTVHpFb0kK"
    }
  }
}
```

### 2. Capabilities (`src-tauri/capabilities/default.json`)
```json
{
  "permissions": [
    "updater:default",
    "process:default"
  ]
}
```

### 3. Frontend Hook (`src/hooks/useAutoUpdater.ts`)
```typescript
import { check, type Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { ask } from '@tauri-apps/plugin-dialog';

export function useAutoUpdater() {
  // Check on mount (production only)
  useEffect(() => {
    if (import.meta.env.PROD) {
      checkForUpdates();
    }
  }, []);

  // Show dialog, download, install, relaunch
}
```

### 4. Signing Keys

**Local Development:**
- Private key: `~/.tauri/signing.key` (password: `tauri`)
- Public key: `~/.tauri/signing.key.pub`

**GitHub Actions:**
- Private key encrypted: `.github/signing.key.gpg`
- Decrypt with: `gpg --decrypt --passphrase="$GPG_PASSPHRASE" --output /tmp/signing.key .github/signing.key.gpg`
- Use secrets:
  - `GPG_PASSPHRASE` - to decrypt the GPG file
  - `TAURI_PRIVATE_KEY_PASSWORD` - password for the signing key

### 5. Release Workflow Strategy

```yaml
jobs:
  build:
    # For each architecture (arm64, x64):
    # 1. Build the app
    # 2. Decrypt signing key
    # 3. Create signed updater artifacts (.tar.gz, .sig)
    # 4. Create PKG installer
    # 5. Upload PKG directly to release
    # 6. Upload updater files as artifacts for publish job

  publish:
    # 1. Download all updater artifacts
    # 2. Create latest.json with changelog notes
    # 3. Deploy to GitHub Pages (tar.gz, sig, latest.json)
    # 4. Update release description with installation guide
```

### 6. File Organization

```
GitHub Release (user-facing):
├── Editor.Workshop_0.3.3_arm64.pkg
└── Editor.Workshop_0.3.3_x64.pkg

GitHub Pages (auto-updater):
├── latest.json
├── Editor.Workshop_0.3.3_arm64.app.tar.gz
├── Editor.Workshop_0.3.3_arm64.app.tar.gz.sig
├── Editor.Workshop_0.3.3_x64.app.tar.gz
└── Editor.Workshop_0.3.3_x64.app.tar.gz.sig
```

---

## Key Lessons Learned

1. **Tauri v2 requires explicit permissions** - Don't forget `updater:default` and `process:default`
2. **Always disable artifact compression** for binary files (`compression-level: 0`)
3. **Separate user-facing and technical files** - Use GitHub Pages for updater artifacts
4. **Use PKG installers** with postinstall scripts for better UX on macOS
5. **Signing is critical** - Wrong public key or missing password breaks everything
6. **Extract release notes** from changelog.md for better update dialogs
7. **Test in production builds** - Auto-updater only works when `import.meta.env.PROD` is true

---

## Testing Updates

1. **Build a new version:**
   ```bash
   ./bump-version.sh patch --release
   ```

2. **Create a GitHub release:**
   - Push the tag created by bump-version.sh
   - Wait for GitHub Actions to complete
   - Verify files appear in both GitHub Releases and GitHub Pages

3. **Test update detection:**
   - Install the previous version
   - Launch the app
   - Should show update dialog within a few seconds
   - Click "Yes" to install
   - App should relaunch with new version

4. **Verify signature:**
   ```bash
   # Download files from GitHub Pages
   curl -O https://myedithub.github.io/Editor-Workshop/Editor.Workshop_0.3.3_arm64.app.tar.gz
   curl -O https://myedithub.github.io/Editor-Workshop/Editor.Workshop_0.3.3_arm64.app.tar.gz.sig

   # Verify with public key
   minisign -Vm Editor.Workshop_0.3.3_arm64.app.tar.gz -P <your-public-key>
   ```

---

## Troubleshooting Checklist

If auto-updater isn't working:

- [ ] `createUpdaterArtifacts: true` in tauri.conf.json
- [ ] Correct public key in tauri.conf.json
- [ ] `updater:default` permission in capabilities/default.json
- [ ] `process:default` permission in capabilities/default.json
- [ ] `compression-level: 0` for artifact uploads
- [ ] GitHub Pages is enabled and deployed
- [ ] `latest.json` exists at the endpoint URL
- [ ] Signatures match between latest.json and actual .sig files
- [ ] Testing in production build (`npm run tauri build`), not dev mode
- [ ] Current version is lower than the version in latest.json

---

## References

- [Tauri Updater Plugin Docs](https://v2.tauri.app/plugin/updater/)
- [Tauri Signing Guide](https://v2.tauri.app/distribute/sign/)
- GitHub Actions commits: `60117da`, `520c84b`, `56e3013`, `9aff193`
