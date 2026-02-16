use tauri::Manager;
use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct DetectedTopic {
    pub id: i64,
    pub title: String,
    pub description: String,
    pub ai_reason: String,
    pub confidence: f64,
    pub detected_from_episode_id: i64,
}

#[derive(Debug, Serialize)]
pub struct AnalysisStatus {
    pub episode_id: i64,
    pub status: String,
    pub topics_found: i64,
    pub error: Option<String>,
}

// LLM response helpers (not serialized to frontend)
#[derive(Debug, serde::Deserialize)]
struct LlmTopicsResponse {
    topics: Vec<LlmTopic>,
}

#[derive(Debug, serde::Deserialize)]
struct LlmTopic {
    title: String,
    description: String,
    reason: String,
    confidence: f64,
}

/// Analyze a single episode's transcript for unfinished topics using LLM.
#[tauri::command]
pub async fn analyze_episode_topics(
    episode_id: i64,
    app: tauri::AppHandle,
) -> Result<Vec<DetectedTopic>, String> {
    let db_path = app.path().app_data_dir()
        .map_err(|e| e.to_string())?
        .join("binky.db");

    // Step 1: Read API key from settings
    let api_key = {
        let conn = rusqlite::Connection::open(&db_path)
            .map_err(|e| e.to_string())?;
        let key: Option<String> = conn.query_row(
            "SELECT value FROM settings WHERE key = 'openai_api_key'",
            [],
            |row| row.get(0),
        ).ok().flatten();
        match key {
            Some(k) if !k.is_empty() => k,
            _ => return Err("Kein OpenAI API-Schlüssel konfiguriert".to_string()),
        }
    };

    // Step 2: Read transcript text
    let transcript_text = {
        let conn = rusqlite::Connection::open(&db_path)
            .map_err(|e| e.to_string())?;
        let text: Option<String> = conn.query_row(
            "SELECT full_text FROM transcripts WHERE episode_id = ?",
            [episode_id],
            |row| row.get(0),
        ).ok();
        match text {
            Some(t) if !t.is_empty() => t,
            _ => return Err("Kein Transkript für diese Episode gefunden".to_string()),
        }
    };

    // Step 3: Set episode_analysis status to 'analyzing'
    {
        let conn = rusqlite::Connection::open(&db_path)
            .map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT OR REPLACE INTO episode_analysis (episode_id, status, topics_found, analyzed_at, error)
             VALUES (?, 'analyzing', 0, NULL, NULL)",
            [episode_id],
        ).map_err(|e| e.to_string())?;
    }

    // Step 4: Call LLM (error path updates episode_analysis status='error')
    let result = run_llm_analysis(episode_id, &api_key, &transcript_text, &db_path).await;

    match result {
        Ok(topics) => Ok(topics),
        Err(err_msg) => {
            // Update episode_analysis with error status
            if let Ok(conn) = rusqlite::Connection::open(&db_path) {
                let _ = conn.execute(
                    "UPDATE episode_analysis SET status='error', error=? WHERE episode_id=?",
                    rusqlite::params![err_msg, episode_id],
                );
            }
            Err(err_msg)
        }
    }
}

async fn run_llm_analysis(
    episode_id: i64,
    api_key: &str,
    transcript_text: &str,
    db_path: &std::path::Path,
) -> Result<Vec<DetectedTopic>, String> {
    use async_openai::{
        Client,
        config::OpenAIConfig,
        types::chat::{
            CreateChatCompletionRequest,
            ChatCompletionRequestMessage,
            ChatCompletionRequestSystemMessage,
            ChatCompletionRequestSystemMessageContent,
            ChatCompletionRequestUserMessage,
            ChatCompletionRequestUserMessageContent,
            ResponseFormat,
        },
    };

    // Truncate transcript to 40,000 characters if longer
    let transcript_truncated = if transcript_text.len() > 40_000 {
        &transcript_text[..40_000]
    } else {
        transcript_text
    };

    let system_prompt = "Du bist ein Assistent für Podcast-Analyse.\n\
Analysiere dieses deutsche Podcast-Transkript und identifiziere Themen,\n\
die erwähnt aber NICHT vollständig besprochen wurden -- also Themen die\n\
vertagt, verschoben oder nur kurz angerissen wurden.\n\n\
Erkenne Signalphrasen wie:\n\
- \"das vertiefen wir nächste Woche / nächstes Mal\"\n\
- \"dazu kommen wir noch\" / \"darüber reden wir noch\"\n\
- \"das ist ein Thema für sich\"\n\
- \"kurz erwähnt: ...\" ohne weitere Diskussion\n\
- Themen die nach wenigen Sätzen abgebrochen werden\n\
- Verweise auf eine zukünftige Episode als geplante Vertiefung\n\n\
Wenn keine unvollständigen Themen gefunden werden, gib ein leeres Array zurück.\n\
Antworte NUR mit validem JSON im Format: {\"topics\": [{\"title\": \"...\", \"description\": \"...\", \"reason\": \"...\", \"confidence\": 0.9}]}";

    let user_message = format!("Transkript:\n\n{}", transcript_truncated);

    let config = OpenAIConfig::new().with_api_key(api_key);
    let client = Client::with_config(config);

    let request = CreateChatCompletionRequest {
        model: "gpt-4o-mini".to_string(),
        messages: vec![
            ChatCompletionRequestMessage::System(ChatCompletionRequestSystemMessage {
                content: ChatCompletionRequestSystemMessageContent::Text(system_prompt.to_string()),
                name: None,
            }),
            ChatCompletionRequestMessage::User(ChatCompletionRequestUserMessage {
                content: ChatCompletionRequestUserMessageContent::Text(user_message),
                name: None,
            }),
        ],
        response_format: Some(ResponseFormat::JsonObject),
        ..Default::default()
    };

    let response = client
        .chat()
        .create(request)
        .await
        .map_err(|e| format!("OpenAI-Fehler: {}", e))?;

    // Step 5: Parse the response
    let content = response
        .choices
        .first()
        .and_then(|c| c.message.content.as_deref())
        .ok_or_else(|| "Leere Antwort von OpenAI".to_string())?;

    let llm_response: LlmTopicsResponse = serde_json::from_str(content)
        .map_err(|e| format!("JSON-Parsefehler: {} — Antwort: {}", e, content))?;

    // Step 6: Write topics to DB
    let conn = rusqlite::Connection::open(db_path)
        .map_err(|e| e.to_string())?;

    // Delete prior AI-detected topics for re-analysis safety
    conn.execute(
        "DELETE FROM topics WHERE detected_from_episode_id = ? AND ai_detected = 1",
        [episode_id],
    ).map_err(|e| e.to_string())?;

    for topic in &llm_response.topics {
        conn.execute(
            "INSERT INTO topics (title, description, status, priority, ai_detected, detected_from_episode_id, ai_reason, confidence, created_at, updated_at)
             VALUES (?, ?, 'offen', 'mittel', 1, ?, ?, ?, datetime('now'), datetime('now'))",
            rusqlite::params![
                topic.title,
                topic.description,
                episode_id,
                topic.reason,
                topic.confidence,
            ],
        ).map_err(|e| e.to_string())?;
    }

    let topics_found = llm_response.topics.len() as i64;

    // Step 7: Update episode_analysis to done
    conn.execute(
        "UPDATE episode_analysis SET status='done', topics_found=?, analyzed_at=datetime('now') WHERE episode_id=?",
        rusqlite::params![topics_found, episode_id],
    ).map_err(|e| e.to_string())?;

    // Step 9: Re-query to get DB-assigned IDs
    let mut stmt = conn.prepare(
        "SELECT id, title, COALESCE(description,''), COALESCE(ai_reason,''), COALESCE(confidence,0.5), COALESCE(detected_from_episode_id,0)
         FROM topics WHERE detected_from_episode_id = ? AND ai_detected = 1",
    ).map_err(|e| e.to_string())?;

    let topics: Vec<DetectedTopic> = stmt
        .query_map([episode_id], |row| {
            Ok(DetectedTopic {
                id: row.get(0)?,
                title: row.get(1)?,
                description: row.get(2)?,
                ai_reason: row.get(3)?,
                confidence: row.get(4)?,
                detected_from_episode_id: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(topics)
}

/// Check analysis status for a specific episode.
#[tauri::command]
pub async fn get_episode_analysis_status(
    episode_id: i64,
    app: tauri::AppHandle,
) -> Result<AnalysisStatus, String> {
    let db_path = app.path().app_data_dir()
        .map_err(|e| e.to_string())?
        .join("binky.db");
    let conn = rusqlite::Connection::open(&db_path)
        .map_err(|e| e.to_string())?;

    let result = conn.query_row(
        "SELECT episode_id, status, topics_found, error FROM episode_analysis WHERE episode_id = ?",
        [episode_id],
        |row| Ok(AnalysisStatus {
            episode_id: row.get(0)?,
            status: row.get(1)?,
            topics_found: row.get(2)?,
            error: row.get(3)?,
        }),
    );

    match result {
        Ok(s) => Ok(s),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(AnalysisStatus {
            episode_id,
            status: "not_started".to_string(),
            topics_found: 0,
            error: None,
        }),
        Err(e) => Err(e.to_string()),
    }
}

/// Check if an OpenAI API key is configured (never returns the key itself).
#[tauri::command]
pub async fn has_openai_key_configured(
    app: tauri::AppHandle,
) -> Result<bool, String> {
    let db_path = app.path().app_data_dir()
        .map_err(|e| e.to_string())?
        .join("binky.db");
    let conn = rusqlite::Connection::open(&db_path)
        .map_err(|e| e.to_string())?;

    let key: Option<String> = conn.query_row(
        "SELECT value FROM settings WHERE key = 'openai_api_key'",
        [],
        |row| row.get(0),
    ).ok();

    Ok(key.map_or(false, |k| !k.is_empty()))
}
