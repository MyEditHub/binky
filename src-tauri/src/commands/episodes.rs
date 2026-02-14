use crate::models::episode::EpisodeMetadata;
use chrono::{DateTime, NaiveDate};
use rss::Channel;
use tauri_plugin_http::reqwest;

const RSS_URL: &str =
    "https://cdn.julephosting.de/podcasts/1188-nettgefluster-der-podcast-eines-ehepaars/feed.rss";

const FILTER_DATE: &str = "2024-01-01";

/// Parse iTunes duration string ("HH:MM:SS", "MM:SS", or plain seconds) into minutes as f64.
fn parse_duration_minutes(duration: &str) -> Option<f64> {
    let duration = duration.trim();
    if duration.is_empty() {
        return None;
    }

    let parts: Vec<&str> = duration.split(':').collect();
    match parts.len() {
        1 => {
            // Plain seconds
            let secs: f64 = parts[0].parse().ok()?;
            Some(secs / 60.0)
        }
        2 => {
            // MM:SS
            let mins: f64 = parts[0].parse().ok()?;
            let secs: f64 = parts[1].parse().ok()?;
            Some(mins + secs / 60.0)
        }
        3 => {
            // HH:MM:SS
            let hours: f64 = parts[0].parse().ok()?;
            let mins: f64 = parts[1].parse().ok()?;
            let secs: f64 = parts[2].parse().ok()?;
            Some(hours * 60.0 + mins + secs / 60.0)
        }
        _ => None,
    }
}

/// Fetch and parse the Nettgefluster RSS feed, returning episode metadata for 2024+.
///
/// Uses `tauri_plugin_http::reqwest` so the request goes through the macOS sandbox entitlements
/// declared in the capabilities JSON (network: outbound). Raw `reqwest` would bypass this.
#[tauri::command]
pub async fn sync_rss() -> Result<Vec<EpisodeMetadata>, String> {
    let bytes = reqwest::get(RSS_URL)
        .await
        .map_err(|e| format!("HTTP request failed: {}", e))?
        .bytes()
        .await
        .map_err(|e| format!("Failed to read response body: {}", e))?;

    let channel =
        Channel::read_from(&bytes[..]).map_err(|e| format!("Failed to parse RSS feed: {}", e))?;

    let filter_date = NaiveDate::parse_from_str(FILTER_DATE, "%Y-%m-%d")
        .expect("hardcoded filter date is valid");

    let mut episodes: Vec<EpisodeMetadata> = Vec::new();

    for item in channel.items() {
        // Parse publication date (RFC 2822)
        let pub_date_str: Option<String> = item
            .pub_date()
            .and_then(|date_str| DateTime::parse_from_rfc2822(date_str).ok())
            .map(|dt| dt.format("%Y-%m-%d").to_string());

        // Filter: skip episodes before 2024-01-01
        if let Some(ref date_str) = pub_date_str {
            if let Ok(date) = NaiveDate::parse_from_str(date_str, "%Y-%m-%d") {
                if date < filter_date {
                    continue;
                }
            }
        }

        // Title is required; skip malformed items
        let title = match item.title() {
            Some(t) if !t.is_empty() => t.to_string(),
            _ => continue,
        };

        let description = item.description().map(|d| d.to_string());
        let audio_url = item.enclosure().map(|e| e.url().to_string());

        // iTunes extensions
        let itunes_ext = item.itunes_ext();
        let duration_str = itunes_ext
            .and_then(|ext| ext.duration())
            .map(|d| d.to_string());

        let duration_minutes = duration_str
            .as_deref()
            .and_then(parse_duration_minutes);

        let episode_number: Option<i32> = itunes_ext
            .and_then(|ext| ext.episode())
            .and_then(|ep| ep.parse().ok());

        episodes.push(EpisodeMetadata {
            title,
            description,
            audio_url,
            pub_date: pub_date_str,
            duration_str,
            duration_minutes,
            episode_number,
        });
    }

    Ok(episodes)
}
