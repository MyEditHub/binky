import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import Database from '@tauri-apps/plugin-sql';

export interface Episode {
  id: number;
  episode_number: number | null;
  title: string;
  publish_date: string | null;
  audio_url: string | null;
  duration_minutes: number | null;
  description: string | null;
  transcription_status: 'not_started' | 'queued' | 'downloading' | 'transcribing' | 'done' | 'error';
  transcription_error: string | null;
  podcast_name: string | null;
  created_at: string | null;
  updated_at: string | null;
}

/** Metadata returned from sync_rss Rust command. */
interface EpisodeMetadata {
  title: string;
  description: string | null;
  audio_url: string | null;
  pub_date: string | null;
  duration_str: string | null;
  duration_minutes: number | null;
  episode_number: number | null;
}

async function getDb(): Promise<InstanceType<typeof Database>> {
  return Database.load('sqlite:binky.db');
}

export function useEpisodes() {
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  /** Load episodes from local SQLite database, filtered to 2024+, newest first. */
  const loadEpisodes = useCallback(async () => {
    try {
      const db = await getDb();
      const rows = await db.select<Episode[]>(
        `SELECT * FROM episodes
         WHERE publish_date >= '2024-01-01'
         ORDER BY publish_date DESC`
      );
      setEpisodes(rows);
    } catch (err) {
      console.error('[useEpisodes] loadEpisodes error:', err);
      setError(String(err));
    }
  }, []);

  /** Sync RSS feed: fetch from Rust command, upsert into SQLite, then reload. */
  const syncRss = useCallback(async () => {
    if (syncing) return;
    setSyncing(true);
    setError(null);
    try {
      const metadata = await invoke<EpisodeMetadata[]>('sync_rss');
      const db = await getDb();

      for (const ep of metadata) {
        await db.execute(
          `INSERT OR IGNORE INTO episodes
             (title, description, audio_url, publish_date, duration_minutes,
              episode_number, podcast_name, transcription_status)
           VALUES (?, ?, ?, ?, ?, ?, 'Nettgefluster', 'not_started')`,
          [
            ep.title,
            ep.description ?? null,
            ep.audio_url ?? null,
            ep.pub_date ?? null,
            ep.duration_minutes ?? null,
            ep.episode_number ?? null,
          ]
        );
      }

      await loadEpisodes();
    } catch (err) {
      console.error('[useEpisodes] syncRss error:', err);
      setError(String(err));
    } finally {
      setSyncing(false);
    }
  }, [syncing, loadEpisodes]);

  /** Client-side filter: returns episodes matching the search query by title. */
  const filteredEpisodes = searchQuery.trim()
    ? episodes.filter((ep) =>
        ep.title.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : episodes;

  // On mount: load from DB, then sync in background.
  useEffect(() => {
    let mounted = true;

    async function init() {
      await loadEpisodes();
      if (mounted) {
        setLoading(false);
        // Fire RSS sync in background — updates the list when done
        syncRss().catch((err) => console.error('[useEpisodes] background sync failed:', err));
      }
    }

    init();

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    episodes: filteredEpisodes,
    allEpisodes: episodes,
    loading,
    syncing,
    error,
    searchQuery,
    setSearchQuery,
    syncRss,
    loadEpisodes,
  };
}
