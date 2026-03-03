use crate::models::diarization::{
    DiarizationEvent, DiarizationModelDownloadEvent, DiarizationModelStatus, DiarizationQueueStatus,
};
use crate::state::diarization_queue::{DiarizationJob, DiarizationState};
use futures_util::StreamExt;
use std::sync::Arc;
use tauri::ipc::Channel;
use tauri::Manager;
use tauri_plugin_http::reqwest;
use tokio::io::AsyncWriteExt;
use tokio_util::sync::CancellationToken;

// ─────────────────────────────────────────────────────────────────────────────
// Model URLs (verified 2026-02-16)
// Segmentation: tar.bz2 archive (no standalone .onnx available)
// Embedding: direct .onnx file
// ─────────────────────────────────────────────────────────────────────────────

const SEGMENTATION_URL: &str = "https://github.com/k2-fsa/sherpa-onnx/releases/download/speaker-segmentation-models/sherpa-onnx-pyannote-segmentation-3-0.tar.bz2";
const EMBEDDING_URL: &str = "https://github.com/k2-fsa/sherpa-onnx/releases/download/speaker-recongition-models/nemo_en_titanet_large.onnx";
const EMBEDDING_FILENAME: &str = "nemo_en_titanet_large.onnx";

// ─────────────────────────────────────────────────────────────────────────────
// Helper: download a URL with streaming progress, writing to a tmp file,
// then atomically rename to dest_path on success.
// Progress is mapped to [base_offset, base_offset + 50].
// ─────────────────────────────────────────────────────────────────────────────

async fn download_with_progress(
    url: &str,
    tmp_path: &std::path::Path,
    base_offset: i32,
    on_event: &Channel<DiarizationModelDownloadEvent>,
) -> Result<(), String> {
    let response = reqwest::get(url).await.map_err(|e| {
        let msg = format!("HTTP request failed: {}", e);
        let _ = on_event.send(DiarizationModelDownloadEvent::Error { message: msg.clone() });
        msg
    })?;

    if !response.status().is_success() {
        let msg = format!("Server returned status: {}", response.status());
        let _ = on_event.send(DiarizationModelDownloadEvent::Error { message: msg.clone() });
        return Err(msg);
    }

    let total = response.content_length().unwrap_or(0);
    let mut stream = response.bytes_stream();
    let mut downloaded: u64 = 0;

    let mut file = tokio::fs::File::create(tmp_path).await.map_err(|e| {
        let msg = format!("Failed to create temp file: {}", e);
        let _ = on_event.send(DiarizationModelDownloadEvent::Error { message: msg.clone() });
        msg
    })?;

    while let Some(chunk_result) = stream.next().await {
        let chunk = match chunk_result {
            Ok(c) => c,
            Err(e) => {
                let msg = format!("Download stream error: {}", e);
                let _ = on_event.send(DiarizationModelDownloadEvent::Error { message: msg.clone() });
                let _ = tokio::fs::remove_file(tmp_path).await;
                return Err(msg);
            }
        };

        if let Err(e) = file.write_all(&chunk).await {
            let msg = format!("Failed to write chunk: {}", e);
            let _ = on_event.send(DiarizationModelDownloadEvent::Error { message: msg.clone() });
            let _ = tokio::fs::remove_file(tmp_path).await;
            return Err(msg);
        }

        downloaded += chunk.len() as u64;
        let half_percent = if total > 0 {
            (downloaded * 50 / total) as i32
        } else {
            0
        };
        let overall_percent = base_offset + half_percent;
        let _ = on_event.send(DiarizationModelDownloadEvent::Progress {
            percent: overall_percent,
            bytes: downloaded,
        });
    }

    file.flush().await.map_err(|e| {
        let msg = format!("Failed to flush file: {}", e);
        let _ = on_event.send(DiarizationModelDownloadEvent::Error { message: msg.clone() });
        msg
    })?;

    Ok(())
}

// ─────────────────────────────────────────────────────────────────────────────
// Model management commands
// ─────────────────────────────────────────────────────────────────────────────

/// Check which diarization models are present in the app local data directory.
/// Segmentation model: models/diarization/segmentation/model.onnx (size > 0)
/// Embedding model: models/diarization/embedding/*.onnx (any .onnx file, size > 0)
#[tauri::command]
pub async fn get_diarization_model_status(
    app: tauri::AppHandle,
) -> Result<DiarizationModelStatus, String> {
    let models_dir = app
        .path()
        .app_local_data_dir()
        .map_err(|e| format!("Cannot resolve app local data dir: {}", e))?
        .join("models")
        .join("diarization");

    let models_dir_str = models_dir.to_string_lossy().to_string();

    // Check segmentation model
    let seg_model = models_dir.join("segmentation").join("model.onnx");
    let segmentation_downloaded = if seg_model.exists() {
        match tokio::fs::metadata(&seg_model).await {
            Ok(m) => m.len() > 0,
            Err(_) => false,
        }
    } else {
        false
    };

    // Check embedding model: the specific expected file must exist with size > 0
    let emb_path = models_dir.join("embedding").join(EMBEDDING_FILENAME);
    let embedding_downloaded = if emb_path.exists() {
        match tokio::fs::metadata(&emb_path).await {
            Ok(m) => m.len() > 0,
            Err(_) => false,
        }
    } else {
        false
    };

    Ok(DiarizationModelStatus {
        segmentation_downloaded,
        embedding_downloaded,
        models_dir: models_dir_str,
    })
}

/// Download both diarization models with streaming progress events.
/// Segmentation (progress 0–50%): downloaded as tar.bz2 and extracted.
/// Embedding (progress 50–100%): direct .onnx file.
#[tauri::command]
pub async fn download_diarization_models(
    app: tauri::AppHandle,
    on_event: Channel<DiarizationModelDownloadEvent>,
) -> Result<(), String> {
    let base_dir = app
        .path()
        .app_local_data_dir()
        .map_err(|e| format!("Cannot resolve app local data dir: {}", e))?
        .join("models")
        .join("diarization");

    // ── Segmentation model (0–50%) ─────────────────────────────────────────

    let seg_dir = base_dir.join("segmentation");
    tokio::fs::create_dir_all(&seg_dir)
        .await
        .map_err(|e| format!("Failed to create segmentation dir: {}", e))?;

    let seg_tmp = seg_dir.join("model.tar.bz2.tmp");

    download_with_progress(SEGMENTATION_URL, &seg_tmp, 0, &on_event).await?;

    // Extract the tar.bz2: strip top-level directory, extract model.onnx into seg_dir
    let seg_tmp_str = seg_tmp.to_string_lossy().to_string();
    let seg_dir_str = seg_dir.to_string_lossy().to_string();

    let extract_result = tokio::process::Command::new("tar")
        .args([
            "-xjf",
            &seg_tmp_str,
            "--strip-components=1",
            "-C",
            &seg_dir_str,
        ])
        .output()
        .await
        .map_err(|e| format!("Failed to run tar: {}", e))?;

    // Clean up tmp archive regardless of extraction outcome
    let _ = tokio::fs::remove_file(&seg_tmp).await;

    if !extract_result.status.success() {
        let stderr = String::from_utf8_lossy(&extract_result.stderr);
        let msg = format!("Tar extraction failed: {}", stderr);
        let _ = on_event.send(DiarizationModelDownloadEvent::Error { message: msg.clone() });
        return Err(msg);
    }

    // Verify extracted model.onnx exists
    let seg_model = seg_dir.join("model.onnx");
    if !seg_model.exists() {
        let msg = "Segmentation model.onnx not found after extraction".to_string();
        let _ = on_event.send(DiarizationModelDownloadEvent::Error { message: msg.clone() });
        return Err(msg);
    }

    // Send progress at 50% after extraction
    let _ = on_event.send(DiarizationModelDownloadEvent::Progress {
        percent: 50,
        bytes: 0,
    });

    // ── Embedding model (50–100%) ──────────────────────────────────────────

    let emb_dir = base_dir.join("embedding");
    tokio::fs::create_dir_all(&emb_dir)
        .await
        .map_err(|e| format!("Failed to create embedding dir: {}", e))?;

    let emb_tmp = emb_dir.join(format!("{}.tmp", EMBEDDING_FILENAME));
    let emb_dest = emb_dir.join(EMBEDDING_FILENAME);

    download_with_progress(EMBEDDING_URL, &emb_tmp, 50, &on_event).await?;

    tokio::fs::rename(&emb_tmp, &emb_dest)
        .await
        .map_err(|e| {
            let msg = format!("Failed to rename embedding model: {}", e);
            let _ = on_event.send(DiarizationModelDownloadEvent::Error { message: msg.clone() });
            msg
        })?;

    let _ = on_event.send(DiarizationModelDownloadEvent::Done);

    Ok(())
}

/// Delete all downloaded diarization models.
#[tauri::command]
pub async fn delete_diarization_models(app: tauri::AppHandle) -> Result<(), String> {
    let models_dir = app
        .path()
        .app_local_data_dir()
        .map_err(|e| format!("Cannot resolve app local data dir: {}", e))?
        .join("models")
        .join("diarization");

    if models_dir.exists() {
        tokio::fs::remove_dir_all(&models_dir)
            .await
            .map_err(|e| format!("Failed to delete diarization models: {}", e))?;
    }

    Ok(())
}

// ─────────────────────────────────────────────────────────────────────────────
// Diarization engine helpers
// ─────────────────────────────────────────────────────────────────────────────

/// Find the diarization model paths. Returns (segmentation_path, embedding_path).
async fn find_diarization_models(
    app: &tauri::AppHandle,
) -> Result<(std::path::PathBuf, std::path::PathBuf), String> {
    let models_dir = app
        .path()
        .app_local_data_dir()
        .map_err(|e| format!("Cannot resolve app local data dir: {}", e))?
        .join("models")
        .join("diarization");

    let seg_path = models_dir.join("segmentation").join("model.onnx");
    let emb_path = models_dir.join("embedding").join(EMBEDDING_FILENAME);

    if !seg_path.exists() {
        return Err("Segmentierungsmodell nicht heruntergeladen. Bitte zuerst die Diarisierungsmodelle in den Einstellungen herunterladen.".to_string());
    }
    if !emb_path.exists() {
        return Err("Erkennungsmodell nicht heruntergeladen. Bitte zuerst die Diarisierungsmodelle in den Einstellungen herunterladen.".to_string());
    }

    Ok((seg_path, emb_path))
}

/// Update diarization_status and diarization_error columns for an episode.
fn update_diarization_status(
    db_path: &std::path::Path,
    episode_id: i64,
    status: &str,
    error_msg: Option<&str>,
) {
    if let Ok(conn) = rusqlite::Connection::open(db_path) {
        if let Some(msg) = error_msg {
            let _ = conn.execute(
                "UPDATE episodes SET diarization_status = ?1, diarization_error = ?2, updated_at = datetime('now') WHERE id = ?3",
                rusqlite::params![status, msg, episode_id],
            );
        } else {
            let _ = conn.execute(
                "UPDATE episodes SET diarization_status = ?1, diarization_error = NULL, updated_at = datetime('now') WHERE id = ?2",
                rusqlite::params![status, episode_id],
            );
        }
    }
}

/// Run backfill_segment_text_from_whisper for every episode that has both a
/// Whisper transcript (segments_json IS NOT NULL) and diarization segments.
/// Runs unconditionally (not just for text IS NULL) so that episodes already
/// backfilled with the old buggy overlap logic are also corrected.
/// Called once at app startup. Idempotent — safe to re-run.
pub(crate) fn backfill_all_whisper_segment_text(db_path: &std::path::Path) {
    let conn = match rusqlite::Connection::open(db_path) {
        Ok(c) => c,
        Err(_) => return,
    };

    let episode_ids: Vec<i64> = {
        let mut stmt = match conn.prepare(
            "SELECT DISTINCT t.episode_id FROM transcripts t \
             JOIN diarization_segments ds ON ds.episode_id = t.episode_id \
             WHERE t.segments_json IS NOT NULL",
        ) {
            Ok(s) => s,
            Err(_) => return,
        };
        let collected: Vec<i64> = match stmt.query_map([], |row| row.get(0)) {
            Ok(rows) => rows.filter_map(|r| r.ok()).collect(),
            Err(_) => return,
        };
        collected
    };

    drop(conn);

    for episode_id in episode_ids {
        backfill_segment_text_from_whisper(db_path, episode_id);
    }
}

/// After storing diarization segments, populate the `text` column by joining
/// with Whisper's `transcripts.segments_json` on time overlap.
/// Silent no-op if no Whisper transcript exists (AssemblyAI path or not yet transcribed).
fn backfill_segment_text_from_whisper(db_path: &std::path::Path, episode_id: i64) {
    let conn = match rusqlite::Connection::open(db_path) {
        Ok(c) => c,
        Err(_) => return,
    };

    // Fetch Whisper segments JSON — NULL or missing if episode used AssemblyAI
    let segments_json: Option<String> = match conn.query_row(
        "SELECT segments_json FROM transcripts WHERE episode_id = ?1",
        rusqlite::params![episode_id],
        |row| row.get(0),
    ) {
        Ok(v) => v,
        Err(_) => return,
    };
    let segments_json = match segments_json {
        Some(j) => j,
        None => return,
    };

    // Parse [{text, start_ms, end_ms}, ...] from Whisper output
    let whisper_segs: Vec<(i64, i64, String)> =
        match serde_json::from_str::<serde_json::Value>(&segments_json) {
            Ok(serde_json::Value::Array(arr)) => arr
                .into_iter()
                .filter_map(|v| {
                    let start = v["start_ms"].as_i64()?;
                    let end = v["end_ms"].as_i64()?;
                    let text = v["text"].as_str()?.trim().to_string();
                    if text.is_empty() { None } else { Some((start, end, text)) }
                })
                .collect(),
            _ => return,
        };

    if whisper_segs.is_empty() {
        return;
    }

    // Fetch ALL diarization segments (regardless of text status) so we can
    // assign each Whisper segment to exactly one speaker window.
    let diar_segs: Vec<(i64, i64, i64)> = {
        let mut stmt = match conn.prepare(
            "SELECT id, start_ms, end_ms FROM diarization_segments \
             WHERE episode_id = ?1 ORDER BY start_ms",
        ) {
            Ok(s) => s,
            Err(_) => return,
        };
        // Collect before stmt drops — MappedRows borrows stmt and must be
        // fully consumed before the block ends.
        let collected: Vec<(i64, i64, i64)> = match stmt.query_map(
            rusqlite::params![episode_id],
            |row| Ok((row.get::<_, i64>(0)?, row.get::<_, i64>(1)?, row.get::<_, i64>(2)?)),
        ) {
            Ok(rows) => rows.filter_map(|r| r.ok()).collect(),
            Err(_) => return,
        };
        collected
    };

    if diar_segs.is_empty() {
        return;
    }

    // Clear existing text on all diarization segments for this episode so that
    // segments which receive no assignment (no overlapping Whisper segment) don't
    // retain stale text from a previous buggy backfill run.
    let _ = conn.execute(
        "UPDATE diarization_segments SET text = NULL WHERE episode_id = ?1",
        rusqlite::params![episode_id],
    );

    // Winner-takes-all assignment: each Whisper segment belongs to exactly one
    // diarization window — the one with the greatest millisecond overlap.
    // This prevents the same sentence from appearing under both speakers when a
    // Whisper segment straddles a speaker boundary.
    //
    // Build a map: diarization segment id → Vec<text>
    let mut text_map: std::collections::HashMap<i64, Vec<String>> = std::collections::HashMap::new();

    for (ws_start, ws_end, ws_text) in &whisper_segs {
        let ws_duration = ws_end - ws_start;
        if ws_duration <= 0 {
            continue;
        }

        // Find the diarization segment with the maximum PROPORTIONAL overlap.
        //
        // Proportional = overlap_ms / diarization_window_duration_ms
        //
        // Why proportional instead of absolute?
        // sherpa-rs produces large SPEAKER_0 windows (30-60s) that temporally
        // envelop many short SPEAKER_1 windows (300-1000ms).  A ~1.8s average
        // Whisper segment always has more absolute ms overlap with the big
        // SPEAKER_0 window than with the 1s SPEAKER_1 window it actually
        // fills — so absolute wins always go to SPEAKER_0, leaving all
        // SPEAKER_1 segments with NULL text.
        //
        // With proportional overlap a Whisper segment covering 99% of a 1s
        // SPEAKER_1 window scores 0.99 vs ~0.04 for the 48s SPEAKER_0 window,
        // correctly attributing it to SPEAKER_1.
        //
        // We store (overlap_numerator * 1_000_000 / ds_duration) as an i64
        // to avoid floating point while preserving ordering.
        let best = diar_segs.iter().filter_map(|(seg_id, ds_start, ds_end)| {
            let overlap_start = (*ws_start).max(*ds_start);
            let overlap_end = (*ws_end).min(*ds_end);
            let overlap = overlap_end - overlap_start;
            let ds_dur = ds_end - ds_start;
            if overlap > 0 && ds_dur > 0 {
                let prop_score = overlap * 1_000_000 / ds_dur;
                Some((prop_score, seg_id))
            } else {
                None
            }
        }).max_by_key(|(prop_score, _)| *prop_score);

        if let Some((_, seg_id)) = best {
            text_map.entry(*seg_id).or_default().push(ws_text.clone());
        }
    }

    // Write assigned texts back to each diarization segment
    for (seg_id, texts) in &text_map {
        let text = texts.join(" ");
        if !text.is_empty() {
            let _ = conn.execute(
                "UPDATE diarization_segments SET text = ?1 WHERE id = ?2",
                rusqlite::params![text, seg_id],
            );
        }
    }
}

/// Store diarization segments in SQLite atomically.
/// Deletes existing segments first (allows re-runs).
fn store_diarization_segments(
    db_path: &std::path::Path,
    episode_id: i64,
    segments: &[crate::models::diarization::DiarizationSegment],
) -> Result<(), String> {
    let conn = rusqlite::Connection::open(db_path)
        .map_err(|e| format!("Failed to open DB: {}", e))?;

    conn.execute("BEGIN", [])
        .map_err(|e| format!("Failed to begin tx: {}", e))?;

    conn.execute(
        "DELETE FROM diarization_segments WHERE episode_id = ?1",
        rusqlite::params![episode_id],
    )
    .map_err(|e| format!("Failed to delete existing segments: {}", e))?;

    for seg in segments {
        conn.execute(
            "INSERT INTO diarization_segments (episode_id, start_ms, end_ms, speaker_label, confidence) VALUES (?1, ?2, ?3, ?4, ?5)",
            rusqlite::params![episode_id, seg.start_ms, seg.end_ms, seg.speaker_label, seg.confidence],
        )
        .map_err(|e| format!("Failed to insert segment: {}", e))?;
    }

    conn.execute("COMMIT", [])
        .map_err(|e| format!("Failed to commit tx: {}", e))?;

    Ok(())
}

// ─────────────────────────────────────────────────────────────────────────────
// Core processing function
//
// Accepts Option<Channel<DiarizationEvent>> so both the user-facing command
// (Some(channel)) and the internal chained call (None) use the same code path.
// ─────────────────────────────────────────────────────────────────────────────

async fn process_diarization_episode(
    job: &DiarizationJob,
    app: &tauri::AppHandle,
    state: &Arc<DiarizationState>,
    on_event: Option<&Channel<DiarizationEvent>>,
    seg_path: &std::path::PathBuf,
    emb_path: &std::path::PathBuf,
    db_path: &std::path::PathBuf,
) {
    let episode_id = job.episode_id;

    // Update status to 'processing' and register cancellation token
    update_diarization_status(db_path, episode_id, "processing", None);

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
            update_diarization_status(db_path, episode_id, "error", Some(&msg));
            if let Some(ch) = on_event {
                let _ = ch.send(DiarizationEvent::Error { message: msg });
            }
            let mut q = state.queue.lock().unwrap();
            q.active_episode_id = None;
            q.active_token = None;
            return;
        }
    };

    if let Err(e) = tokio::fs::create_dir_all(&cache_dir).await {
        let msg = format!("Cannot create cache dir: {}", e);
        update_diarization_status(db_path, episode_id, "error", Some(&msg));
        if let Some(ch) = on_event {
            let _ = ch.send(DiarizationEvent::Error { message: msg });
        }
        let mut q = state.queue.lock().unwrap();
        q.active_episode_id = None;
        q.active_token = None;
        return;
    }

    let temp_path = cache_dir.join(format!("diarize_{}.mp3", episode_id));
    let temp_path_for_cleanup = temp_path.clone();

    // ── Download audio (progress 0–50%) ────────────────────────────────────

    let response = match reqwest::get(&job.audio_url).await {
        Ok(r) => r,
        Err(e) => {
            let msg = format!("Audio download failed: {}", e);
            update_diarization_status(db_path, episode_id, "error", Some(&msg));
            if let Some(ch) = on_event {
                let _ = ch.send(DiarizationEvent::Error { message: msg });
            }
            let mut q = state.queue.lock().unwrap();
            q.active_episode_id = None;
            q.active_token = None;
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
            update_diarization_status(db_path, episode_id, "error", Some(&msg));
            if let Some(ch) = on_event {
                let _ = ch.send(DiarizationEvent::Error { message: msg });
            }
            let mut q = state.queue.lock().unwrap();
            q.active_episode_id = None;
            q.active_token = None;
            return;
        }
    };

    while let Some(chunk_result) = stream.next().await {
        if cancel_token.is_cancelled() {
            let _ = file.flush().await;
            drop(file);
            let _ = tokio::fs::remove_file(&temp_path_for_cleanup).await;
            update_diarization_status(db_path, episode_id, "not_started", None);
            if let Some(ch) = on_event {
                let _ = ch.send(DiarizationEvent::Cancelled);
            }
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
                update_diarization_status(db_path, episode_id, "error", Some(&msg));
                if let Some(ch) = on_event {
                    let _ = ch.send(DiarizationEvent::Error { message: msg });
                }
                let mut q = state.queue.lock().unwrap();
                q.active_episode_id = None;
                q.active_token = None;
                return;
            }
        };

        if let Err(e) = file.write_all(&chunk).await {
            let _ = tokio::fs::remove_file(&temp_path_for_cleanup).await;
            let msg = format!("Failed to write audio chunk: {}", e);
            update_diarization_status(db_path, episode_id, "error", Some(&msg));
            if let Some(ch) = on_event {
                let _ = ch.send(DiarizationEvent::Error { message: msg });
            }
            let mut q = state.queue.lock().unwrap();
            q.active_episode_id = None;
            q.active_token = None;
            return;
        }

        downloaded_bytes += chunk.len() as u64;
        let download_percent = if total_bytes > 0 {
            ((downloaded_bytes * 50) / total_bytes) as i32
        } else {
            25
        };
        if let Some(ch) = on_event {
            let _ = ch.send(DiarizationEvent::Progress { percent: download_percent });
        }
    }

    if let Err(e) = file.flush().await {
        let _ = tokio::fs::remove_file(&temp_path_for_cleanup).await;
        let msg = format!("Failed to flush audio file: {}", e);
        update_diarization_status(db_path, episode_id, "error", Some(&msg));
        if let Some(ch) = on_event {
            let _ = ch.send(DiarizationEvent::Error { message: msg });
        }
        let mut q = state.queue.lock().unwrap();
        q.active_episode_id = None;
        q.active_token = None;
        return;
    }
    drop(file);

    // Check cancellation after download
    if cancel_token.is_cancelled() {
        let _ = tokio::fs::remove_file(&temp_path_for_cleanup).await;
        update_diarization_status(db_path, episode_id, "not_started", None);
        if let Some(ch) = on_event {
            let _ = ch.send(DiarizationEvent::Cancelled);
        }
        let mut q = state.queue.lock().unwrap();
        q.active_episode_id = None;
        q.active_token = None;
        return;
    }

    // ── Decode audio to 16 kHz mono f32 PCM ────────────────────────────────

    let samples = match crate::commands::transcription::decode_mp3_to_pcm(&temp_path) {
        Ok(s) => s,
        Err(e) => {
            let _ = tokio::fs::remove_file(&temp_path_for_cleanup).await;
            let msg = format!("Audio decode failed: {}", e);
            update_diarization_status(db_path, episode_id, "error", Some(&msg));
            if let Some(ch) = on_event {
                let _ = ch.send(DiarizationEvent::Error { message: msg });
            }
            let mut q = state.queue.lock().unwrap();
            q.active_episode_id = None;
            q.active_token = None;
            return;
        }
    };

    // Delete temp file now that audio is decoded
    let _ = tokio::fs::remove_file(&temp_path_for_cleanup).await;

    // ── Run sherpa-rs diarization in spawn_blocking ─────────────────────────

    let seg_path_str = seg_path.to_string_lossy().to_string();
    let emb_path_str = emb_path.to_string_lossy().to_string();

    let diar_result = tauri::async_runtime::spawn_blocking(move || {
        use sherpa_rs::diarize::{Diarize, DiarizeConfig};

        let config = DiarizeConfig {
            num_clusters: Some(2), // 2 main podcast hosts
            threshold: Some(0.5),
            min_duration_on: Some(0.3),
            min_duration_off: Some(0.3),
            provider: None,
            debug: false,
        };

        let mut diarizer = Diarize::new(&seg_path_str, &emb_path_str, config)
            .map_err(|e| format!("Failed to initialize diarizer: {:?}", e))?;

        let raw_segments = diarizer
            .compute(samples, None)
            .map_err(|e| format!("Diarization failed: {:?}", e))?;

        let results: Vec<crate::models::diarization::DiarizationSegment> = raw_segments
            .into_iter()
            .map(|seg| {
                // sherpa-rs returns seconds (f32) — multiply by 1000 for milliseconds
                let start_ms = (seg.start * 1000.0) as i64;
                let end_ms = (seg.end * 1000.0) as i64;
                // speaker is an i32 index (0, 1, 2...)
                let speaker_label = format!("SPEAKER_{}", seg.speaker);

                crate::models::diarization::DiarizationSegment {
                    start_ms,
                    end_ms,
                    speaker_label,
                    confidence: None,
                }
            })
            .collect();

        Ok::<Vec<crate::models::diarization::DiarizationSegment>, String>(results)
    })
    .await;

    // Send 100% progress after inference completes
    if let Some(ch) = on_event {
        let _ = ch.send(DiarizationEvent::Progress { percent: 100 });
    }

    match diar_result {
        Ok(Ok(segments)) => {
            // ── Solo detection ──────────────────────────────────────────────
            // A podcast is 'solo' if there's only 1 unique speaker, or if any
            // one speaker accounts for < 5% of total speaking time (likely noise).
            let unique_speakers: std::collections::HashSet<_> =
                segments.iter().map(|s| &s.speaker_label).collect();
            let total_ms: i64 = segments.iter().map(|s| s.end_ms - s.start_ms).sum();

            let is_solo = unique_speakers.len() <= 1 || {
                let speaker_ms =
                    segments
                        .iter()
                        .fold(std::collections::HashMap::new(), |mut m, s| {
                            *m.entry(&s.speaker_label).or_insert(0i64) +=
                                s.end_ms - s.start_ms;
                            m
                        });
                let min_speaker_ms = speaker_ms.values().copied().min().unwrap_or(0);
                total_ms > 0 && (min_speaker_ms * 100 / total_ms) < 5
            };

            let final_status = if is_solo { "solo" } else { "done" };

            // Store segments in DB
            if let Err(e) = store_diarization_segments(db_path, episode_id, &segments) {
                update_diarization_status(db_path, episode_id, "error", Some(&e));
                if let Some(ch) = on_event {
                    let _ = ch.send(DiarizationEvent::Error { message: e });
                }
            } else {
                // Populate text from Whisper transcript (no-op for AssemblyAI episodes)
                backfill_segment_text_from_whisper(db_path, episode_id);
                update_diarization_status(db_path, episode_id, final_status, None);
                if let Some(ch) = on_event {
                    let _ = ch.send(DiarizationEvent::Done { episode_id });
                }
            }
        }
        Ok(Err(e)) => {
            update_diarization_status(db_path, episode_id, "error", Some(&e));
            if let Some(ch) = on_event {
                let _ = ch.send(DiarizationEvent::Error { message: e });
            }
        }
        Err(e) => {
            let msg = format!("Diarization task panicked: {}", e);
            update_diarization_status(db_path, episode_id, "error", Some(&msg));
            if let Some(ch) = on_event {
                let _ = ch.send(DiarizationEvent::Error { message: msg });
            }
        }
    }

    // Clear active episode tracking
    let mut q = state.queue.lock().unwrap();
    q.active_episode_id = None;
    q.active_token = None;
}

// ─────────────────────────────────────────────────────────────────────────────
// Diarization engine commands
// ─────────────────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn start_diarization(
    episode_id: i64,
    audio_url: String,
    on_event: Channel<DiarizationEvent>,
    app: tauri::AppHandle,
    state: tauri::State<'_, Arc<DiarizationState>>,
) -> Result<(), String> {
    let (seg_path, emb_path) = find_diarization_models(&app).await?;

    let db_path = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Cannot resolve app data dir: {}", e))?
        .join("binky.db");

    let already_processing = {
        let mut q = state.queue.lock().unwrap();
        q.enqueue(DiarizationJob {
            episode_id,
            audio_url,
        });
        let was = q.is_processing;
        if !was {
            q.is_processing = true;
        }
        was
    };

    update_diarization_status(&db_path, episode_id, "queued", None);

    if already_processing {
        return Ok(());
    }

    let state_arc: Arc<DiarizationState> = state.inner().clone();

    tauri::async_runtime::spawn(async move {
        loop {
            let job = {
                let mut q = state_arc.queue.lock().unwrap();
                q.dequeue()
            };

            match job {
                None => {
                    state_arc.queue.lock().unwrap().is_processing = false;
                    break;
                }
                Some(j) => {
                    process_diarization_episode(
                        &j,
                        &app,
                        &state_arc,
                        Some(&on_event),
                        &seg_path,
                        &emb_path,
                        &db_path,
                    )
                    .await;
                }
            }
        }
    });

    Ok(())
}

/// Enqueue a diarization job from internal code (e.g., after transcription completes).
/// Returns immediately — models not downloaded → silently skipped (fire-and-forget).
pub(crate) async fn enqueue_diarization_internal(
    episode_id: i64,
    audio_url: String,
    app: &tauri::AppHandle,
    state: &Arc<DiarizationState>,
) {
    let (seg_path, emb_path) = match find_diarization_models(app).await {
        Ok(paths) => paths,
        Err(_) => return, // Models not downloaded — skip silently
    };

    let db_path = match app.path().app_data_dir() {
        Ok(d) => d.join("binky.db"),
        Err(_) => return,
    };

    let already_processing = {
        let mut q = state.queue.lock().unwrap();
        q.enqueue(DiarizationJob {
            episode_id,
            audio_url,
        });
        let was = q.is_processing;
        if !was {
            q.is_processing = true;
        }
        was
    };

    update_diarization_status(&db_path, episode_id, "queued", None);

    if already_processing {
        return;
    }

    let state_arc = state.clone();
    let app_clone = app.clone();

    tauri::async_runtime::spawn(async move {
        loop {
            let job = {
                let mut q = state_arc.queue.lock().unwrap();
                q.dequeue()
            };

            match job {
                None => {
                    state_arc.queue.lock().unwrap().is_processing = false;
                    break;
                }
                Some(j) => {
                    // No frontend channel for chained runs — pass None
                    process_diarization_episode(
                        &j,
                        &app_clone,
                        &state_arc,
                        None,
                        &seg_path,
                        &emb_path,
                        &db_path,
                    )
                    .await;
                }
            }
        }
    });
}

#[tauri::command]
pub async fn cancel_diarization(
    state: tauri::State<'_, Arc<DiarizationState>>,
) -> Result<(), String> {
    state.queue.lock().unwrap().cancel_active();
    Ok(())
}

#[tauri::command]
pub async fn get_diarization_queue_status(
    state: tauri::State<'_, Arc<DiarizationState>>,
) -> Result<DiarizationQueueStatus, String> {
    let q = state.queue.lock().unwrap();
    Ok(DiarizationQueueStatus {
        active_episode_id: q.active_episode_id,
        queue_length: q.queue_len(),
        is_processing: q.is_processing,
    })
}
