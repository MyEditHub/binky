ALTER TABLE episodes ADD COLUMN pipeline_progress INTEGER DEFAULT 0;
ALTER TABLE episodes ADD COLUMN pipeline_status TEXT DEFAULT 'idle';

-- Mark already-transcribed episodes as done
UPDATE episodes
SET pipeline_status = 'done', pipeline_progress = 100
WHERE transcription_status = 'done';
