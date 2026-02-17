import Database from '@tauri-apps/plugin-sql';
import { invoke } from '@tauri-apps/api/core';
import { useState, useCallback, useEffect } from 'react';

export interface BirdProfile {
  id: number;
  name_de: string;
  name_sci: string | null;
  image_url: string | null;
  nabu_url: string;
  content_html: string | null;
  used: boolean;
  used_date: string | null;
}

export interface UsedBirdEntry {
  id: number;
  bird_id: number;
  bird_name_de: string;
  bird_nabu_url: string;
  episode_title: string | null;
  used_date: string;
}

export interface BirdPoolStatus {
  total: number;
  used: number;
  available: number;
}

export function useBirds() {
  const [currentBird, setCurrentBird] = useState<BirdProfile | null>(null);
  const [currentBirdMarked, setCurrentBirdMarked] = useState(false);
  const [history, setHistory] = useState<UsedBirdEntry[]>([]);
  const [poolStatus, setPoolStatus] = useState<BirdPoolStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [poolExhausted, setPoolExhausted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPoolStatus = useCallback(async () => {
    try {
      const db = await Database.load('sqlite:binky.db');
      const rows = await db.select<{ total: number; used_count: number }[]>(
        `SELECT COUNT(*) as total, SUM(CASE WHEN used = 1 THEN 1 ELSE 0 END) as used_count FROM birds`
      );
      if (rows.length > 0) {
        const { total, used_count } = rows[0];
        const used = used_count ?? 0;
        setPoolStatus({ total, used, available: total - used });
      }
    } catch (_e) {
      // silently fail
    }
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      const entries = await invoke<UsedBirdEntry[]>('get_bird_history');
      setHistory(entries);
    } catch (_e) {
      // silently fail
    }
  }, []);

  const loadCurrentBird = useCallback(async () => {
    setLoading(true);
    try {
      const bird = await invoke<BirdProfile | null>('get_current_bird');
      setCurrentBird(bird);
      if (bird) {
        setCurrentBirdMarked(bird.used);
        setPoolExhausted(false);
      }
      await loadPoolStatus();
      await loadHistory();
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [loadPoolStatus, loadHistory]);

  const refreshPool = useCallback(async () => {
    setFetching(true);
    setError(null);
    try {
      const status = await invoke<BirdPoolStatus>('fetch_nabu_bird_list');
      setPoolStatus(status);
      setPoolExhausted(false);
    } catch (e) {
      setError(String(e));
    } finally {
      setFetching(false);
    }
  }, []);

  // Returns false if user needs to confirm before drawing (current bird unmarked)
  const drawBird = useCallback(async (force = false): Promise<boolean> => {
    if (!force && currentBird && !currentBirdMarked) {
      return false; // caller must show confirm dialog
    }
    setLoading(true);
    setError(null);
    try {
      const bird = await invoke<BirdProfile>('draw_random_bird');
      setCurrentBird(bird);
      setCurrentBirdMarked(false);
      setPoolExhausted(false);
      await loadPoolStatus();
      return true;
    } catch (e) {
      const errStr = String(e);
      if (errStr.includes('pool_exhausted')) {
        setPoolExhausted(true);
        setCurrentBird(null);
      } else {
        setError(errStr);
      }
      return true;
    } finally {
      setLoading(false);
    }
  }, [currentBird, currentBirdMarked, loadPoolStatus]);

  const markAsUsed = useCallback(async (episodeTitle: string | null) => {
    if (!currentBird) return;
    try {
      await invoke('mark_bird_used', { bird_id: currentBird.id, episode_title: episodeTitle });
      setCurrentBirdMarked(true);
      await loadHistory();
      await loadPoolStatus();
    } catch (e) {
      setError(String(e));
    }
  }, [currentBird, loadHistory, loadPoolStatus]);

  const undoMarkUsed = useCallback(async () => {
    if (!currentBird) return;
    try {
      await invoke('undo_mark_bird_used', { bird_id: currentBird.id });
      setCurrentBirdMarked(false);
      await loadHistory();
      await loadPoolStatus();
    } catch (e) {
      setError(String(e));
    }
  }, [currentBird, loadHistory, loadPoolStatus]);

  const resetPool = useCallback(async () => {
    try {
      await invoke('reset_bird_pool');
      setCurrentBird(null);
      setCurrentBirdMarked(false);
      setPoolExhausted(false);
      setHistory([]);
      await loadPoolStatus();
    } catch (e) {
      setError(String(e));
    }
  }, [loadPoolStatus]);

  // On mount: load state; auto-fetch if pool empty
  useEffect(() => {
    loadCurrentBird().then(async () => {
      // Auto-fetch on first open if pool is empty
      try {
        const db = await Database.load('sqlite:binky.db');
        const rows = await db.select<{ total: number }[]>('SELECT COUNT(*) as total FROM birds');
        if (rows[0]?.total === 0) {
          refreshPool();
        }
      } catch (_e) {
        // silently fail
      }
    });
  }, []);

  return {
    currentBird,
    currentBirdMarked,
    history,
    poolStatus,
    loading,
    fetching,
    poolExhausted,
    error,
    drawBird,
    markAsUsed,
    undoMarkUsed,
    resetPool,
    refreshPool,
    loadHistory,
    loadPoolStatus,
  };
}
