-- Remove bird history entries that were added during testing (2025-01-01 dates)
-- and reset those birds back to unused so they re-enter the available pool.

UPDATE birds
SET used = 0, used_date = NULL
WHERE id IN (
    SELECT bird_id FROM bird_used_history WHERE used_date <= '2025-01-01'
);

DELETE FROM bird_used_history WHERE used_date <= '2025-01-01';
