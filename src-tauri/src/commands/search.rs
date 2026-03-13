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

/// A related episode result returned by fetch_related_episodes.
/// episode_number may be NULL for episodes without a number assigned.
#[derive(Debug, Serialize)]
pub struct RelatedEpisode {
    pub episode_id: i64,
    pub episode_title: String,
    pub episode_number: Option<i64>,
}

/// German stop-words stripped from topic titles before building the FTS5 query.
/// Prevents high-frequency words from dominating BM25 scores.
const STOP_WORDS: &[&str] = &[
    "die", "der", "das", "und", "in", "mit", "für", "von", "zu", "ein",
    "eine", "auf", "an", "ist", "es", "er", "sie", "wir", "ich", "du",
    "nicht", "auch", "als", "aber", "oder", "wie", "bei", "dem", "den",
    "im", "am", "zum", "zur", "des", "ein", "eine", "eines", "einer",
];

/// Build an OR-query from the significant words in a topic title.
/// Strips German stop-words and single-character tokens; joins remaining with " OR ".
/// Returns None if all tokens are stop-words (caller skips the FTS query).
fn build_topic_fts_query(title: &str) -> Option<String> {
    // Reuse sanitization: keep alphanumeric/whitespace/hyphens
    let sanitized: String = title
        .chars()
        .filter(|c| c.is_alphanumeric() || c.is_whitespace() || *c == '-')
        .collect();

    let significant: Vec<String> = sanitized
        .split_whitespace()
        .filter(|w| w.len() > 1 && !STOP_WORDS.contains(&w.to_lowercase().as_str()))
        .map(|w| w.to_string())
        .collect();

    if significant.is_empty() {
        return None;
    }

    Some(significant.join(" OR "))
}

/// Return related episodes for a batch of topic IDs.
///
/// For each topic_id:
///   1. Look up the topic title and source episode_id from the topics table.
///   2. Strip stop-words from the title to form an OR FTS5 query.
///   3. Query search_index WHERE segment_type='topic' AND episode_id != source,
///      ordered by BM25, LIMIT 10 (to allow deduplication).
///   4. Deduplicate by episode_id (keep best-ranked row per episode), take top 3.
///
/// Empty query (all stop-words) → store empty Vec for that topic_id, continue.
/// Any per-topic error → store empty Vec, continue (never propagate per-topic errors).
/// Returns Err only on db open failure.
#[tauri::command]
pub fn fetch_related_episodes(
    topic_ids: Vec<i64>,
    app: tauri::AppHandle,
) -> Result<std::collections::HashMap<i64, Vec<RelatedEpisode>>, String> {
    if topic_ids.is_empty() {
        return Ok(std::collections::HashMap::new());
    }

    let db_path = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("binky.db");
    let conn = rusqlite::Connection::open(&db_path).map_err(|e| e.to_string())?;

    let mut result_map: std::collections::HashMap<i64, Vec<RelatedEpisode>> =
        std::collections::HashMap::new();

    for topic_id in &topic_ids {
        // 1. Fetch topic title + source episode_id
        let topic_info: Option<(String, Option<i64>)> = conn
            .query_row(
                "SELECT title, detected_from_episode_id FROM topics WHERE id = ?1",
                rusqlite::params![topic_id],
                |row| Ok((row.get::<_, String>(0)?, row.get::<_, Option<i64>>(1)?)),
            )
            .ok();

        let (title, source_episode_id) = match topic_info {
            Some(v) => v,
            None => {
                result_map.insert(*topic_id, vec![]);
                continue;
            }
        };

        // 2. Build FTS5 OR query from significant keywords
        let fts_query = match build_topic_fts_query(&title) {
            Some(q) => q,
            None => {
                result_map.insert(*topic_id, vec![]);
                continue;
            }
        };

        // 3. Query search_index for related topic rows, excluding source episode.
        //    JOIN episodes to get episode_number.
        //    LIMIT 10 to allow deduplication before taking top 3.
        let exclude_id = source_episode_id.unwrap_or(-1); // -1 never matches a real id

        let sql = "
            SELECT si.episode_id, si.episode_title, e.episode_number
            FROM search_index si
            LEFT JOIN episodes e ON e.id = si.episode_id
            WHERE search_index MATCH ?1
              AND si.segment_type = 'topic'
              AND si.episode_id != ?2
            ORDER BY bm25(search_index)
            LIMIT 10
        ";

        let mut stmt = match conn.prepare(sql) {
            Ok(s) => s,
            Err(_) => {
                result_map.insert(*topic_id, vec![]);
                continue;
            }
        };
        let rows: Vec<(i64, String, Option<i64>)> =
            match stmt.query_map(rusqlite::params![fts_query, exclude_id], |row| {
                Ok((
                    row.get::<_, i64>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, Option<i64>>(2)?,
                ))
            }) {
                Ok(mapped) => mapped.filter_map(|r| r.ok()).collect(),
                Err(_) => {
                    result_map.insert(*topic_id, vec![]);
                    continue;
                }
            };

        // 4. Deduplicate by episode_id (preserve BM25 order = first occurrence wins),
        //    then take top 3 unique episodes.
        let mut seen = std::collections::HashSet::new();
        let deduped: Vec<RelatedEpisode> = rows
            .into_iter()
            .filter(|(eid, _, _)| seen.insert(*eid))
            .take(3)
            .map(|(episode_id, episode_title, episode_number)| RelatedEpisode {
                episode_id,
                episode_title,
                episode_number,
            })
            .collect();

        result_map.insert(*topic_id, deduped);
    }

    Ok(result_map)
}
