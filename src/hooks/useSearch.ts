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
        // Group by episode_id preserving BM25 order (Map insertion = first-appearance order)
        // CRITICAL: do NOT sort() — this would destroy the backend's BM25 ranking
        const map = new Map<number, EpisodeGroup>();
        for (const r of raw) {
          if (!map.has(r.episode_id)) {
            map.set(r.episode_id, { episode_id: r.episode_id, title: r.title, results: [] });
          }
          map.get(r.episode_id)!.results.push(r);
        }
        setGroups(Array.from(map.values()));
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
