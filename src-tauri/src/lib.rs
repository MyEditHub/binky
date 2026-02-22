use std::sync::Arc;
use tauri::Manager;
use tauri_plugin_sql::{Builder as SqlBuilder, Migration, MigrationKind};
use state::diarization_queue::DiarizationState;

mod commands;
mod models;
mod state;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize Sentry before Tauri (only when DSN is provided at compile time)
    let _sentry = option_env!("SENTRY_DSN").filter(|s| !s.is_empty()).map(|dsn| {
        sentry::init((
            dsn,
            sentry::ClientOptions {
                release: sentry::release_name!(),
                ..Default::default()
            },
        ))
    });

    let migrations = vec![
        Migration {
            version: 1,
            description: "create_initial_tables",
            sql: include_str!("../migrations/001_initial.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "episodes_transcripts",
            sql: include_str!("../migrations/002_episodes_transcripts.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "diarization_schema",
            sql: include_str!("../migrations/003_diarization.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 4,
            description: "topics_enhanced",
            sql: include_str!("../migrations/004_topics_enhanced.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 5,
            description: "birds_enhanced",
            sql: include_str!("../migrations/005_birds_enhanced.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 6,
            description: "Clear test bird history",
            sql: include_str!("../migrations/006_clear_test_bird_history.sql"),
            kind: MigrationKind::Up,
        },
    ];

    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .plugin(
            SqlBuilder::default()
                .add_migrations("sqlite:binky.db", migrations)
                .build(),
        )
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        // Manage Arc<TranscriptionState> so we can clone it into async tasks
        .manage(Arc::new(state::transcription_queue::TranscriptionState::new()))
        .manage(Arc::new(DiarizationState::new()))
        .setup(|app| {
            // Reset any in-flight transcription statuses left over from a previous
            // crashed/force-quit session. The in-memory queue is empty on every
            // startup, so 'queued'/'downloading'/'transcribing' states are stale.
            if let Ok(db_path) = app.path().app_data_dir().map(|d: std::path::PathBuf| d.join("binky.db")) {
                if let Ok(conn) = rusqlite::Connection::open(&db_path) {
                    let _ = conn.execute(
                        "UPDATE episodes \
                         SET transcription_status = 'not_started', transcription_error = NULL \
                         WHERE transcription_status IN ('queued', 'downloading', 'transcribing')",
                        [],
                    );
                    let _ = conn.execute(
                        "UPDATE episodes \
                         SET diarization_status = 'not_started', diarization_error = NULL \
                         WHERE diarization_status IN ('queued', 'processing')",
                        [],
                    );
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::episodes::sync_rss,
            commands::transcription::get_model_status,
            commands::transcription::download_whisper_model,
            commands::transcription::delete_whisper_model,
            commands::transcription::start_transcription,
            commands::transcription::cancel_transcription,
            commands::transcription::get_queue_status,
            commands::diarization::get_diarization_model_status,
            commands::diarization::download_diarization_models,
            commands::diarization::delete_diarization_models,
            commands::diarization::start_diarization,
            commands::diarization::cancel_diarization,
            commands::diarization::get_diarization_queue_status,
            commands::topics::analyze_episode_topics,
            commands::topics::get_episode_analysis_status,
            commands::topics::has_openai_key_configured,
            commands::birds::fetch_nabu_bird_list,
            commands::birds::draw_random_bird,
            commands::birds::fetch_bird_profile,
            commands::birds::mark_bird_used,
            commands::birds::undo_mark_bird_used,
            commands::birds::reset_bird_pool,
            commands::birds::get_bird_history,
            commands::birds::get_current_bird,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
