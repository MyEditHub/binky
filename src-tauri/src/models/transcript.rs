use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Transcript {
    pub id: i64,
    pub episode_id: i64,
    pub full_text: String,
    pub segments_json: Option<String>,
    pub whisper_model: Option<String>,
    pub language: Option<String>,
    pub created_at: Option<String>,
}

#[derive(Clone, Serialize)]
#[serde(tag = "event", content = "data")]
pub enum TranscriptionEvent {
    Downloading { percent: i32 },
    Progress { percent: i32 },
    Segment { text: String, start_ms: i64, end_ms: i64 },
    Done { episode_id: i64 },
    Error { message: String },
    Cancelled,
}

#[derive(Clone, Serialize)]
#[serde(tag = "event", content = "data")]
pub enum ModelDownloadEvent {
    Progress { percent: i32, bytes: u64 },
    Done { model_name: String },
    Error { message: String },
}
