ALTER TABLE episodes ADD COLUMN diarization_status TEXT DEFAULT 'not_started';
ALTER TABLE episodes ADD COLUMN diarization_error TEXT;

CREATE TABLE IF NOT EXISTS diarization_segments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    episode_id INTEGER NOT NULL,
    start_ms INTEGER NOT NULL,
    end_ms INTEGER NOT NULL,
    speaker_label TEXT NOT NULL,
    confidence REAL,
    corrected_speaker TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (episode_id) REFERENCES episodes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS host_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    speaker_label TEXT NOT NULL,
    host_name TEXT NOT NULL,
    color TEXT DEFAULT '#FF6B35',
    episode_id INTEGER,
    confirmed INTEGER DEFAULT 0,
    FOREIGN KEY (episode_id) REFERENCES episodes(id)
);

CREATE INDEX IF NOT EXISTS idx_diarization_episode ON diarization_segments(episode_id);
