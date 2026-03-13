use serde::Serialize;

#[derive(Clone, Serialize)]
#[serde(tag = "event", content = "data")]
pub enum PipelineEvent {
    StageStarted  { stage: String, overall_percent: i32 },
    Progress      { stage: String, stage_percent: i32, overall_percent: i32 },
    StageDone     { stage: String, overall_percent: i32 },
    Done          { episode_id: i64 },
    Error         { stage: String, message: String, overall_percent: i32 },
    Cancelled     { completed_stages: Vec<String>, overall_percent: i32 },
}

pub const DOWNLOAD_START: i32 = 0;
pub const DOWNLOAD_END: i32 = 8;
pub const TRANSCRIPTION_START: i32 = 8;
pub const TRANSCRIPTION_END: i32 = 63;
pub const DIARIZATION_START: i32 = 63;
pub const DIARIZATION_END: i32 = 93;
pub const TOPICS_START: i32 = 93;
pub const TOPICS_END: i32 = 100;

/// Map a stage-local percentage (0–100) to the overall pipeline percentage
/// using the stage's start and end bounds.
pub fn map_to_overall(stage_pct: i32, stage_start: i32, stage_end: i32) -> i32 {
    stage_start + (stage_pct * (stage_end - stage_start) / 100)
}
