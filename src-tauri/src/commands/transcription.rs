use crate::models::transcript::{ModelDownloadEvent, TranscriptionEvent};
use crate::state::transcription_queue::{TranscriptionJob, TranscriptionState};
use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::sync::Arc;
use tauri::ipc::Channel;
use tauri::Manager;
use tauri_plugin_http::reqwest;
use tokio::io::AsyncWriteExt;
use tokio_util::sync::CancellationToken;
use whisper_rs::{FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters};

const HUGGINGFACE_BASE_URL: &str =
    "https://huggingface.co/ggerganov/whisper.cpp/resolve/main";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelStatus {
    pub downloaded_model: Option<String>,
    pub model_size_bytes: Option<u64>,
    pub models_dir: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct QueueStatus {
    pub active_episode_id: Option<i64>,
    pub queue_length: usize,
    pub is_processing: bool,
}

// ─────────────────────────────────────────────────────────────────────────────
// Model management commands (from Plan 02-03)
// ─────────────────────────────────────────────────────────────────────────────

/// Returns the currently downloaded Whisper model (if any) from the app local data directory.
#[tauri::command]
pub async fn get_model_status(app: tauri::AppHandle) -> Result<ModelStatus, String> {
    let models_dir = app
        .path()
        .app_local_data_dir()
        .map_err(|e| format!("Cannot resolve app local data dir: {}", e))?
        .join("models");

    let models_dir_str = models_dir.to_string_lossy().to_string();

    if !models_dir.exists() {
        return Ok(ModelStatus {
            downloaded_model: None,
            model_size_bytes: None,
            models_dir: models_dir_str,
        });
    }

    let mut read_dir = tokio::fs::read_dir(&models_dir)
        .await
        .map_err(|e| format!("Failed to read models dir: {}", e))?;

    while let Some(entry) = read_dir
        .next_entry()
        .await
        .map_err(|e| format!("Failed to read directory entry: {}", e))?
    {
        let file_name = entry.file_name();
        let name = file_name.to_string_lossy();

        if name.starts_with("ggml-") && name.ends_with(".bin") {
            let model_name = name
                .trim_start_matches("ggml-")
                .trim_end_matches(".bin")
                .to_string();

            let metadata = entry
                .metadata()
                .await
                .map_err(|e| format!("Failed to read file metadata: {}", e))?;
            let size_bytes = metadata.len();

            return Ok(ModelStatus {
                downloaded_model: Some(model_name),
                model_size_bytes: Some(size_bytes),
                models_dir: models_dir_str,
            });
        }
    }

    Ok(ModelStatus {
        downloaded_model: None,
        model_size_bytes: None,
        models_dir: models_dir_str,
    })
}

/// Downloads a Whisper model from Hugging Face with streaming progress updates via Channel.
#[tauri::command]
pub async fn download_whisper_model(
    model_name: String,
    app: tauri::AppHandle,
    on_event: Channel<ModelDownloadEvent>,
) -> Result<(), String> {
    let models_dir = app
        .path()
        .app_local_data_dir()
        .map_err(|e| format!("Cannot resolve app local data dir: {}", e))?
        .join("models");

    tokio::fs::create_dir_all(&models_dir)
        .await
        .map_err(|e| format!("Failed to create models directory: {}", e))?;

    // Delete any existing model file before downloading
    let mut read_dir = tokio::fs::read_dir(&models_dir)
        .await
        .map_err(|e| format!("Failed to read models dir: {}", e))?;

    while let Some(entry) = read_dir
        .next_entry()
        .await
        .map_err(|e| format!("Failed to read directory entry: {}", e))?
    {
        let file_name = entry.file_name();
        let name = file_name.to_string_lossy();
        if name.starts_with("ggml-") && name.ends_with(".bin") {
            tokio::fs::remove_file(entry.path())
                .await
                .map_err(|e| format!("Failed to delete existing model: {}", e))?;
        }
    }

    let dest_path = models_dir.join(format!("ggml-{}.bin", model_name));
    let url = format!("{}/ggml-{}.bin", HUGGINGFACE_BASE_URL, model_name);

    let response = reqwest::get(&url).await.map_err(|e| {
        let msg = format!("HTTP request failed: {}", e);
        let _ = on_event.send(ModelDownloadEvent::Error { message: msg.clone() });
        msg
    })?;

    if !response.status().is_success() {
        let msg = format!("Server returned status: {}", response.status());
        let _ = on_event.send(ModelDownloadEvent::Error { message: msg.clone() });
        return Err(msg);
    }

    let total = response.content_length().unwrap_or(0);
    let mut stream = response.bytes_stream();
    let mut downloaded: u64 = 0;

    let mut file = match tokio::fs::File::create(&dest_path).await {
        Ok(f) => f,
        Err(e) => {
            let msg = format!("Failed to create destination file: {}", e);
            let _ = on_event.send(ModelDownloadEvent::Error { message: msg.clone() });
            return Err(msg);
        }
    };

    while let Some(chunk_result) = stream.next().await {
        let chunk = match chunk_result {
            Ok(c) => c,
            Err(e) => {
                let msg = format!("Download stream error: {}", e);
                let _ = on_event.send(ModelDownloadEvent::Error { message: msg.clone() });
                let _ = tokio::fs::remove_file(&dest_path).await;
                return Err(msg);
            }
        };

        if let Err(e) = file.write_all(&chunk).await {
            let msg = format!("Failed to write chunk: {}", e);
            let _ = on_event.send(ModelDownloadEvent::Error { message: msg.clone() });
            let _ = tokio::fs::remove_file(&dest_path).await;
            return Err(msg);
        }

        downloaded += chunk.len() as u64;
        let percent = if total > 0 {
            (downloaded * 100 / total) as i32
        } else {
            0
        };

        let _ = on_event.send(ModelDownloadEvent::Progress {
            percent,
            bytes: downloaded,
        });
    }

    if let Err(e) = file.flush().await {
        let msg = format!("Failed to flush file: {}", e);
        let _ = on_event.send(ModelDownloadEvent::Error { message: msg.clone() });
        let _ = tokio::fs::remove_file(&dest_path).await;
        return Err(msg);
    }

    let _ = on_event.send(ModelDownloadEvent::Done {
        model_name: model_name.clone(),
    });

    Ok(())
}

/// Deletes any downloaded Whisper model file from the models directory.
#[tauri::command]
pub async fn delete_whisper_model(app: tauri::AppHandle) -> Result<(), String> {
    let models_dir = app
        .path()
        .app_local_data_dir()
        .map_err(|e| format!("Cannot resolve app local data dir: {}", e))?
        .join("models");

    if !models_dir.exists() {
        return Ok(());
    }

    let mut read_dir = tokio::fs::read_dir(&models_dir)
        .await
        .map_err(|e| format!("Failed to read models dir: {}", e))?;

    while let Some(entry) = read_dir
        .next_entry()
        .await
        .map_err(|e| format!("Failed to read directory entry: {}", e))?
    {
        let file_name = entry.file_name();
        let name = file_name.to_string_lossy();
        if name.starts_with("ggml-") && name.ends_with(".bin") {
            tokio::fs::remove_file(entry.path())
                .await
                .map_err(|e| format!("Failed to delete model file: {}", e))?;
        }
    }

    Ok(())
}

// ─────────────────────────────────────────────────────────────────────────────
// Transcription engine (Plan 02-04)
// ─────────────────────────────────────────────────────────────────────────────

/// Find the first ggml-*.bin model file in the models directory.
/// Returns (model_name, full_path) if found.
async fn find_model(app: &tauri::AppHandle) -> Option<(String, std::path::PathBuf)> {
    let models_dir = app
        .path()
        .app_local_data_dir()
        .ok()?
        .join("models");

    let mut read_dir = tokio::fs::read_dir(&models_dir).await.ok()?;

    while let Ok(Some(entry)) = read_dir.next_entry().await {
        let file_name = entry.file_name();
        let name = file_name.to_string_lossy().to_string();
        if name.starts_with("ggml-") && name.ends_with(".bin") {
            let model_name = name
                .trim_start_matches("ggml-")
                .trim_end_matches(".bin")
                .to_string();
            return Some((model_name, entry.path()));
        }
    }

    None
}

/// Read the whisper_language setting from the SQLite database. Returns "de" by default.
fn read_language_setting(db_path: &Path) -> String {
    match rusqlite::Connection::open(db_path) {
        Ok(conn) => {
            let result: rusqlite::Result<String> = conn.query_row(
                "SELECT value FROM settings WHERE key = 'whisper_language' LIMIT 1",
                [],
                |row| row.get(0),
            );
            result.unwrap_or_else(|_| "de".to_string())
        }
        Err(_) => "de".to_string(),
    }
}

/// Update episode transcription_status in SQLite.
fn update_episode_status(db_path: &Path, episode_id: i64, status: &str, error_msg: Option<&str>) {
    if let Ok(conn) = rusqlite::Connection::open(db_path) {
        if let Some(msg) = error_msg {
            let _ = conn.execute(
                "UPDATE episodes SET transcription_status = ?1, transcription_error = ?2, \
                 updated_at = datetime('now') WHERE id = ?3",
                rusqlite::params![status, msg, episode_id],
            );
        } else {
            let _ = conn.execute(
                "UPDATE episodes SET transcription_status = ?1, transcription_error = NULL, \
                 updated_at = datetime('now') WHERE id = ?2",
                rusqlite::params![status, episode_id],
            );
        }
    }
}

/// Store a completed transcript in the transcripts table.
fn store_transcript(
    db_path: &Path,
    episode_id: i64,
    full_text: &str,
    segments_json: &str,
    model_name: &str,
    language: &str,
) {
    if let Ok(conn) = rusqlite::Connection::open(db_path) {
        let _ = conn.execute(
            "INSERT OR REPLACE INTO transcripts \
             (episode_id, full_text, segments_json, whisper_model, language, created_at) \
             VALUES (?1, ?2, ?3, ?4, ?5, datetime('now'))",
            rusqlite::params![episode_id, full_text, segments_json, model_name, language],
        );
    }
}

/// Decode an MP3 file to mono f32 PCM at 16 kHz using symphonia + rubato.
fn decode_mp3_to_pcm(path: &Path) -> Result<Vec<f32>, String> {
    use symphonia::core::audio::{AudioBufferRef, Signal};
    use symphonia::core::codecs::{DecoderOptions, CODEC_TYPE_NULL};
    use symphonia::core::formats::FormatOptions;
    use symphonia::core::io::MediaSourceStream;
    use symphonia::core::meta::MetadataOptions;
    use symphonia::core::probe::Hint;
    use symphonia::default::{get_codecs, get_probe};

    let file = std::fs::File::open(path).map_err(|e| format!("Cannot open audio file: {}", e))?;
    let mss = MediaSourceStream::new(Box::new(file), Default::default());

    let mut hint = Hint::new();
    hint.with_extension("mp3");

    let probed = get_probe()
        .format(
            &hint,
            mss,
            &FormatOptions::default(),
            &MetadataOptions::default(),
        )
        .map_err(|e| format!("Probe error: {}", e))?;

    let mut format = probed.format;

    let track = format
        .tracks()
        .iter()
        .find(|t| t.codec_params.codec != CODEC_TYPE_NULL)
        .ok_or_else(|| "No audio track found".to_string())?;

    let sample_rate = track.codec_params.sample_rate.unwrap_or(44100);
    let track_id = track.id;
    let track_channels = track
        .codec_params
        .channels
        .map(|c| c.count())
        .unwrap_or(1);

    let mut decoder = get_codecs()
        .make(&track.codec_params, &DecoderOptions::default())
        .map_err(|e| format!("Decoder error: {}", e))?;

    let mut mono_samples: Vec<f32> = Vec::new();

    loop {
        let packet = match format.next_packet() {
            Ok(p) => p,
            Err(_) => break,
        };
        if packet.track_id() != track_id {
            continue;
        }

        let decoded = match decoder.decode(&packet) {
            Ok(d) => d,
            Err(_) => continue,
        };

        match &decoded {
            AudioBufferRef::F32(buf) => {
                let n = buf.frames();
                for i in 0..n {
                    let mut sum = 0.0f32;
                    for ch in 0..track_channels {
                        sum += buf.chan(ch)[i];
                    }
                    mono_samples.push(sum / track_channels as f32);
                }
            }
            AudioBufferRef::S16(buf) => {
                let n = buf.frames();
                for i in 0..n {
                    let mut sum = 0.0f32;
                    for ch in 0..track_channels {
                        sum += buf.chan(ch)[i] as f32 / 32768.0;
                    }
                    mono_samples.push(sum / track_channels as f32);
                }
            }
            AudioBufferRef::S32(buf) => {
                let n = buf.frames();
                for i in 0..n {
                    let mut sum = 0.0f32;
                    for ch in 0..track_channels {
                        sum += buf.chan(ch)[i] as f32 / 2_147_483_648.0;
                    }
                    mono_samples.push(sum / track_channels as f32);
                }
            }
            _ => continue,
        }
    }

    if mono_samples.is_empty() {
        return Err("No audio data decoded from MP3".to_string());
    }

    // Resample to 16 kHz if needed
    if sample_rate != 16000 {
        use rubato::{FftFixedIn, Resampler};
        let chunk_size = 1024usize;
        let mut resampler =
            FftFixedIn::<f32>::new(sample_rate as usize, 16000, chunk_size, 2, 1)
                .map_err(|e| format!("Resampler creation error: {}", e))?;

        let mut resampled: Vec<f32> = Vec::new();
        let mut pos = 0usize;

        loop {
            let frames_next = resampler.input_frames_next();
            if pos >= mono_samples.len() {
                break;
            }
            let end = (pos + frames_next).min(mono_samples.len());
            let mut chunk = mono_samples[pos..end].to_vec();

            // Pad with zeros if last chunk is short
            if chunk.len() < frames_next {
                chunk.resize(frames_next, 0.0);
            }

            let out = resampler
                .process(&[&chunk], None)
                .map_err(|e| format!("Resample error: {}", e))?;
            resampled.extend_from_slice(&out[0]);
            pos += frames_next;
        }

        return Ok(resampled);
    }

    Ok(mono_samples)
}

/// Process a single transcription job: download audio, decode PCM, run Whisper, store result.
async fn process_episode(
    job: &TranscriptionJob,
    app: &tauri::AppHandle,
    state: &Arc<TranscriptionState>,
    on_event: &Channel<TranscriptionEvent>,
    model_path: &std::path::PathBuf,
    model_name: &str,
    db_path: &std::path::PathBuf,
) {
    let episode_id = job.episode_id;

    // Update status to 'downloading'
    update_episode_status(db_path, episode_id, "downloading", None);

    // Create cancellation token and register it in the queue
    let cancel_token = CancellationToken::new();
    {
        let mut q = state.queue.lock().unwrap();
        q.active_token = Some(cancel_token.clone());
        q.active_episode_id = Some(episode_id);
    }

    // Resolve cache directory for temp audio file
    let cache_dir = match app.path().app_cache_dir() {
        Ok(d) => d,
        Err(e) => {
            let msg = format!("Cannot resolve cache dir: {}", e);
            update_episode_status(db_path, episode_id, "error", Some(&msg));
            let _ = on_event.send(TranscriptionEvent::Error { message: msg });
            return;
        }
    };

    if let Err(e) = tokio::fs::create_dir_all(&cache_dir).await {
        let msg = format!("Cannot create cache dir: {}", e);
        update_episode_status(db_path, episode_id, "error", Some(&msg));
        let _ = on_event.send(TranscriptionEvent::Error { message: msg });
        return;
    }

    let temp_path = cache_dir.join(format!("episode_{}.mp3", episode_id));
    let temp_path_for_cleanup = temp_path.clone();

    // Download audio with streaming progress
    let response = match reqwest::get(&job.audio_url).await {
        Ok(r) => r,
        Err(e) => {
            let msg = format!("Audio download failed: {}", e);
            update_episode_status(db_path, episode_id, "error", Some(&msg));
            let _ = on_event.send(TranscriptionEvent::Error { message: msg });
            return;
        }
    };

    let total_bytes = response.content_length().unwrap_or(0);
    let mut stream = response.bytes_stream();
    let mut downloaded_bytes: u64 = 0;

    let mut file = match tokio::fs::File::create(&temp_path).await {
        Ok(f) => f,
        Err(e) => {
            let msg = format!("Cannot create temp audio file: {}", e);
            update_episode_status(db_path, episode_id, "error", Some(&msg));
            let _ = on_event.send(TranscriptionEvent::Error { message: msg });
            return;
        }
    };

    while let Some(chunk_result) = stream.next().await {
        // Check for cancellation between chunks
        if cancel_token.is_cancelled() {
            let _ = file.flush().await;
            drop(file);
            let _ = tokio::fs::remove_file(&temp_path_for_cleanup).await;
            update_episode_status(db_path, episode_id, "not_started", None);
            let _ = on_event.send(TranscriptionEvent::Cancelled);
            let mut q = state.queue.lock().unwrap();
            q.active_episode_id = None;
            q.active_token = None;
            return;
        }

        let chunk = match chunk_result {
            Ok(c) => c,
            Err(e) => {
                let _ = file.flush().await;
                drop(file);
                let _ = tokio::fs::remove_file(&temp_path_for_cleanup).await;
                let msg = format!("Download stream error: {}", e);
                update_episode_status(db_path, episode_id, "error", Some(&msg));
                let _ = on_event.send(TranscriptionEvent::Error { message: msg });
                return;
            }
        };

        if let Err(e) = file.write_all(&chunk).await {
            let _ = tokio::fs::remove_file(&temp_path_for_cleanup).await;
            let msg = format!("Failed to write audio chunk: {}", e);
            update_episode_status(db_path, episode_id, "error", Some(&msg));
            let _ = on_event.send(TranscriptionEvent::Error { message: msg });
            return;
        }

        downloaded_bytes += chunk.len() as u64;
        // Map download progress to 0-50 range
        let download_percent = if total_bytes > 0 {
            ((downloaded_bytes * 50) / total_bytes) as i32
        } else {
            25 // unknown total: show midpoint
        };
        let _ = on_event.send(TranscriptionEvent::Downloading {
            percent: download_percent,
        });
    }

    if let Err(e) = file.flush().await {
        let _ = tokio::fs::remove_file(&temp_path_for_cleanup).await;
        let msg = format!("Failed to flush audio file: {}", e);
        update_episode_status(db_path, episode_id, "error", Some(&msg));
        let _ = on_event.send(TranscriptionEvent::Error { message: msg });
        return;
    }
    drop(file);

    // Check cancellation after download
    if cancel_token.is_cancelled() {
        let _ = tokio::fs::remove_file(&temp_path_for_cleanup).await;
        update_episode_status(db_path, episode_id, "not_started", None);
        let _ = on_event.send(TranscriptionEvent::Cancelled);
        let mut q = state.queue.lock().unwrap();
        q.active_episode_id = None;
        q.active_token = None;
        return;
    }

    // Update status to 'transcribing'
    update_episode_status(db_path, episode_id, "transcribing", None);

    // Decode MP3 to mono f32 PCM at 16 kHz
    let audio_data = match decode_mp3_to_pcm(&temp_path) {
        Ok(data) => data,
        Err(e) => {
            let _ = tokio::fs::remove_file(&temp_path_for_cleanup).await;
            let msg = format!("Audio decode failed: {}", e);
            update_episode_status(db_path, episode_id, "error", Some(&msg));
            let _ = on_event.send(TranscriptionEvent::Error { message: msg });
            return;
        }
    };

    // Read language setting from DB
    let language = read_language_setting(db_path);

    // Run Whisper in spawn_blocking (MUST NOT run on the async runtime thread)
    let model_path_str = model_path.to_string_lossy().to_string();
    let model_name_owned = model_name.to_string();
    let language_clone = language.clone();
    let cancel_token_for_whisper = cancel_token.clone();
    let on_event_for_whisper = on_event.clone();

    let whisper_result = tauri::async_runtime::spawn_blocking(move || {
        let ctx =
            WhisperContext::new_with_params(&model_path_str, WhisperContextParameters::default())
                .map_err(|e| format!("Failed to load Whisper model: {}", e))?;

        let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });
        params.set_language(Some(language_clone.as_str()));
        params.set_print_progress(false);
        params.set_print_realtime(false);
        params.set_print_special(false);
        params.set_print_timestamps(false);

        // Abort callback: checked at each segment boundary by whisper-rs
        let cancel_for_abort = cancel_token_for_whisper.clone();
        params.set_abort_callback_safe(move || cancel_for_abort.is_cancelled());

        // Progress callback: maps whisper 0-100 to overall 50-100
        params.set_progress_callback_safe(move |progress| {
            let overall = 50 + progress / 2;
            let _ = on_event_for_whisper.send(TranscriptionEvent::Progress { percent: overall });
        });

        let mut whisper_state = ctx
            .create_state()
            .map_err(|e| format!("Failed to create Whisper state: {}", e))?;

        whisper_state
            .full(params, &audio_data)
            .map_err(|e| format!("Whisper transcription failed: {}", e))?;

        // Extract segments using the iterator API (whisper-rs 0.15)
        let mut full_text = String::new();
        let mut segments_arr: Vec<serde_json::Value> = Vec::new();

        for segment in whisper_state.as_iter() {
            let text = segment.to_string();
            // start/end timestamps are in centiseconds; convert to milliseconds (* 10)
            let t0 = segment.start_timestamp();
            let t1 = segment.end_timestamp();

            full_text.push_str(&text);
            segments_arr.push(serde_json::json!({
                "text": text,
                "start_ms": t0 * 10,
                "end_ms": t1 * 10
            }));
        }

        let segments_json = serde_json::to_string(&segments_arr).unwrap_or_default();
        Ok::<(String, String, String), String>((full_text, segments_json, model_name_owned))
    })
    .await;

    // Always delete temp audio file
    let _ = tokio::fs::remove_file(&temp_path_for_cleanup).await;

    // Check if cancelled (abort callback fired before/during whisper)
    if cancel_token.is_cancelled() {
        update_episode_status(db_path, episode_id, "not_started", None);
        let _ = on_event.send(TranscriptionEvent::Cancelled);
        let mut q = state.queue.lock().unwrap();
        q.active_episode_id = None;
        q.active_token = None;
        return;
    }

    match whisper_result {
        Ok(Ok((full_text, segments_json, used_model))) => {
            store_transcript(db_path, episode_id, &full_text, &segments_json, &used_model, &language);
            update_episode_status(db_path, episode_id, "done", None);
            let _ = on_event.send(TranscriptionEvent::Done { episode_id });
        }
        Ok(Err(e)) => {
            update_episode_status(db_path, episode_id, "error", Some(&e));
            let _ = on_event.send(TranscriptionEvent::Error { message: e });
        }
        Err(e) => {
            let msg = format!("Whisper task panicked: {}", e);
            update_episode_status(db_path, episode_id, "error", Some(&msg));
            let _ = on_event.send(TranscriptionEvent::Error { message: msg });
        }
    }

    // Clear active episode tracking
    let mut q = state.queue.lock().unwrap();
    q.active_episode_id = None;
    q.active_token = None;
}

/// Start transcribing an episode. Adds the job to the queue and starts the
/// processing loop if it is not already running.
#[tauri::command]
pub async fn start_transcription(
    episode_id: i64,
    audio_url: String,
    on_event: Channel<TranscriptionEvent>,
    app: tauri::AppHandle,
    state: tauri::State<'_, Arc<TranscriptionState>>,
) -> Result<(), String> {
    // Check that a model is downloaded
    let (model_name, model_path) = find_model(&app).await.ok_or_else(|| {
        "Kein Whisper-Modell heruntergeladen. Bitte zuerst ein Modell in den Einstellungen herunterladen.".to_string()
    })?;

    // Resolve the SQLite DB path (same file tauri-plugin-sql uses)
    let db_path = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Cannot resolve app data dir: {}", e))?
        .join("binky.db");

    // Enqueue the job; detect if we need to start the processing loop
    let already_processing = {
        let mut q = state.queue.lock().unwrap();
        q.enqueue(TranscriptionJob {
            episode_id,
            audio_url,
        });
        let was = q.is_processing;
        if !was {
            q.is_processing = true;
        }
        was
    };

    // Mark the episode as 'queued' immediately so the UI reflects it
    update_episode_status(&db_path, episode_id, "queued", None);

    if already_processing {
        // Loop already running — it will pick up the new job automatically
        return Ok(());
    }

    // Clone the Arc so the async task owns it independently
    let state_arc: Arc<TranscriptionState> = state.inner().clone();

    tauri::async_runtime::spawn(async move {
        loop {
            let job = {
                let mut q = state_arc.queue.lock().unwrap();
                q.dequeue()
            };

            match job {
                None => {
                    // Queue empty — stop processing
                    state_arc.queue.lock().unwrap().is_processing = false;
                    break;
                }
                Some(j) => {
                    process_episode(
                        &j,
                        &app,
                        &state_arc,
                        &on_event,
                        &model_path,
                        &model_name,
                        &db_path,
                    )
                    .await;
                }
            }
        }
    });

    Ok(())
}

/// Cancel the currently active transcription.
#[tauri::command]
pub async fn cancel_transcription(
    state: tauri::State<'_, Arc<TranscriptionState>>,
) -> Result<(), String> {
    state.queue.lock().unwrap().cancel_active();
    Ok(())
}

/// Return the current queue status.
#[tauri::command]
pub async fn get_queue_status(
    state: tauri::State<'_, Arc<TranscriptionState>>,
) -> Result<QueueStatus, String> {
    let q = state.queue.lock().unwrap();
    Ok(QueueStatus {
        active_episode_id: q.active_episode_id,
        queue_length: q.queue_len(),
        is_processing: q.is_processing,
    })
}
