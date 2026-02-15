use crate::models::diarization::{
    DiarizationEvent, DiarizationModelDownloadEvent, DiarizationModelStatus, DiarizationQueueStatus,
};
use crate::state::diarization_queue::DiarizationState;
use futures_util::StreamExt;
use std::sync::Arc;
use tauri::ipc::Channel;
use tauri::Manager;
use tauri_plugin_http::reqwest;
use tokio::io::AsyncWriteExt;

// ─────────────────────────────────────────────────────────────────────────────
// Model URLs (verified 2026-02-16)
// Segmentation: tar.bz2 archive (no standalone .onnx available)
// Embedding: direct .onnx file
// ─────────────────────────────────────────────────────────────────────────────

const SEGMENTATION_URL: &str = "https://github.com/k2-fsa/sherpa-onnx/releases/download/speaker-segmentation-models/sherpa-onnx-pyannote-segmentation-3-0.tar.bz2";
const EMBEDDING_URL: &str = "https://github.com/k2-fsa/sherpa-onnx/releases/download/speaker-recongition-models/wespeaker_en_voxceleb_resnet34_LM.onnx";
const EMBEDDING_FILENAME: &str = "wespeaker_en_voxceleb_resnet34_LM.onnx";

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

    // Check embedding model: any .onnx file in embedding/ with size > 0
    let emb_dir = models_dir.join("embedding");
    let embedding_downloaded = if emb_dir.exists() {
        match tokio::fs::read_dir(&emb_dir).await {
            Ok(mut rd) => {
                let mut found = false;
                while let Ok(Some(entry)) = rd.next_entry().await {
                    let name = entry.file_name();
                    let name_str = name.to_string_lossy();
                    if name_str.ends_with(".onnx") {
                        if let Ok(meta) = entry.metadata().await {
                            if meta.len() > 0 {
                                found = true;
                                break;
                            }
                        }
                    }
                }
                found
            }
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
// Diarization engine stubs (Plan 03-03+)
// ─────────────────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn start_diarization(
    _episode_id: i64,
    _audio_url: String,
    _on_event: Channel<DiarizationEvent>,
    _app: tauri::AppHandle,
    _state: tauri::State<'_, Arc<DiarizationState>>,
) -> Result<(), String> {
    Err("Not implemented yet".to_string())
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
