import { useState, useEffect, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Channel } from '@tauri-apps/api/core';

// ─── Types matching Rust TranscriptionEvent enum ──────────────────────────────

type TranscriptionEventDownloading = { event: 'Downloading'; data: { percent: number } };
type TranscriptionEventProgress = { event: 'Progress'; data: { percent: number } };
type TranscriptionEventDone = { event: 'Done'; data: { episode_id: number } };
type TranscriptionEventError = { event: 'Error'; data: { message: string } };
type TranscriptionEventCancelled = { event: 'Cancelled'; data: Record<string, never> };

type TranscriptionEvent =
  | TranscriptionEventDownloading
  | TranscriptionEventProgress
  | TranscriptionEventDone
  | TranscriptionEventError
  | TranscriptionEventCancelled;

interface QueueStatus {
  active_episode_id: number | null;
  queue_length: number;
  is_processing: boolean;
}

export interface TranscriptionState {
  activeEpisodeId: number | null;
  progress: number; // 0–100
  queueLength: number;
  isProcessing: boolean;
}

export interface UseTranscriptionReturn extends TranscriptionState {
  startTranscription: (episodeId: number, audioUrl: string) => Promise<void>;
  cancelTranscription: () => Promise<void>;
  refreshQueueStatus: () => Promise<void>;
}

export function useTranscription(onEpisodeUpdated?: () => void): UseTranscriptionReturn {
  const [activeEpisodeId, setActiveEpisodeId] = useState<number | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [queueLength, setQueueLength] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Keep track of whether we should be polling
  const isProcessingRef = useRef(isProcessing);
  isProcessingRef.current = isProcessing;

  const refreshQueueStatus = useCallback(async () => {
    try {
      const status = await invoke<QueueStatus>('get_queue_status');
      setIsProcessing(status.is_processing);
      setQueueLength(status.queue_length);
      setActiveEpisodeId(status.active_episode_id);
      if (!status.is_processing) {
        setProgress(0);
      }
    } catch (err) {
      console.error('[useTranscription] get_queue_status error:', err);
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

  const startTranscription = useCallback(
    async (episodeId: number, audioUrl: string) => {
      const channel = new Channel<TranscriptionEvent>();

      channel.onmessage = (event: TranscriptionEvent) => {
        switch (event.event) {
          case 'Downloading': {
            // Download phase: progress 0–50 (mapped from 0–100 in Rust)
            setActiveEpisodeId(episodeId);
            setIsProcessing(true);
            setProgress(event.data.percent);
            break;
          }
          case 'Progress': {
            // Whisper phase: progress 50–100 (already mapped in Rust)
            setActiveEpisodeId(episodeId);
            setIsProcessing(true);
            setProgress(event.data.percent);
            break;
          }
          case 'Done': {
            setIsProcessing(false);
            setActiveEpisodeId(null);
            setProgress(0);
            // Trigger episode list reload so the status badge updates
            onEpisodeUpdated?.();
            break;
          }
          case 'Error': {
            console.error('[useTranscription] transcription error:', event.data.message);
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
        await invoke('start_transcription', {
          episodeId,
          audioUrl,
          onEvent: channel,
        });
      } catch (err) {
        console.error('[useTranscription] start_transcription error:', err);
        // Show error to user via alert (basic UX; toast system comes later)
        const msg = String(err);
        if (msg.includes('Kein Whisper-Modell')) {
          alert(msg);
        }
        setIsProcessing(false);
        setActiveEpisodeId(null);
        setProgress(0);
      }
    },
    [onEpisodeUpdated]
  );

  const cancelTranscription = useCallback(async () => {
    try {
      await invoke('cancel_transcription');
    } catch (err) {
      console.error('[useTranscription] cancel_transcription error:', err);
    }
  }, []);

  return {
    activeEpisodeId,
    progress,
    queueLength,
    isProcessing,
    startTranscription,
    cancelTranscription,
    refreshQueueStatus,
  };
}
