import { useState, useEffect, useCallback, useRef } from 'react';
import { invoke, Channel } from '@tauri-apps/api/core';

// ─── Types matching Rust DiarizationEvent enum ────────────────────────────────

type DiarizationEvent =
  | { event: 'Progress'; data: { percent: number } }
  | { event: 'Done'; data: { episode_id: number } }
  | { event: 'Error'; data: { message: string } }
  | { event: 'Cancelled'; data: Record<string, never> };

interface DiarizationQueueStatus {
  active_episode_id: number | null;
  queue_length: number;
  is_processing: boolean;
}

export interface UseDiarizationReturn {
  activeEpisodeId: number | null;
  progress: number;
  queueLength: number;
  isProcessing: boolean;
  startDiarization: (episodeId: number, audioUrl: string) => Promise<void>;
  cancelDiarization: () => Promise<void>;
  refreshQueueStatus: () => Promise<void>;
  startBatchDiarization: (episodes: Array<{ id: number; audioUrl: string }>) => Promise<void>;
}

export function useDiarization(onEpisodeUpdated?: () => void): UseDiarizationReturn {
  const [activeEpisodeId, setActiveEpisodeId] = useState<number | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [queueLength, setQueueLength] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Keep track of whether we should be polling
  const isProcessingRef = useRef(isProcessing);
  isProcessingRef.current = isProcessing;

  const refreshQueueStatus = useCallback(async () => {
    try {
      const status = await invoke<DiarizationQueueStatus>('get_diarization_queue_status');
      setIsProcessing(status.is_processing);
      setQueueLength(status.queue_length);
      setActiveEpisodeId(status.active_episode_id);
      if (!status.is_processing) {
        setProgress(0);
      }
    } catch (err) {
      console.error('[useDiarization] get_diarization_queue_status error:', err);
    }
  }, []);

  // Poll queue status every 2 seconds while processing is active
  useEffect(() => {
    if (!isProcessing) return;

    const interval = setInterval(() => {
      if (isProcessingRef.current) {
        refreshQueueStatus();
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [isProcessing, refreshQueueStatus]);

  const startDiarization = useCallback(
    async (episodeId: number, audioUrl: string) => {
      const channel = new Channel<DiarizationEvent>();

      channel.onmessage = (event: DiarizationEvent) => {
        switch (event.event) {
          case 'Progress': {
            setActiveEpisodeId(episodeId);
            setIsProcessing(true);
            setProgress(event.data.percent);
            break;
          }
          case 'Done': {
            setIsProcessing(false);
            setActiveEpisodeId(null);
            setProgress(0);
            onEpisodeUpdated?.();
            break;
          }
          case 'Error': {
            const errMsg = event.data.message;
            console.error('[useDiarization] diarization error:', errMsg);
            setIsProcessing(false);
            setActiveEpisodeId(null);
            setProgress(0);
            onEpisodeUpdated?.();
            break;
          }
          case 'Cancelled': {
            setIsProcessing(false);
            setActiveEpisodeId(null);
            setProgress(0);
            onEpisodeUpdated?.();
            break;
          }
        }
      };

      try {
        setActiveEpisodeId(episodeId);
        setIsProcessing(true);
        await invoke('start_diarization', {
          episodeId,
          audioUrl,
          onEvent: channel,
        });
      } catch (err) {
        console.error('[useDiarization] start_diarization error:', err);
        setIsProcessing(false);
        setActiveEpisodeId(null);
        setProgress(0);
      }
    },
    [onEpisodeUpdated]
  );

  const cancelDiarization = useCallback(async () => {
    try {
      await invoke('cancel_diarization');
    } catch (err) {
      console.error('[useDiarization] cancel_diarization error:', err);
    }
  }, []);

  const startBatchDiarization = useCallback(
    async (episodes: Array<{ id: number; audioUrl: string }>) => {
      for (const ep of episodes) {
        await startDiarization(ep.id, ep.audioUrl);
      }
    },
    [startDiarization]
  );

  return {
    activeEpisodeId,
    progress,
    queueLength,
    isProcessing,
    startDiarization,
    cancelDiarization,
    refreshQueueStatus,
    startBatchDiarization,
  };
}
