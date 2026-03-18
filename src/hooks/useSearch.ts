import { invoke } from '@tauri-apps/api/core';
import { useState, useEffect, useRef } from 'react';

export interface SearchResult {
  episode_id: number;
  title: string;
  speaker: string | null;
  snippet: string;
  segment_type: string; // 'transcript' | 'topic'
  start_ms: number | null;
  end_ms: number | null;
}

export interface EpisodeGroup {
  episode_id: number;
  title: string;
  results: SearchResult[];
}

export function useSearch(query: string, debounceMs = 300): { groups: EpisodeGroup[]; loading: boolean } {
  const [groups, setGroups] = useState<EpisodeGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(async () => {
      if (query.trim().length < 2) {
        setGroups([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const raw = await invoke<SearchResult[]>('search_transcripts', { query, limit: 50 });
        // Group by episode_id, then sort groups numerically by episode number (newest first).
        // BM25 ranking is preserved within each group; only group order changes.
        const map = new Map<number, EpisodeGroup>();
        for (const r of raw) {
          if (!map.has(r.episode_id)) {
            map.set(r.episode_id, { episode_id: r.episode_id, title: r.title, results: [] });
          }
          map.get(r.episode_id)!.results.push(r);
        }
        const episodeNumber = (title: string) => {
          const m = title.match(/^#(\d+)/);
          return m ? parseInt(m[1], 10) : 0;
        };
        setGroups(Array.from(map.values()).sort((a, b) => episodeNumber(b.title) - episodeNumber(a.title)));
      } catch {
        setGroups([]);
      } finally {
        setLoading(false);
      }
    }, debounceMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query, debounceMs]);

  return { groups, loading };
}
