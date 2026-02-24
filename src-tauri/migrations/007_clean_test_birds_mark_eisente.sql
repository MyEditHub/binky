-- Remove test bird draw records from development sessions (2026-02-23, 2026-02-24)
UPDATE birds SET used = 0, used_date = NULL WHERE used_date IN ('2026-02-23', '2026-02-24');
DELETE FROM bird_used_history WHERE used_date IN ('2026-02-23', '2026-02-24');

-- Also remove Waldwasserläufer if it appears as a test entry without a real episode
DELETE FROM bird_used_history WHERE bird_name_de = 'Waldwasserläufer' AND (episode_title IS NULL OR episode_title = '');
UPDATE birds SET used = 0, used_date = NULL WHERE name_de = 'Waldwasserläufer'
  AND NOT EXISTS (SELECT 1 FROM bird_used_history WHERE bird_name_de = 'Waldwasserläufer');

-- Mark Eisente as used from episode 267
-- Only runs if Eisente exists in the birds table and is not already marked used
UPDATE birds
SET used = 1, used_date = COALESCE(
  (SELECT publish_date FROM episodes WHERE title LIKE '%267%' LIMIT 1),
  '2025-01-01'
)
WHERE name_de = 'Eisente' AND used = 0;

INSERT INTO bird_used_history (bird_id, bird_name_de, bird_nabu_url, episode_title, used_date)
SELECT
  b.id,
  b.name_de,
  b.nabu_url,
  (SELECT title FROM episodes WHERE title LIKE '%267%' LIMIT 1),
  COALESCE((SELECT publish_date FROM episodes WHERE title LIKE '%267%' LIMIT 1), '2025-01-01')
FROM birds b
WHERE b.name_de = 'Eisente'
  AND NOT EXISTS (SELECT 1 FROM bird_used_history WHERE bird_name_de = 'Eisente');
