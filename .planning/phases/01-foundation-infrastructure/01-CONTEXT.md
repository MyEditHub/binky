# Phase 1: Foundation & Infrastructure - Context

**Gathered:** 2026-02-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Establish Tauri v2 desktop app foundation with database, macOS permissions, auto-updater infrastructure, PKG installer, German UI foundation, and CI/CD integration. This phase delivers a working app scaffold that users can install, launch, and update - ready for feature development in later phases.

</domain>

<decisions>
## Implementation Decisions

### Auto-Updater Behavior
- Check for updates on every app launch
- Non-blocking banner notification when update available
- Download and install automatically (seamless updates)
- **Exception:** Updates >50MB must warn user and ask permission before downloading
- Show progress bar during download - user can continue using app fully
- Allow "Remind me later" only (no permanent version skipping)
- Stable channel only - no beta builds in Phase 1
- Silent retry on download failure (try again next launch, no error notification)
- Prompt user to restart now or later after update installs
- Show brief highlights (2-3 bullet points) when notifying about new version
- Post-update: small dismissible banner "Now on v1.2.0" on first launch
- Offline behavior: silent skip, retry on next launch
- Verify digital signatures before installing (critical security)
- Pre-release testing: GitHub pre-release builds (manual PKG sharing)
- Critical bugs: emergency hotfix release strategy (no built-in rollback)

### Distribution & Repository
- New dedicated GitHub repository: `nettgefluester-app`
- Owned by user's personal GitHub account
- Auto-updater releases via GitHub Releases (free, version controlled)
- Custom branded PKG installer with podcast logo and colors
- Show required disk space in installer wizard
- Always install to `/Applications` (standard macOS location)
- Minimum macOS version: 12 Monterey or newer
- Dedicated uninstaller app included with installer

### Error Tracking & Analytics
- Sentry (or similar) for crash reporting from day 1
- Anonymous analytics enabled for feature usage tracking
- Claude's discretion on specific analytics platform choice

### Installation & First Launch
- **No microphone permission needed** - app transcribes existing podcast episodes from RSS feed, not live recording
- Quick tutorial on first launch (2-3 screens) showing main features and phase roadmap
- Tutorial asks "Start app when you log in?" (launch at login preference)
- App icon created from podcast logo artwork
- Custom branded installer showing podcast colors and welcome message

### Data Storage Strategy
- Transcripts stored in free GitHub repository (cloud storage)
- App downloads transcripts from GitHub on first launch - keeps app tiny
- Don't bundle episode audio or transcript data in app itself
- App stays lean over time - no growing bundle size
- GitHub repo approach: free, reliable, version controlled

### UI Foundation & Navigation
- Sidebar navigation (left ~200px, resizable window)
- All phase sections visible from start: Episodes, Analytics, Topics, Bird Randomizer, Settings
- **Phase 1 active sections:** Episodes and Settings only
- **Grayed-out/disabled:** Analytics, Topics, Bird (enabled in later phases)
- Auto-follow macOS system theme (light/dark mode)
- Brand colors extracted from podcast artwork automatically
- Resizable window with enforced minimum size (prevents broken layouts)
- No toolbar below title bar - clean window design
- macOS system font (SF Pro) throughout
- Standard Mac menu bar (File, Edit, Window, Help) - no custom menus
- Common keyboard shortcuts only (Cmd+comma for Settings, Cmd+Q to quit, etc.)
- macOS native spinner for loading states

### UI Content & Localization
- German UI throughout entire app
- Relative dates in German: "vor 2 Tagen", "gestern", "heute" instead of absolute dates
- Empty states: grayed-out sections with clear phase roadmap indication

### Database Strategy
- SQLite database for all app data
- Automatic migrations on app launch (seamless schema upgrades across phases)
- Automatic backup before running migrations (safety net)
- Auto-repair attempt if database corruption detected
- Export to JSON/ZIP file for user backups
- **Architecture:** Single-device for Phase 1, but design for future cloud sync capability
- Dev mode toggle for loading sample test data during development

### Claude's Discretion
- Specific analytics platform choice (Sentry + analytics tool)
- Single database file vs. split database architecture
- Database indexing and performance optimization strategy
- Exact window minimum dimensions
- Specific auto-updater signature verification implementation

</decisions>

<specifics>
## Specific Ideas

- "Keep the app lean - it shouldn't grow larger over time with bundled data"
- "I'm fairly new to GitHub system" - setup needs to be clear and documented
- "Can't quite place how the UI will look" - user prefers visual clarity, provided ASCII mockup helped
- App is for two podcast hosts (German-speaking), not general public
- Existing Editor-Workshop project has proven Tauri v2 setup with auto-updater, signing keys, CI/CD - reuse this approach

**Data approach clarification:**
- Don't need to store full episode audio files (stream from RSS feed or existing hosting)
- Only store transcripts (text/JSON - tiny) and statistics
- This keeps app and data storage minimal

**Repository setup:**
- New repo: `nettgefluester-app` on user's personal GitHub account
- Separate from podcast website/content

</specifics>

<deferred>
## Deferred Ideas

None - discussion stayed within Phase 1 scope. Future phase features (transcription, analytics, topics, bird randomizer) are already planned in roadmap and intentionally disabled in UI until their respective phases.

</deferred>

---

*Phase: 01-foundation-infrastructure*
*Context gathered: 2026-02-11*
