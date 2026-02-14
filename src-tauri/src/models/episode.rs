use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Episode {
    pub id: i64,
    pub episode_number: Option<i32>,
    pub title: String,
    pub publish_date: Option<String>,
    pub audio_url: Option<String>,
    pub duration_minutes: Option<f64>,
    pub description: Option<String>,
    pub transcription_status: String, // not_started | queued | downloading | transcribing | done | error
    pub transcription_error: Option<String>,
    pub podcast_name: Option<String>,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EpisodeMetadata {
    pub title: String,
    pub description: Option<String>,
    pub audio_url: Option<String>,
    pub pub_date: Option<String>,
    pub duration_str: Option<String>,
    pub episode_number: Option<i32>,
}
