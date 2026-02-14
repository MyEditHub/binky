use std::collections::VecDeque;
use std::sync::Mutex;
use tokio_util::sync::CancellationToken;

#[derive(Debug)]
pub struct TranscriptionJob {
    pub episode_id: i64,
    pub audio_url: String,
}

pub struct TranscriptionQueue {
    pub queue: VecDeque<TranscriptionJob>,
    pub active_token: Option<CancellationToken>,
    pub active_episode_id: Option<i64>,
    pub is_processing: bool,
}

impl TranscriptionQueue {
    pub fn new() -> Self {
        Self {
            queue: VecDeque::new(),
            active_token: None,
            active_episode_id: None,
            is_processing: false,
        }
    }

    pub fn enqueue(&mut self, job: TranscriptionJob) {
        self.queue.push_back(job);
    }

    pub fn dequeue(&mut self) -> Option<TranscriptionJob> {
        self.queue.pop_front()
    }

    pub fn cancel_active(&mut self) {
        if let Some(token) = self.active_token.take() {
            token.cancel();
        }
        self.active_episode_id = None;
    }

    pub fn queue_len(&self) -> usize {
        self.queue.len()
    }
}

pub struct TranscriptionState {
    pub queue: Mutex<TranscriptionQueue>,
}

impl TranscriptionState {
    pub fn new() -> Self {
        Self {
            queue: Mutex::new(TranscriptionQueue::new()),
        }
    }
}
