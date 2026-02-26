-- Reset episodes 182, 184, 194, 204, 230 and 262 for re-processing via AssemblyAI.
-- Clears existing whisper transcript + diarization data so assemblyai_process_backlog
-- picks them up and produces better transcription + diarization.

DELETE FROM diarization_segments
WHERE episode_id IN (
    SELECT id FROM episodes WHERE episode_number IN (182, 184, 194, 204, 230, 262)
);

DELETE FROM host_profiles
WHERE episode_id IN (
    SELECT id FROM episodes WHERE episode_number IN (182, 184, 194, 204, 230, 262)
);

DELETE FROM transcripts
WHERE episode_id IN (
    SELECT id FROM episodes WHERE episode_number IN (182, 184, 194, 204, 230, 262)
);

UPDATE episodes
SET transcription_status = 'not_started', transcription_error = NULL,
    diarization_status = 'not_started', diarization_error = NULL
WHERE episode_number IN (182, 184, 194, 204, 230, 262);
