# Pitfalls Research

**Domain:** Podcast Management/Transcription Desktop App (Tauri + Whisper)
**Researched:** 2026-02-11
**Confidence:** HIGH

## Critical Pitfalls

### Pitfall 1: Blocking UI Thread with CPU-Intensive Transcription

**What goes wrong:**
Whisper transcription runs on the main thread, causing the entire UI to freeze for minutes or hours depending on audio length. Users can't interact with the app, can't cancel the operation, and the app appears crashed. On macOS, the system may show "Application Not Responding" warnings.

**Why it happens:**
Developers treat Tauri commands as "automatically async" when synchronous commands without the `async` keyword run on the main thread. The Rust/JavaScript bridge makes it easy to call heavy functions without realizing they're blocking. Whisper transcription (especially large models) is extremely CPU-intensive—10+ minutes for a 1-hour podcast on CPU.

**How to avoid:**
- **Always use async commands:** Mark all Whisper-related commands with `async` keyword so they execute on `async_runtime::spawn`
- **Implement progress channels:** Use Tauri's channel mechanism to stream progress updates (0-100%) back to the frontend
- **Use tokio::spawn for blocking work:** Wrap synchronous Whisper calls in `tokio::task::spawn_blocking` to prevent async runtime blocking
- **Add cancellation tokens:** Implement cancellation via Arc<AtomicBool> shared between frontend and backend

**Warning signs:**
- App becomes unresponsive during transcription tests
- macOS Activity Monitor shows app as "Not Responding"
- UI updates (progress bars, buttons) stop working
- Users report having to force-quit the app

**Phase to address:**
Phase 1 (Core Transcription Engine). Must be architected correctly from the start—refactoring later means rewriting the entire transcription system.

---

### Pitfall 2: Memory Explosion from Large Whisper Models

**What goes wrong:**
App crashes with out-of-memory errors or causes system-wide slowdown. Memory usage climbs to 8GB+ on medium/large models, swapping to disk and degrading overall system performance. On user machines with 8GB RAM, this makes the entire system unusable.

**Why it happens:**
Whisper models have steep memory requirements: tiny (~1GB), base (~1GB), small (~2GB), medium (~5GB), large (~10GB). Developers test with small models but ship medium/large for better accuracy. Memory requirements compound when processing multiple files or keeping models loaded in memory between transcriptions.

**How to avoid:**
- **Start with whisper.cpp instead of Python Whisper:** C++ implementation with quantization support reduces memory by 50-75%
- **Implement model quantization:** Use int8 quantization for 4x memory reduction with minimal accuracy loss
- **Unload models after use:** Don't keep models in memory—load on demand, unload after transcription
- **Provide model selection UI:** Let users choose model size based on their hardware (auto-detect RAM and recommend model)
- **Use faster-whisper:** 4x faster than openai/whisper with lower memory usage via CTranslate2

**Warning signs:**
- Memory usage >2GB for tiny/small models (should be ~1GB)
- System swap usage increases during transcription
- App crashes after processing 2-3 files in succession
- macOS shows "Your system has run out of application memory"

**Phase to address:**
Phase 1 (Core Transcription Engine) for architecture decisions. Phase 2 (Performance Optimization) for quantization implementation.

---

### Pitfall 3: Ignoring Tauri Message Queue Limits

**What goes wrong:**
Rapid user interactions (clicking transcribe button multiple times, switching files quickly) cause "PostMessage failed; is the messages queue full?" errors and app crashes. The Rust backend becomes unreachable, requiring app restart.

**Why it happens:**
Tauri's IPC (inter-process communication) between frontend and Rust backend uses a message queue with finite capacity. Rapid consecutive calls—especially for heavy operations like transcription—overwhelm the queue before previous messages are processed. This is particularly problematic if backend commands are slow to return.

**How to avoid:**
- **Debounce UI interactions:** Add 300ms debounce on transcription/analysis buttons
- **Disable buttons during processing:** Visually disable buttons and show loading state to prevent double-clicks
- **Implement request queuing in frontend:** Queue multiple requests and send them sequentially, not in parallel
- **Use event listeners instead of polling:** Don't poll backend state via repeated invoke calls—use Tauri events for backend-to-frontend updates
- **Throttle progress updates:** Send progress updates max every 500ms, not on every 1% increment

**Warning signs:**
- Console errors: "PostMessage failed; is the messages queue full?"
- App crashes when clicking buttons rapidly during testing
- Backend commands stop responding after burst of interactions
- Users report "the app freezes when I click too fast"

**Phase to address:**
Phase 1 (Core Transcription Engine) for backend architecture. Phase 2 (UI/UX Polish) for frontend debouncing and state management.

---

### Pitfall 4: Auto-Updater Loses Private Key

**What goes wrong:**
You lose the Tauri signing private key. All existing users are permanently unable to receive updates. You must release a new app with a different name, forcing users to manually uninstall and reinstall. Complete loss of update distribution channel.

**Why it happens:**
The signing key is generated once during initial setup and stored locally. Developers commit it to .gitignore, store it only on local machine, or lose it during machine migration. Unlike password reset, there is NO recovery mechanism—the key is cryptographically tied to the app signature.

**How to avoid:**
- **Store in 1Password/BitWarden immediately:** Add to secure vault the moment you generate it
- **Backup to encrypted cloud storage:** Keep encrypted backup in Google Drive/Dropbox
- **Document key location in team wiki:** Ensure all team members know where to find it
- **Never use .env files:** Tauri explicitly states ".env files do NOT work"—use actual environment variables
- **Test key recovery process:** Quarterly, attempt to retrieve key from backup to verify it works
- **Consider key management service:** For production, use AWS Secrets Manager or similar

**Warning signs:**
- You can't find TAURI_SIGNING_PRIVATE_KEY in your password manager
- Only one developer can create releases (key is on their machine only)
- No documented backup location for the key
- `.env` file contains the key (it won't work in production)

**Phase to address:**
Phase 0 (Project Setup). This must be addressed BEFORE first release. Once you ship without proper key management, recovery is impossible.

---

### Pitfall 5: SQLite Database Growth Without Vacuuming

**What goes wrong:**
Transcripts are large text (10,000-50,000 characters per podcast). Database file grows to 500MB+ after 100 podcasts, never shrinks even when transcripts are deleted. App startup slows from 100ms to 2-3 seconds. File-based backups become impractical.

**Why it happens:**
SQLite marks deleted rows as free space but doesn't reclaim it automatically. Large TEXT fields in transcripts fragment the database. Multiple edits to transcripts create page fragmentation. Default SQLite settings don't optimize for large text storage.

**How to avoid:**
- **Implement VACUUM on schedule:** Run `VACUUM` monthly or when free space >20% of file size
- **Enable auto_vacuum mode:** Set `PRAGMA auto_vacuum = INCREMENTAL` at database creation
- **Separate hot/cold storage:** Store recent transcripts in SQLite, archive old ones to separate files
- **Index carefully:** Don't index large TEXT columns—index only metadata (date, podcast ID, speaker)
- **Use WITHOUT ROWID for lookup tables:** Reduces overhead for metadata tables
- **Implement compression:** Compress transcript text before storage, decompress on read

**Warning signs:**
- Database file size >100MB for <50 podcasts
- `sqlite3 dbfile "PRAGMA freelist_count"` returns >10% of total pages
- App startup time increases as database grows
- Backup file size is suspiciously large for amount of data

**Phase to address:**
Phase 1 (Core Transcription Engine) for schema design. Phase 3 (Data Management) for vacuum automation and archival.

---

### Pitfall 6: Speaker Diarization False Confidence

**What goes wrong:**
Speaker diarization labels speakers incorrectly but displays results with 100% confidence. Users trust the labels, publish transcripts with wrong speaker attribution. Two similar voices get merged into one speaker, or crosstalk creates phantom third speaker. Error rates hit 50%+ on real-world podcasts with overlapping speech.

**Why it happens:**
Diarization models (pyannote, AssemblyAI) return discrete labels without uncertainty scores. Developers display "Speaker 1", "Speaker 2" as fact, not hypothesis. Real-world podcasts have overlapping speech, similar voice characteristics, background noise—all causing misattribution. Academic benchmarks (DER 11-19%) don't reflect real-world performance.

**How to avoid:**
- **Force speaker count:** Use `num_speakers=2` parameter when count is known—significantly improves accuracy
- **Display confidence warnings:** Show "Speakers auto-detected—verify accuracy" banner on first use
- **Provide speaker editing UI:** Let users manually merge/split/relabel speakers before finalizing
- **Highlight low-confidence segments:** Use pyannote's segmentation confidence scores to flag uncertain regions
- **Test on real podcasts, not clean audio:** Benchmark on YouTube/Spotify podcasts with crosstalk, not academic datasets
- **Consider manual review phase:** For non-technical users, show "Speaker detection may need correction" workflow

**Warning signs:**
- DER (Diarization Error Rate) >20% on test podcasts
- Users report "the speakers are mixed up"
- Crosstalk segments show phantom third speaker
- Very similar voices (two men, two women) get merged
- Demo works perfectly but real podcasts fail

**Phase to address:**
Phase 2 (Speaker Diarization) for core implementation. Phase 4 (UI/UX Polish) for confidence visualization and editing interface.

---

### Pitfall 7: German Language Model Selection

**What goes wrong:**
Transcription accuracy for German podcasts is poor (WER 20-30%) despite using Whisper's "multilingual" model. Users complain about misspelled words, incorrect grammar, dialect confusion. Developer assumes "multilingual support" means equal accuracy across languages—it doesn't.

**Why it happens:**
Whisper models have language-specific performance gaps. German is "medium-resource" (WER 8-15% on academic benchmarks) vs. English "high-resource" (WER 3-5%). Real-world German audio with dialects performs worse (WER 15-30%). Generic multilingual models optimize for English and major languages, not German specifically.

**How to avoid:**
- **Use German-specific fine-tuned models:** Look for `whisper-large-v2-german` or similar on Hugging Face
- **Test on Bavarian/Austrian/Swiss German:** If target users have dialect variation, benchmark on those accents
- **Provide language selection UI:** Let users explicitly choose "German" instead of auto-detect
- **Set language parameter explicitly:** `language="de"` in Whisper config, don't rely on auto-detection
- **Accept higher WER for German:** Document that German accuracy will be lower than English (manage expectations)
- **Consider hybrid approach:** Use Whisper for initial transcription, German spell-checker for post-processing

**Warning signs:**
- WER >15% on standard German audio
- Common German words consistently misspelled
- Swiss German or Austrian accents perform terribly (WER >40%)
- Users manually correct >25% of transcript words
- Testing only done on hochdeutsch (standard German), not dialects

**Phase to address:**
Phase 1 (Core Transcription Engine) for model selection. Phase 5 (Localization) for dialect support and model fine-tuning.

---

### Pitfall 8: macOS Permissions Not Requested at Right Time

**What goes wrong:**
App launches successfully, user imports podcast audio file, transcription fails silently or shows "Permission denied" error. No permission prompt appears. User checks System Settings, sees app has no file access. Requires manual navigation to Settings > Privacy to grant access—most users give up.

**Why it happens:**
macOS requires explicit entitlements in Info.plist AND runtime permission requests. Tauri v2 changed permission model—old tutorials don't work. Reading podcast files needs file access scope configured. Developers test on development machines with "Full Disk Access" enabled for development, missing that users won't have this.

**How to avoid:**
- **Add entitlements EARLY:** Include file access scope in `tauri.conf.json` capabilities before first release
- **Request permission on first use:** Show native permission dialog when user first imports a file, not at app launch
- **Graceful fallback:** If permission denied, show clear instructions with screenshot of System Settings path
- **Test on fresh macOS install:** Use a clean VM or test machine without development permissions
- **Document required permissions:** Include README section explaining why file access is needed
- **Use file picker dialog:** macOS grants temporary access to files selected via NSOpenPanel—use Tauri dialog plugin

**Warning signs:**
- File operations work on your machine but fail for beta testers
- macOS Console shows "Operation not permitted" errors
- Users report "nothing happens when I import a file"
- No permission dialog appears during testing
- App works perfectly in development, fails in signed release build

**Phase to address:**
Phase 0 (Project Setup) for entitlements configuration. Phase 1 (Core Transcription Engine) for runtime permission requests.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Using Python Whisper instead of whisper.cpp | Faster implementation (pip install) | 2-4x slower transcription, 2x memory usage, Python runtime dependency | Prototype/MVP only—switch before v1.0 |
| Storing full transcripts in SQLite without compression | Simple implementation | Database grows 5-10x larger than needed, slow backups | Never for production—implement compression from start |
| Synchronous Tauri commands for quick operations | No async complexity | UI freezes accumulate, feels sluggish on slower machines | Only for <50ms operations (metadata reads) |
| Auto-detecting speakers instead of forcing count | Works without user input | 30-50% error rate for 2-speaker podcasts vs. 10-15% with num_speakers=2 | Never if speaker count is always known |
| Skipping Tauri channel progress updates | Simpler backend code | Users think app is frozen during long transcriptions | Never for operations >10 seconds |
| Loading Whisper model once at startup | Faster subsequent transcriptions | 2-10GB RAM locked for entire session, slow startup | Only if users transcribe 5+ files per session |
| Using generic multilingual Whisper model | One model for all languages | 2-3x worse accuracy for German than German-specific model | Testing only—switch to language-specific for production |
| Disabling VACUUM to avoid IO spikes | No periodic slow operations | Database grows unbounded, 10x larger than needed | Never—schedule VACUUM during low-usage times |

---

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Whisper model loading | Loading model on every transcription | Load once, reuse across files in session, unload on idle timeout |
| Tauri IPC | Sending large payloads (full transcripts) through invoke | Use filesystem for >100KB data, send file path via IPC |
| SQLite connection | Opening new connection per query | Use connection pool (r2d2-sqlite), reuse connections |
| pyannote speaker diarization | Running without speaker count hint | Always use num_speakers=2 when known—improves accuracy 20-30% |
| Tauri updater | Storing signing key in .env file | Use real environment variable, backup to password manager |
| macOS file access | Reading files without permission request | Use Tauri dialog API for file selection—grants temporary access |
| Async Rust commands | Using &str parameters in async commands | Convert to String (owned type) to avoid lifetime issues |
| Progress updates | Emitting event on every 1% progress | Throttle to max 2 updates/second to avoid message queue overflow |

---

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Loading entire transcript into memory | Works fine for 5-minute podcasts | Use streaming/chunked processing | >30 minute podcasts (50,000+ chars) |
| No pagination on transcript list | Fast with 10 podcasts | Add virtual scrolling or pagination | >100 podcasts in database |
| Running VACUUM during user interaction | Imperceptible on 10MB database | Schedule VACUUM during idle time or background task | Database >100MB (2-5 second freeze) |
| Storing speaker timestamps in JSON string | Easy to implement | Use separate table with foreign key | >50 speaker transitions per podcast |
| Synchronous SQLite queries on UI thread | Fast for simple queries | Use async with tokio-rusqlite | Complex queries or full-text search |
| No caching of processed audio metadata | Recompute duration/waveform on load | Cache in database after first processing | >20 podcasts in library |
| Using large Whisper model by default | Best accuracy | Start with small model, let users upgrade | Users with <16GB RAM |
| Keeping all audio files in single directory | Simple file management | Use year/month subdirectory structure | >500 audio files (slow filesystem operations) |

---

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Storing private key in git repository | Key exposure allows malicious updates to users | Add to .gitignore, store in password manager, scan repo history for leaks |
| Auto-updating without user notification | Users surprised by changes, breaking workflows | Show "Update available" notification, require user consent |
| Loading untrusted Whisper models from URLs | Model files can contain malicious code | Only load models from verified sources (Hugging Face official), verify checksums |
| Displaying raw transcript without sanitization | XSS if transcript contains HTML/JavaScript | Sanitize before rendering in webview, use text content not innerHTML |
| No validation on imported audio files | Malicious audio files could exploit FFmpeg | Validate file format, size limits, use sandboxed audio processing |
| Exposing full filesystem paths in error messages | Leaks user directory structure | Show relative paths only, log full paths to file not UI |
| No rate limiting on transcription requests | User could queue 1000 files, exhaust CPU/disk | Limit to 3 concurrent transcriptions, queue the rest |

---

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No cancel button during transcription | Users forced to force-quit app if they import wrong file | Always provide cancel button, implement cancellation tokens |
| Transcription runs with no progress indicator | Users think app is frozen, force-quit | Show percentage, estimated time remaining, current processing stage |
| Speaker labels default to "Speaker 1", "Speaker 2" | Users publish transcripts with generic labels | Prompt for names on first detection, remember for next time |
| No error recovery for failed transcriptions | App crashes or hangs on corrupted audio | Catch errors, show clear message, let user retry with different settings |
| Hiding model selection from users | Users with 8GB RAM try to use large model, run out of memory | Show model selection UI, display memory requirements, auto-recommend based on system RAM |
| Auto-updating without restart warning | Update downloads, requires restart, user loses work | Warn "Update will restart app—save work first" |
| No indication which podcasts need transcription | Users forget which files are processed | Show status badge: "Transcribed", "Processing", "Not transcribed" |
| Transcript editing saves on every keystroke | Excessive SQLite writes, potential data corruption | Debounce saves to every 2-3 seconds, show "Saving..." indicator |
| No keyboard shortcuts for common actions | Power users forced to use mouse for everything | Add Cmd+T for transcribe, Cmd+E for export, Cmd+, for settings |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Transcription:** Works on demo audio — verify on 2-hour podcast, multi-speaker, background noise, German dialects
- [ ] **Speaker diarization:** Works on clean audio — verify on crosstalk, similar voices, phone call quality
- [ ] **Progress updates:** Shows percentage — verify updates continue during long transcriptions (>30 min)
- [ ] **Database:** Stores transcripts — verify VACUUM automation, compression, does NOT grow unbounded
- [ ] **Memory management:** Model loads — verify model UNLOADS after transcription, memory returns to baseline
- [ ] **Auto-updater:** Downloads update — verify signature validation, restart workflow, doesn't lose user data
- [ ] **File access:** Reads podcast files — verify works without "Full Disk Access" on fresh macOS install
- [ ] **Error handling:** Shows error message — verify app remains responsive, allows retry, logs for debugging
- [ ] **German support:** Transcribes German audio — verify on Bavarian/Austrian/Swiss dialects, not just hochdeutsch
- [ ] **Cancellation:** Cancel button exists — verify actually stops processing, frees memory, doesn't crash
- [ ] **UI responsiveness:** App doesn't freeze — verify during transcription, database vacuum, model loading

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Blocked UI thread | LOW | Add `async` keyword to command, wrap in `spawn_blocking`, deploy hotfix |
| Lost signing key | HIGH | Generate new key, release as new app, communicate to users, manual migration |
| Database too large | MEDIUM | Export transcripts to JSON, recreate database with compression, re-import |
| Memory leak from model | LOW | Add model unload after transcription, deploy update, users restart app |
| Diarization accuracy poor | MEDIUM | Add `num_speakers` parameter, retrain with user corrections, deploy update |
| Message queue overflow | LOW | Add debouncing to frontend, throttle progress updates, deploy hotfix |
| German accuracy low | MEDIUM | Switch to German-specific model, may require users to re-transcribe |
| macOS permissions broken | MEDIUM | Update entitlements, re-sign app, users re-download, grant permissions |
| Auto-updater broken | HIGH | Can't fix via update (broken updater), requires manual new download |
| SQLite corruption | HIGH | Restore from backup, implement auto-backup if not present |

---

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Blocking UI thread | Phase 1: Core Transcription | Test 2-hour podcast, UI remains responsive |
| Memory explosion | Phase 1: Core Transcription | Monitor memory during transcription, <2GB for small model |
| Message queue overflow | Phase 1: Core Transcription | Rapid-click all buttons, no crashes |
| Auto-updater key loss | Phase 0: Project Setup | Key stored in 1Password, documented in wiki |
| SQLite unbounded growth | Phase 3: Data Management | Database 50 podcasts <50MB, VACUUM runs automatically |
| Diarization false confidence | Phase 2: Speaker Diarization | DER <15% on test podcasts with num_speakers=2 |
| German model accuracy | Phase 1: Core Transcription | WER <12% on German podcast benchmarks |
| macOS permissions | Phase 0: Project Setup | Works on fresh macOS install without manual permission grants |
| No progress updates | Phase 1: Core Transcription | Progress updates every second during transcription |
| No cancellation | Phase 1: Core Transcription | Cancel button stops processing within 2 seconds |

---

## Sources

### Tauri Performance & Architecture
- [Tauri Calling Rust from Frontend](https://v2.tauri.app/develop/calling-rust/)
- [Tauri UI Thread Blocking Issue #10893](https://github.com/tauri-apps/tauri/issues/10893)
- [Tauri Background Process Discussion #14117](https://github.com/tauri-apps/tauri/issues/14117)
- [Tauri Async Process Guide](https://rfdonnelly.github.io/posts/tauri-async-rust-process/)
- [Medium: Tauri + Rust Performance Issues](https://medium.com/@srish5945/tauri-rust-speed-but-heres-where-it-breaks-under-pressure-fef3e8e2dcb3)

### Whisper Performance & Memory
- [Faster Whisper GitHub](https://github.com/SYSTRAN/faster-whisper)
- [Whisper Memory Requirements Discussion](https://github.com/openai/whisper/discussions/5)
- [Whisper.cpp Performance](https://github.com/ggml-org/whisper.cpp)
- [Whisper.cpp 1.8.3 12x Performance Boost](https://www.phoronix.com/news/Whisper-cpp-1.8.3-12x-Perf)
- [Modal: Choosing Whisper Variants](https://modal.com/blog/choosing-whisper-variants)

### Speaker Diarization
- [AssemblyAI: What is Speaker Diarization](https://www.assemblyai.com/blog/what-is-speaker-diarization-and-how-does-it-work)
- [Pyannote Speaker Diarization 3.1](https://huggingface.co/pyannote/speaker-diarization-3.1)
- [Pyannote Precision-2 Announcement](https://www.pyannote.ai/blog/precision-2)
- [Speaker Diarization Accuracy Problems](https://www.fastpix.io/blog/speaker-diarization-libraries-apis-for-developers)

### SQLite Optimization
- [SQLite Performance Tuning](https://phiresky.github.io/blog/2020/sqlite-performance-tuning/)
- [SQLite Optimizations for High Performance](https://www.powersync.com/blog/sqlite-optimizations-for-ultra-high-performance)
- [Android SQLite Best Practices](https://developer.android.com/topic/performance/sqlite-performance-best-practices)

### Tauri macOS Permissions
- [Tauri Permissions Documentation](https://v2.tauri.app/security/permissions/)
- [Tauri macOS Permissions Plugin](https://github.com/ayangweb/tauri-plugin-macos-permissions)
- [Tauri macOS Microphone Permission Issue #11951](https://github.com/tauri-apps/tauri/issues/11951)

### Tauri Auto-Updater
- [Tauri Updater Plugin](https://v2.tauri.app/plugin/updater/)
- [Tauri Updater Cross-Device Link Issue #7169](https://github.com/tauri-apps/tauri/issues/7169)
- [How to Make Automatic Updates Work](https://thatgurjot.com/til/tauri-auto-updater/)

### German Language Support
- [WhisperX vs Competitors Benchmark 2026](https://brasstranscripts.com/blog/whisperx-vs-competitors-accuracy-benchmark)
- [Deepgram: Benchmarking Whisper for Non-English](https://deepgram.com/learn/benchmarking-openai-whisper-for-non-english-asr)
- [Whisper Large V2 German Model](https://huggingface.co/bofenghuang/whisper-large-v2-cv11-german)

### Podcast Transcription Domain
- [Transistor: Best AI Podcast Tools](https://transistor.fm/best-ai-podcast-tools/)
- [Best 7 AI Transcription Apps for Podcasts](https://www.whispertranscribe.com/blog/best-7-best-ai-transcription-apps-for-podcasts-2025)
- [How to Transcribe a Podcast Workflow](https://ticnote.com/en/blog/transcribe-a-podcast)

### Desktop App Best Practices
- [Microsoft: Windows Application Best Practices](https://learn.microsoft.com/en-us/windows/apps/get-started/best-practices)
- [Desktop App Development Guide 2026](https://www.jhavtech.com.au/desktop-app-development-guide-2026/)
- [Michael's Coding Spot: Desktop App Development Decisions](https://michaelscodingspot.com/9-must-decisions-in-desktop-application-development-for-windows/)

---
*Pitfalls research for: Podcast Management/Transcription Desktop App*
*Researched: 2026-02-11*
