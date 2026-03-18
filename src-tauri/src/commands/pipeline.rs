use crate::models::pipeline::{
    PipelineEvent, PipelineTiming, DOWNLOAD_END, DOWNLOAD_START, DIARIZATION_END, DIARIZATION_START,
    TOPICS_END, TOPICS_START, TRANSCRIPTION_END, TRANSCRIPTION_START, map_to_overall,
};
use crate::state::pipeline::PipelineState;
use crate::state::transcription_queue::TranscriptionState;
use crate::state::diarization_queue::DiarizationState;
use futures_util::StreamExt;
use std::path::Path;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use tauri::ipc::Channel;
use tauri::Manager;
use tauri_plugin_http::reqwest;
use tokio::io::AsyncWriteExt;
use tokio_util::sync::CancellationToken;
use whisper_rs::{FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters};

// ─────────────────────────────────────────────────────────────────────────────
// Persistence helpers
// ─────────────────────────────────────────────────────────────────────────────

/// Persist pipeline_progress and pipeline_status to the episodes table.
fn persist_pipeline_progress(db_path: &Path, episode_id: i64, pct: i32, status: &str) {
    if let Ok(conn) = rusqlite::Connection::open(db_path) {
        let _ = conn.execute(
            "UPDATE episodes SET pipeline_progress = ?1, pipeline_status = ?2 WHERE id = ?3",
            rusqlite::params![pct, status, episode_id],
        );
    }
}

/// Send a PipelineEvent on the channel and persist the overall_percent from it.
fn emit_and_persist(
    channel: &Channel<PipelineEvent>,
    db_path: &Path,
    episode_id: i64,
    event: PipelineEvent,
) {
    let pct = match &event {
        PipelineEvent::StageStarted { overall_percent, .. } => *overall_percent,
        PipelineEvent::Progress { overall_percent, .. } => *overall_percent,
        PipelineEvent::StageDone { overall_percent, .. } => *overall_percent,
        PipelineEvent::Done { .. } => 100,
        PipelineEvent::Error { overall_percent, .. } => *overall_percent,
        PipelineEvent::Cancelled { overall_percent, .. } => *overall_percent,
    };
    let _ = channel.send(event);
    persist_pipeline_progress(db_path, episode_id, pct, "running");
}

// ─────────────────────────────────────────────────────────────────────────────
// start_pipeline — unified orchestrator
// ─────────────────────────────────────────────────────────────────────────────

/// Start the full processing pipeline for an episode:
/// download + transcription (0–63%) → diarization (63–93%) → topic analysis (93–100%).
///
/// Emits PipelineEvent variants on the channel with weighted overall_percent values.
/// All stage results are persisted to the DB so AnalyticsPage remains consistent.
/// Errors halt the pipeline and persist error state; cancellation preserves completed work.
#[tauri::command]
pub async fn start_pipeline(
    app: tauri::AppHandle,
    pipeline_state: tauri::State<'_, PipelineState>,
    _transcription_state: tauri::State<'_, Arc<TranscriptionState>>,
    _diarization_state: tauri::State<'_, Arc<DiarizationState>>,
    episode_id: i64,
    audio_url: String,
    on_event: Channel<PipelineEvent>,
) -> Result<(), String> {
    // ── Setup ─────────────────────────────────────────────────────────────────

    let db_path = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Cannot resolve app data dir: {}", e))?
        .join("binky.db");

    let cache_dir = app
        .path()
        .app_cache_dir()
        .map_err(|e| format!("Cannot resolve cache dir: {}", e))?;

    // Check if transcription is already done — lets us skip Whisper on interrupted-at-diarization restarts
    let transcription_already_done = transcription_is_done(&db_path, episode_id);

    // Locate Whisper model only when transcription still needs to run
    let whisper_info: Option<(String, std::path::PathBuf)> = if transcription_already_done {
        None
    } else {
        Some(find_whisper_model(&app).await.ok_or_else(|| {
            "Kein Whisper-Modell heruntergeladen. Bitte zuerst ein Modell in den Einstellungen herunterladen.".to_string()
        })?)
    };

    // Locate diarization models (optional — pipeline skips diarization if not present)
    let diar_models = find_diarization_models(&app).await.ok();

    // Create a fresh cancellation token and register it in PipelineState
    let cancel_token = CancellationToken::new();
    {
        *pipeline_state.cancel_token.lock().unwrap() = Some(cancel_token.clone());
        *pipeline_state.active_episode_id.lock().unwrap() = Some(episode_id);
    }

    // Mark running in DB
    persist_pipeline_progress(&db_path, episode_id, 0, "running");

    let pipeline_start = std::time::Instant::now();
    let mut completed_stages: Vec<String> = Vec::new();

    // ── Stage 1a: Download audio (0–8%) ──────────────────────────────────────

    emit_and_persist(
        &on_event, &db_path, episode_id,
        PipelineEvent::StageStarted { stage: "download".to_string(), overall_percent: DOWNLOAD_START },
    );

    if cancel_token.is_cancelled() {
        finish_cancelled(&on_event, &db_path, episode_id, &completed_stages, 0, &pipeline_state);
        return Ok(());
    }

    tokio::fs::create_dir_all(&cache_dir)
        .await
        .map_err(|e| format!("Cannot create cache dir: {}", e))?;

    let temp_path = cache_dir.join(format!("pipeline_{}.mp3", episode_id));
    let temp_path_for_cleanup = temp_path.clone();

    // Update transcription_status so standalone flow stays consistent (skip if already done)
    if !transcription_already_done {
        update_transcription_status(&db_path, episode_id, "downloading");
    }

    let download_t = std::time::Instant::now();
    let http_client = reqwest::Client::builder()
        .connect_timeout(std::time::Duration::from_secs(30))
        .build()
        .unwrap_or_default();
    let response = match http_client.get(&audio_url).send().await {
        Ok(r) => r,
        Err(e) => {
            let msg = format!("Audio download failed: {}", e);
            return finish_error(&on_event, &db_path, episode_id, "download", &msg, 0, &pipeline_state);
        }
    };

    let total_bytes = response.content_length().unwrap_or(0);
    let mut stream = response.bytes_stream();
    let mut downloaded_bytes: u64 = 0;

    let mut file = match tokio::fs::File::create(&temp_path).await {
        Ok(f) => f,
        Err(e) => {
            let msg = format!("Cannot create temp audio file: {}", e);
            return finish_error(&on_event, &db_path, episode_id, "download", &msg, 0, &pipeline_state);
        }
    };

    // 60s idle timeout per chunk — kills stalled connections without affecting slow but active downloads
    let chunk_timeout = std::time::Duration::from_secs(60);

    loop {
        let next = tokio::time::timeout(chunk_timeout, stream.next()).await;
        let chunk_result = match next {
            Err(_elapsed) => {
                let _ = file.flush().await;
                drop(file);
                let _ = tokio::fs::remove_file(&temp_path_for_cleanup).await;
                let msg = "Download timed out (server stopped responding)".to_string();
                update_transcription_status(&db_path, episode_id, "not_started");
                return finish_error(&on_event, &db_path, episode_id, "download", &msg, 0, &pipeline_state);
            }
            Ok(None) => break, // stream ended
            Ok(Some(r)) => r,
        };

        if cancel_token.is_cancelled() {
            let _ = file.flush().await;
            drop(file);
            let _ = tokio::fs::remove_file(&temp_path_for_cleanup).await;
            update_transcription_status(&db_path, episode_id, "not_started");
            finish_cancelled(&on_event, &db_path, episode_id, &completed_stages, 0, &pipeline_state);
            return Ok(());
        }

        let chunk = match chunk_result {
            Ok(c) => c,
            Err(e) => {
                let _ = file.flush().await;
                drop(file);
                let _ = tokio::fs::remove_file(&temp_path_for_cleanup).await;
                let msg = format!("Download stream error: {}", e);
                update_transcription_status(&db_path, episode_id, "not_started");
                return finish_error(&on_event, &db_path, episode_id, "download", &msg, 0, &pipeline_state);
            }
        };

        if let Err(e) = file.write_all(&chunk).await {
            let _ = tokio::fs::remove_file(&temp_path_for_cleanup).await;
            let msg = format!("Failed to write audio chunk: {}", e);
            update_transcription_status(&db_path, episode_id, "not_started");
            return finish_error(&on_event, &db_path, episode_id, "download", &msg, 0, &pipeline_state);
        }

        downloaded_bytes += chunk.len() as u64;
        let download_stage_pct = if total_bytes > 0 {
            ((downloaded_bytes * 100) / total_bytes) as i32
        } else {
            50
        };
        let overall_pct = map_to_overall(download_stage_pct, DOWNLOAD_START, DOWNLOAD_END);
        emit_and_persist(
            &on_event, &db_path, episode_id,
            PipelineEvent::Progress {
                stage: "download".to_string(),
                stage_percent: download_stage_pct,
                overall_percent: overall_pct,
            },
        );
    }

    if let Err(e) = file.flush().await {
        let _ = tokio::fs::remove_file(&temp_path_for_cleanup).await;
        let msg = format!("Failed to flush audio file: {}", e);
        update_transcription_status(&db_path, episode_id, "not_started");
        return finish_error(&on_event, &db_path, episode_id, "download", &msg, 0, &pipeline_state);
    }
    drop(file);

    // Check cancellation after download
    if cancel_token.is_cancelled() {
        let _ = tokio::fs::remove_file(&temp_path_for_cleanup).await;
        update_transcription_status(&db_path, episode_id, "not_started");
        finish_cancelled(&on_event, &db_path, episode_id, &completed_stages, DOWNLOAD_END, &pipeline_state);
        return Ok(());
    }

    emit_and_persist(
        &on_event, &db_path, episode_id,
        PipelineEvent::StageDone { stage: "download".to_string(), overall_percent: DOWNLOAD_END },
    );
    completed_stages.push("download".to_string());
    let download_s = download_t.elapsed().as_secs_f64();

    // ── Stages 1b + 2: Transcription (8–63%) + Diarization (63–93%) in parallel ─
    //
    // Whisper uses Metal (GPU). sherpa-rs uses CPU (ONNX). They hit different
    // hardware, so we decode the audio once into a shared Arc buffer, then run
    // both spawn_blocking tasks concurrently via tokio::join!.

    // Decode MP3 once — shared by both tasks.
    // Returns (mixed_mono, channel_0_mono): mixed for Whisper, ch0 for diarization.
    // On two-mic stereo podcasts ch0 has one speaker loud + the other as room bleed,
    // giving sherpa-rs far better speaker contrast than the blended average.
    // Runs in spawn_blocking so the async executor is not stalled.
    let decode_t = std::time::Instant::now();
    let temp_path_for_decode = temp_path.clone();
    let (audio_data, audio_data_diar) = match tauri::async_runtime::spawn_blocking(move || {
        crate::commands::transcription::decode_mp3_to_pcm(&temp_path_for_decode)
    }).await {
        Ok(Ok((mixed, ch0))) => (std::sync::Arc::new(mixed), std::sync::Arc::new(ch0)),
        Ok(Err(e)) => {
            let _ = tokio::fs::remove_file(&temp_path_for_cleanup).await;
            let msg = format!("Audio decode failed: {}", e);
            update_transcription_status(&db_path, episode_id, "error");
            return finish_error(&on_event, &db_path, episode_id, "transcription", &msg, TRANSCRIPTION_START, &pipeline_state);
        }
        Err(e) => {
            let _ = tokio::fs::remove_file(&temp_path_for_cleanup).await;
            let msg = format!("Audio decode panicked: {}", e);
            update_transcription_status(&db_path, episode_id, "error");
            return finish_error(&on_event, &db_path, episode_id, "transcription", &msg, TRANSCRIPTION_START, &pipeline_state);
        }
    };
    let decode_s = decode_t.elapsed().as_secs_f64();
    eprintln!("[pipeline timing] ep={} decode={:.1}s", episode_id, decode_s);

    // Temp file no longer needed — both tasks work from the Arc'd PCM buffer
    let _ = tokio::fs::remove_file(&temp_path_for_cleanup).await;

    // Read language setting
    let language = read_language_setting(&db_path);

    let episode_id_copy = episode_id;
    let transcription_ms = Arc::new(AtomicU64::new(0));
    let diarization_ms = Arc::new(AtomicU64::new(0));

    // ── Transcription task ────────────────────────────────────────────────────
    // Returns Ok(Some(transcript)) on success, Ok(None) if skipped, Err on failure.
    // Skipped when transcription_already_done — saves ~600s on interrupted-at-diarization restarts.
    type WhisperOutput = Option<(String, String, String)>; // (full_text, segments_json, model_name)

    let whisper_handle = if transcription_already_done {
        // Transcription already complete — emit stages instantly, skip Whisper inference
        emit_and_persist(
            &on_event, &db_path, episode_id,
            PipelineEvent::StageStarted { stage: "transcription".to_string(), overall_percent: TRANSCRIPTION_START },
        );
        emit_and_persist(
            &on_event, &db_path, episode_id,
            PipelineEvent::StageDone { stage: "transcription".to_string(), overall_percent: TRANSCRIPTION_END },
        );
        tauri::async_runtime::spawn_blocking(|| Ok::<WhisperOutput, String>(None))
    } else {
        let (model_name, model_path) = whisper_info.unwrap(); // safe: whisper_info is Some when !transcription_already_done
        emit_and_persist(
            &on_event, &db_path, episode_id,
            PipelineEvent::StageStarted { stage: "transcription".to_string(), overall_percent: TRANSCRIPTION_START },
        );
        update_transcription_status(&db_path, episode_id, "transcribing");

        let model_path_str = model_path.to_string_lossy().to_string();
        let model_name_owned = model_name.clone();
        let language_clone = language.clone();
        let cancel_token_for_whisper = cancel_token.clone();
        let on_event_for_whisper = on_event.clone();
        let db_path_for_whisper = db_path.clone();
        let audio_for_whisper = std::sync::Arc::clone(&audio_data);
        let transcription_ms_clone = Arc::clone(&transcription_ms);

        tauri::async_runtime::spawn_blocking(move || {
            let whisper_t = std::time::Instant::now();
            let ctx =
                WhisperContext::new_with_params(&model_path_str, WhisperContextParameters::default())
                    .map_err(|e| format!("Failed to load Whisper model: {}", e))?;

            const CHUNK_SAMPLES: usize = 20 * 60 * 16_000; // 20 min at 16 kHz
            let num_chunks = (audio_for_whisper.len() + CHUNK_SAMPLES - 1) / CHUNK_SAMPLES;

            let mut full_text = String::new();
            let mut segments_arr: Vec<serde_json::Value> = Vec::new();

            for chunk_idx in 0..num_chunks {
                if cancel_token_for_whisper.is_cancelled() {
                    break;
                }

                let start = chunk_idx * CHUNK_SAMPLES;
                let end = (start + CHUNK_SAMPLES).min(audio_for_whisper.len());
                let chunk = &audio_for_whisper[start..end];
                let chunk_offset_cs = (start / 160) as i64;

                let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });
                params.set_language(Some(language_clone.as_str()));
                params.set_print_progress(false);
                params.set_print_realtime(false);
                params.set_print_special(false);
                params.set_print_timestamps(false);

                // Fresh state per chunk — see CLAUDE.md note about whisper-rs 0.15 dangling pointer UB
                let mut whisper_state = ctx
                    .create_state()
                    .map_err(|e| format!("Failed to create Whisper state (chunk {}): {}", chunk_idx + 1, e))?;

                whisper_state
                    .full(params, chunk)
                    .map_err(|e| format!("Whisper failed (chunk {}/{}): {}", chunk_idx + 1, num_chunks, e))?;

                for segment in whisper_state.as_iter() {
                    let text = segment.to_string();
                    let t0 = segment.start_timestamp() + chunk_offset_cs;
                    let t1 = segment.end_timestamp() + chunk_offset_cs;

                    if crate::commands::transcription::is_duplicate_segment(&text, &segments_arr) {
                        continue;
                    }

                    full_text.push_str(&text);
                    segments_arr.push(serde_json::json!({
                        "text": text,
                        "start_ms": t0 * 10,
                        "end_ms": t1 * 10
                    }));
                }
                // whisper_state drops here

                // Map chunk progress to overall pipeline range (8–63%)
                let transcription_stage_pct = ((chunk_idx + 1) * 100 / num_chunks) as i32;
                let overall_pct = map_to_overall(transcription_stage_pct, TRANSCRIPTION_START, TRANSCRIPTION_END);
                let _ = on_event_for_whisper.send(PipelineEvent::Progress {
                    stage: "transcription".to_string(),
                    stage_percent: transcription_stage_pct,
                    overall_percent: overall_pct,
                });
                persist_pipeline_progress(&db_path_for_whisper, episode_id_copy, overall_pct, "running");
            }

            let segments_json = serde_json::to_string(&segments_arr).unwrap_or_default();
            transcription_ms_clone.store(whisper_t.elapsed().as_millis() as u64, Ordering::Relaxed);
            Ok::<WhisperOutput, String>(Some((full_text, segments_json, model_name_owned)))
        })
    };

    // ── Diarization task (launched in parallel with Whisper) ─────────────────
    // Always spawn a task — returns Ok(None) when no models are configured,
    // Ok(Some(segments)) when diarization runs. Both handles share the same
    // concrete return type, which avoids Option<JoinHandle> type-inference pain.
    type DiarSegments = Vec<crate::models::diarization::DiarizationSegment>;

    let (diar_model_paths, has_diar_models) = match diar_models {
        Some((sp, ep)) => {
            let paths = (sp.to_string_lossy().to_string(), ep.to_string_lossy().to_string());
            (Some(paths), true)
        }
        None => (None, false),
    };

    if has_diar_models {
        update_diarization_status_db(&db_path, episode_id, "processing");
        emit_and_persist(
            &on_event, &db_path, episode_id,
            PipelineEvent::StageStarted { stage: "diarization".to_string(), overall_percent: DIARIZATION_START },
        );
    }

    let on_event_for_diar = on_event.clone();
    let db_path_for_diar = db_path.clone();
    let audio_for_diar_mixed = std::sync::Arc::clone(&audio_data);
    let audio_for_diar_ch0   = std::sync::Arc::clone(&audio_data_diar);
    let diarization_ms_clone = Arc::clone(&diarization_ms);

    let diar_handle = tauri::async_runtime::spawn_blocking(move || -> Result<Option<DiarSegments>, String> {
        let diar_t = std::time::Instant::now();
        let (seg_path_str, emb_path_str) = match diar_model_paths {
            None => return Ok(None), // no models configured
            Some(paths) => paths,
        };

        use sherpa_rs::diarize::{Diarize, DiarizeConfig};

        let config = DiarizeConfig {
            num_clusters: Some(2), // always exactly 2 hosts
            threshold: None,
            min_duration_on: Some(0.1),
            min_duration_off: Some(0.1),
            provider: None,
            debug: false,
        };

        let mut diarizer = Diarize::new(&seg_path_str, &emb_path_str, config)
            .map_err(|e| format!("Failed to initialize diarizer: {:?}", e))?;

        // Dominant-channel selection: for each 64ms window pick whichever mic is louder.
        // ch1 = 2×mixed − ch0 (exact: resampling is linear, mixed = (ch0+ch1)/2).
        // No third resampler or extra 230MB buffer needed.
        let mixed_samples = (*audio_for_diar_mixed).to_vec();
        let ch0_samples   = (*audio_for_diar_ch0).to_vec();
        let len = mixed_samples.len().min(ch0_samples.len());

        const WINDOW: usize = 1024; // 64ms at 16 kHz
        let mut samples: Vec<f32> = Vec::with_capacity(len);
        let mut i = 0;
        while i < len {
            let end = (i + WINDOW).min(len);
            let e0: f32 = ch0_samples[i..end].iter().map(|s| s * s).sum();
            let e1: f32 = mixed_samples[i..end].iter().zip(&ch0_samples[i..end])
                .map(|(m, c)| { let s = 2.0 * m - c; s * s }).sum();
            if e0 >= e1 {
                samples.extend_from_slice(&ch0_samples[i..end]);
            } else {
                for j in i..end {
                    samples.push(2.0 * mixed_samples[j] - ch0_samples[j]);
                }
            }
            i += WINDOW;
        }

        // Pre-emphasis: y[n] = x[n] - α·x[n-1], α=0.97
        // Boosts high-frequency formants that TitaNet speaker embeddings rely on,
        // suppresses low-frequency room noise, and improves VAD segment accuracy.
        {
            let alpha = 0.97_f32;
            let mut prev = 0.0_f32;
            for s in samples.iter_mut() {
                let cur = *s;
                *s = cur - alpha * prev;
                prev = cur;
            }
        }

        // Real intermediate progress from the diarization library.
        // Callback signature: (num_processed_chunks, num_total_chunks) -> 0 (continue).
        let on_event_cb = on_event_for_diar.clone();
        let db_path_cb = db_path_for_diar.clone();
        let progress_cb = Box::new(move |processed: i32, total: i32| -> i32 {
            if total > 0 {
                let stage_pct = (processed * 100 / total).min(99); // hold 100% for StageDone
                let overall_pct = map_to_overall(stage_pct, DIARIZATION_START, DIARIZATION_END);
                let _ = on_event_cb.send(PipelineEvent::Progress {
                    stage: "diarization".to_string(),
                    stage_percent: stage_pct,
                    overall_percent: overall_pct,
                });
                persist_pipeline_progress(&db_path_cb, episode_id_copy, overall_pct, "running");
            }
            0 // returning 0 continues processing; non-zero would abort
        });

        let raw_segments = diarizer
            .compute(samples, Some(progress_cb))
            .map_err(|e| format!("Diarization failed: {:?}", e))?;

        let results: DiarSegments = raw_segments
            .into_iter()
            .map(|seg| crate::models::diarization::DiarizationSegment {
                start_ms: (seg.start * 1000.0) as i64,
                end_ms: (seg.end * 1000.0) as i64,
                speaker_label: format!("SPEAKER_{}", seg.speaker),
                confidence: None,
            })
            .collect();

        diarization_ms_clone.store(diar_t.elapsed().as_millis() as u64, Ordering::Relaxed);
        Ok(Some(results))
    });

    // Drop the last Arc references we hold — tasks own their own Arc clones
    drop(audio_data);
    drop(audio_data_diar);

    // ── Await both tasks concurrently ─────────────────────────────────────────
    let (whisper_result, diar_result) = tokio::join!(whisper_handle, diar_handle);
    let transcription_s = transcription_ms.load(Ordering::Relaxed) as f64 / 1000.0;
    let diarization_s = diarization_ms.load(Ordering::Relaxed) as f64 / 1000.0;

    // ── Handle transcription result ───────────────────────────────────────────
    if cancel_token.is_cancelled() {
        update_transcription_status(&db_path, episode_id, "not_started");
        finish_cancelled(&on_event, &db_path, episode_id, &completed_stages, TRANSCRIPTION_START, &pipeline_state);
        return Ok(());
    }

    match whisper_result {
        Ok(Ok(Some((full_text, segments_json, used_model)))) => {
            store_transcript(&db_path, episode_id, &full_text, &segments_json, &used_model, &language);
            update_transcription_status(&db_path, episode_id, "done");
            emit_and_persist(
                &on_event, &db_path, episode_id,
                PipelineEvent::StageDone { stage: "transcription".to_string(), overall_percent: TRANSCRIPTION_END },
            );
            completed_stages.push("transcription".to_string());
        }
        Ok(Ok(None)) => {
            // Transcription was skipped (already done) — stages emitted instantly before tasks launched
            completed_stages.push("transcription".to_string());
        }
        Ok(Err(e)) => {
            update_transcription_status(&db_path, episode_id, "error");
            return finish_error(&on_event, &db_path, episode_id, "transcription", &e, TRANSCRIPTION_START, &pipeline_state);
        }
        Err(e) => {
            let msg = format!("Whisper task panicked: {}", e);
            update_transcription_status(&db_path, episode_id, "error");
            return finish_error(&on_event, &db_path, episode_id, "transcription", &msg, TRANSCRIPTION_START, &pipeline_state);
        }
    }

    // ── Handle diarization result ─────────────────────────────────────────────
    match diar_result {
        Ok(Ok(Some(segments))) => {
            // Solo detection (mirrors diarization.rs logic)
            let unique_speakers: std::collections::HashSet<_> =
                segments.iter().map(|s| &s.speaker_label).collect();
            let total_ms: i64 = segments.iter().map(|s| s.end_ms - s.start_ms).sum();

            let is_solo = unique_speakers.len() <= 1 || {
                let speaker_ms = segments.iter().fold(
                    std::collections::HashMap::new(),
                    |mut m, s| {
                        *m.entry(&s.speaker_label).or_insert(0i64) += s.end_ms - s.start_ms;
                        m
                    },
                );
                let min_ms = speaker_ms.values().copied().min().unwrap_or(0);
                total_ms > 0 && (min_ms * 100 / total_ms) < 5
            };
            let final_diar_status = if is_solo { "solo" } else { "done" };

            if let Err(e) = store_diarization_segments_pipeline(&db_path, episode_id, &segments) {
                return finish_error(&on_event, &db_path, episode_id, "diarization", &e, DIARIZATION_START, &pipeline_state);
            }

            crate::commands::diarization::backfill_all_whisper_segment_text(&db_path);
            update_diarization_status_db(&db_path, episode_id, final_diar_status);

            completed_stages.push("diarization".to_string());
            emit_and_persist(
                &on_event, &db_path, episode_id,
                PipelineEvent::StageDone { stage: "diarization".to_string(), overall_percent: DIARIZATION_END },
            );
        }
        Ok(Ok(None)) => {
            // No diarization models configured — skip stage
            emit_and_persist(
                &on_event, &db_path, episode_id,
                PipelineEvent::StageDone { stage: "diarization".to_string(), overall_percent: DIARIZATION_END },
            );
            completed_stages.push("diarization".to_string());
        }
        Ok(Err(e)) => {
            update_diarization_status_db(&db_path, episode_id, "error");
            return finish_error(&on_event, &db_path, episode_id, "diarization", &e, DIARIZATION_START, &pipeline_state);
        }
        Err(e) => {
            let msg = format!("Diarization task panicked: {}", e);
            update_diarization_status_db(&db_path, episode_id, "error");
            return finish_error(&on_event, &db_path, episode_id, "diarization", &msg, DIARIZATION_START, &pipeline_state);
        }
    }

    // ── Stage 3: Topics (93–100%) ─────────────────────────────────────────────

    if cancel_token.is_cancelled() {
        finish_cancelled(&on_event, &db_path, episode_id, &completed_stages, DIARIZATION_END, &pipeline_state);
        return Ok(());
    }

    let topics_t = std::time::Instant::now();
    emit_and_persist(
        &on_event, &db_path, episode_id,
        PipelineEvent::StageStarted { stage: "topics".to_string(), overall_percent: TOPICS_START },
    );

    // Read API key (topics are optional — skip if key not configured)
    let api_key = read_openai_key(&db_path);

    if let Some(api_key) = api_key {
        // Read transcript text for LLM
        let transcript_text = read_transcript_text(&db_path, episode_id);

        if let Some(transcript_text) = transcript_text {
            // Set episode_analysis status to 'analyzing'
            if let Ok(conn) = rusqlite::Connection::open(&db_path) {
                let _ = conn.execute(
                    "INSERT OR REPLACE INTO episode_analysis (episode_id, status, topics_found, analyzed_at, error) \
                     VALUES (?, 'analyzing', 0, NULL, NULL)",
                    [episode_id],
                );
            }

            let topics_result = crate::commands::topics::run_llm_analysis(
                episode_id,
                &api_key,
                &transcript_text,
                &db_path,
            ).await;

            match topics_result {
                Ok(_topics) => {
                    completed_stages.push("topics".to_string());
                }
                Err(e) => {
                    // Topic failure doesn't halt pipeline — log error status and continue to Done
                    if let Ok(conn) = rusqlite::Connection::open(&db_path) {
                        let _ = conn.execute(
                            "UPDATE episode_analysis SET status='error', error=? WHERE episode_id=?",
                            rusqlite::params![e, episode_id],
                        );
                    }
                    // Emit error event but then still complete the pipeline (transcription + diarization done)
                    let _ = on_event.send(PipelineEvent::Error {
                        stage: "topics".to_string(),
                        message: e,
                        overall_percent: TOPICS_START,
                    });
                    // Complete the pipeline at 100% despite topic error (not a hard failure)
                    persist_pipeline_progress(&db_path, episode_id, 100, "done");
                    let total_s = pipeline_start.elapsed().as_secs_f64();
                    let topics_s = topics_t.elapsed().as_secs_f64();
                    persist_pipeline_duration(&db_path, episode_id, total_s);
                    eprintln!("[pipeline timing] ep={} download={:.1}s decode={:.1}s transcription={:.1}s diarization={:.1}s topics={:.1}s total={:.1}s",
                        episode_id, download_s, decode_s, transcription_s, diarization_s, topics_s, total_s);
                    let _ = on_event.send(PipelineEvent::Done { episode_id, timing: PipelineTiming { download_s, decode_s, transcription_s, diarization_s, topics_s, total_s } });
                    clear_pipeline_state(&pipeline_state);
                    return Ok(());
                }
            }
        } else {
            // No transcript (shouldn't happen at this stage, but guard it)
            completed_stages.push("topics".to_string());
        }
    } else {
        // No API key — skip topics stage
        completed_stages.push("topics".to_string());
    }

    // ── Pipeline complete ──────────────────────────────────────────────────────

    emit_and_persist(
        &on_event, &db_path, episode_id,
        PipelineEvent::StageDone { stage: "topics".to_string(), overall_percent: TOPICS_END },
    );

    persist_pipeline_progress(&db_path, episode_id, 100, "done");
    let total_s = pipeline_start.elapsed().as_secs_f64();
    let topics_s = topics_t.elapsed().as_secs_f64();
    persist_pipeline_duration(&db_path, episode_id, total_s);
    eprintln!("[pipeline timing] ep={} download={:.1}s decode={:.1}s transcription={:.1}s diarization={:.1}s topics={:.1}s total={:.1}s",
        episode_id, download_s, decode_s, transcription_s, diarization_s, topics_s, total_s);
    let _ = on_event.send(PipelineEvent::Done { episode_id, timing: PipelineTiming { download_s, decode_s, transcription_s, diarization_s, topics_s, total_s } });

    clear_pipeline_state(&pipeline_state);

    Ok(())
}

// ─────────────────────────────────────────────────────────────────────────────
// cancel_pipeline
// ─────────────────────────────────────────────────────────────────────────────

/// Cancel the currently active pipeline run.
/// The running start_pipeline task will detect cancellation at the next
/// stage boundary check and emit a Cancelled event.
#[tauri::command]
pub async fn cancel_pipeline(
    state: tauri::State<'_, PipelineState>,
) -> Result<(), String> {
    if let Some(token) = state.cancel_token.lock().unwrap().as_ref() {
        token.cancel();
    }
    Ok(())
}

// ─────────────────────────────────────────────────────────────────────────────
// get_pipeline_status
// ─────────────────────────────────────────────────────────────────────────────

/// Read pipeline_progress and pipeline_status for an episode from the DB.
/// Returns (progress: i32, status: String).
#[tauri::command]
pub async fn get_pipeline_status(
    app: tauri::AppHandle,
    episode_id: i64,
) -> Result<(i32, String), String> {
    let db_path = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Cannot resolve app data dir: {}", e))?
        .join("binky.db");

    let conn = rusqlite::Connection::open(&db_path)
        .map_err(|e| format!("Cannot open DB: {}", e))?;

    let result = conn.query_row(
        "SELECT COALESCE(pipeline_progress, 0), COALESCE(pipeline_status, 'idle') \
         FROM episodes WHERE id = ?1",
        rusqlite::params![episode_id],
        |row| Ok((row.get::<_, i32>(0)?, row.get::<_, String>(1)?)),
    )
    .map_err(|e| format!("DB query failed: {}", e))?;

    Ok(result)
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

/// Emit a Cancelled event and persist interrupted state.
fn finish_cancelled(
    channel: &Channel<PipelineEvent>,
    db_path: &Path,
    episode_id: i64,
    completed_stages: &[String],
    overall_percent: i32,
    pipeline_state: &PipelineState,
) {
    let _ = channel.send(PipelineEvent::Cancelled {
        completed_stages: completed_stages.to_vec(),
        overall_percent,
    });
    persist_pipeline_progress(db_path, episode_id, overall_percent, "interrupted");
    clear_pipeline_state(pipeline_state);
}

/// Emit an Error event and persist error state. Returns Ok(()) so the caller can return it.
fn finish_error(
    channel: &Channel<PipelineEvent>,
    db_path: &Path,
    episode_id: i64,
    stage: &str,
    message: &str,
    overall_percent: i32,
    pipeline_state: &PipelineState,
) -> Result<(), String> {
    let _ = channel.send(PipelineEvent::Error {
        stage: stage.to_string(),
        message: message.to_string(),
        overall_percent,
    });
    persist_pipeline_progress(db_path, episode_id, overall_percent, "error");
    clear_pipeline_state(pipeline_state);
    Ok(()) // Error communicated via the event, not via Result::Err
}

fn clear_pipeline_state(pipeline_state: &PipelineState) {
    *pipeline_state.cancel_token.lock().unwrap() = None;
    *pipeline_state.active_episode_id.lock().unwrap() = None;
}

fn persist_pipeline_duration(db_path: &Path, episode_id: i64, total_s: f64) {
    if let Ok(conn) = rusqlite::Connection::open(db_path) {
        let _ = conn.execute(
            "UPDATE episodes SET pipeline_duration_s = ?1 WHERE id = ?2",
            rusqlite::params![total_s, episode_id],
        );
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// DB helpers (local to pipeline — mirrors transcription.rs / diarization.rs)
// ─────────────────────────────────────────────────────────────────────────────

fn transcription_is_done(db_path: &Path, episode_id: i64) -> bool {
    rusqlite::Connection::open(db_path)
        .ok()
        .and_then(|conn| {
            conn.query_row(
                "SELECT transcription_status FROM episodes WHERE id = ?1",
                rusqlite::params![episode_id],
                |row| row.get::<_, String>(0),
            )
            .ok()
        })
        .map(|s| s == "done")
        .unwrap_or(false)
}

fn update_transcription_status(db_path: &Path, episode_id: i64, status: &str) {
    if let Ok(conn) = rusqlite::Connection::open(db_path) {
        let _ = conn.execute(
            "UPDATE episodes SET transcription_status = ?1, transcription_error = NULL, \
             updated_at = datetime('now') WHERE id = ?2",
            rusqlite::params![status, episode_id],
        );
    }
}

fn update_diarization_status_db(db_path: &Path, episode_id: i64, status: &str) {
    if let Ok(conn) = rusqlite::Connection::open(db_path) {
        let _ = conn.execute(
            "UPDATE episodes SET diarization_status = ?1, diarization_error = NULL, \
             updated_at = datetime('now') WHERE id = ?2",
            rusqlite::params![status, episode_id],
        );
    }
}

fn read_language_setting(db_path: &Path) -> String {
    match rusqlite::Connection::open(db_path) {
        Ok(conn) => {
            let result: rusqlite::Result<String> = conn.query_row(
                "SELECT value FROM settings WHERE key = 'whisper_language' LIMIT 1",
                [],
                |row| row.get(0),
            );
            result.unwrap_or_else(|_| "de".to_string())
        }
        Err(_) => "de".to_string(),
    }
}

fn read_openai_key(db_path: &Path) -> Option<String> {
    let conn = rusqlite::Connection::open(db_path).ok()?;
    let key: Option<String> = conn.query_row(
        "SELECT value FROM settings WHERE key = 'openai_api_key'",
        [],
        |row| row.get(0),
    ).ok().flatten();
    key.filter(|k| !k.is_empty())
}

fn read_transcript_text(db_path: &Path, episode_id: i64) -> Option<String> {
    let conn = rusqlite::Connection::open(db_path).ok()?;
    let text: Option<String> = conn.query_row(
        "SELECT full_text FROM transcripts WHERE episode_id = ?",
        [episode_id],
        |row| row.get(0),
    ).ok()?;
    text.filter(|t| !t.is_empty())
}

fn store_transcript(
    db_path: &Path,
    episode_id: i64,
    full_text: &str,
    segments_json: &str,
    model_name: &str,
    language: &str,
) {
    if let Ok(conn) = rusqlite::Connection::open(db_path) {
        let _ = conn.execute(
            "INSERT OR REPLACE INTO transcripts \
             (episode_id, full_text, segments_json, whisper_model, language, created_at) \
             VALUES (?1, ?2, ?3, ?4, ?5, datetime('now'))",
            rusqlite::params![episode_id, full_text, segments_json, model_name, language],
        );
    }
}

fn store_diarization_segments_pipeline(
    db_path: &Path,
    episode_id: i64,
    segments: &[crate::models::diarization::DiarizationSegment],
) -> Result<(), String> {
    let conn = rusqlite::Connection::open(db_path)
        .map_err(|e| format!("Failed to open DB: {}", e))?;

    conn.execute("BEGIN", []).map_err(|e| format!("Failed to begin tx: {}", e))?;
    conn.execute(
        "DELETE FROM diarization_segments WHERE episode_id = ?1",
        rusqlite::params![episode_id],
    ).map_err(|e| format!("Failed to delete existing segments: {}", e))?;

    for seg in segments {
        conn.execute(
            "INSERT INTO diarization_segments \
             (episode_id, start_ms, end_ms, speaker_label, confidence) \
             VALUES (?1, ?2, ?3, ?4, ?5)",
            rusqlite::params![episode_id, seg.start_ms, seg.end_ms, seg.speaker_label, seg.confidence],
        ).map_err(|e| format!("Failed to insert segment: {}", e))?;
    }

    conn.execute("COMMIT", []).map_err(|e| format!("Failed to commit tx: {}", e))?;
    Ok(())
}

// ─────────────────────────────────────────────────────────────────────────────
// Model discovery helpers
// ─────────────────────────────────────────────────────────────────────────────

async fn find_whisper_model(app: &tauri::AppHandle) -> Option<(String, std::path::PathBuf)> {
    let models_dir = app
        .path()
        .app_local_data_dir()
        .ok()?
        .join("models");

    let mut read_dir = tokio::fs::read_dir(&models_dir).await.ok()?;
    while let Ok(Some(entry)) = read_dir.next_entry().await {
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with("ggml-") && name.ends_with(".bin") {
            let model_name = name
                .trim_start_matches("ggml-")
                .trim_end_matches(".bin")
                .to_string();
            return Some((model_name, entry.path()));
        }
    }
    None
}

const DIAR_EMBEDDING_FILENAME: &str = "wespeaker_en_voxceleb_resnet34_LM.onnx";

async fn find_diarization_models(
    app: &tauri::AppHandle,
) -> Result<(std::path::PathBuf, std::path::PathBuf), String> {
    let models_dir = app
        .path()
        .app_local_data_dir()
        .map_err(|e| format!("Cannot resolve app local data dir: {}", e))?
        .join("models")
        .join("diarization");

    let seg_path = models_dir.join("segmentation").join("model.onnx");
    let emb_path = models_dir.join("embedding").join(DIAR_EMBEDDING_FILENAME);

    if !seg_path.exists() || !emb_path.exists() {
        return Err("Diarization models not downloaded".to_string());
    }

    Ok((seg_path, emb_path))
}

