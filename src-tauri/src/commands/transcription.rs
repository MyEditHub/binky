use crate::models::transcript::ModelDownloadEvent;
use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use tauri::ipc::Channel;
use tauri::Manager;
use tauri_plugin_http::reqwest;
use tokio::io::AsyncWriteExt;

const HUGGINGFACE_BASE_URL: &str =
    "https://huggingface.co/ggerganov/whisper.cpp/resolve/main";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelStatus {
    pub downloaded_model: Option<String>,
    pub model_size_bytes: Option<u64>,
    pub models_dir: String,
}

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
            // Extract model name: "ggml-small.bin" -> "small"
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

    // Create models directory if it doesn't exist
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

    let response = reqwest::get(&url)
        .await
        .map_err(|e| {
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
                // Clean up partial download
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

    // Flush file to disk
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
