import { useState, useEffect, useCallback } from 'react';
import { invoke, Channel } from '@tauri-apps/api/core';
import Database from '@tauri-apps/plugin-sql';

interface ModelStatus {
  downloaded_model: string | null;
  model_size_bytes: number | null;
  models_dir: string;
}

type ModelDownloadEvent =
  | { event: 'Progress'; data: { percent: number; bytes: number } }
  | { event: 'Done'; data: { model_name: string } }
  | { event: 'Error'; data: { message: string } };

export interface UseModelManagerResult {
  currentModel: string | null;
  modelSize: number | null;
  downloading: boolean;
  downloadProgress: number;
  loading: boolean;
  error: string | null;
  checkModelStatus: () => Promise<void>;
  downloadModel: (modelName: string) => Promise<void>;
  deleteModel: () => Promise<void>;
}

export function useModelManager(): UseModelManagerResult {
  const [currentModel, setCurrentModel] = useState<string | null>(null);
  const [modelSize, setModelSize] = useState<number | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const checkModelStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const status = await invoke<ModelStatus>('get_model_status');
      setCurrentModel(status.downloaded_model);
      setModelSize(status.model_size_bytes);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const downloadModel = useCallback(async (modelName: string) => {
    setDownloading(true);
    setDownloadProgress(0);
    setError(null);

    const channel = new Channel<ModelDownloadEvent>();

    channel.onmessage = (message) => {
      if (message.event === 'Progress') {
        setDownloadProgress(message.data.percent);
      } else if (message.event === 'Done') {
        setCurrentModel(message.data.model_name);
        setDownloading(false);
        setDownloadProgress(100);

        // Persist selected model to settings
        Database.load('sqlite:binky.db')
          .then((db) =>
            db.execute(
              "INSERT INTO settings (key, value) VALUES ('whisper_model', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
              [message.data.model_name],
            ),
          )
          .catch(console.error);

        // Refresh size info
        invoke<ModelStatus>('get_model_status')
          .then((status) => setModelSize(status.model_size_bytes))
          .catch(console.error);
      } else if (message.event === 'Error') {
        setError(message.data.message);
        setDownloading(false);
      }
    };

    try {
      await invoke('download_whisper_model', {
        modelName,
        onEvent: channel,
      });
    } catch (err) {
      setError(String(err));
      setDownloading(false);
    }
  }, []);

  const deleteModel = useCallback(async () => {
    setError(null);
    try {
      await invoke('delete_whisper_model');
      setCurrentModel(null);
      setModelSize(null);
      setDownloadProgress(0);

      // Clear model from settings
      Database.load('sqlite:binky.db')
        .then((db) =>
          db.execute(
            "INSERT INTO settings (key, value) VALUES ('whisper_model', '') ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            [],
          ),
        )
        .catch(console.error);
    } catch (err) {
      setError(String(err));
    }
  }, []);

  useEffect(() => {
    checkModelStatus();
  }, [checkModelStatus]);

  return {
    currentModel,
    modelSize,
    downloading,
    downloadProgress,
    loading,
    error,
    checkModelStatus,
    downloadModel,
    deleteModel,
  };
}
