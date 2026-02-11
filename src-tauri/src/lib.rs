use tauri_plugin_sql::{Builder as SqlBuilder, Migration, MigrationKind};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize Sentry BEFORE Tauri builder
    // DSN is optional - if not set, Sentry initializes but doesn't send events
    let dsn = option_env!("SENTRY_DSN").unwrap_or("");
    let client = sentry::init((
        dsn,
        sentry::ClientOptions {
            release: sentry::release_name!(),
            auto_session_tracking: true,
            ..Default::default()
        },
    ));

    // Guard keeps Sentry active for app lifetime
    let _guard = client;

    let migrations = vec![
        Migration {
            version: 1,
            description: "create_initial_tables",
            sql: include_str!("../migrations/001_initial.sql"),
            kind: MigrationKind::Up,
        },
    ];

    tauri::Builder::default()
        .plugin(tauri_plugin_sentry::init_with_no_injection(&_guard))
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
