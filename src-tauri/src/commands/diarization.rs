use crate::models::diarization::{
    DiarizationEvent, DiarizationModelDownloadEvent, DiarizationModelStatus, DiarizationQueueStatus,
};
use crate::state::diarization_queue::DiarizationState;
use std::sync::Arc;
use tauri::ipc::Channel;
use tauri::Manager;

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
    Ok(DiarizationModelStatus {
        segmentation_downloaded: false,
        embedding_downloaded: false,
        models_dir: models_dir.to_string_lossy().to_string(),
    })
}

#[tauri::command]
pub async fn download_diarization_models(
    _app: tauri::AppHandle,
    _on_event: Channel<DiarizationModelDownloadEvent>,
) -> Result<(), String> {
    Err("Not implemented yet".to_string())
}

#[tauri::command]
pub async fn delete_diarization_models(_app: tauri::AppHandle) -> Result<(), String> {
    Err("Not implemented yet".to_string())
}

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
