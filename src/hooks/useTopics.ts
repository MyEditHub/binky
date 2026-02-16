import Database from '@tauri-apps/plugin-sql';
import { invoke } from '@tauri-apps/api/core';
import { useState, useCallback } from 'react';

export type TopicStatus = 'offen' | 'erledigt' | 'zurückgestellt';

export interface TopicRow {
  id: number;
  title: string;
  description: string | null;
  status: TopicStatus;
  priority: string;
  ai_detected: number;
  ai_reason: string | null;
  confidence: number | null;
  detected_from_episode_id: number | null;
  source_episode_title: string | null;
  created_at: string;
}

export interface EpisodeForAnalysis {
  id: number;
  title: string;
  analysis_status: string;
  topics_found: number;
}

export function useTopics() {
  const [topics, setTopics] = useState<TopicRow[]>([]);
  const [episodes, setEpisodes] = useState<EpisodeForAnalysis[]>([]);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTopics = useCallback(async (statusFilter?: TopicStatus) => {
    setLoading(true);
    setError(null);
    try {
      const db = await Database.load('sqlite:binky.db');
      let query: string;
      let args: unknown[];
      if (statusFilter) {
        query = `
          SELECT t.id, t.title, t.description, t.status, t.priority,
                 t.ai_detected, t.ai_reason, t.confidence,
                 t.detected_from_episode_id,
                 e.title as source_episode_title,
                 t.created_at
          FROM topics t
          LEFT JOIN episodes e ON t.detected_from_episode_id = e.id
          WHERE t.status = ?
          ORDER BY t.created_at DESC
        `;
        args = [statusFilter];
      } else {
        query = `
          SELECT t.id, t.title, t.description, t.status, t.priority,
                 t.ai_detected, t.ai_reason, t.confidence,
                 t.detected_from_episode_id,
                 e.title as source_episode_title,
                 t.created_at
          FROM topics t
          LEFT JOIN episodes e ON t.detected_from_episode_id = e.id
          ORDER BY t.created_at DESC
        `;
        args = [];
      }
      const rows = await db.select<TopicRow[]>(query, args);
      setTopics(rows);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadEpisodes = useCallback(async () => {
    try {
      const db = await Database.load('sqlite:binky.db');
      const rows = await db.select<EpisodeForAnalysis[]>(`
        SELECT e.id, e.title,
               COALESCE(ea.status, 'not_started') as analysis_status,
               COALESCE(ea.topics_found, 0) as topics_found
        FROM episodes e
        INNER JOIN transcripts tr ON tr.episode_id = e.id
        LEFT JOIN episode_analysis ea ON ea.episode_id = e.id
        ORDER BY e.publish_date DESC
      `);
      setEpisodes(rows);
    } catch (err) {
      setError(String(err));
    }
  }, []);

  const updateStatus = useCallback(async (topicId: number, status: TopicStatus) => {
    // Optimistic update
    setTopics(prev =>
      prev.map(t => (t.id === topicId ? { ...t, status } : t))
    );
    try {
      const db = await Database.load('sqlite:binky.db');
      await db.execute(
        `UPDATE topics SET status = ?, updated_at = datetime('now') WHERE id = ?`,
        [status, topicId]
      );
    } catch (err) {
      setError(String(err));
      // Reload to revert optimistic update on error
      await loadTopics();
    }
  }, [loadTopics]);

  const analyzeEpisode = useCallback(async (episodeId: number) => {
    setAnalyzing(true);
    setError(null);
    try {
      await invoke('analyze_episode_topics', { episodeId });
      await Promise.all([loadTopics(), loadEpisodes()]);
    } catch (err) {
      setError(String(err));
    } finally {
      setAnalyzing(false);
    }
  }, [loadTopics, loadEpisodes]);

  return {
    topics,
    episodes,
    loading,
    analyzing,
    error,
    loadTopics,
    loadEpisodes,
    updateStatus,
    analyzeEpisode,
  };
}
