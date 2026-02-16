-- Migration 004: Enhance topics table for AI-detected content
-- topics table already exists from Migration 001 — only ADD COLUMN

ALTER TABLE topics ADD COLUMN ai_detected INTEGER DEFAULT 0;
ALTER TABLE topics ADD COLUMN detected_from_episode_id INTEGER REFERENCES episodes(id);
ALTER TABLE topics ADD COLUMN ai_reason TEXT;
ALTER TABLE topics ADD COLUMN confidence REAL DEFAULT 0.5;

-- Track per-episode analysis status (separate from individual topic status)
CREATE TABLE IF NOT EXISTS episode_analysis (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    episode_id INTEGER NOT NULL UNIQUE,
    status TEXT DEFAULT 'not_started',
    error TEXT,
    topics_found INTEGER DEFAULT 0,
    analyzed_at TEXT,
    FOREIGN KEY (episode_id) REFERENCES episodes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_topics_detected_episode ON topics(detected_from_episode_id);
CREATE INDEX IF NOT EXISTS idx_topics_ai_detected ON topics(ai_detected);
CREATE INDEX IF NOT EXISTS idx_episode_analysis_status ON episode_analysis(status);

INSERT OR IGNORE INTO settings (key, value) VALUES ('openai_api_key', '');
