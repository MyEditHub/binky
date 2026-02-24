-- Fix bird history: remove test draws, add historically used birds

-- Step 1: Remove the 4 test birds by name
DELETE FROM bird_used_history WHERE bird_name_de IN ('Raufußkauz', 'Zwergtaucher', 'Heidelerche', 'Waldwasserläufer');
UPDATE birds SET used = 0, used_date = NULL WHERE name IN ('Raufußkauz', 'Zwergtaucher', 'Heidelerche', 'Waldwasserläufer');

-- Step 2: Mark Eichelhäher, Eiderente, Eisente as used (historical podcast episodes)
-- Only runs if the bird exists in the birds table (scraped from NABU index)
UPDATE birds SET used = 1, used_date = '2025-01-01'
WHERE name IN ('Eichelhäher', 'Eiderente', 'Eisente') AND used = 0;

INSERT INTO bird_used_history (bird_id, bird_name_de, bird_nabu_url, episode_title, used_date)
SELECT b.id, b.name, b.nabu_url, NULL, '2025-01-01'
FROM birds b
WHERE b.name IN ('Eichelhäher', 'Eiderente', 'Eisente')
  AND NOT EXISTS (
    SELECT 1 FROM bird_used_history WHERE bird_name_de = b.name
  );
