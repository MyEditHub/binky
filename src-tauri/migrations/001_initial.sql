-- Initial database schema for Nettgefluester

CREATE TABLE IF NOT EXISTS episodes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    episode_number INTEGER,
    title TEXT NOT NULL,
    publish_date TEXT,
    audio_url TEXT,
    duration_minutes REAL,
    transcription_text TEXT,
    transcribed INTEGER DEFAULT 0,
    speaker_a_time REAL,
    speaker_b_time REAL,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS birds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    scientific_name TEXT,
    description TEXT,
    image_url TEXT,
    nabu_url TEXT,
    used INTEGER DEFAULT 0,
    used_date TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS topics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    priority TEXT DEFAULT 'medium',
    status TEXT DEFAULT 'offen',
    category TEXT,
    episode_id INTEGER,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (episode_id) REFERENCES episodes(id)
);

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS episode_topics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    episode_id INTEGER NOT NULL,
    topic_id INTEGER NOT NULL,
    planned INTEGER DEFAULT 0,
    discussed INTEGER DEFAULT 0,
    FOREIGN KEY (episode_id) REFERENCES episodes(id),
    FOREIGN KEY (topic_id) REFERENCES topics(id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_episodes_publish_date ON episodes(publish_date);
CREATE INDEX IF NOT EXISTS idx_topics_status ON topics(status);
CREATE INDEX IF NOT EXISTS idx_birds_used ON birds(used);
