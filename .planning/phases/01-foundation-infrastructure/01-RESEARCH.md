# Phase 1: Foundation & Infrastructure - Research

**Researched:** 2026-02-11
**Domain:** Tauri v2 desktop application development for macOS
**Confidence:** HIGH

## Summary

Phase 1 requires establishing a production-ready Tauri v2 desktop application foundation for macOS with comprehensive distribution infrastructure. The research focused on the standard Tauri v2 stack, macOS-specific distribution requirements (PKG installers, code signing, notarization), auto-updater implementation via GitHub Releases, SQLite database with migrations, React frontend with German localization, and crash reporting integration.

**Key findings:**
- Tauri v2 provides official plugins for all critical requirements (updater, SQL, file system)
- GitHub Actions with tauri-action provides battle-tested CI/CD for macOS builds and releases
- macOS code signing and notarization are mandatory for distribution outside the App Store
- SQLite migrations via tauri-plugin-sql include automatic transaction rollback but require manual backup strategies
- react-i18next is the de facto standard for React internationalization with excellent TypeScript support
- sentry-tauri community plugin provides unified crash reporting across frontend (JavaScript) and backend (Rust)

**Primary recommendation:** Use the official Tauri v2 plugin ecosystem (sql, updater, file-system) with create-tauri-app React template, GitHub Actions via tauri-action for CI/CD, and react-i18next for German localization. This stack is well-documented, actively maintained, and represents current best practices as of 2026.

## Standard Stack

The established libraries/tools for Tauri v2 macOS desktop applications:

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Tauri | v2.x | Desktop app framework | Official v2 stable release (2024), active maintenance, official macOS support |
| React | 19.x | Frontend framework | First-class Tauri template support, large ecosystem, TypeScript-friendly |
| TypeScript | 5.x+ | Type safety | Recommended by Tauri templates, catches errors at compile-time |
| Vite | 6.x+ | Build tool | Official Tauri recommendation for React/Vue/Svelte SPAs |
| Rust | 1.77.2+ | Backend language | Required by Tauri, minimum version for SQL plugin |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| tauri-plugin-sql | 2.x | SQLite database with migrations | Always - core data storage requirement |
| tauri-plugin-updater | 2.x | Auto-updater with signature verification | Always - required for app updates |
| tauri-plugin-fs | 2.x | File system access | Always - required for file operations |
| react-i18next | 15.x+ | Internationalization (i18n) | Always - German UI requirement |
| i18next | 23.x+ | i18n core framework | Dependency of react-i18next |
| sentry-tauri | 0.5.x | Crash reporting (Rust + JS) | Always - error tracking from day 1 |
| @sentry/browser | Latest | Browser-side error tracking | Integrated via sentry-tauri |
| sentry-rust | 0.42+ | Rust panic/crash reporting | Integrated via sentry-tauri |

### CI/CD & Distribution

| Tool | Version | Purpose | When to Use |
|------|---------|---------|-------------|
| tauri-action | v0 | GitHub Actions workflow | Always - automates builds and releases |
| GitHub Releases | N/A | Update distribution | Always - free hosting for updater artifacts |
| Xcode Command Line Tools | Latest | macOS code signing | Always - required for PKG signing |
| productbuild | Native | PKG installer creation | Always - macOS installer format |
| xcrun | Native | Signing and notarization | Always - Apple toolchain integration |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| react-i18next | react-intl | react-i18next has better Tauri ecosystem fit and simpler API |
| tauri-plugin-sql | rusqlite directly | Plugin provides migrations, transactions, JS bridge - don't hand-roll |
| Sentry | Custom logging | Sentry provides context, breadcrumbs, source maps - mature solution |
| GitHub Releases | CrabNebula Cloud | GitHub is free and sufficient for private app (2 users) |
| React | Svelte/Vue/Solid | Context shows existing Editor-Workshop uses React, reuse patterns |

**Installation:**
```bash
# Create Tauri app with React template
npm create tauri-app@latest

# Add official plugins
npm run tauri add sql
npm run tauri add updater
npm run tauri add fs

# Add Rust dependencies
cd src-tauri
cargo add tauri-plugin-sql --features sqlite
cargo add sentry --version 0.42
cargo add tauri-plugin-sentry --version 0.5

# Add frontend dependencies
cd ..
npm install react-i18next i18next
```

## Architecture Patterns

### Recommended Project Structure

```
nettgefluester-app/
├── src/                    # React frontend
│   ├── components/         # React components
│   ├── lib/               # Utilities, helpers
│   ├── locales/           # i18n translations
│   │   └── de/           # German translations
│   │       └── translation.json
│   ├── hooks/             # Custom React hooks
│   ├── App.tsx            # Main app component
│   └── main.tsx           # Entry point
├── src-tauri/             # Rust backend
│   ├── src/
│   │   ├── main.rs       # Main entry (mobile)
│   │   └── lib.rs        # Core app logic
│   ├── icons/            # App icons (generated)
│   ├── migrations/       # SQL migration files
│   │   ├── 001_initial.sql
│   │   └── 002_*.sql
│   ├── capabilities/     # Tauri permissions
│   ├── Cargo.toml        # Rust dependencies
│   ├── tauri.conf.json   # Tauri configuration
│   ├── Info.plist        # macOS metadata
│   └── Entitlements.plist # macOS permissions
├── .github/
│   └── workflows/
│       └── release.yml   # CI/CD pipeline
└── package.json          # Frontend dependencies
```

### Pattern 1: SQL Migrations with Automatic Rollback

**What:** SQLite schema migrations with transaction-based rollback and manual backup before migration execution.

**When to use:** Every database schema change across phases. Phase 1 establishes pattern, future phases extend.

**Example:**
```rust
// Source: https://v2.tauri.app/plugin/sql/
use tauri_plugin_sql::{Builder, Migration, MigrationKind};

let migrations = vec![
    Migration {
        version: 1,
        description: "create_initial_tables",
        sql: include_str!("../migrations/001_initial.sql"),
        kind: MigrationKind::Up,
    },
    Migration {
        version: 2,
        description: "add_settings_table",
        sql: include_str!("../migrations/002_settings.sql"),
        kind: MigrationKind::Up,
    },
];

tauri::Builder::default()
    .plugin(
        Builder::default()
            .add_migrations("sqlite:nettgefluester.db", migrations)
            .build()
    )
```

**Migration file structure:**
```sql
-- migrations/001_initial.sql
-- Create initial schema
CREATE TABLE IF NOT EXISTS episodes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_episodes_created ON episodes(created_at);
```

**Key principles:**
- Each migration has unique version number
- Migrations run within transactions (automatic rollback on failure)
- Use `include_str!()` to embed SQL files at compile time
- Name files with zero-padded numbers: `001_`, `002_`, etc.
- Register migrations with plugin during app initialization

### Pattern 2: Auto-Updater with Signature Verification

**What:** GitHub Releases-based updater with cryptographic signature verification and non-blocking UI.

**When to use:** Every app launch (check for updates), configurable update endpoints per environment.

**Example:**
```rust
// Source: https://v2.tauri.app/plugin/updater/
use tauri_plugin_updater::UpdaterExt;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                let response = handle.updater().check().await;
            });
            Ok(())
        })
}
```

**Configuration in tauri.conf.json:**
```json
{
  "bundle": {
    "createUpdaterArtifacts": true
  },
  "plugins": {
    "updater": {
      "pubkey": "YOUR_PUBLIC_KEY_HERE",
      "endpoints": [
        "https://github.com/<owner>/<repo>/releases/latest/download/latest.json"
      ]
    }
  }
}
```

**Key principles:**
- Generate signing keys once: `npm run tauri signer generate -w ~/.tauri/myapp.key`
- Store private key in 1Password (context requirement)
- Public key embedded in tauri.conf.json
- Set `TAURI_SIGNING_PRIVATE_KEY` environment variable in CI/CD
- Signature verification is mandatory, cannot be disabled

### Pattern 3: React i18n with Namespace Organization

**What:** German localization using react-i18next with JSON translation files organized by feature namespaces.

**When to use:** All user-facing text throughout the application.

**Example:**
```typescript
// Source: https://react.i18next.com/
// src/i18n.ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import de from './locales/de/translation.json';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      de: { translation: de }
    },
    lng: 'de',
    fallbackLng: 'de',
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;
```

**Translation file structure:**
```json
// src/locales/de/translation.json
{
  "app": {
    "title": "Nettgeflüster"
  },
  "nav": {
    "episodes": "Episoden",
    "analytics": "Analytik",
    "topics": "Themen",
    "bird": "Vogel-Randomizer",
    "settings": "Einstellungen"
  },
  "dates": {
    "today": "heute",
    "yesterday": "gestern",
    "daysAgo": "vor {{count}} Tagen"
  }
}
```

**Usage in components:**
```tsx
import { useTranslation } from 'react-i18next';

function Navigation() {
  const { t } = useTranslation();

  return (
    <nav>
      <a href="/episodes">{t('nav.episodes')}</a>
      <a href="/settings">{t('nav.settings')}</a>
    </nav>
  );
}
```

**Key principles:**
- Organize translations by feature/namespace (nav, settings, episodes, etc.)
- Use interpolation for dynamic values: `{{count}}`
- German is the only language, no language switcher needed
- TypeScript support via typed translation keys

### Pattern 4: Sentry Integration (Unified Frontend + Backend)

**What:** Crash reporting that captures JavaScript errors, Rust panics, and native crashes with unified event context.

**When to use:** Initialize during app startup, runs throughout app lifecycle.

**Example:**
```rust
// Source: https://github.com/timfish/sentry-tauri
// src-tauri/src/lib.rs
use sentry;
use tauri_plugin_sentry;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let client = sentry::init((
        "YOUR_SENTRY_DSN",
        sentry::ClientOptions {
            release: sentry::release_name!(),
            auto_session_tracking: true,
            ..Default::default()
        }
    ));

    tauri::Builder::default()
        .plugin(tauri_plugin_sentry::init(&client))
        // ... other plugins
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

**Capabilities configuration:**
```json
// src-tauri/capabilities/default.json
{
  "permissions": [
    "sentry:default"
  ]
}
```

**Key principles:**
- sentry-tauri automatically injects @sentry/browser into webviews
- Rust context enriches JavaScript events (OS, device, system info)
- Breadcrumbs merge from both frontend and backend
- DSN stored as environment variable in CI/CD
- Optional: Enable minidump capture for native crashes

### Pattern 5: macOS Permissions & Entitlements

**What:** Configure macOS sandbox entitlements and Info.plist for required file/audio permissions.

**When to use:** Phase 1 setup, extended in later phases as new permissions needed.

**Example:**
```xml
<!-- src-tauri/Entitlements.plist -->
<!-- Source: https://v2.tauri.app/distribute/macos-application-bundle/ -->
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.security.app-sandbox</key>
    <true/>
    <key>com.apple.security.files.user-selected.read-only</key>
    <true/>
    <key>com.apple.security.network.client</key>
    <true/>
</dict>
</plist>
```

**Note:** Based on context, **NO microphone permission needed** - app transcribes existing episodes from RSS feed, not live recording.

**Info.plist for German localization:**
```xml
<!-- src-tauri/Info.plist -->
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleDisplayName</key>
    <string>Nettgeflüster</string>
    <key>CFBundleName</key>
    <string>Nettgeflüster</string>
</dict>
</plist>
```

**Configuration in tauri.conf.json:**
```json
{
  "bundle": {
    "macOS": {
      "entitlements": "./Entitlements.plist",
      "minimumSystemVersion": "12.0"
    }
  }
}
```

### Pattern 6: Window Configuration with Theme Support

**What:** Configure resizable window with minimum size constraints and automatic system theme detection.

**When to use:** App initialization in tauri.conf.json.

**Example:**
```json
// tauri.conf.json
// Source: https://v2.tauri.app/learn/window-customization/
{
  "app": {
    "windows": [
      {
        "title": "Nettgeflüster",
        "width": 1200,
        "height": 800,
        "minWidth": 800,
        "minHeight": 600,
        "resizable": true,
        "decorations": true,
        "theme": null
      }
    ]
  }
}
```

**Theme detection using CSS:**
```css
/* Auto-detect system theme */
@media (prefers-color-scheme: dark) {
  :root {
    --background: #1a1a1a;
    --foreground: #ffffff;
  }
}

@media (prefers-color-scheme: light) {
  :root {
    --background: #ffffff;
    --foreground: #000000;
  }
}
```

**JavaScript theme detection:**
```typescript
// Listen for theme changes
const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');

darkModeQuery.addEventListener('change', (e) => {
  const isDark = e.matches;
  // Update UI accordingly
});
```

**Key principles:**
- Set `theme: null` to auto-follow system theme
- Use `prefers-color-scheme` CSS media query for styling
- Enforce minimum window size to prevent broken layouts
- Context specifies SF Pro (macOS system font) - use `-apple-system` in CSS

### Anti-Patterns to Avoid

- **Hard-coding translations in JSX:** Always use `t('key')` function, never hardcode German strings. Makes future changes difficult and inconsistent.

- **Running migrations without backup:** SQLite DDL changes can't rollback mid-migration. Always backup database before migration (automatic backup strategy required).

- **Skipping signature verification:** Never disable updater signature checks or attempt to bypass. This is a critical security feature.

- **Building universal macOS binaries directly:** Tauri v2 requires separate builds for `aarch64-apple-darwin` (ARM) and `x86_64-apple-darwin` (Intel), then combining. Don't try to build universal binary in single step.

- **Storing sensitive keys in repository:** Private signing keys must be in 1Password and injected via environment variables in CI/CD. Never commit to git.

- **Using ad-hoc signing for distribution:** Ad-hoc signing (`signingIdentity: "-"`) is only for local ARM development. Production requires proper Apple Developer certificate and notarization.

- **Hand-rolling database migrations:** tauri-plugin-sql provides migration system with transaction support. Don't implement custom migration logic.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Auto-updater | Custom update checker + downloader | tauri-plugin-updater | Handles signature verification, progress tracking, platform differences, partial downloads, rollback |
| SQLite migrations | Version table + SQL runner | tauri-plugin-sql migrations | Transaction management, version tracking, rollback, JavaScript bridge |
| i18n/localization | Object lookups + string templates | react-i18next | Pluralization, interpolation, namespaces, TypeScript types, date formatting |
| Crash reporting | Console logging + file writes | sentry-tauri | Context enrichment, breadcrumbs, source maps, release tracking, user feedback |
| Code signing | Shell scripts calling `codesign` | Tauri CLI + tauri-action | Handles certificates, entitlements, notarization, PKG signing automatically |
| Dark mode detection | Manual theme toggle | CSS `prefers-color-scheme` | System integration, automatic switching, respects user preference |
| Window management | Manual resize handlers | Tauri window API | Cross-platform, min/max constraints, decorations, multiple windows |

**Key insight:** Tauri's plugin ecosystem is mature and well-tested. The v2 official plugins integrate deeply with the framework and provide JavaScript ↔ Rust bridges that would be complex to build correctly. Always check for official or well-maintained community plugins before implementing custom solutions.

## Common Pitfalls

### Pitfall 1: SQLite Migration Failure Without Backup

**What goes wrong:** DDL statements (CREATE TABLE, ALTER TABLE, DROP) in SQLite cannot be rolled back mid-execution. If a migration fails partway through complex schema changes, database can be left in inconsistent state.

**Why it happens:** Developers assume transaction rollback works for all SQL statements. SQLite doesn't support transactional DDL fully - while the plugin wraps migrations in transactions, corruption or syntax errors during DDL execution can still cause issues.

**How to avoid:**
- Implement automatic backup before running migrations (copy database file)
- Store backup in app's data directory with timestamp
- Test migrations against copy of production database first
- Keep migrations small and focused (one logical change per migration)
- Use `IF NOT EXISTS` / `IF EXISTS` clauses for idempotency

**Warning signs:**
- Migration fails and database won't open
- App crashes on launch after update
- Data missing after failed update

### Pitfall 2: Code Signing Certificate Confusion

**What goes wrong:** Using wrong certificate type for PKG installers or confusing Developer ID Application (for .app) with Developer ID Installer (for .pkg), resulting in notarization failures.

**Why it happens:** Apple has multiple certificate types and the distinction isn't always clear. The .app bundle needs "Developer ID Application" or "Apple Distribution", but the PKG installer needs "Developer ID Installer" or "Mac Installer Distribution".

**How to avoid:**
- .app signing: Use "Developer ID Application" for distribution outside App Store
- .pkg signing: Use "Developer ID Installer" (requires account holder role)
- App Store: Use "Apple Distribution" + "Mac Installer Distribution"
- Set `APPLE_SIGNING_IDENTITY` to correct certificate name in CI/CD
- Verify certificate chain: `security find-identity -v -p codesigning`

**Warning signs:**
- "Code object is not signed at all" error
- Notarization fails with "invalid signature"
- PKG installer shows "unidentified developer" warning
- CI/CD fails during signing step

### Pitfall 3: GitHub Releases URL Endpoint Misconfiguration

**What goes wrong:** Auto-updater can't find update JSON or downloads wrong architecture's binary.

**Why it happens:** Tauri generates platform-specific JSON manifests, but the updater endpoint must use template variables correctly. Common mistakes: wrong repository name, missing `latest/download/` path component, hardcoding architecture.

**How to avoid:**
- Use exact endpoint format: `https://github.com/<owner>/<repo>/releases/latest/download/latest.json`
- Template variables supported: `{{target}}`, `{{arch}}`, `{{current_version}}`
- For macOS universal: Don't use arch variable, use platform-specific endpoints
- Test updater in pre-release builds before production
- Set `createUpdaterArtifacts: true` in tauri.conf.json

**Configuration example:**
```json
{
  "plugins": {
    "updater": {
      "endpoints": [
        "https://github.com/username/nettgefluester-app/releases/latest/download/latest.json"
      ]
    }
  }
}
```

**Warning signs:**
- Updater never finds new versions
- "Failed to fetch update manifest" error
- Wrong architecture binary downloaded on update

### Pitfall 4: Cross-Platform UI Inconsistencies (macOS vs Other)

**What goes wrong:** UI looks correct during development on developer's machine but broken on other macOS versions or screen sizes due to font rendering differences, missing system fonts, or window size edge cases.

**Why it happens:** Tauri uses native webview (WebKit on macOS), which has platform-specific rendering quirks. Font availability varies by macOS version, and different screen densities affect layout.

**How to avoid:**
- Use system font stack: `font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`
- Test on minimum supported macOS version (12 Monterey from context)
- Test at various window sizes down to minimum (enforced in config)
- Use relative units (rem, em, %) instead of fixed pixels
- Avoid hardcoded dimensions that assume specific screen sizes
- Test with both light and dark modes

**Warning signs:**
- Text truncated or overlapping at minimum window size
- Fonts render differently than expected
- Layout breaks when resizing window
- Sidebar navigation unreadable at narrow widths

### Pitfall 5: Rust Compilation Time in Development

**What goes wrong:** Initial `npm run tauri dev` takes 5-10+ minutes, making development iteration slow and frustrating.

**Why it happens:** Rust compilation is CPU-intensive, especially first build or after dependency changes. Tauri compiles entire Rust backend including all plugins.

**How to avoid:**
- Use `swatinem/rust-cache@v2` in GitHub Actions (saves ~90% CI build time)
- Enable incremental compilation (default in dev mode)
- Use `mold` linker on Linux or `lld` on macOS for faster linking
- Keep Rust backend stable during frontend iteration
- Use `npm run dev` (frontend only) when not testing Rust changes
- Consider pre-compiling Rust dependencies in Docker for consistent CI

**Warning signs:**
- 10+ minute builds on every change
- CI/CD pipelines timeout
- Developer frustration with iteration speed

### Pitfall 6: i18n Key Typos Without TypeScript Protection

**What goes wrong:** Translation key typos show raw key strings in UI (`"nav.epsodes"` instead of "Episoden") and only discovered at runtime.

**Why it happens:** Without TypeScript types for translation keys, typos aren't caught at compile time. react-i18next defaults to returning the key string when translation missing.

**How to avoid:**
- Generate TypeScript types from translation JSON (via i18next-parser or similar)
- Use typed translation keys: `t($ => $.nav.episodes)` syntax
- Enable strict mode in i18next: `returnNull: false` to fail fast
- Implement fallback warnings in development mode
- Code review focusing on new translation keys

**Example TypeScript setup:**
```typescript
// i18n.d.ts
import 'react-i18next';
import translation from './locales/de/translation.json';

declare module 'react-i18next' {
  interface CustomTypeOptions {
    resources: {
      translation: typeof translation;
    };
  }
}
```

**Warning signs:**
- UI shows translation keys instead of German text
- Keys work in some contexts but not others
- Missing translations not caught until manual testing

### Pitfall 7: Forgetting Capabilities Permissions for Plugins

**What goes wrong:** Plugin commands fail with permission errors even though plugin is installed and initialized correctly.

**Why it happens:** Tauri v2 security model requires explicit permission grants in capabilities JSON files. Installing plugin doesn't automatically grant permissions.

**How to avoid:**
- Add plugin permissions to `src-tauri/capabilities/default.json` or specific capability files
- Check plugin documentation for required permissions
- Common permissions: `sql:default`, `updater:default`, `fs:default`, `sentry:default`
- Test plugin commands immediately after installation
- CI/CD should fail if permissions missing (build-time validation)

**Required permissions for Phase 1:**
```json
{
  "permissions": [
    "sql:default",
    "sql:allow-execute",
    "updater:default",
    "fs:default",
    "sentry:default"
  ]
}
```

**Warning signs:**
- Commands work in Rust but fail when called from frontend
- "Permission denied" errors in browser console
- Plugin appears installed but non-functional

## Code Examples

Verified patterns from official sources:

### GitHub Actions Workflow for Tauri v2

```yaml
# Source: https://v2.tauri.app/distribute/pipelines/github/
# .github/workflows/release.yml
name: Release

on:
  push:
    branches:
      - release

jobs:
  publish-tauri:
    permissions:
      contents: write
    strategy:
      fail-fast: false
      matrix:
        include:
          - platform: 'macos-latest' # ARM-based Mac
            args: '--target aarch64-apple-darwin'
          - platform: 'macos-latest' # Intel-based Mac
            args: '--target x86_64-apple-darwin'

    runs-on: ${{ matrix.platform }}
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: lts/*
          cache: 'npm'

      - name: Install Rust
        uses: dtolnay/rust-toolchain@stable
        with:
          # ARM and Intel targets for macOS
          targets: aarch64-apple-darwin,x86_64-apple-darwin

      - name: Rust cache
        uses: swatinem/rust-cache@v2
        with:
          workspaces: './src-tauri -> target'

      - name: Install frontend dependencies
        run: npm install

      - name: Build Tauri app
        uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          APPLE_CERTIFICATE: ${{ secrets.APPLE_CERTIFICATE }}
          APPLE_CERTIFICATE_PASSWORD: ${{ secrets.APPLE_CERTIFICATE_PASSWORD }}
          APPLE_SIGNING_IDENTITY: ${{ secrets.APPLE_SIGNING_IDENTITY }}
          APPLE_ID: ${{ secrets.APPLE_ID }}
          APPLE_PASSWORD: ${{ secrets.APPLE_PASSWORD }}
          APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
          TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
        with:
          tagName: app-v__VERSION__
          releaseName: 'Nettgeflüster v__VERSION__'
          releaseBody: 'See CHANGELOG.md for details'
          releaseDraft: false
          prerelease: false
          args: ${{ matrix.args }}
```

### Database Backup Before Migration

```typescript
// Source: Best practices from https://www.sqliteforum.com/p/sqlite-versioning-and-migration-strategies
// src/lib/database.ts
import { BaseDirectory, copyFile, exists } from '@tauri-apps/plugin-fs';
import Database from '@tauri-apps/plugin-sql';

export async function loadDatabaseWithBackup(): Promise<Database> {
  const dbPath = 'nettgefluester.db';
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = `backups/nettgefluester-${timestamp}.db`;

  // Check if database exists
  const dbExists = await exists(dbPath, { baseDir: BaseDirectory.AppData });

  if (dbExists) {
    // Create backup before loading (migrations run on load)
    await copyFile(dbPath, backupPath, {
      fromPathBaseDir: BaseDirectory.AppData,
      toPathBaseDir: BaseDirectory.AppData
    });

    console.log(`Database backed up to ${backupPath}`);
  }

  // Load database (migrations run automatically)
  return await Database.load(`sqlite:${dbPath}`);
}
```

### App Icon Generation

```bash
# Source: https://v2.tauri.app/develop/icons/
# Place 1024x1024 PNG with transparency at project root
# Named app-icon.png

# Generate all platform icons
npm run tauri icon

# Output: src-tauri/icons/
#   - icon.icns (macOS)
#   - icon.ico (Windows)
#   - 32x32.png, 128x128.png, 128x128@2x.png, 256x256.png, 512x512.png (Linux)
```

### Checking for Updates (Non-Blocking)

```typescript
// Source: https://v2.tauri.app/plugin/updater/
// src/lib/updater.ts
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

export async function checkForUpdates() {
  try {
    const update = await check();

    if (update?.available) {
      console.log(`Update available: ${update.version}`);

      // Context requirement: Warn if >50MB
      if (update.contentLength && update.contentLength > 50 * 1024 * 1024) {
        const userConsent = confirm(
          `Update ist ${(update.contentLength / 1024 / 1024).toFixed(1)} MB groß. Jetzt herunterladen?`
        );
        if (!userConsent) return;
      }

      // Download and install with progress
      await update.downloadAndInstall((event) => {
        if (event.type === 'download-progress') {
          const percent = (event.chunkLength / event.contentLength) * 100;
          console.log(`Download: ${percent.toFixed(1)}%`);
          // Update UI progress bar
        }
      });

      // Prompt for restart
      const shouldRelaunch = confirm('Update installiert. App jetzt neu starten?');
      if (shouldRelaunch) {
        await relaunch();
      }
    }
  } catch (error) {
    // Context requirement: Silent retry on failure
    console.error('Update check failed:', error);
    // Don't show error to user, will retry on next launch
  }
}
```

### Relative Date Formatting (German)

```typescript
// Source: Best practices from https://www.glorywebs.com/blog/internationalization-in-react
// src/lib/dates.ts
import { useTranslation } from 'react-i18next';

export function useRelativeDate() {
  const { t } = useTranslation();

  return (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return t('dates.today'); // "heute"
    if (diffDays === 1) return t('dates.yesterday'); // "gestern"
    if (diffDays < 7) return t('dates.daysAgo', { count: diffDays }); // "vor X Tagen"

    // Fallback to formatted date
    return new Intl.DateTimeFormat('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(date);
  };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Tauri v1 | Tauri v2 | 2024 stable release | Mobile support, improved plugins, better security model |
| Manual updater implementation | tauri-plugin-updater | Tauri v2 | Built-in signature verification, platform-specific artifacts |
| electron-builder for distribution | tauri-action GitHub Action | 2024-2025 | Automated releases, code signing in CI/CD |
| Create React App | Vite | 2023-2024 | Faster builds, better dev experience, smaller bundles |
| react-i18next v11 | react-i18next v15 | 2025 | Better TypeScript support, React 19 compatibility |
| Manual SQL migrations | tauri-plugin-sql with migrations | Tauri v2 | Transaction-based rollback, automatic versioning |
| sentry-electron | sentry-tauri | 2024-2025 | Unified Rust + JavaScript crash reporting |
| Universal macOS binary builds | Separate ARM + Intel builds | Tauri v2 | Better optimization per architecture, required by Tauri v2 |

**Deprecated/outdated:**
- **Tauri v1 plugin system:** v2 uses new plugin architecture with capabilities/permissions. v1 plugins not compatible.
- **`npm run tauri build --target universal-apple-darwin`:** No longer supported. Build ARM and Intel separately.
- **create-react-app template:** Deprecated. Use Vite template from create-tauri-app.
- **Ad-hoc signing for production:** Only for local development. Production requires proper Developer ID certificates.
- **Manual Info.plist for all metadata:** Tauri generates most Info.plist entries automatically. Only add custom keys.

## Open Questions

Things that couldn't be fully resolved:

1. **PKG Installer Customization Level**
   - What we know: `productbuild` can create branded PKG with disk space requirements
   - What's unclear: Level of customization possible for installer UI (colors, logo, custom screens)
   - Recommendation: Start with basic `productbuild` PKG. Investigate advanced customization in implementation phase if needed. May require additional tools like PackageMaker (deprecated) or third-party solutions.

2. **Analytics Platform Choice (Claude's Discretion)**
   - What we know: Sentry handles crash reporting well. Context allows Claude discretion on analytics platform.
   - What's unclear: Best anonymous analytics tool for desktop apps in 2026 (Posthog, Mixpanel, custom)
   - Recommendation: Start with Sentry's performance monitoring (included). Add dedicated analytics platform (Posthog self-hosted or cloud) if detailed feature usage tracking needed in Phase 2+. Privacy-focused for German users.

3. **Database Architecture: Single vs Split Files**
   - What we know: SQLite supports single file or separate databases (via ATTACH). Context allows Claude discretion.
   - What's unclear: Performance trade-offs for single vs split architecture given app will grow across phases
   - Recommendation: Start with single database file for Phase 1 simplicity. Monitor performance. Consider splitting by domain (episodes DB, analytics DB, topics DB) in later phases if single file exceeds ~500MB or concurrent write contention becomes issue.

4. **Window Minimum Dimensions (Claude's Discretion)**
   - What we know: Must enforce minimum size to prevent broken layouts. Sidebar ~200px + content area needed.
   - What's unclear: Exact pixel values for minWidth/minHeight that work well in practice
   - Recommendation: Start with `minWidth: 800, minHeight: 600` based on standard laptop screens. Test at minimum size during implementation and adjust if needed. Consider responsive breakpoint at 1024px for layout changes.

5. **Uninstaller Implementation Approach**
   - What we know: Context requires "dedicated uninstaller app included with installer". macOS PKG receipts tracked by pkgutil.
   - What's unclear: Whether to bundle separate uninstaller .app or provide shell script
   - Recommendation: Create simple uninstaller shell script packaged with installer. Script uses `pkgutil --pkgs | grep nettgefluester` to find receipts, removes files, and deletes app data. Provide GUI wrapper (small .app) that runs script if desired. Reference: https://github.com/erikstam/uninstaller

6. **First Launch Tutorial Implementation**
   - What we know: Context specifies 2-3 screen tutorial on first launch showing features and phase roadmap
   - What's unclear: Whether to use modal overlays, separate window, or in-app onboarding flow
   - Recommendation: Use in-app modal overlay approach (more native feeling). Store `firstLaunchCompleted` flag in settings table. Show tutorial cards with "Next" / "Skip" buttons. Last screen asks about launch-at-login preference.

## Sources

### Primary (HIGH confidence)

- [Tauri v2 Documentation](https://v2.tauri.app/) - Official docs, all core concepts
- [Tauri v2 Create Project Guide](https://v2.tauri.app/start/create-project/) - Project setup, templates
- [Tauri Updater Plugin](https://v2.tauri.app/plugin/updater/) - Auto-updater implementation
- [Tauri SQL Plugin](https://v2.tauri.app/plugin/sql/) - Database migrations
- [Tauri macOS Code Signing](https://v2.tauri.app/distribute/sign/macos/) - Code signing, notarization
- [Tauri macOS Application Bundle](https://v2.tauri.app/distribute/macos-application-bundle/) - Info.plist, entitlements
- [Tauri GitHub Actions Pipeline](https://v2.tauri.app/distribute/pipelines/github/) - CI/CD workflow
- [Tauri App Icons](https://v2.tauri.app/develop/icons/) - Icon generation
- [Tauri Window Customization](https://v2.tauri.app/learn/window-customization/) - Window configuration
- [tauri-action GitHub Action](https://github.com/tauri-apps/tauri-action) - Release automation
- [react-i18next Documentation](https://react.i18next.com/) - i18n setup
- [sentry-tauri GitHub](https://github.com/timfish/sentry-tauri) - Crash reporting integration
- [MDN prefers-color-scheme](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-color-scheme) - Theme detection

### Secondary (MEDIUM confidence)

- [SQLite Versioning and Migration Strategies](https://www.sqliteforum.com/p/sqlite-versioning-and-migration-strategies) - Migration best practices, verified with official docs
- [SQLite Transactions](https://sqlite.org/lang_transaction.html) - Rollback behavior
- [Internationalization in React (2026)](https://www.glorywebs.com/com/blog/internationalization-in-react) - i18n patterns, cross-referenced with react-i18next docs
- [macOS Uninstaller Script](https://github.com/erikstam/uninstaller) - Community tool for PKG uninstallation

### Tertiary (LOW confidence - requires validation)

- Web search results on Tauri common pitfalls - anecdotal, should validate during implementation
- Web search results on PKG installer disk space requirements - some conflicting information, test in practice
- Community discussions on tauri-plugin-theme - plugin not used in Phase 1, prefer CSS approach

## Metadata

**Confidence breakdown:**
- Standard stack: **HIGH** - All components from official Tauri v2 docs and well-established React ecosystem
- Architecture: **HIGH** - Patterns from official plugin documentation and verified examples
- Pitfalls: **MEDIUM** - Mix of documented issues and community-reported problems. Some require validation in practice.
- Open questions: **MEDIUM** - Areas requiring implementation decisions, but multiple viable paths identified

**Research date:** 2026-02-11
**Valid until:** ~30 days (2026-03-13) - Tauri v2 is stable, but plugin versions and tooling evolve. Re-verify before Phase 2+ if significant time passes.

**Sources consulted:**
- 18 official Tauri v2 documentation pages (via WebFetch)
- 12 web searches across domains (via WebSearch)
- 3 official GitHub repositories (tauri-action, sentry-tauri, react-i18next)
- 2 MDN references (CSS standards)

**Verification protocol followed:** ✅
- Context7 not used (no MCP access in research environment)
- Official docs fetched for all core stack components
- WebSearch findings cross-referenced with official sources
- Negative claims avoided unless explicitly documented
- Confidence levels assigned based on source hierarchy
