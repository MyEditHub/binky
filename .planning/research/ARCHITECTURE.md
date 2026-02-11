# Architecture Research

**Domain:** Podcast management desktop app (Tauri v2 + Rust + Web frontend)
**Researched:** 2026-02-11
**Confidence:** HIGH

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER (Web)                      │
│  Frontend UI (HTML/CSS/JS) in Platform WebView                  │
├─────────────────────────────────────────────────────────────────┤
│                    IPC BOUNDARY (Tauri)                          │
│  Commands (invoke) │ Events (emit/listen) │ Channels (stream)   │
├─────────────────────────────────────────────────────────────────┤
│                    CORE PROCESS (Rust)                           │
│  ┌────────────┐  ┌──────────────┐  ┌─────────────────────┐     │
│  │ Tauri      │  │ Background   │  │ CPU-Intensive       │     │
│  │ Commands   │  │ Services     │  │ Workers             │     │
│  └─────┬──────┘  └──────┬───────┘  └──────┬──────────────┘     │
│        │                │                  │                    │
│        └────────────────┴──────────────────┘                    │
│                         │                                       │
│  ┌──────────────────────┴───────────────────────────────┐      │
│  │              BUSINESS LOGIC LAYER                     │      │
│  │  ┌──────────┐ ┌────────────┐ ┌──────────────────┐    │      │
│  │  │ RSS      │ │ Download   │ │ Transcription    │    │      │
│  │  │ Manager  │ │ Manager    │ │ Manager          │    │      │
│  │  └──────────┘ └────────────┘ └──────────────────┘    │      │
│  └────────────────────────────────────────────────────────┘      │
│                         │                                       │
├─────────────────────────┴───────────────────────────────────────┤
│                    DATA LAYER                                    │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────────┐      │
│  │ SQLite DB   │  │ File Storage │  │ Managed State     │      │
│  │ (Episodes,  │  │ (Audio Files,│  │ (In-Memory Cache) │      │
│  │ Transcripts)│  │  Temp Files) │  │                   │      │
│  └─────────────┘  └──────────────┘  └───────────────────┘      │
└─────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| **Frontend UI** | User interface, visualization, user interactions | Web framework (React/Vue/Svelte) with Tauri API bindings |
| **Tauri Commands** | Sync/async request-response handlers | Rust functions with `#[tauri::command]` attribute |
| **Background Services** | Long-running RSS polling, scheduled tasks | Tokio async tasks spawned during app startup |
| **CPU Workers** | Transcription, diarization processing | `spawn_blocking` threads to avoid blocking async runtime |
| **RSS Manager** | Feed parsing, update scheduling, adaptive polling | RSS parser + adaptive interval tracking |
| **Download Manager** | Audio file downloads, queue management, progress | HTTP client with download queue and progress channels |
| **Transcription Manager** | Whisper model integration, queue processing | Whisper.cpp bindings + task queue |
| **SQLite Database** | Episodes, transcripts, metadata storage | rusqlite or sqlx with migrations |
| **File Storage** | Audio files, cached data, temporary files | OS filesystem through std::fs or tokio::fs |
| **Managed State** | Shared application state across commands | Tauri State<T> with Mutex for thread-safe mutation |

## Recommended Project Structure

```
src-tauri/
├── src/
│   ├── main.rs                 # App entry point, Tauri setup
│   ├── commands/               # Tauri command handlers
│   │   ├── mod.rs              # Command registry
│   │   ├── rss.rs              # RSS feed commands
│   │   ├── download.rs         # Download commands
│   │   ├── transcription.rs    # Transcription commands
│   │   └── playback.rs         # Audio playback commands
│   ├── services/               # Background services
│   │   ├── mod.rs
│   │   ├── rss_poller.rs       # Background RSS polling service
│   │   ├── download_queue.rs   # Download queue processor
│   │   └── transcription_queue.rs  # Transcription queue processor
│   ├── workers/                # CPU-intensive worker logic
│   │   ├── mod.rs
│   │   ├── whisper.rs          # Whisper transcription wrapper
│   │   └── diarization.rs      # Speaker diarization logic
│   ├── db/                     # Database layer
│   │   ├── mod.rs              # Database connection pool
│   │   ├── models.rs           # Data models (Episodes, Feeds, etc.)
│   │   ├── schema.rs           # SQL schema definitions
│   │   └── migrations/         # SQL migration files
│   ├── state/                  # Application state
│   │   ├── mod.rs
│   │   └── app_state.rs        # Shared application state
│   └── utils/                  # Utilities
│       ├── mod.rs
│       ├── audio.rs            # Audio file utilities
│       └── rss_parser.rs       # RSS parsing utilities
├── Cargo.toml
└── tauri.conf.json

frontend/
├── src/
│   ├── main.ts                 # Frontend entry point
│   ├── App.vue                 # Root component
│   ├── components/             # UI components
│   │   ├── FeedList.vue        # RSS feed list
│   │   ├── EpisodeList.vue     # Episode list
│   │   ├── TranscriptViewer.vue # Transcript display
│   │   └── AudioPlayer.vue     # Audio playback component
│   ├── stores/                 # Frontend state (Pinia/Zustand)
│   │   ├── feeds.ts            # Feed state
│   │   ├── episodes.ts         # Episode state
│   │   └── ui.ts               # UI state
│   ├── services/               # Frontend service layer
│   │   ├── api.ts              # Tauri invoke wrappers
│   │   └── events.ts           # Tauri event listeners
│   └── views/                  # Page views
│       ├── Home.vue
│       ├── Feeds.vue
│       └── Settings.vue
└── package.json
```

### Structure Rationale

- **commands/:** Each file exposes Tauri commands for a specific domain (RSS, downloads, etc.). Commands are registered in `mod.rs` and handle request-response IPC.
- **services/:** Long-running background tasks that start during app initialization and run independently. These use Tokio for async I/O operations and emit events to the frontend.
- **workers/:** CPU-intensive work isolated via `spawn_blocking` to prevent blocking the async runtime. Whisper transcription and audio processing happen here.
- **db/:** SQLite abstraction with models, schema, and migrations. Connection pool managed in Tauri state for sharing across commands.
- **state/:** Application-wide shared state using `Mutex` for thread-safe mutation. Accessed via Tauri's `State<T>` guard in commands.

## Architectural Patterns

### Pattern 1: Command Pattern (Request-Response IPC)

**What:** Rust functions exposed to the frontend via Tauri's `#[tauri::command]` attribute, called using `invoke()` from the frontend.

**When to use:** Synchronous or asynchronous request-response operations where the frontend needs data back from the backend.

**Trade-offs:**
- **Pros:** Type-safe, supports async/await, automatic JSON serialization, error handling via Result<T, E>
- **Cons:** Requires JSON-serializable types, not suitable for streaming large data

**Example:**
```rust
// Rust backend
#[tauri::command]
async fn fetch_episodes(feed_id: i64, state: State<'_, AppState>) -> Result<Vec<Episode>, String> {
    let db = state.db.lock().await;
    db.get_episodes_by_feed(feed_id)
        .map_err(|e| e.to_string())
}

// Frontend
import { invoke } from '@tauri-apps/api/core';

const episodes = await invoke('fetch_episodes', { feedId: 123 });
```

### Pattern 2: Event-Driven Communication (Fire-and-Forget)

**What:** Asynchronous one-way messages emitted from Rust backend to frontend (or vice versa) using Tauri's event system.

**When to use:** Broadcasting state changes, progress updates, notifications where no response is needed.

**Trade-offs:**
- **Pros:** Decoupled, asynchronous, supports multiple listeners, good for real-time updates
- **Cons:** Not type-safe, no return values, order not guaranteed

**Example:**
```rust
// Rust backend - emit event
use tauri::Emitter;

app.emit("download-progress", DownloadProgress {
    episode_id: 123,
    bytes_downloaded: 1024,
    total_bytes: 5120,
})?;

// Frontend - listen for event
import { listen } from '@tauri-apps/api/event';

await listen('download-progress', (event) => {
    console.log('Download progress:', event.payload);
});
```

### Pattern 3: Channel Pattern (Streaming Data)

**What:** Tauri's `Channel<T>` for streaming ordered data chunks from backend to frontend, used for large data transfers or progress reporting.

**When to use:** Download progress, transcription status updates, log streaming.

**Trade-offs:**
- **Pros:** Fast, ordered delivery, efficient for large datasets
- **Cons:** More complex API than events, one-way only

**Example:**
```rust
// Rust backend
use tauri::ipc::Channel;

#[tauri::command]
async fn transcribe_with_progress(
    episode_id: i64,
    progress: Channel<TranscriptionProgress>
) -> Result<Transcript, String> {
    for chunk in transcription_chunks {
        progress.send(TranscriptionProgress { percent: chunk.percent })?;
    }
    Ok(transcript)
}
```

### Pattern 4: Managed State (Shared Application State)

**What:** Application-wide state managed by Tauri's `State<T>` system, accessible across all commands via dependency injection.

**When to use:** Database connection pools, configuration, caches, shared counters/flags.

**Trade-offs:**
- **Pros:** Thread-safe (when wrapped in Mutex/RwLock), automatically managed by Tauri, accessible anywhere
- **Cons:** Requires locking for mutation (potential contention), must be Send + Sync

**Example:**
```rust
// Define state
struct AppState {
    db: Arc<Mutex<Database>>,
    config: Arc<RwLock<Config>>,
}

// Setup in main
fn main() {
    tauri::Builder::default()
        .manage(AppState {
            db: Arc::new(Mutex::new(Database::new())),
            config: Arc::new(RwLock::new(Config::load())),
        })
        .invoke_handler(tauri::generate_handler![my_command])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

// Access in commands
#[tauri::command]
async fn my_command(state: State<'_, AppState>) -> Result<String, String> {
    let db = state.db.lock().await;
    // Use db...
    Ok("success".to_string())
}
```

### Pattern 5: Background Service Pattern (Long-Running Tasks)

**What:** Tokio tasks spawned during app initialization that run continuously, performing background work like RSS polling.

**When to use:** Periodic polling, scheduled tasks, continuous monitoring.

**Trade-offs:**
- **Pros:** Isolated from UI, efficient async I/O, can emit events to frontend
- **Cons:** Requires careful lifecycle management, error handling complexity

**Example:**
```rust
// Background RSS poller service
async fn start_rss_poller(app: AppHandle) {
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(300)); // 5 minutes
        loop {
            interval.tick().await;

            // Fetch and update feeds
            if let Err(e) = poll_all_feeds(&app).await {
                eprintln!("RSS polling error: {}", e);
            }

            // Emit event to frontend
            app.emit("feeds-updated", ()).ok();
        }
    });
}

// Start in main
fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                start_rss_poller(handle).await;
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### Pattern 6: CPU Worker Pattern (Blocking Tasks)

**What:** Isolating CPU-intensive work using `spawn_blocking` to prevent blocking the async runtime.

**When to use:** Whisper transcription, audio processing, compression, cryptography.

**Trade-offs:**
- **Pros:** Doesn't block async runtime, maintains UI responsiveness
- **Cons:** Thread overhead, can't use borrowed data easily

**Example:**
```rust
#[tauri::command]
async fn transcribe_audio(audio_path: String) -> Result<Transcript, String> {
    // Run CPU-intensive transcription on blocking thread pool
    let transcript = tokio::task::spawn_blocking(move || {
        whisper::transcribe(&audio_path)
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())?;

    Ok(transcript)
}
```

## Data Flow

### Primary Data Flows

**1. RSS Feed Update Flow**
```
Background Service (RSS Poller)
    ↓ (every 5 min, adaptive)
Fetch RSS Feed (HTTP)
    ↓
Parse XML → Extract Episodes
    ↓
Check for New Episodes (compare with DB)
    ↓
Insert New Episodes → SQLite
    ↓
Emit Event → Frontend ("new-episodes")
    ↓
Frontend Updates UI
```

**2. Episode Download Flow**
```
User Action (Frontend: "Download Episode")
    ↓
Invoke Command → "download_episode"
    ↓
Add to Download Queue (Service)
    ↓
HTTP Download with Progress
    ↓ (stream chunks)
Write to File System + Emit Progress Events via Channel
    ↓
Update Episode Status → SQLite (downloaded = true)
    ↓
Emit Event → Frontend ("download-complete")
    ↓
Frontend Updates UI
```

**3. Transcription Flow**
```
User Action (Frontend: "Transcribe Episode")
    ↓
Invoke Command → "transcribe_episode"
    ↓
Add to Transcription Queue (Service)
    ↓
Load Audio File from File System
    ↓
spawn_blocking → Whisper Worker (CPU-intensive)
    ↓ (progress updates)
Send Progress via Channel → Frontend
    ↓
Whisper Returns Transcript
    ↓
Save Transcript → SQLite
    ↓
Emit Event → Frontend ("transcription-complete")
    ↓
Frontend Displays Transcript
```

**4. Analytics Display Flow**
```
User Action (Frontend: "View Analytics")
    ↓
Invoke Command → "get_analytics"
    ↓
Query SQLite (aggregations, counts, etc.)
    ↓
Return JSON Data → Frontend
    ↓
Frontend Renders Charts/Stats
```

### State Management Flow

**Backend State (Rust):**
- Database connection pool: `Arc<Mutex<Database>>` in Tauri State
- Configuration: `Arc<RwLock<Config>>` in Tauri State
- Active downloads: Shared queue in Service
- Transcription queue: Shared queue in Service

**Frontend State (Web):**
- Local component state: Framework-specific (React useState, Vue ref)
- Global UI state: State management library (Pinia/Zustand)
- Backend-synced state: Listen to events, update local store

**Synchronization:**
- Backend emits events when data changes
- Frontend listens to events, updates local state
- Frontend invokes commands to trigger backend actions

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-100 feeds | Single-threaded background poller, in-memory queue |
| 100-1000 feeds | Adaptive polling intervals, database-backed queue, concurrent downloads |
| 1000+ feeds | Distributed polling (unlikely for desktop app), prioritization algorithms |

### Scaling Priorities

**1. First bottleneck: Transcription CPU time**
- **Problem:** Whisper transcription can take minutes per episode
- **Solution:** Queue system with configurable concurrency (e.g., max 2 concurrent transcriptions), allow user to pause/resume, consider cloud transcription fallback

**2. Second bottleneck: Database write contention**
- **Problem:** Multiple concurrent operations (RSS updates, downloads, transcriptions) writing to SQLite
- **Solution:** Use SQLite's WAL mode for better concurrency, batch writes where possible, connection pooling

**3. Third bottleneck: RSS polling frequency**
- **Problem:** Polling hundreds of feeds every 5 minutes wastes resources
- **Solution:** Adaptive polling based on feed update patterns (some feeds update hourly, others daily), exponential backoff for inactive feeds

## Anti-Patterns

### Anti-Pattern 1: Blocking the Async Runtime

**What people do:** Run CPU-intensive work (Whisper transcription) directly in async functions without `spawn_blocking`.

**Why it's wrong:** Blocks the Tokio runtime thread pool, freezing all async I/O operations, causing UI freezes and unresponsive app.

**Do this instead:** Always use `tokio::task::spawn_blocking` for CPU-bound work:
```rust
// WRONG
#[tauri::command]
async fn transcribe(path: String) -> Result<Transcript, String> {
    whisper::transcribe(&path) // Blocks async runtime!
}

// CORRECT
#[tauri::command]
async fn transcribe(path: String) -> Result<Transcript, String> {
    tokio::task::spawn_blocking(move || {
        whisper::transcribe(&path)
    })
    .await
    .map_err(|e| e.to_string())?
}
```

### Anti-Pattern 2: Shared Mutable State Without Locking

**What people do:** Share mutable state across commands without `Mutex` or `RwLock`, assuming Tauri handles it.

**Why it's wrong:** Causes data races, undefined behavior, and potential crashes.

**Do this instead:** Always wrap mutable state in `Mutex` or `RwLock`:
```rust
// WRONG
struct AppState {
    counter: i32, // Not thread-safe!
}

// CORRECT
struct AppState {
    counter: Arc<Mutex<i32>>, // Thread-safe
}
```

### Anti-Pattern 3: Polling Instead of Events

**What people do:** Frontend polls backend every second via `invoke` to check for updates.

**Why it's wrong:** Wastes resources (CPU, battery), increases latency, creates unnecessary IPC overhead.

**Do this instead:** Use Tauri events to push updates from backend to frontend:
```rust
// WRONG (Frontend)
setInterval(async () => {
    const status = await invoke('get_download_status');
    // Update UI
}, 1000);

// CORRECT (Backend emits events)
app.emit("download-progress", progress)?;

// CORRECT (Frontend listens)
listen('download-progress', (event) => {
    // Update UI
});
```

### Anti-Pattern 4: Storing Large Blobs in SQLite

**What people do:** Store entire audio files or large binary data in SQLite BLOBs.

**Why it's wrong:** Bloats database file, slows queries, wastes memory, complicates backups.

**Do this instead:** Store files on filesystem, store file paths in database:
```sql
-- WRONG
CREATE TABLE episodes (
    id INTEGER PRIMARY KEY,
    audio_data BLOB -- Entire audio file!
);

-- CORRECT
CREATE TABLE episodes (
    id INTEGER PRIMARY KEY,
    audio_file_path TEXT -- Just the path
);
```

### Anti-Pattern 5: Not Handling Command Errors

**What people do:** Panic or unwrap errors in commands, causing the entire Rust backend to crash.

**Why it's wrong:** Crashes the app, terrible user experience, no error recovery.

**Do this instead:** Return `Result<T, String>` and handle errors gracefully:
```rust
// WRONG
#[tauri::command]
fn get_episode(id: i64, state: State<AppState>) -> Episode {
    state.db.lock().unwrap().get_episode(id).unwrap() // Crash!
}

// CORRECT
#[tauri::command]
fn get_episode(id: i64, state: State<AppState>) -> Result<Episode, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_episode(id).map_err(|e| e.to_string())
}
```

### Anti-Pattern 6: Synchronous File I/O in Async Context

**What people do:** Use `std::fs` for file operations in async commands.

**Why it's wrong:** Blocks the async runtime thread, same problem as CPU-intensive work.

**Do this instead:** Use `tokio::fs` for async file I/O:
```rust
// WRONG
#[tauri::command]
async fn read_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(path).map_err(|e| e.to_string()) // Blocks!
}

// CORRECT
#[tauri::command]
async fn read_file(path: String) -> Result<String, String> {
    tokio::fs::read_to_string(path).await.map_err(|e| e.to_string())
}
```

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| RSS Feeds | HTTP GET with reqwest, parse with feed-rs | Handle HTTP errors, timeouts, malformed XML |
| Whisper (Local) | FFI bindings to whisper.cpp or Rust binding crate | CPU-intensive, use spawn_blocking |
| File System | tokio::fs for async, std::fs in spawn_blocking | macOS sandboxing may require permissions |
| SQLite | rusqlite or sqlx with connection pool | Use WAL mode for better concurrency |
| Audio Playback | rodio or soloud crate | Cross-platform audio playback |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Frontend ↔ Backend | Commands (invoke), Events (emit/listen), Channels | Use commands for request-response, events for notifications |
| Commands ↔ Services | Shared State (Tauri State), direct function calls | Commands can trigger service actions via shared state |
| Services ↔ Workers | Channels (tokio::sync::mpsc), spawn_blocking | Services delegate CPU work to workers |
| Backend ↔ Database | Connection pool in State, query methods | Serialize access with Mutex, use WAL mode |
| Backend ↔ File System | tokio::fs (async I/O), std::fs (blocking I/O) | Use tokio::fs in async, std::fs in spawn_blocking |

## Build Order Recommendations

Based on dependencies between components, recommended build order:

### Phase 1: Foundation
1. **Database layer** - Schema, migrations, models, query methods
2. **Managed State** - AppState with DB connection pool
3. **Basic commands** - Simple CRUD operations for feeds/episodes

**Why first:** Other components depend on database access and state management.

### Phase 2: Core Functionality
4. **RSS Manager** - Feed fetching, parsing, episode extraction
5. **Download Manager** - HTTP downloads with progress tracking
6. **File Storage** - Audio file management, path handling

**Why second:** Builds on database, enables core podcast management features.

### Phase 3: Background Processing
7. **Background RSS Poller** - Scheduled feed updates, adaptive polling
8. **Download Queue Service** - Concurrent download management

**Why third:** Requires core functionality to work, adds automation.

### Phase 4: Advanced Features
9. **Transcription Manager** - Whisper integration, queue processing
10. **Audio Playback** - Playback controls, player state management

**Why fourth:** Most complex, CPU-intensive, can be built incrementally.

### Phase 5: Polish
11. **Analytics** - Aggregations, visualizations
12. **Auto-updater** - App update infrastructure

**Why last:** Depends on all other components, less critical for MVP.

## Sources

**Tauri Architecture (HIGH confidence):**
- [Tauri Architecture | Tauri](https://v2.tauri.app/concept/architecture/)
- [Inter-Process Communication | Tauri](https://v2.tauri.app/concept/inter-process-communication/)
- [Calling Rust from the Frontend | Tauri](https://v2.tauri.app/develop/calling-rust/)
- [Process Model | Tauri](https://v2.tauri.app/concept/process-model/)
- [State Management | Tauri](https://v2.tauri.app/develop/state-management/)

**Podcast App Architecture (MEDIUM confidence):**
- [How to Build a Podcast App like Pocket Casts? | AppMaster](https://appmaster.io/blog/building-podcast-app)

**RSS Polling Patterns (MEDIUM confidence):**
- [Building an Intelligent Web Crawler: How I Optimized My RSS Reader App | by Nikolaj Johannes Skole Jensen | Medium](https://nikolajjsj.medium.com/building-an-intelligent-rss-feed-fetcher-how-i-optimized-my-rss-reader-app-1a21e040d6bf)

**Rust Async Patterns (HIGH confidence):**
- [Tokio Tutorial 2026: Building Async Applications in Rust | Complete Guide](https://reintech.io/blog/tokio-tutorial-2026-building-async-applications-rust)

**Whisper Architecture (MEDIUM confidence):**
- [Whisper desktop app for real time transcription and translation · openai/whisper · Discussion #834](https://github.com/openai/whisper/discussions/834)
- [GitHub - soderstromkr/whisper-local-transcribe](https://github.com/soderstromkr/whisper-local-transcribe)

**SQLite Patterns (HIGH confidence):**
- [Architecture of SQLite](https://sqlite.org/arch.html)
- [Appropriate Uses For SQLite](https://sqlite.org/whentouse.html)

**Audio Architecture (MEDIUM confidence):**
- [System design and site architecture for an audio streaming app like Spotify](https://www.fastpix.io/blog/system-design-and-site-architecture-for-an-audio-streaming-app-like-spotify)

---
*Architecture research for: Podcast management desktop app (Tauri + Rust)*
*Researched: 2026-02-11*
