use tauri::Manager;
use serde::Serialize;

/// Structured search result returned to the frontend via invoke().
/// Field names are part of the Phase 12 API contract — do not rename.
#[derive(Debug, Serialize)]
pub struct SearchResult {
    pub episode_id: i64,
    pub title: String,
    pub speaker: Option<String>,
    pub snippet: String,
    pub segment_type: String,
    pub start_ms: Option<i64>,
    pub end_ms: Option<i64>,
}

/// Sanitize user input for FTS5 MATCH syntax.
/// Removes special FTS5 characters: " ( ) : ^ * and reserved keywords.
/// Appends * to the last token for prefix matching.
fn build_fts_query(input: &str) -> String {
    // Keep alphanumeric, whitespace, hyphens; strip everything FTS5 reserves
    let sanitized: String = input
        .chars()
        .filter(|c| c.is_alphanumeric() || c.is_whitespace() || *c == '-')
        .collect();

    let words: Vec<&str> = sanitized.split_whitespace().collect();
    if words.is_empty() {
        return String::new();
    }

    // All words except last: exact match (AND semantics is FTS5 default)
    // Last word: prefix match with * for type-as-you-search
    let mut parts: Vec<String> = words[..words.len() - 1]
        .iter()
        .map(|w| w.to_string())
        .collect();
    parts.push(format!("{}*", words.last().unwrap()));
    parts.join(" ")
}

/// Search all indexed transcript text, episode titles, and topic summaries.
///
/// Arguments:
///   query: The search term (minimum 2 characters after trimming)
///   limit: Maximum results (default 20, capped at 100)
///
/// Returns Vec<SearchResult> sorted by BM25 relevance (best first).
/// Returns Ok([]) for queries shorter than 2 chars or that sanitize to empty.
/// Returns Ok([]) (not Err) on FTS5 syntax errors — prevents frontend error toasts on bad input.
#[tauri::command]
pub fn search_transcripts(
    query: String,
    limit: Option<i64>,
    app: tauri::AppHandle,
) -> Result<Vec<SearchResult>, String> {
    let query = query.trim();
    if query.len() < 2 {
        return Ok(vec![]);
    }

    let db_path = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("binky.db");
    let conn = rusqlite::Connection::open(&db_path).map_err(|e| e.to_string())?;

    let max_results = limit.unwrap_or(20).min(100);

    let fts_query = build_fts_query(query);
    if fts_query.is_empty() {
        return Ok(vec![]);
    }

    // snippet() arguments:
    //   column_index=3 → segment_text (4th declared column, 0-based)
    //   open_markup='' (no HTML — Phase 12 handles highlighting)
    //   close_markup=''
    //   ellipsis='...'
    //   max_tokens=40 (≈ 250 chars depending on word length)
    let sql = "
        SELECT episode_id, episode_title, speaker, segment_type, start_ms, end_ms,
               snippet(search_index, 3, '', '', '...', 40)
        FROM search_index
        WHERE search_index MATCH ?1
        ORDER BY bm25(search_index)
        LIMIT ?2
    ";

    let mut stmt = match conn.prepare(sql) {
        Ok(s) => s,
        Err(_) => return Ok(vec![]),
    };

    let results = match stmt.query_map(rusqlite::params![fts_query, max_results], |row| {
        Ok(SearchResult {
            episode_id: row.get(0)?,
            title: row.get(1)?,
            speaker: row.get(2)?,
            segment_type: row.get(3)?,
            start_ms: row.get(4)?,
            end_ms: row.get(5)?,
            snippet: row.get(6)?,
        })
    }) {
        Ok(mapped) => mapped.filter_map(|r| r.ok()).collect::<Vec<_>>(),
        Err(_) => vec![],
    };

    Ok(results)
}

/// Rebuild the entire FTS5 search index from stored content.
/// Use when the index is suspected corrupt or after bulk data changes outside triggers.
/// This is the FTS5 'rebuild' special command — it re-derives all index data.
#[tauri::command]
pub fn rebuild_search_index(app: tauri::AppHandle) -> Result<(), String> {
    let db_path = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("binky.db");
    let conn = rusqlite::Connection::open(&db_path).map_err(|e| e.to_string())?;

    conn.execute("INSERT INTO search_index(search_index) VALUES('rebuild')", [])
        .map_err(|e| e.to_string())?;

    Ok(())
}
