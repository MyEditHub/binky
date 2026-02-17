use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct BirdProfile {
    pub id: i64,
    pub name_de: String,
    pub name_sci: Option<String>,
    pub image_url: Option<String>,
    pub nabu_url: String,
    pub content_html: Option<String>,
    pub used: bool,
    pub used_date: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct UsedBirdEntry {
    pub id: i64,
    pub bird_id: i64,
    pub bird_name_de: String,
    pub bird_nabu_url: String,
    pub episode_title: Option<String>,
    pub used_date: String,
}

#[derive(Debug, Serialize)]
pub struct BirdPoolStatus {
    pub total: i64,
    pub used: i64,
    pub available: i64,
}

/// Scrape NABU bird index and populate the birds table with discovered entries.
#[tauri::command]
pub async fn fetch_nabu_bird_list(
    _app: tauri::AppHandle,
) -> Result<BirdPoolStatus, String> {
    Err("not_implemented".to_string())
}

/// Select a random unused bird, fetch and cache its NABU profile, set as current bird.
#[tauri::command]
pub async fn draw_random_bird(
    _app: tauri::AppHandle,
) -> Result<BirdProfile, String> {
    Err("not_implemented".to_string())
}

/// Fetch or return cached profile for a specific bird by NABU URL.
#[tauri::command]
pub async fn fetch_bird_profile(
    _nabu_url: String,
    _app: tauri::AppHandle,
) -> Result<BirdProfile, String> {
    Err("not_implemented".to_string())
}

/// Mark a bird as used and insert a history entry with optional episode linkage.
#[tauri::command]
pub async fn mark_bird_used(
    _bird_id: i64,
    _episode_title: Option<String>,
    _app: tauri::AppHandle,
) -> Result<(), String> {
    Err("not_implemented".to_string())
}

/// Undo the most recent use marking for a bird.
#[tauri::command]
pub async fn undo_mark_bird_used(
    _bird_id: i64,
    _app: tauri::AppHandle,
) -> Result<(), String> {
    Err("not_implemented".to_string())
}

/// Reset all birds to unused and clear the history table.
#[tauri::command]
pub async fn reset_bird_pool(
    _app: tauri::AppHandle,
) -> Result<(), String> {
    Err("not_implemented".to_string())
}

/// Return the bird use history sorted newest first.
#[tauri::command]
pub async fn get_bird_history(
    _app: tauri::AppHandle,
) -> Result<Vec<UsedBirdEntry>, String> {
    Err("not_implemented".to_string())
}

/// Load the persisted current bird from settings.
#[tauri::command]
pub async fn get_current_bird(
    _app: tauri::AppHandle,
) -> Result<Option<BirdProfile>, String> {
    Err("not_implemented".to_string())
}
