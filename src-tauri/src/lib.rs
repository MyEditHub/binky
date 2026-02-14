use std::sync::Arc;
use tauri_plugin_sql::{Builder as SqlBuilder, Migration, MigrationKind};

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
        .invoke_handler(tauri::generate_handler![
            commands::episodes::sync_rss,
            commands::transcription::get_model_status,
            commands::transcription::download_whisper_model,
            commands::transcription::delete_whisper_model,
            commands::transcription::start_transcription,
            commands::transcription::cancel_transcription,
            commands::transcription::get_queue_status,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
