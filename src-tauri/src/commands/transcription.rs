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
///
/// Streams packets directly through the resampler so that only the growing
/// output buffer (~230 MB for a 60-min episode) is kept in memory, rather
/// than first accumulating a full decoded buffer (~635 MB) and then a
/// resampled buffer simultaneously.
pub(crate) fn decode_mp3_to_pcm(path: &Path) -> Result<Vec<f32>, String> {
    use rubato::{FftFixedIn, Resampler};
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

    // If no resampling is needed, collect directly into output.
    if sample_rate == 16000 {
        let mut output: Vec<f32> = Vec::new();
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
            push_mono_frames(&decoded, track_channels, &mut output);
        }
        if output.is_empty() {
            return Err("No audio data decoded from MP3".to_string());
        }
        return Ok(output);
    }

    // Streaming resample path: feed each decoded packet directly through rubato
    // so the intermediate "all decoded samples" buffer is never materialised.
    const CHUNK_SIZE: usize = 4096;
    let mut resampler = FftFixedIn::<f32>::new(sample_rate as usize, 16000, CHUNK_SIZE, 2, 1)
        .map_err(|e| format!("Resampler creation error: {}", e))?;

    // `pending` holds decoded samples waiting to fill one resampler chunk (tiny).
    let mut pending: Vec<f32> = Vec::with_capacity(CHUNK_SIZE * 2);
    let mut resampled: Vec<f32> = Vec::new();

    // Flush `pending` through the resampler whenever it has a full chunk.
    let flush = |resampler: &mut FftFixedIn<f32>,
                 pending: &mut Vec<f32>,
                 resampled: &mut Vec<f32>,
                 force: bool|
     -> Result<(), String> {
        loop {
            let needed = resampler.input_frames_next();
            if pending.len() < needed {
                if !force {
                    break;
                }
                // Pad the last partial chunk with silence.
                pending.resize(needed, 0.0);
            }
            let chunk: Vec<f32> = pending.drain(..needed).collect();
            let out = resampler
                .process(&[&chunk], None)
                .map_err(|e| format!("Resample error: {}", e))?;
            resampled.extend_from_slice(&out[0]);
            if force && pending.is_empty() {
                break;
            }
        }
        Ok(())
    };

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
        push_mono_frames(&decoded, track_channels, &mut pending);
        flush(&mut resampler, &mut pending, &mut resampled, false)?;
    }

    // Flush any remaining samples with zero-padding.
    if !pending.is_empty() {
        flush(&mut resampler, &mut pending, &mut resampled, true)?;
    }

    if resampled.is_empty() {
        return Err("No audio data decoded from MP3".to_string());
    }

    Ok(resampled)
}

/// Extract mono f32 frames from a decoded AudioBufferRef and append to `out`.
pub(crate) fn push_mono_frames(
    decoded: &symphonia::core::audio::AudioBufferRef<'_>,
    track_channels: usize,
    out: &mut Vec<f32>,
) {
    use symphonia::core::audio::{AudioBufferRef, Signal};
    match decoded {
        AudioBufferRef::F32(buf) => {
            let n = buf.frames();
            for i in 0..n {
                let mut sum = 0.0f32;
                for ch in 0..track_channels {
                    sum += buf.chan(ch)[i];
                }
                out.push(sum / track_channels as f32);
            }
        }
        AudioBufferRef::S16(buf) => {
            let n = buf.frames();
            for i in 0..n {
                let mut sum = 0.0f32;
                for ch in 0..track_channels {
                    sum += buf.chan(ch)[i] as f32 / 32768.0;
                }
                out.push(sum / track_channels as f32);
            }
        }
        AudioBufferRef::S32(buf) => {
            let n = buf.frames();
            for i in 0..n {
                let mut sum = 0.0f32;
                for ch in 0..track_channels {
                    sum += buf.chan(ch)[i] as f32 / 2_147_483_648.0;
                }
                out.push(sum / track_channels as f32);
            }
        }
        _ => {}
    }
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

        // Process audio in 20-minute chunks so whisper.cpp never needs to allocate
        // the mel spectrogram for the full 60-min episode at once (~115 MB → ~38 MB/chunk).
        //
        // IMPORTANT: a fresh WhisperState is created for each chunk. whisper.cpp stores
        // raw callback pointers (abort/progress) from FullParams inside the state object.
        // Reusing the same state across calls causes those pointers to go stale (dangling)
        // after FullParams is dropped at the end of each loop iteration → SIGSEGV.
        const CHUNK_SAMPLES: usize = 20 * 60 * 16_000; // 20 min at 16 kHz
        let num_chunks = (audio_data.len() + CHUNK_SAMPLES - 1) / CHUNK_SAMPLES;

        let mut full_text = String::new();
        let mut segments_arr: Vec<serde_json::Value> = Vec::new();

        for chunk_idx in 0..num_chunks {
            // Allow clean cancellation between chunks without waiting for the
            // next full() call — the abort callback handles in-chunk cancellation.
            if cancel_token_for_whisper.is_cancelled() {
                break;
            }

            let start = chunk_idx * CHUNK_SAMPLES;
            let end = (start + CHUNK_SAMPLES).min(audio_data.len());
            let chunk = &audio_data[start..end];
            // Timestamp offset for this chunk in centiseconds (samples ÷ 160 at 16 kHz)
            let chunk_offset_cs = (start / 160) as i64;

            let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });
            params.set_language(Some(language_clone.as_str()));
            params.set_print_progress(false);
            params.set_print_realtime(false);
            params.set_print_special(false);
            params.set_print_timestamps(false);

            // No abort callback and no progress callback.
            //
            // whisper-rs 0.15 set_abort_callback_safe has a type-confusion bug:
            //   stored data:    *mut Box<Box<dyn FnMut() -> bool>>  (double-boxed fat ptr)
            //   trampoline casts as: *mut F  (original concrete closure type)
            // These differ in layout → UB → SIGSEGV / SIGABRT during transcription.
            //
            // Cancellation is handled between chunks via the token check above.
            // Progress is sent from Rust after each chunk completes (safe, no FFI).

            // Fresh state per chunk: ctx holds model weights (not re-read from disk),
            // state holds only the KV cache and runtime buffers — cheap to recreate.
            let mut whisper_state = ctx
                .create_state()
                .map_err(|e| format!("Failed to create Whisper state (chunk {}): {}", chunk_idx + 1, e))?;

            whisper_state
                .full(params, chunk)
                .map_err(|e| format!("Whisper failed (chunk {}/{}): {}", chunk_idx + 1, num_chunks, e))?;

            // Collect segments with timestamp offset so they align to the full episode
            for segment in whisper_state.as_iter() {
                let text = segment.to_string();
                let t0 = segment.start_timestamp() + chunk_offset_cs;
                let t1 = segment.end_timestamp() + chunk_offset_cs;
                full_text.push_str(&text);
                segments_arr.push(serde_json::json!({
                    "text": text,
                    "start_ms": t0 * 10,
                    "end_ms": t1 * 10
                }));
            }
            // whisper_state drops here — callbacks + buffers freed cleanly

            // Send progress from Rust (safe — no FFI boundary crossing).
            // Chunks: 50% → 67% → 83% → 100% for a 3-chunk episode.
            let progress_pct = 50 + ((chunk_idx + 1) * 50 / num_chunks) as i32;
            let _ = on_event_for_whisper.send(TranscriptionEvent::Progress { percent: progress_pct });
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

            // Chain diarization automatically when models are available
            if let Some(diarize_state) = app.try_state::<Arc<crate::state::diarization_queue::DiarizationState>>() {
                let diarize_arc = diarize_state.inner().clone();
                let audio_url_for_diarize = job.audio_url.clone();
                let episode_id_for_diarize = episode_id;
                let app_for_diarize = app.clone();
                tauri::async_runtime::spawn(async move {
                    crate::commands::diarization::enqueue_diarization_internal(
                        episode_id_for_diarize,
                        audio_url_for_diarize,
                        &app_for_diarize,
                        &diarize_arc,
                    )
                    .await;
                });
            }
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
