import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getSetting, setSetting } from '../lib/settings';

interface AssemblyAIProgress {
  episode_id: number;
  episode_title: string;
  status: 'submitted' | 'done' | 'error';
  message: string | null;
  completed_count: number;
  total_count: number;
}

interface ProgressEntry {
  episode_id: number;
  episode_title: string;
  status: 'submitted' | 'done' | 'error';
  message: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function AssemblyAIDevPanel({ open, onClose }: Props) {
  const [apiKey, setApiKey] = useState('');
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState<Map<number, ProgressEntry>>(new Map());
  const [completedCount, setCompletedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [batchResult, setBatchResult] = useState<string | null>(null);

  // Load stored API key when panel opens
  useEffect(() => {
    if (open) {
      getSetting('assemblyai_api_key').then(v => {
        if (v) setApiKey(v);
      });
    }
  }, [open]);

  // Listen for progress events while panel is open
  useEffect(() => {
    if (!open) return;

    const unlistenPromise = listen<AssemblyAIProgress>('assemblyai_progress', (event) => {
      const payload = event.payload;
      setProgress(prev => {
        const next = new Map(prev);
        next.set(payload.episode_id, {
          episode_id: payload.episode_id,
          episode_title: payload.episode_title,
          status: payload.status,
          message: payload.message,
        });
        return next;
      });
      setCompletedCount(payload.completed_count);
      setTotalCount(payload.total_count);
      if (payload.completed_count === payload.total_count && payload.total_count > 0) {
        setProcessing(false);
      }
    });

    return () => {
      unlistenPromise.then(unlisten => unlisten());
    };
  }, [open]);

  async function handleStart() {
    if (!apiKey || processing) return;
    // Persist API key for next time
    await setSetting('assemblyai_api_key', apiKey);
    setProcessing(true);
    setProgress(new Map());
    setCompletedCount(0);
    setTotalCount(0);
    setBatchResult(null);
    try {
      const result = await invoke<string>('assemblyai_process_backlog', { apiKey });
      setBatchResult(result);
    } catch (err) {
      setBatchResult(`Fehler: ${String(err)}`);
      setProcessing(false);
    }
  }

  if (!open) return null;

  const sortedEntries = Array.from(progress.values()).sort(
    (a, b) => a.episode_id - b.episode_id
  );

  function StatusDot({ status, message }: { status: ProgressEntry['status']; message: string | null }) {
    if (status === 'submitted') {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            backgroundColor: '#f5a623', display: 'inline-block', flexShrink: 0
          }} />
          <span style={{ color: '#f5a623', fontSize: 12 }}>Gesendet</span>
        </span>
      );
    }
    if (status === 'done') {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            backgroundColor: '#4caf50', display: 'inline-block', flexShrink: 0
          }} />
          <span style={{ color: '#4caf50', fontSize: 12 }}>Fertig</span>
        </span>
      );
    }
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <span style={{
          width: 8, height: 8, borderRadius: '50%',
          backgroundColor: '#f44336', display: 'inline-block', flexShrink: 0
        }} />
        <span style={{ color: '#f44336', fontSize: 12 }}>
          Fehler{message ? `: ${message}` : ''}
        </span>
      </span>
    );
  }

  return (
    <div
      onClick={() => { if (!processing) onClose(); }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Modal card — stop click propagation so inner clicks don't close overlay */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 500,
          maxWidth: '90vw',
          background: 'var(--color-background)',
          border: '1px solid var(--color-border)',
          borderRadius: 10,
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        {/* Header */}
        <div>
          <h2 style={{ margin: 0, fontSize: 18, color: 'var(--color-text)' }}>
            AssemblyAI Backlog
          </h2>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--color-text-muted, var(--color-text))', opacity: 0.7 }}>
            Dev-only: Alle unverarbeiteten Episoden senden
          </p>
        </div>

        {/* API Key input */}
        <input
          type="password"
          value={apiKey}
          onChange={e => setApiKey(e.target.value)}
          placeholder="AssemblyAI API Key"
          disabled={processing}
          style={{
            padding: '8px 10px',
            borderRadius: 6,
            border: '1px solid var(--color-border)',
            background: 'var(--color-background)',
            color: 'var(--color-text)',
            fontSize: 13,
            width: '100%',
            boxSizing: 'border-box',
            opacity: processing ? 0.5 : 1,
          }}
        />

        {/* Start button */}
        <button
          onClick={handleStart}
          disabled={processing || !apiKey}
          style={{
            padding: '8px 14px',
            borderRadius: 6,
            border: '1px solid var(--color-border)',
            background: processing || !apiKey ? 'transparent' : 'var(--color-accent, #d97757)',
            color: processing || !apiKey ? 'var(--color-text)' : '#fff',
            fontSize: 13,
            cursor: processing || !apiKey ? 'not-allowed' : 'pointer',
            opacity: processing || !apiKey ? 0.5 : 1,
            alignSelf: 'flex-start',
          }}
        >
          {processing ? 'Verarbeitung läuft...' : 'Alle Episoden verarbeiten'}
        </button>

        {/* Batch result info */}
        {batchResult && (
          <p style={{ margin: 0, fontSize: 12, color: 'var(--color-text)', opacity: 0.7 }}>
            {batchResult}
          </p>
        )}

        {/* Progress list */}
        {sortedEntries.length > 0 && (
          <div>
            <div
              style={{
                maxHeight: 300,
                overflowY: 'auto',
                border: '1px solid var(--color-border)',
                borderRadius: 6,
                padding: '4px 0',
              }}
            >
              {sortedEntries.map(entry => (
                <div
                  key={entry.episode_id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '6px 10px',
                    borderBottom: '1px solid var(--color-border)',
                    gap: 8,
                  }}
                >
                  <span style={{ fontSize: 12, color: 'var(--color-text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {entry.episode_title}
                  </span>
                  <StatusDot status={entry.status} message={entry.message} />
                </div>
              ))}
            </div>
            <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--color-text)', opacity: 0.7 }}>
              {completedCount} / {totalCount} fertig
            </p>
          </div>
        )}

        {/* Close button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            disabled={processing}
            style={{
              padding: '7px 14px',
              borderRadius: 6,
              border: '1px solid var(--color-border)',
              background: 'transparent',
              color: 'var(--color-text)',
              fontSize: 13,
              cursor: processing ? 'not-allowed' : 'pointer',
              opacity: processing ? 0.5 : 1,
            }}
          >
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
}
