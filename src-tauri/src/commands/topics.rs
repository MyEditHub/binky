use tauri::Manager;
use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct DetectedTopic {
    pub id: i64,
    pub title: String,
    pub description: String,
    pub ai_reason: String,
    pub confidence: f64,
    pub detected_from_episode_id: i64,
}

#[derive(Debug, Serialize)]
pub struct AnalysisStatus {
    pub episode_id: i64,
    pub status: String,
    pub topics_found: i64,
    pub error: Option<String>,
}

/// Analyze a single episode's transcript for unfinished topics using LLM.
/// Stub — full implementation in Plan 04-02.
#[tauri::command]
pub async fn analyze_episode_topics(
    _episode_id: i64,
    _app: tauri::AppHandle,
) -> Result<Vec<DetectedTopic>, String> {
    Err("Noch nicht implementiert".to_string())
}

/// Check analysis status for a specific episode.
#[tauri::command]
pub async fn get_episode_analysis_status(
    episode_id: i64,
    app: tauri::AppHandle,
) -> Result<AnalysisStatus, String> {
    let db_path = app.path().app_data_dir()
        .map_err(|e| e.to_string())?
        .join("binky.db");
    let conn = rusqlite::Connection::open(&db_path)
        .map_err(|e| e.to_string())?;

    let result = conn.query_row(
        "SELECT episode_id, status, topics_found, error FROM episode_analysis WHERE episode_id = ?",
        [episode_id],
        |row| Ok(AnalysisStatus {
            episode_id: row.get(0)?,
            status: row.get(1)?,
            topics_found: row.get(2)?,
            error: row.get(3)?,
        }),
    );

    match result {
        Ok(s) => Ok(s),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(AnalysisStatus {
            episode_id,
            status: "not_started".to_string(),
            topics_found: 0,
            error: None,
        }),
        Err(e) => Err(e.to_string()),
    }
}

/// Check if an OpenAI API key is configured (never returns the key itself).
#[tauri::command]
pub async fn has_openai_key_configured(
    app: tauri::AppHandle,
) -> Result<bool, String> {
    let db_path = app.path().app_data_dir()
        .map_err(|e| e.to_string())?
        .join("binky.db");
    let conn = rusqlite::Connection::open(&db_path)
        .map_err(|e| e.to_string())?;

    let key: Option<String> = conn.query_row(
        "SELECT value FROM settings WHERE key = 'openai_api_key'",
        [],
        |row| row.get(0),
    ).ok();

    Ok(key.map_or(false, |k| !k.is_empty()))
}
