use std::sync::{Arc, Mutex};
use tokio_util::sync::CancellationToken;

pub struct PipelineState {
    /// Cancellation token for the active pipeline run.
    /// None when no pipeline is running.
    pub cancel_token: Arc<Mutex<Option<CancellationToken>>>,
    /// The episode_id currently being processed by the pipeline.
    /// None when no pipeline is running.
    pub active_episode_id: Arc<Mutex<Option<i64>>>,
}

impl Default for PipelineState {
    fn default() -> Self {
        Self {
            cancel_token: Arc::new(Mutex::new(None)),
            active_episode_id: Arc::new(Mutex::new(None)),
        }
    }
}
