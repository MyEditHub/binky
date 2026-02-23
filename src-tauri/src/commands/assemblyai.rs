use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::Emitter;
use tauri::Manager;
use tauri_plugin_http::reqwest;
use tokio::sync::Semaphore;
use tokio::time::{sleep, Duration};

#[derive(Clone, Serialize)]
pub struct AssemblyAIProgress {
    pub episode_id: i64,
    pub episode_title: String,
    pub status: String, // "submitted" | "done" | "error"
    pub message: Option<String>,
    pub completed_count: u32,
    pub total_count: u32,
}

#[derive(Debug, Deserialize)]
struct SubmitResponse {
    id: String,
    #[allow(dead_code)]
    status: String,
}

#[derive(Debug, Deserialize)]
struct PollResponse {
    #[allow(dead_code)]
    id: String,
    status: String,
    text: Option<String>,
    utterances: Option<Vec<Utterance>>,
    error: Option<String>,
}

#[derive(Debug, Deserialize)]
struct Utterance {
    speaker: String,
    start: i64,
    end: i64,
    #[allow(dead_code)]
    text: String,
}

/// Maps AssemblyAI speaker letter to SPEAKER_N format.
/// "A" -> "SPEAKER_0", "B" -> "SPEAKER_1", etc.
fn map_speaker_label(speaker: &str) -> String {
    let index = speaker
        .chars()
        .next()
        .map(|c| (c as u8).saturating_sub(b'A') as usize)
        .unwrap_or(0);
    format!("SPEAKER_{}", index)
}

#[tauri::command]
pub async fn assemblyai_process_backlog(
    app: tauri::AppHandle,
    api_key: String,
) -> Result<String, String> {
    // Release build guard — this command is dev-only
    #[cfg(not(debug_assertions))]
    return Err("Dev-only command".to_string());

    #[cfg(debug_assertions)]
    {
        let db_path = app
            .path()
            .app_data_dir()
            .map_err(|e| e.to_string())?
            .join("binky.db");

        // Save API key to settings
        {
            let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;
            conn.execute(
                "INSERT OR REPLACE INTO settings (key, value) VALUES ('assemblyai_api_key', ?1)",
                rusqlite::params![api_key],
            )
            .map_err(|e| e.to_string())?;
        }

        // Get all not_started or error episodes with audio_url (includes retry of previous failures)
        let episodes: Vec<(i64, String, String)> = {
            let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;
            let mut stmt = conn
                .prepare(
                    "SELECT id, title, audio_url FROM episodes \
                     WHERE transcription_status IN ('not_started', 'error') \
                     AND audio_url IS NOT NULL AND audio_url != '' \
                     ORDER BY publish_date ASC",
                )
                .map_err(|e| e.to_string())?;
            let rows = stmt
                .query_map([], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)))
                .map_err(|e| e.to_string())?
                .collect::<Result<Vec<_>, _>>()
                .map_err(|e| e.to_string())?;
            rows
        };

        if episodes.is_empty() {
            return Ok("Keine Episoden zu verarbeiten".to_string());
        }

        let total = episodes.len() as u32;
        let result_msg = format!("Verarbeite {} Episoden", total);

        let semaphore = Arc::new(Semaphore::new(5));
        let completed_count = Arc::new(std::sync::atomic::AtomicU32::new(0));
        let mut handles = vec![];

        for (episode_id, title, audio_url) in episodes {
            let permit = semaphore.clone().acquire_owned().await.unwrap();
            let api_key_clone = api_key.clone();
            let db_path_clone = db_path.clone();
            let app_clone = app.clone();
            let completed_count_clone = completed_count.clone();

            let handle = tauri::async_runtime::spawn(async move {
                let _permit = permit;

                // Submit to AssemblyAI
                let submit_result = submit_episode(&audio_url, &api_key_clone).await;

                match submit_result {
                    Err(e) => {
                        // Mark error in DB
                        if let Ok(conn) = Connection::open(&db_path_clone) {
                            let _ = conn.execute(
                                "UPDATE episodes SET transcription_status = 'error', transcription_error = ?1 WHERE id = ?2",
                                rusqlite::params![e, episode_id],
                            );
                        }
                        let count = completed_count_clone
                            .fetch_add(1, std::sync::atomic::Ordering::SeqCst)
                            + 1;
                        let _ = app_clone.emit(
                            "assemblyai_progress",
                            AssemblyAIProgress {
                                episode_id,
                                episode_title: title,
                                status: "error".to_string(),
                                message: Some(e),
                                completed_count: count,
                                total_count: total,
                            },
                        );
                    }
                    Ok(transcript_id) => {
                        // Emit submitted event
                        let _ = app_clone.emit(
                            "assemblyai_progress",
                            AssemblyAIProgress {
                                episode_id,
                                episode_title: title.clone(),
                                status: "submitted".to_string(),
                                message: None,
                                completed_count: completed_count_clone
                                    .load(std::sync::atomic::Ordering::SeqCst),
                                total_count: total,
                            },
                        );

                        // Poll until done
                        let poll_result = poll_until_done(&transcript_id, &api_key_clone).await;

                        match poll_result {
                            Err(e) => {
                                if let Ok(conn) = Connection::open(&db_path_clone) {
                                    let _ = conn.execute(
                                        "UPDATE episodes SET transcription_status = 'error', transcription_error = ?1 WHERE id = ?2",
                                        rusqlite::params![e, episode_id],
                                    );
                                }
                                let count = completed_count_clone
                                    .fetch_add(1, std::sync::atomic::Ordering::SeqCst)
                                    + 1;
                                let _ = app_clone.emit(
                                    "assemblyai_progress",
                                    AssemblyAIProgress {
                                        episode_id,
                                        episode_title: title,
                                        status: "error".to_string(),
                                        message: Some(e),
                                        completed_count: count,
                                        total_count: total,
                                    },
                                );
                            }
                            Ok(poll) => {
                                // Write results to DB
                                let write_result =
                                    write_results_to_db(episode_id, &poll, &db_path_clone);
                                let count = completed_count_clone
                                    .fetch_add(1, std::sync::atomic::Ordering::SeqCst)
                                    + 1;
                                if let Err(e) = write_result {
                                    let _ = app_clone.emit(
                                        "assemblyai_progress",
                                        AssemblyAIProgress {
                                            episode_id,
                                            episode_title: title,
                                            status: "error".to_string(),
                                            message: Some(e),
                                            completed_count: count,
                                            total_count: total,
                                        },
                                    );
                                } else {
                                    let _ = app_clone.emit(
                                        "assemblyai_progress",
                                        AssemblyAIProgress {
                                            episode_id,
                                            episode_title: title,
                                            status: "done".to_string(),
                                            message: None,
                                            completed_count: count,
                                            total_count: total,
                                        },
                                    );
                                }
                            }
                        }
                    }
                }
            });
            handles.push(handle);
        }

        // Spawn a background task to wait for all handles — return early to caller
        tauri::async_runtime::spawn(async move {
            for h in handles {
                let _ = h.await;
            }
        });

        Ok(result_msg)
    }
}

async fn submit_episode(audio_url: &str, api_key: &str) -> Result<String, String> {
    let client = reqwest::Client::new();
    let body = serde_json::json!({
        "audio_url": audio_url,
        "speaker_labels": true,
        "language_code": "de"
    });

    let response = client
        .post("https://api.assemblyai.com/v2/transcript")
        .header("Authorization", api_key)
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Submit-Anfrage fehlgeschlagen: {}", e))?;

    let status = response.status();
    if status == 401 {
        return Err("Ungültiger API-Schlüssel (401)".to_string());
    }
    if !status.is_success() {
        return Err(format!("AssemblyAI Fehler: {}", status));
    }

    let resp: SubmitResponse = response
        .json()
        .await
        .map_err(|e| format!("Antwort konnte nicht geparst werden: {}", e))?;

    Ok(resp.id)
}

async fn poll_until_done(transcript_id: &str, api_key: &str) -> Result<PollResponse, String> {
    let client = reqwest::Client::new();
    let url = format!(
        "https://api.assemblyai.com/v2/transcript/{}",
        transcript_id
    );

    loop {
        let response = client
            .get(&url)
            .header("Authorization", api_key)
            .send()
            .await
            .map_err(|e| format!("Poll-Anfrage fehlgeschlagen: {}", e))?;

        if response.status() == 429 {
            // Rate limited — wait 60 seconds and retry
            sleep(Duration::from_secs(60)).await;
            continue;
        }

        let poll: PollResponse = response
            .json()
            .await
            .map_err(|e| format!("Poll-Antwort konnte nicht geparst werden: {}", e))?;

        match poll.status.as_str() {
            "completed" => return Ok(poll),
            "error" => {
                return Err(poll
                    .error
                    .unwrap_or_else(|| "Unbekannter Fehler".to_string()))
            }
            _ => {
                // "queued" or "processing" — wait and retry
                sleep(Duration::from_secs(3)).await;
            }
        }
    }
}

fn write_results_to_db(
    episode_id: i64,
    poll: &PollResponse,
    db_path: &std::path::Path,
) -> Result<(), String> {
    let conn = Connection::open(db_path).map_err(|e| e.to_string())?;

    let full_text = poll.text.as_deref().unwrap_or("");

    // Insert transcript
    conn.execute(
        "INSERT OR REPLACE INTO transcripts (episode_id, full_text, segments_json, whisper_model, language) \
         VALUES (?1, ?2, NULL, 'assemblyai', 'de')",
        rusqlite::params![episode_id, full_text],
    )
    .map_err(|e| format!("Transkript konnte nicht gespeichert werden: {}", e))?;

    // Clear existing diarization segments
    conn.execute(
        "DELETE FROM diarization_segments WHERE episode_id = ?1",
        rusqlite::params![episode_id],
    )
    .map_err(|e| e.to_string())?;

    // Insert diarization segments
    if let Some(utterances) = &poll.utterances {
        for utterance in utterances {
            let speaker_label = map_speaker_label(&utterance.speaker);
            conn.execute(
                "INSERT INTO diarization_segments (episode_id, start_ms, end_ms, speaker_label, confidence) \
                 VALUES (?1, ?2, ?3, ?4, 1.0)",
                rusqlite::params![episode_id, utterance.start, utterance.end, speaker_label],
            )
            .map_err(|e| format!("Segment konnte nicht gespeichert werden: {}", e))?;
        }
    }

    // Update episode status
    conn.execute(
        "UPDATE episodes SET transcription_status = 'done', transcription_error = NULL, \
         diarization_status = 'done', diarization_error = NULL \
         WHERE id = ?1",
        rusqlite::params![episode_id],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}
