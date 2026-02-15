use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiarizationSegment {
    pub start_ms: i64,
    pub end_ms: i64,
    pub speaker_label: String,
    pub confidence: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "event", content = "data")]
pub enum DiarizationEvent {
    Progress { percent: i32 },
    Done { episode_id: i64 },
    Error { message: String },
    Cancelled,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiarizationModelStatus {
    pub segmentation_downloaded: bool,
    pub embedding_downloaded: bool,
    pub models_dir: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiarizationQueueStatus {
    pub active_episode_id: Option<i64>,
    pub queue_length: usize,
    pub is_processing: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "event", content = "data")]
pub enum DiarizationModelDownloadEvent {
    Progress { percent: i32, bytes: u64 },
    Done,
    Error { message: String },
}
