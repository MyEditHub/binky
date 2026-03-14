import { useState, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Channel } from '@tauri-apps/api/core';

// ─── Types matching Rust PipelineEvent enum ───────────────────────────────────

type PipelineEvent =
  | { event: 'StageStarted'; data: { stage: string; overall_percent: number } }
  | { event: 'Progress';     data: { stage: string; stage_percent: number; overall_percent: number } }
  | { event: 'StageDone';    data: { stage: string; overall_percent: number } }
  | { event: 'Done';         data: { episode_id: number } }
  | { event: 'Error';        data: { stage: string; message: string; overall_percent: number } }
  | { event: 'Cancelled';    data: { completed_stages: string[]; overall_percent: number } };

// Stage name → German display label
const STAGE_LABELS: Record<string, string> = {
  download:      'Herunterladen...',
  transcription: 'Transkription...',
  diarization:   'Sprecher erkennen...',
  topics:        'Themen analysieren...',
};

function stageLabel(stage: string): string {
  return STAGE_LABELS[stage] ?? stage;
}

export interface PipelineState {
  isProcessing: boolean;
  activeEpisodeId: number | null;
  activeEpisodeTitle: string | null;
  progress: number;           // 0–100 overall
  stepLabel: string | null;   // current step name for display
  error: boolean;             // true when pipeline errored
  errorStage: string | null;  // stage name that errored
  interrupted: boolean;       // true when showing interrupted state from restart
}

export interface UsePipelineReturn extends PipelineState {
  startPipeline: (episodeId: number, audioUrl: string, episodeTitle: string) => Promise<void>;
  cancelPipeline: () => Promise<void>;
}

export function usePipeline(
  onEpisodeUpdated?: () => void,
  onPipelineStateChange?: (
    isProcessing: boolean,
    progress: number,
    stepLabel: string | null,
    episodeTitle: string | null
  ) => void
): UsePipelineReturn {
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeEpisodeId, setActiveEpisodeId] = useState<number | null>(null);
  const [activeEpisodeTitle, setActiveEpisodeTitle] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [stepLabel, setStepLabel] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [errorStage, setErrorStage] = useState<string | null>(null);
  const [interrupted, setInterrupted] = useState(false);

  // Keep a ref to the episode title so the channel handler closure can read it
  const activeTitleRef = useRef<string | null>(null);

  const notify = useCallback(
    (
      processing: boolean,
      prog: number,
      label: string | null,
      title: string | null
    ) => {
      onPipelineStateChange?.(processing, prog, label, title);
    },
    [onPipelineStateChange]
  );

  const startPipeline = useCallback(
    async (episodeId: number, audioUrl: string, episodeTitle: string) => {
      const channel = new Channel<PipelineEvent>();

      activeTitleRef.current = episodeTitle;

      // Set initial processing state
      setIsProcessing(true);
      setActiveEpisodeId(episodeId);
      setActiveEpisodeTitle(episodeTitle);
      setProgress(0);
      setStepLabel(null);
      setError(false);
      setErrorStage(null);
      setInterrupted(false);

      notify(true, 0, null, episodeTitle);

      channel.onmessage = (event: PipelineEvent) => {
        const title = activeTitleRef.current;

        switch (event.event) {
          case 'StageStarted': {
            const label = stageLabel(event.data.stage);
            setStepLabel(label);
            setProgress(event.data.overall_percent);
            notify(true, event.data.overall_percent, label, title);
            break;
          }
          case 'Progress': {
            setProgress(event.data.overall_percent);
            notify(true, event.data.overall_percent, stepLabel, title);
            break;
          }
          case 'StageDone': {
            setProgress(event.data.overall_percent);
            notify(true, event.data.overall_percent, stepLabel, title);
            break;
          }
          case 'Done': {
            setProgress(100);
            notify(true, 100, stepLabel, title);
            // Hold at 100% for 1s then clear
            setTimeout(() => {
              setIsProcessing(false);
              setActiveEpisodeId(null);
              setActiveEpisodeTitle(null);
              setProgress(0);
              setStepLabel(null);
              activeTitleRef.current = null;
              notify(false, 0, null, null);
              onEpisodeUpdated?.();
            }, 1000);
            break;
          }
          case 'Error': {
            const label = `Fehler: ${stageLabel(event.data.stage)}`;
            setError(true);
            setErrorStage(event.data.stage);
            setProgress(event.data.overall_percent);
            setStepLabel(label);
            // Keep isProcessing=false but keep activeEpisodeId so the error bar stays visible
            setIsProcessing(false);
            notify(false, event.data.overall_percent, label, title);
            onEpisodeUpdated?.();
            break;
          }
          case 'Cancelled': {
            setInterrupted(true);
            setIsProcessing(false);
            setProgress(event.data.overall_percent);
            notify(false, 0, null, null);
            onEpisodeUpdated?.();
            break;
          }
        }
      };

      try {
        await invoke('start_pipeline', {
          episodeId,
          audioUrl,
          onEvent: channel,
        });
      } catch (err) {
        console.error('[usePipeline] start_pipeline error:', err);
        setError(true);
        setIsProcessing(false);
        setStepLabel('Fehler beim Starten');
        notify(false, 0, null, null);
      }
    },
    [onEpisodeUpdated, notify, stepLabel]
  );

  const cancelPipeline = useCallback(async () => {
    try {
      await invoke('cancel_pipeline');
    } catch (err) {
      console.error('[usePipeline] cancel_pipeline error:', err);
    }
  }, []);

  return {
    isProcessing,
    activeEpisodeId,
    activeEpisodeTitle,
    progress,
    stepLabel,
    error,
    errorStage,
    interrupted,
    startPipeline,
    cancelPipeline,
  };
}
