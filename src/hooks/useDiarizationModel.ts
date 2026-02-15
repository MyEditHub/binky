import { useState, useEffect, useCallback } from 'react';
import { invoke, Channel } from '@tauri-apps/api/core';

interface DiarizationModelStatus {
  segmentation_downloaded: boolean;
  embedding_downloaded: boolean;
  models_dir: string;
}

type DiarizationModelDownloadEvent =
  | { event: 'Progress'; data: { percent: number; bytes: number } }
  | { event: 'Done'; data: Record<string, never> }
  | { event: 'Error'; data: { message: string } };

export function useDiarizationModel() {
  const [segmentationDownloaded, setSegmentationDownloaded] = useState(false);
  const [embeddingDownloaded, setEmbeddingDownloaded] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const checkStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const status = await invoke<DiarizationModelStatus>(
        'get_diarization_model_status',
      );
      setSegmentationDownloaded(status.segmentation_downloaded);
      setEmbeddingDownloaded(status.embedding_downloaded);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void checkStatus();
  }, [checkStatus]);

  const downloadModels = useCallback(async () => {
    setDownloading(true);
    setDownloadProgress(0);
    setError(null);

    const channel = new Channel<DiarizationModelDownloadEvent>();
    channel.onmessage = (message) => {
      if (message.event === 'Progress') {
        setDownloadProgress(message.data.percent);
      } else if (message.event === 'Done') {
        setDownloading(false);
        setDownloadProgress(100);
        void checkStatus();
      } else if (message.event === 'Error') {
        setError(message.data.message);
        setDownloading(false);
      }
    };

    try {
      await invoke('download_diarization_models', { onEvent: channel });
    } catch (err) {
      setError(String(err));
      setDownloading(false);
    }
  }, [checkStatus]);

  const deleteModels = useCallback(async () => {
    setError(null);
    try {
      await invoke('delete_diarization_models');
      setSegmentationDownloaded(false);
      setEmbeddingDownloaded(false);
      setDownloadProgress(0);
    } catch (err) {
      setError(String(err));
    }
  }, []);

  return {
    segmentationDownloaded,
    embeddingDownloaded,
    allDownloaded: segmentationDownloaded && embeddingDownloaded,
    downloading,
    downloadProgress,
    loading,
    error,
    checkStatus,
    downloadModels,
    deleteModels,
  };
}
