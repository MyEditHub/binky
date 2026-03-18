import { useState, useCallback, useRef, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Channel } from '@tauri-apps/api/core';
import { getSetting, setSetting } from '../lib/settings';

// ─── Types matching Rust PipelineEvent enum ───────────────────────────────────

type PipelineEvent =
  | { event: 'StageStarted'; data: { stage: string; overall_percent: number } }
  | { event: 'Progress';     data: { stage: string; stage_percent: number; overall_percent: number } }
  | { event: 'StageDone';    data: { stage: string; overall_percent: number } }
  | { event: 'Done';         data: { episode_id: number; timing: { download_s: number; decode_s: number; transcription_s: number; diarization_s: number; topics_s: number; total_s: number } } }
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

// ─── Pipeline timing history ──────────────────────────────────────────────────
// Saved to settings as JSON, keyed by 'pipeline_timing_history'.
// Keeps the last 10 completed runs and uses their average for initial estimates.

const HISTORY_KEY = 'pipeline_timing_history';
const MAX_HISTORY = 10;

interface TimingRecord {
  total_s: number;
  download_s: number;
  transcription_s: number;
  diarization_s: number;
  topics_s: number;
}

async function loadAvgTiming(): Promise<TimingRecord | null> {
  try {
    const raw = await getSetting(HISTORY_KEY);
    if (!raw) return null;
    const runs: TimingRecord[] = JSON.parse(raw);
    if (!runs.length) return null;
    const avg = (key: keyof TimingRecord) =>
      runs.reduce((s, r) => s + r[key], 0) / runs.length;
    return {
      total_s:        avg('total_s'),
      download_s:     avg('download_s'),
      transcription_s: avg('transcription_s'),
      diarization_s:  avg('diarization_s'),
      topics_s:       avg('topics_s'),
    };
  } catch {
    return null;
  }
}

async function saveTimingRecord(rec: TimingRecord): Promise<void> {
  try {
    const raw = await getSetting(HISTORY_KEY);
    const runs: TimingRecord[] = raw ? JSON.parse(raw) : [];
    runs.push(rec);
    if (runs.length > MAX_HISTORY) runs.splice(0, runs.length - MAX_HISTORY);
    await setSetting(HISTORY_KEY, JSON.stringify(runs));
  } catch (e) {
    console.warn('[usePipeline] failed to save timing history:', e);
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export interface PipelineState {
  isProcessing: boolean;
  activeEpisodeId: number | null;
  activeEpisodeTitle: string | null;
  progress: number;           // 0–100 overall
  stepLabel: string | null;   // stage name + estimated remaining (e.g. "Transkription... (noch ~22 Min.)")
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

  const startTimeRef = useRef<number | null>(null);
  // Historical average total_s loaded at pipeline start — used when progress < 5%
  const historicalTotalMsRef = useRef<number | null>(null);

  // Keep a ref to the episode title so the channel handler closure can read it
  const activeTitleRef = useRef<string | null>(null);
  // Refs so the estimate interval can rebuild the label without stale closures
  const stepNameRef = useRef<string | null>(null);
  const progressRef = useRef<number>(0);

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
      startTimeRef.current = Date.now();

      // Load historical average for initial estimate (before we have live progress)
      const avg = await loadAvgTiming();
      historicalTotalMsRef.current = avg ? avg.total_s * 1000 : null;

      // Set initial processing state
      setIsProcessing(true);
      setActiveEpisodeId(episodeId);
      setActiveEpisodeTitle(episodeTitle);
      setProgress(0);
      progressRef.current = 0;
      setStepLabel(null);
      stepNameRef.current = null;
      setError(false);
      setErrorStage(null);
      setInterrupted(false);

      notify(true, 0, null, episodeTitle);

      channel.onmessage = (event: PipelineEvent) => {
        const title = activeTitleRef.current;

        switch (event.event) {
          case 'StageStarted': {
            const base = stageLabel(event.data.stage);
            stepNameRef.current = base;
            setStepLabel(base);
            progressRef.current = event.data.overall_percent;
            setProgress(event.data.overall_percent);
            notify(true, event.data.overall_percent, base, title);
            break;
          }
          case 'Progress': {
            progressRef.current = event.data.overall_percent;
            setProgress(event.data.overall_percent);
            notify(true, event.data.overall_percent, stepLabel, title);
            break;
          }
          case 'StageDone': {
            progressRef.current = event.data.overall_percent;
            setProgress(event.data.overall_percent);
            notify(true, event.data.overall_percent, stepLabel, title);
            break;
          }
          case 'Done': {
            const t = event.data.timing;
            const completedEpisodeId = event.data.episode_id;
            const totalMin = Math.floor(t.total_s / 60);
            const totalSec = Math.round(t.total_s % 60);
            const doneLabel = totalMin > 0
              ? `Fertig · ${totalMin}m ${totalSec}s`
              : `Fertig · ${totalSec}s`;
            console.log(
              `[pipeline timing] ep=${completedEpisodeId}`,
              `download=${t.download_s.toFixed(1)}s`,
              `decode=${t.decode_s.toFixed(1)}s`,
              `transcription=${t.transcription_s.toFixed(1)}s`,
              `diarization=${t.diarization_s.toFixed(1)}s`,
              `topics=${t.topics_s.toFixed(1)}s`,
              `total=${t.total_s.toFixed(1)}s`,
            );
            // Save run to history for future estimates
            saveTimingRecord({
              total_s:        t.total_s,
              download_s:     t.download_s,
              transcription_s: t.transcription_s,
              diarization_s:  t.diarization_s,
              topics_s:       t.topics_s,
            });
            stepNameRef.current = null;
            progressRef.current = 100;
            setProgress(100);
            setStepLabel(doneLabel);
            notify(true, 100, doneLabel, title);
            // Brief hold so the user sees the completion summary
            setTimeout(() => {
              setIsProcessing(false);
              setActiveEpisodeId(null);
              setActiveEpisodeTitle(null);
              setProgress(0);
              progressRef.current = 0;
              setStepLabel(null);
              stepNameRef.current = null;
              startTimeRef.current = null;
              historicalTotalMsRef.current = null;
              activeTitleRef.current = null;
              notify(false, 0, null, null);
              onEpisodeUpdated?.();
              window.dispatchEvent(
                new CustomEvent('pipeline-speaker-detect', { detail: { episodeId: completedEpisodeId } })
              );
            }, 5_000);
            break;
          }
          case 'Error': {
            const label = `Fehler: ${stageLabel(event.data.stage)}`;
            setError(true);
            setErrorStage(event.data.stage);
            setProgress(event.data.overall_percent);
            setStepLabel(label);
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
    [onEpisodeUpdated, notify]
  );

  // Every 30s: recompute estimated remaining time.
  //
  // When progress < 5% (early stage): use historical average total — gives an
  // immediate useful estimate before live data accumulates.
  //
  // When progress >= 5%: use live extrapolation:
  //   remaining = (elapsed / progress) × (100 - progress)
  // Gets more accurate as the pipeline advances and self-corrects run-to-run.
  useEffect(() => {
    if (!isProcessing) return;
    const id = setInterval(() => {
      if (!stepNameRef.current || !startTimeRef.current) return;
      const elapsedMs = Date.now() - startTimeRef.current;
      const prog = progressRef.current;

      let remainingMs: number;
      if (prog < 5 && historicalTotalMsRef.current) {
        // Use historical average — no live data yet
        remainingMs = historicalTotalMsRef.current - elapsedMs;
      } else if (prog >= 5) {
        // Live extrapolation
        remainingMs = (elapsedMs / prog) * (100 - prog);
      } else {
        return; // nothing to show yet
      }

      const remainingMin = Math.ceil(Math.max(0, remainingMs) / 60_000);
      const suffix = remainingMin <= 1
        ? ' (gleich fertig...)'
        : ` (noch ~${remainingMin} Min.)`;
      const label = `${stepNameRef.current}${suffix}`;
      setStepLabel(label);
      notify(true, prog, label, activeTitleRef.current);
    }, 30_000);
    return () => clearInterval(id);
  }, [isProcessing, notify]);

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
