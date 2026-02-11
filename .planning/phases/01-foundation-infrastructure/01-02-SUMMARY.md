---
phase: 01-foundation-infrastructure
plan: 02
subsystem: ui
tags: [react, i18next, typescript, css-variables, theme-support]

# Dependency graph
requires:
  - phase: 01-01
    provides: Tauri v2 scaffold with React frontend and SQLite database
provides:
  - German-language UI foundation with sidebar navigation
  - i18n system with TypeScript-typed translation keys
  - macOS system theme auto-detection (light/dark mode)
  - Page routing for 5 sections (2 active, 3 disabled)
  - Minimal design with podcast brand colors
affects: [03-rss-parser, 04-transcription-engine, 05-analytics-ui]

# Tech tracking
tech-stack:
  added: [react-i18next@15.8.5, i18next@25.8.5]
  patterns: [i18n-with-typescript-types, css-custom-properties-theming, component-page-routing]

key-files:
  created:
    - src/i18n.ts: i18next initialization configured for German
    - src/i18n.d.ts: TypeScript type definitions for translation keys
    - src/locales/de/translation.json: German translations for all Phase 1 UI strings
    - src/components/Sidebar.tsx: Sidebar navigation with 5 sections
    - src/components/Layout.tsx: Main layout managing page state and routing
    - src/components/pages/EpisodesPage.tsx: Episodes page placeholder
    - src/components/pages/SettingsPage.tsx: Settings page with app info
    - src/components/pages/AnalyticsPage.tsx: Analytics disabled placeholder
    - src/components/pages/TopicsPage.tsx: Topics disabled placeholder
    - src/components/pages/BirdPage.tsx: Bird randomizer disabled placeholder
  modified:
    - src/App.tsx: Renders Layout as root component
    - src/main.tsx: Imports i18n before React render
    - src/styles.css: Brand colors, theme support, layout styles

key-decisions:
  - "Used emoji icons for navigation items (simple, no icon library needed)"
  - "CSS custom properties for theme support (macOS light/dark auto-detection)"
  - "Warm orange brand color (#d97757) based on podcast aesthetic"
  - "TypeScript types for i18n keys prevent typo bugs at compile time"

patterns-established:
  - "i18n pattern: All UI text via useTranslation() hook, no hardcoded strings"
  - "Theme pattern: CSS custom properties with @media (prefers-color-scheme: dark)"
  - "Page routing: Layout component manages state, renders page components"
  - "Disabled features: Grayed-out nav items with tooltip explaining coming soon"

# Metrics
duration: 3min
completed: 2026-02-11
---

# Phase 1 Plan 02: German UI Shell Summary

**German-language sidebar navigation with i18n system, light/dark theme support, and 5-page routing (Episodes and Settings active, Analytics/Topics/Bird disabled)**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-11T19:04:44Z
- **Completed:** 2026-02-11T19:07:54Z
- **Tasks:** 2
- **Files modified:** 13

## Accomplishments
- German-language UI with i18n system and TypeScript-typed translation keys
- Sidebar navigation with 5 sections (Episodes, Analytics, Topics, Bird, Settings)
- Episodes and Settings active and clickable, other 3 disabled with "kommt bald" messages
- macOS system theme auto-detection via CSS custom properties
- Minimal design with warm podcast brand colors (#d97757), no gradients
- Page routing between active sections works correctly

## Task Commits

Each task was committed atomically:

1. **Task 1: Set up react-i18next with German translations and TypeScript types** - `ee3a0c3` (feat)
2. **Task 2: Build sidebar navigation, page layout, brand colors, and theme support** - `75d6689` (feat)

## Files Created/Modified

**i18n System:**
- `src/i18n.ts` - i18next initialization with lng: 'de', fallbackLng: 'de'
- `src/i18n.d.ts` - TypeScript type definitions for compile-time translation key checking
- `src/locales/de/translation.json` - German translations for all Phase 1 UI strings (nav, pages, common)

**UI Components:**
- `src/components/Sidebar.tsx` - Navigation sidebar with 5 sections, disabled state support
- `src/components/Layout.tsx` - Main layout managing page state and routing
- `src/components/pages/EpisodesPage.tsx` - Episodes page with empty state
- `src/components/pages/SettingsPage.tsx` - Settings page with app version and database status
- `src/components/pages/AnalyticsPage.tsx` - Analytics coming soon placeholder
- `src/components/pages/TopicsPage.tsx` - Topics coming soon placeholder
- `src/components/pages/BirdPage.tsx` - Bird randomizer coming soon placeholder

**Root Files:**
- `src/App.tsx` - Root component rendering Layout
- `src/main.tsx` - React entry point with i18n import before render
- `src/styles.css` - Brand colors, theme support, layout, component styles

## Decisions Made

**1. Emoji icons for navigation**
- Used emoji icons (🎙️ 📊 📝 🦜 ⚙️) instead of icon library
- Rationale: Simple, no dependencies, works cross-platform, appropriate for minimal design
- Alternative considered: SVG icons or icon library (deferred for Phase 2 if needed)

**2. CSS custom properties for theming**
- Used CSS variables with @media (prefers-color-scheme: dark) for theme support
- Rationale: Native macOS system theme detection, no JavaScript required, instant theme switching
- Variables: --color-primary, --color-background, --color-surface, etc.

**3. Warm orange brand color (#d97757)**
- Selected warm, friendly orange as primary color based on podcast aesthetic
- Dark mode variant: #e89a7a (slightly lighter)
- Rationale: Friendly, warm, matches podcast brand without being playful/comical
- Follows constraint: No gradients, minimal design

**4. TypeScript types for i18n keys**
- Created i18n.d.ts with CustomTypeOptions referencing translation.json type
- Rationale: Compile-time checking prevents typo bugs where raw keys show in UI
- Example: t('nav.episodes') is checked, t('nav.episodez') fails compilation

**5. Disabled navigation items pattern**
- Grayed-out with opacity 0.6, cursor: not-allowed, disabled attribute
- Tooltip shows German message: "Analytik (kommt bald)"
- Rationale: Clear visual feedback, sets user expectations, roadmap transparency

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all tasks executed smoothly. TypeScript compilation passed on first attempt with i18n types.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Ready for Phase 1 Plan 03 (RSS Parser):**
- ✅ UI foundation complete with sidebar navigation
- ✅ Episodes page ready to display fetched episodes
- ✅ Settings page ready to show database status
- ✅ i18n system ready for additional German strings
- ✅ Theme support working for light/dark modes

**Blockers:** None

**Notes:**
- Episodes page shows empty state (expected - RSS parser comes in Plan 03)
- Analytics, Topics, Bird pages show "coming soon" (Phases 3-5)
- All visible text is in German via useTranslation() hook
- No hardcoded English strings anywhere in UI
- App follows macOS system theme automatically

---
*Phase: 01-foundation-infrastructure*
*Completed: 2026-02-11*
