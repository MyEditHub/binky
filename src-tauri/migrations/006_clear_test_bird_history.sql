-- Clear test/development bird draw records (pre-release cleanup)
-- Targets only 2026-02-21 draws (Pfeifente, Baumfalke) — NOT the 2025-01-01 historical pre-marks
UPDATE birds SET used = 0, used_date = NULL WHERE used_date = '2026-02-21';
DELETE FROM bird_used_history WHERE used_date = '2026-02-21';
