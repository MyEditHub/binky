-- Migration 002: Enhance episodes table and add transcripts table
-- Runs exactly once via tauri-plugin-sql migration system

-- Add new columns to episodes table
-- Note: ALTER TABLE ADD COLUMN IF NOT EXISTS requires SQLite >= 3.37.0
-- tauri-plugin-sql migrations run exactly once, so plain ALTER TABLE is safe
ALTER TABLE episodes ADD COLUMN description TEXT;
ALTER TABLE episodes ADD COLUMN transcription_status TEXT DEFAULT 'not_started';
ALTER TABLE episodes ADD COLUMN transcription_error TEXT;
ALTER TABLE episodes ADD COLUMN podcast_name TEXT DEFAULT 'Nettgefluster';

-- New transcripts table for Whisper output
CREATE TABLE IF NOT EXISTS transcripts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    episode_id INTEGER NOT NULL UNIQUE,
    full_text TEXT NOT NULL,
    segments_json TEXT,
    whisper_model TEXT,
    language TEXT DEFAULT 'de',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (episode_id) REFERENCES episodes(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_transcripts_episode_id ON transcripts(episode_id);
CREATE INDEX IF NOT EXISTS idx_episodes_status ON episodes(transcription_status);

-- Default settings for transcription
INSERT OR IGNORE INTO settings (key, value) VALUES ('whisper_model', 'small');
INSERT OR IGNORE INTO settings (key, value) VALUES ('whisper_language', 'de');
