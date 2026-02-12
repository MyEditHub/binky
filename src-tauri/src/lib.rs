use tauri_plugin_sql::{Builder as SqlBuilder, Migration, MigrationKind};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize Sentry BEFORE Tauri builder (only if DSN is provided)
    let _guard = if let Some(dsn) = option_env!("SENTRY_DSN") {
        if !dsn.is_empty() {
            Some(sentry::init((
                dsn,
                sentry::ClientOptions {
                    release: sentry::release_name!(),
                    auto_session_tracking: true,
                    ..Default::default()
                },
            )))
        } else {
            None
        }
    } else {
        None
    };

    let migrations = vec![
        Migration {
            version: 1,
            description: "create_initial_tables",
            sql: include_str!("../migrations/001_initial.sql"),
            kind: MigrationKind::Up,
        },
    ];

    let mut builder = tauri::Builder::default();

    // Add Sentry plugin only if initialized
    if let Some(ref guard) = _guard {
        builder = builder.plugin(tauri_plugin_sentry::init_with_no_injection(guard));
    }

    builder
        .plugin(
            SqlBuilder::default()
                .add_migrations("sqlite:nettgefluester.db", migrations)
                .build()
        )
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_fs::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
