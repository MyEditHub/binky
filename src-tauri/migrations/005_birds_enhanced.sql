-- Migration 005: Bird randomizer schema enhancement
-- birds table already exists from 001 -- extend it

ALTER TABLE birds ADD COLUMN nabu_slug TEXT;
ALTER TABLE birds ADD COLUMN cached_content_html TEXT;
ALTER TABLE birds ADD COLUMN cached_at TEXT;

-- Persist the currently displayed bird across restarts
INSERT OR IGNORE INTO settings (key, value) VALUES ('current_bird_id', '');

-- History table: tracks each use event with episode linkage
CREATE TABLE IF NOT EXISTS bird_used_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bird_id INTEGER NOT NULL,
    bird_name_de TEXT NOT NULL,
    bird_nabu_url TEXT NOT NULL,
    episode_title TEXT,
    used_date TEXT NOT NULL DEFAULT (date('now')),
    FOREIGN KEY (bird_id) REFERENCES birds(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_birds_nabu_slug ON birds(nabu_slug);
CREATE INDEX IF NOT EXISTS idx_bird_history_date ON bird_used_history(used_date DESC);
CREATE INDEX IF NOT EXISTS idx_bird_history_bird ON bird_used_history(bird_id);
