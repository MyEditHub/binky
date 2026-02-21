use tauri::Manager;
use tauri_plugin_http::reqwest;
use scraper::{Html, Selector};
use rusqlite::Connection;
use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct BirdProfile {
    pub id: i64,
    pub name_de: String,
    pub name_sci: Option<String>,
    pub image_url: Option<String>,
    pub nabu_url: String,
    pub content_html: Option<String>,
    pub used: bool,
    pub used_date: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct UsedBirdEntry {
    pub id: i64,
    pub bird_id: i64,
    pub bird_name_de: String,
    pub bird_nabu_url: String,
    pub episode_title: Option<String>,
    pub used_date: String,
}

#[derive(Debug, Serialize)]
pub struct BirdPoolStatus {
    pub total: i64,
    pub used: i64,
    pub available: i64,
}

/// Fetch a NABU bird profile page and extract scientific name, image URL, and content HTML.
/// Returns (name_sci, image_url, content_html).
/// IMPORTANT: This is an async function that must NOT hold a rusqlite Connection.
async fn fetch_profile_from_nabu(
    nabu_url: &str,
) -> Result<(Option<String>, Option<String>, Option<String>), String> {
    let html = reqwest::get(nabu_url)
        .await
        .map_err(|e| format!("Netzwerkfehler: {}", e))?
        .text()
        .await
        .map_err(|e| format!("Netzwerkfehler beim Lesen: {}", e))?;

    let document = Html::parse_document(&html);

    // Extract scientific name from h2
    let name_sci = {
        let sel = Selector::parse("h2").map_err(|e| format!("Selector error: {:?}", e))?;
        document
            .select(&sel)
            .next()
            .map(|el| el.text().collect::<String>())
            .map(|s| s.trim_matches('_').trim().to_string())
            .filter(|s| !s.is_empty())
    };

    // Extract image URL: prefer vogelportraets path, fallback to imperia path
    let image_url = {
        let sel1 = Selector::parse("img[src*='/downloads/vogelportraets/']")
            .map_err(|e| format!("Selector error: {:?}", e))?;
        let sel2 = Selector::parse("img[src*='/imperia/md/nabu/images/']")
            .map_err(|e| format!("Selector error: {:?}", e))?;

        let src = document
            .select(&sel1)
            .next()
            .and_then(|el| el.value().attr("src"))
            .or_else(|| {
                document
                    .select(&sel2)
                    .next()
                    .and_then(|el| el.value().attr("src"))
            })
            .map(|s| s.to_string());

        src.map(|s| {
            if s.starts_with("http") {
                s
            } else {
                format!("https://www.nabu.de{}", s)
            }
        })
    };

    // Extract content as clean text-only HTML: grab p/h3/h4/li from article or main,
    // convert to plain text (strips all links, buttons, nav), wrap in safe tags.
    // This avoids scraped website chrome from appearing in the info panel.
    let content_html = {
        // Try article first, then main, then fall back to whole document
        let sel = Selector::parse(
            "article p, article h3, article h4, article li, \
             main p, main h3, main h4, main li",
        )
        .map_err(|e| format!("Selector error: {:?}", e))?;

        let mut parts: Vec<String> = Vec::new();
        for el in document.select(&sel) {
            let text = el.text().collect::<String>();
            let text = text.trim();
            // Skip very short fragments — navigation links, labels, etc.
            if text.len() < 15 {
                continue;
            }
            let tag = match el.value().name() {
                "h3" | "h4" => "h4",
                "li" => "li",
                _ => "p",
            };
            // Escape HTML entities in the plain text before wrapping
            let escaped = text
                .replace('&', "&amp;")
                .replace('<', "&lt;")
                .replace('>', "&gt;");
            parts.push(format!("<{}>{}</{}>", tag, escaped, tag));
        }

        if parts.is_empty() { None } else { Some(parts.join("\n")) }
    };

    Ok((name_sci, image_url, content_html))
}

/// Scrape NABU bird index and populate the birds table with discovered entries.
#[tauri::command]
pub async fn fetch_nabu_bird_list(
    app: tauri::AppHandle,
) -> Result<BirdPoolStatus, String> {
    let db_path = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("binky.db");

    // Fetch NABU index page
    let html = reqwest::get(
        "https://www.nabu.de/tiere-und-pflanzen/voegel/portraets/index.html",
    )
    .await
    .map_err(|e| format!("Netzwerkfehler: {}", e))?
    .text()
    .await
    .map_err(|e| format!("Netzwerkfehler beim Lesen: {}", e))?;

    let document = Html::parse_document(&html);
    let selector = Selector::parse("a[href*='/voegel/portraets/']")
        .map_err(|e| format!("Selector error: {:?}", e))?;

    // Collect all candidate birds
    let mut candidates: Vec<(String, String, String)> = Vec::new(); // (name, full_url, slug)
    for el in document.select(&selector) {
        let name = el.text().collect::<String>().trim().to_string();
        let href = match el.value().attr("href") {
            Some(h) => h.to_string(),
            None => continue,
        };

        // Skip: index page itself, short names, no slug after /portraets/
        if href == "/tiere-und-pflanzen/voegel/portraets/index.html" {
            continue;
        }
        if !href.contains("/voegel/portraets/") {
            continue;
        }
        if name.len() <= 2 {
            continue;
        }

        let full_url = format!("https://www.nabu.de{}", href);

        // Extract slug: last non-empty path segment
        let slug = href
            .split('/')
            .filter(|s| !s.is_empty())
            .last()
            .unwrap_or("")
            .to_string();

        if slug.is_empty() {
            continue;
        }

        candidates.push((name, full_url, slug));
    }

    // Open DB and do bulk inserts in a transaction
    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;

    let tx = conn
        .unchecked_transaction()
        .map_err(|e| e.to_string())?;

    for (name, full_url, slug) in &candidates {
        // Check if already exists by nabu_url
        let exists: i64 = tx
            .query_row(
                "SELECT COUNT(*) FROM birds WHERE nabu_url = ?1",
                [full_url],
                |row| row.get(0),
            )
            .unwrap_or(0);

        if exists == 0 {
            tx.execute(
                "INSERT INTO birds (name, nabu_url, nabu_slug) VALUES (?1, ?2, ?3)",
                rusqlite::params![name, full_url, slug],
            )
            .map_err(|e| e.to_string())?;
        }
    }

    tx.commit().map_err(|e| e.to_string())?;

    // Return pool status
    let total: i64 = conn
        .query_row("SELECT COUNT(*) FROM birds", [], |row| row.get(0))
        .map_err(|e| e.to_string())?;
    let used: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM birds WHERE used = 1",
            [],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    Ok(BirdPoolStatus {
        total,
        used,
        available: total - used,
    })
}

/// Select a random unused bird, fetch and cache its NABU profile, set as current bird.
#[tauri::command]
pub async fn draw_random_bird(
    app: tauri::AppHandle,
) -> Result<BirdProfile, String> {
    let db_path = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("binky.db");

    // Step 1: Select random unused bird (open connection, do DB work, drop it)
    let (bird_id, bird_name, bird_nabu_url) = {
        let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;
        conn.query_row(
            "SELECT id, name, nabu_url FROM birds WHERE used = 0 ORDER BY RANDOM() LIMIT 1",
            [],
            |row| Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?, row.get::<_, String>(2)?)),
        )
        .map_err(|e| {
            if e == rusqlite::Error::QueryReturnedNoRows {
                "pool_exhausted".to_string()
            } else {
                e.to_string()
            }
        })?
    }; // conn dropped here

    // Step 2: Fetch live profile from NABU (async work — no DB connection held)
    let (name_sci, image_url, content_html) = fetch_profile_from_nabu(&bird_nabu_url).await?;

    // Step 3: Open new connection to cache results and persist current bird
    {
        let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;
        conn.execute(
            "UPDATE birds SET scientific_name = ?1, image_url = ?2, cached_content_html = ?3, cached_at = datetime('now') WHERE id = ?4",
            rusqlite::params![name_sci, image_url, content_html, bird_id],
        )
        .map_err(|e| e.to_string())?;

        conn.execute(
            "INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('current_bird_id', ?1, datetime('now'))",
            rusqlite::params![bird_id.to_string()],
        )
        .map_err(|e| e.to_string())?;
    }

    Ok(BirdProfile {
        id: bird_id,
        name_de: bird_name,
        name_sci,
        image_url,
        nabu_url: bird_nabu_url,
        content_html,
        used: false,
        used_date: None,
    })
}

/// Fetch or return cached profile for a specific bird by NABU URL.
#[tauri::command]
pub async fn fetch_bird_profile(
    nabu_url: String,
    app: tauri::AppHandle,
) -> Result<BirdProfile, String> {
    let db_path = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("binky.db");

    // Step 1: Look up bird in DB (open, query, drop)
    let (bird_id, bird_name, bird_used, bird_used_date, cached_html): (
        i64,
        String,
        bool,
        Option<String>,
        Option<String>,
    ) = {
        let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;
        conn.query_row(
            "SELECT id, name, used, used_date, cached_content_html FROM birds WHERE nabu_url = ?1",
            [&nabu_url],
            |row| {
                let used_int: i64 = row.get(2)?;
                Ok((
                    row.get::<_, i64>(0)?,
                    row.get::<_, String>(1)?,
                    used_int != 0,
                    row.get::<_, Option<String>>(3)?,
                    row.get::<_, Option<String>>(4)?,
                ))
            },
        )
        .map_err(|e| {
            if e == rusqlite::Error::QueryReturnedNoRows {
                "Vogel nicht gefunden".to_string()
            } else {
                e.to_string()
            }
        })?
    }; // conn dropped here

    // Step 2: Try live fetch (async — no DB connection held)
    let live_result = fetch_profile_from_nabu(&nabu_url).await;

    match live_result {
        Ok((name_sci, image_url, content_html)) => {
            // Update cache
            {
                let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;
                conn.execute(
                    "UPDATE birds SET scientific_name = ?1, image_url = ?2, cached_content_html = ?3, cached_at = datetime('now') WHERE id = ?4",
                    rusqlite::params![name_sci, image_url, content_html, bird_id],
                )
                .map_err(|e| e.to_string())?;
            }
            Ok(BirdProfile {
                id: bird_id,
                name_de: bird_name,
                name_sci,
                image_url,
                nabu_url,
                content_html,
                used: bird_used,
                used_date: bird_used_date,
            })
        }
        Err(fetch_err) => {
            // Fall back to cached data if available
            if cached_html.is_some() {
                // Read cached scientific_name and image_url from DB
                let (cached_sci, cached_img): (Option<String>, Option<String>) = {
                    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;
                    conn.query_row(
                        "SELECT scientific_name, image_url FROM birds WHERE id = ?1",
                        [bird_id],
                        |row| Ok((row.get(0)?, row.get(1)?)),
                    )
                    .unwrap_or((None, None))
                };
                Ok(BirdProfile {
                    id: bird_id,
                    name_de: bird_name,
                    name_sci: cached_sci,
                    image_url: cached_img,
                    nabu_url,
                    content_html: cached_html,
                    used: bird_used,
                    used_date: bird_used_date,
                })
            } else {
                Err(fetch_err)
            }
        }
    }
}

/// Mark a bird as used and insert a history entry with optional episode linkage.
#[tauri::command]
pub async fn mark_bird_used(
    bird_id: i64,
    episode_title: Option<String>,
    app: tauri::AppHandle,
) -> Result<(), String> {
    let db_path = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("binky.db");
    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;

    conn.execute(
        "UPDATE birds SET used = 1, used_date = date('now') WHERE id = ?1",
        [bird_id],
    )
    .map_err(|e| e.to_string())?;

    let (name, url): (String, String) = conn
        .query_row(
            "SELECT name, nabu_url FROM birds WHERE id = ?1",
            [bird_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT INTO bird_used_history (bird_id, bird_name_de, bird_nabu_url, episode_title, used_date) VALUES (?1, ?2, ?3, ?4, date('now'))",
        rusqlite::params![bird_id, name, url, episode_title],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

/// Undo the most recent use marking for a bird.
#[tauri::command]
pub async fn undo_mark_bird_used(
    bird_id: i64,
    app: tauri::AppHandle,
) -> Result<(), String> {
    let db_path = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("binky.db");
    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;

    // Delete most recent history entry for this bird
    conn.execute(
        "DELETE FROM bird_used_history WHERE id = (SELECT id FROM bird_used_history WHERE bird_id = ?1 ORDER BY used_date DESC, id DESC LIMIT 1)",
        [bird_id],
    )
    .map_err(|e| e.to_string())?;

    // Reset bird used status
    conn.execute(
        "UPDATE birds SET used = 0, used_date = NULL WHERE id = ?1",
        [bird_id],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

/// Reset all birds to unused and clear the history table.
#[tauri::command]
pub async fn reset_bird_pool(
    app: tauri::AppHandle,
) -> Result<(), String> {
    let db_path = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("binky.db");
    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;

    conn.execute("UPDATE birds SET used = 0, used_date = NULL", [])
        .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM bird_used_history", [])
        .map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('current_bird_id', '', datetime('now'))",
        [],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

/// Return the bird use history sorted newest first.
#[tauri::command]
pub async fn get_bird_history(
    app: tauri::AppHandle,
) -> Result<Vec<UsedBirdEntry>, String> {
    let db_path = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("binky.db");
    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT id, bird_id, bird_name_de, bird_nabu_url, episode_title, used_date FROM bird_used_history ORDER BY used_date DESC, id DESC",
        )
        .map_err(|e| e.to_string())?;

    let entries = stmt
        .query_map([], |row| {
            Ok(UsedBirdEntry {
                id: row.get(0)?,
                bird_id: row.get(1)?,
                bird_name_de: row.get(2)?,
                bird_nabu_url: row.get(3)?,
                episode_title: row.get(4)?,
                used_date: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let result: Result<Vec<_>, _> = entries.collect();
    result.map_err(|e| e.to_string())
}

/// Load the persisted current bird from settings.
#[tauri::command]
pub async fn get_current_bird(
    app: tauri::AppHandle,
) -> Result<Option<BirdProfile>, String> {
    let db_path = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("binky.db");
    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;

    // Read current_bird_id from settings
    let bird_id_str: Option<String> = conn
        .query_row(
            "SELECT value FROM settings WHERE key = 'current_bird_id'",
            [],
            |row| row.get(0),
        )
        .ok();

    let Some(id_str) = bird_id_str else {
        return Ok(None);
    };
    if id_str.is_empty() {
        return Ok(None);
    }

    let bird_id: i64 = id_str
        .parse()
        .map_err(|_| "Ungültige current_bird_id in settings".to_string())?;

    let result = conn.query_row(
        "SELECT id, name, scientific_name, image_url, nabu_url, cached_content_html, used, used_date FROM birds WHERE id = ?1",
        [bird_id],
        |row| {
            let used_int: i64 = row.get(6)?;
            Ok(BirdProfile {
                id: row.get(0)?,
                name_de: row.get(1)?,
                name_sci: row.get(2)?,
                image_url: row.get(3)?,
                nabu_url: row.get(4)?,
                content_html: row.get(5)?,
                used: used_int != 0,
                used_date: row.get(7)?,
            })
        },
    );

    match result {
        Ok(bird) => Ok(Some(bird)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}
