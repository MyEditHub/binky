# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-11)

**Core value:** Podcast hosts can see their speaking balance and track unfinished topics automatically through transcription and AI analysis
**Current focus:** Phase 5: Bird Randomizer & Polish — COMPLETE

## Current Position

Phase: 5 of 5 (Bird Randomizer & Polish) — Complete
Plan: 3 of 3 — 05-03 complete
Status: ALL PHASES COMPLETE — App feature-complete
Last activity: 2026-02-17 — Completed 05-03-PLAN.md (Bird randomizer frontend: useBirds hook, BirdPage, slide panel, episode linking, history)

Progress: [██████████████████████████] 100% (All 5 phases complete, 15 plans total)

## Performance Metrics

**Velocity:**
- Total plans completed: 12
- Average duration: ~4.6 min
- Total execution time: ~0.85 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation-infrastructure | 6 | ~30 min | ~5 min |
| 02-episode-management | 6 | ~25 min | ~4 min |

*Updated after each plan completion*

## Accumulated Context

### Decisions

- Tech stack: Tauri v2 (proven setup from Editor-Workshop with auto-updater, signing keys, CI/CD pipeline)
- Transcription: Local Whisper (free, works offline, good German support, no privacy concerns)
- Language: German UI throughout (podcast and users are German-speaking)
- Scope: 2024-2025 episodes only
- Distribution: PKG with auto-updater (GitHub Pages + Releases + Actions)
- Design: Minimal with brand colors (no gradients)

**From Plan 01-01 (2026-02-11):**
- Tauri v2 capabilities system: Using JSON capabilities files for plugin permissions (not v1 allowlist)
- Database migrations: SQL files in src-tauri/migrations/ loaded via include_str! macro
- macOS entitlements: Network + file access, NO microphone

**From Plan 01-02 (2026-02-11):**
- i18n TypeScript types: Compile-time checking prevents typo bugs
- Emoji icons: Simple navigation icons without icon library dependency

**Rebrand (2026-02-11):**
- App name: Binky (was Nettgeflüster)
- Bundle ID: de.binky.app
- Database: binky.db
- Warm orange brand color (#d97757)
- Disabled features: Grayed-out nav items with "kommt bald" tooltips

**From Plan 01-03 (2026-02-11):**
- Updater signing key: Generated without password for CI/CD (~/.tauri/binky.key)
- Sentry DSN: Optional via env var
- Plugin order: sentry → sql → updater → fs

**From Plan 01-04 (2026-02-11):**
- Signing: GPG-encrypted Tauri key (.github/signing.key.gpg) — no Apple Developer account needed
- GitHub Actions matrix: ARM + Intel, fail-fast: false
- Version management: bump-version.sh syncs package.json, tauri.conf.json, Cargo.toml

**From Plan 01-05 (2026-02-11):**
- Settings pattern: getSetting/setSetting via Database.load('sqlite:binky.db')
- Tutorial: modal overlay, 3 screens, markFirstLaunchComplete on finish
- Update banner: self-contained, polls checkForUpdates on mount
- Plugin opener: @tauri-apps/plugin-opener (Tauri v2) for external URLs

**From Plan 01-06 QA (2026-02-13):**
- German umlauts: All translation strings use proper Unicode (ü, ä, ö, ß)
- Collapsible sidebar: 200px expanded / 52px collapsed, ‹/› toggle in header
- Settings page: No website link; description uses correct German with umlauts

**From Plan 02-01 (2026-02-14):**
- whisper-rs 0.15 with metal feature: GPU-accelerated transcription (3-6x faster on Apple Silicon)
- tauri-plugin-http placed BEFORE sql plugin in Builder chain for correct entitlement scoping
- ALTER TABLE without IF NOT EXISTS: safe in migration system that guarantees single execution
- CancellationToken over JoinHandle::abort: whisper runs in spawn_blocking, abort() has no effect
- cmake required: whisper-rs-sys build requires cmake (installed via Homebrew)
- Module stubs: command stubs created now, implemented in dedicated plans (02-02, 02-04)

**From Plan 02-02 (2026-02-14):**
- sync_rss returns Vec<EpisodeMetadata> to frontend (not Rust-side SQL): consistent with plugin-sql JS pattern from Phase 1
- duration_minutes computed in Rust during RSS parse: avoids re-parsing duration strings in TypeScript
- INSERT OR IGNORE upsert on (title, publish_date): idempotent, no duplicate rows on repeated sync
- Background RSS sync on mount: load DB first (instant render), then network sync, then reload
- Episode list uses single expandedId state: collapse current on second click or new selection
- tauri_plugin_http::reqwest (not raw reqwest): required for macOS sandbox entitlement compliance

**From Plan 02-03 (2026-02-14):**
- tauri-plugin-http stream feature: bytes_stream() requires features = ["stream"] in Cargo.toml
- tauri::Manager import: app.path() requires explicit `use tauri::Manager` in Rust files
- Single model policy: delete existing ggml-*.bin before downloading new one
- Whisper model path convention: app_local_data_dir/models/ggml-{name}.bin
- Upsert for settings: INSERT ... ON CONFLICT(key) DO UPDATE SET value = excluded.value
- useModelManager hook pattern: encapsulates all Tauri invocations + state for model management

**From Plan 02-05 (2026-02-14):**
- Paragraph gap threshold 2000ms: natural podcast speech pause grouping from segments_json
- Full-page swap for transcript viewer (not modal): cleaner on small macOS window
- reloadKey pattern on EpisodeList: bump key to force reload after transcript deletion
- Delete guarded by get_queue_status: blocks if active_episode_id matches episode being deleted
- groupIntoParagraphs exported from useTranscript.ts: reusable in Phase 3/4

**From Plan 02-04 (2026-02-14):**
- Arc<TranscriptionState> managed in Tauri: allows `.inner().clone()` in async tasks without unsafe Send/Sync
- whisper-rs 0.15 iterator API: state.as_iter() → WhisperSegment with .to_string(), .start_timestamp(), .end_timestamp()
- rusqlite 0.32 (bundled) for Rust-side DB writes: avoids JS bridge for background queue operations
- Download progress 0-50 + whisper progress 50-100: unified bar for seamless visual progress
- Model status fetched in EpisodeList directly: avoids prop-drilling through Layout/SettingsPage
- Episode status progression: queued → downloading → transcribing → done/error/not_started (cancelled)
- Sequential queue: processing loop dequeues until empty, then sets is_processing=false

**From Plan 03-01 (2026-02-15):**
- sherpa-rs 0.6.8 features: "diarize" feature does not exist — use default features (download-binaries + tts); diarization is in the core crate
- DiarizationState mirrors TranscriptionState exactly: Arc<Mutex<DiarizationQueue>> pattern
- Diarization command prefix: get_diarization_, download_diarization_, cancel_diarization_, get_diarization_queue_status
- Diarization status progression: queued → processing → done/error/not_started (cancelled)

**From Plan 03-02 (2026-02-16):**
- Segmentation model URL: tar.bz2 only (no standalone .onnx) — extract with tar --strip-components=1 -C segmentation/
- Embedding model filename: wespeaker_en_voxceleb_resnet34_LM.onnx (underscores, includes _en_voxceleb_)
- tokio "process" feature: required for tokio::process::Command (tar extraction)
- Model paths: app_local_data_dir/models/diarization/segmentation/model.onnx and embedding/wespeaker_en_voxceleb_resnet34_LM.onnx
- Two-phase progress: segmentation 0–50%, embedding 50–100%

**From Plan 03-05 (2026-02-16):**
- recharts Tooltip formatter: type as `(value: number | string | undefined)` — recharts strict TS requires nullable value type
- HostSettingsSection as inline sub-component in SettingsPage: small self-contained section, avoids over-splitting
- btn-outline CSS class: established as reusable action button pattern across analytics components
- Segment load-more: paginate at 100 segments per render to avoid DOM bloat for long episodes
- Optimistic local state on segment click: update SegmentRow state immediately before DB confirm

**From Plan 03-04 (2026-02-16):**
- HostProfile storage: settings table key-value (host_0_name, host_1_name, host_0_color, host_1_color, hosts_confirmed) — avoids separate host_profiles table
- Auto-detect host names: German regex patterns (Hallo, Hey, danke, sag mal) + STOPWORD filter; auto-confirm if >=5 occurrences and >=50% match share
- Analytics page gate: hostProfile.confirmed=false shows HostConfirmation first; auto-confirmed silently on high confidence
- Auto-start diarization: fires on first analytics page visit via autoStartedRef (not on re-renders); batch queues all transcribed-but-not-diarized episodes
- Analytics components: src/components/Analytics/ directory; host_0/host_1 naming maps to SPEAKER_0/SPEAKER_1

**From Plan 03-03 (2026-02-16):**
- sherpa-rs 0.6.8 real diarize API: Diarize::new(seg, emb, DiarizeConfig) + compute(Vec<f32>, Option<ProgressCallback>) → Result<Vec<Segment>>
- Segment fields: start: f32, end: f32, speaker: i32 (index) — NOT embedded speaker labels; map to "SPEAKER_N" strings
- Seconds-to-ms: sherpa-rs returns f32 seconds, multiply by 1000.0 for milliseconds
- Option<Channel> pattern: process_diarization_episode takes Option<&Channel<DiarizationEvent>> for dual use (user cmd + internal chain)
- Solo detection: <=1 unique speaker OR minor speaker <5% of total speaking time → status='solo'
- Diarization chaining: fires after TranscriptionEvent::Done via fire-and-forget spawn; skips if models not downloaded
- decode_mp3_to_pcm and push_mono_frames are now pub(crate)

### Pending Todos

**CRITICAL - Before first release:**
- Back up private signing key at ~/.tauri/binky.key to 1Password/BitWarden
- Configure GitHub Secrets: GPG_PASSPHRASE and TAURI_PRIVATE_KEY_PASSWORD
- Configure Sentry DSN in production environment (optional)
- Document Gatekeeper bypass instructions for users

### Blockers/Concerns

**Before First Release:**
- URGENT: Private signing key at ~/.tauri/binky.key must be backed up before first release
- GitHub Secrets not configured yet
- Sentry DSN not configured yet

**Phase 2 — Resolved:**
- German transcription: working on real podcast audio (human QA 2026-02-15)
- Memory: streaming decode + 20-min chunks avoids 635MB peak (committed 2026-02-15)
- macOS sandbox: works in dev; production build verification still pending

**From Plan 04-01 (2026-02-17):**
- async-openai 0.32 default features: "reqwest" is not an explicit feature (uses dep: syntax) — use default features which include reqwest transport
- episode_analysis table: separate from topics table — tracks per-episode analysis status (not_started/processing/done/error)
- topics AI columns: ai_detected, detected_from_episode_id, ai_reason, confidence — all nullable for existing manual topics
- openai_api_key: stored in settings table (key-value), never returned to frontend from has_openai_key_configured

**From Plan 04-02 (2026-02-17):**
- async-openai 0.32 requires explicit feature flag: `features = ["chat-completion"]` — default `rustls` feature only adds transport, not the API client or types
- async-openai 0.32 chat types path: `async_openai::types::chat::*` (NOT re-exported at `async_openai::types::*`)
- analyze_episode_topics: reads API key from settings, reads transcript, calls GPT-4o-mini with German prompt, parses JSON, writes topics with ai_detected=1, updates episode_analysis
- Re-analysis safety: DELETE FROM topics WHERE detected_from_episode_id=? AND ai_detected=1 before INSERT

**From Plan 05-03 (2026-02-17):**
- CSS variables: existing codebase uses --color-* prefix (--color-background, --color-border, etc.) NOT --bg-primary/--border-color aliases
- drawBird force param: pass force=true after user confirmation to bypass unconfirmed guard (avoids window.location.reload)
- dompurify@3.3.1 includes TypeScript types natively — no @types/dompurify needed

**From Plan 05-02 (2026-02-17):**
- fetch_profile_from_nabu: standalone async fn (not method), shared by draw_random_bird and fetch_bird_profile
- rusqlite connection split pattern: open conn, sync DB work, drop conn before .await, open new conn after HTTP fetch
- NABU scraping dedup: SELECT COUNT(*) WHERE nabu_url=? check before INSERT (birds table has no UNIQUE constraint)
- scraper selectors: h2 for scientific name (trim_matches '_'), img[src*='/downloads/vogelportraets/'] for image, article>main>body for content HTML
- fetch_bird_profile offline fallback: returns cached_content_html from DB if live HTTP fetch fails
- draw_random_bird pool_exhausted: QueryReturnedNoRows from ORDER BY RANDOM() LIMIT 1 maps to "pool_exhausted" error string

**From Plan 05-01 (2026-02-17):**
- Migration 005 uses ALTER TABLE ADD COLUMN only (birds table exists from 001, do NOT CREATE TABLE)
- idx_birds_used index already exists from migration 001 — not recreated in 005
- scraper 0.25: CSS selector-based HTML parsing crate for NABU bird profile scraping
- 8 stub bird commands follow same pattern as topics.rs (tauri::AppHandle, Result<T, String>)
- bird_used_history table: links bird use events to optional episode_title strings (not episode_id FK — episodes may not exist for manual use)

## Session Continuity

Last session: 2026-02-17T06:32:04Z
Stopped at: Completed 05-03-PLAN.md (Bird randomizer frontend: useBirds hook, BirdPage, slide panel, episode linking, history)
Resume file: None
Next: All phases complete — ready for pre-release checklist (signing key backup, GitHub Secrets, Gatekeeper docs)
