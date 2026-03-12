import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import EpisodeList from '../EpisodeList/EpisodeList';
import TranscriptViewer from '../TranscriptViewer/TranscriptViewer';

interface EpisodesPageProps {
  onTranscriptionStateChange?: (isProcessing: boolean, queueCount: number) => void;
  pendingTranscriptNav?: { episodeId: number; startMs: number | null; title: string } | null;
  onTranscriptNavConsumed?: () => void;
}

interface ViewingTranscript {
  episodeId: number;
  episodeTitle: string;
  scrollToMs?: number;
}

export default function EpisodesPage({
  onTranscriptionStateChange,
  pendingTranscriptNav,
  onTranscriptNavConsumed,
}: EpisodesPageProps) {
  const { t } = useTranslation();
  const [viewingTranscript, setViewingTranscript] = useState<ViewingTranscript | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  function handleViewTranscript(episodeId: number, episodeTitle: string) {
    setViewingTranscript({ episodeId, episodeTitle });
  }

  function handleCloseTranscript() {
    setViewingTranscript(null);
  }

  function handleTranscriptDeleted() {
    setViewingTranscript(null);
    // Force EpisodeList to reload by bumping the key
    setReloadKey((k) => k + 1);
  }

  // Open TranscriptViewer when a search deep-link navigation arrives
  useEffect(() => {
    if (!pendingTranscriptNav) return;
    setViewingTranscript({
      episodeId: pendingTranscriptNav.episodeId,
      episodeTitle: pendingTranscriptNav.title,
      scrollToMs: pendingTranscriptNav.startMs ?? undefined,
    });
    onTranscriptNavConsumed?.();
  }, [pendingTranscriptNav]);

  if (viewingTranscript) {
    return (
      <TranscriptViewer
        episodeId={viewingTranscript.episodeId}
        episodeTitle={viewingTranscript.episodeTitle}
        onClose={handleCloseTranscript}
        onTranscriptDeleted={handleTranscriptDeleted}
        scrollToMs={viewingTranscript.scrollToMs}
      />
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">{t('pages.episodes.title')}</h2>
      </div>
      <EpisodeList
        key={reloadKey}
        onTranscriptionStateChange={onTranscriptionStateChange}
        onViewTranscript={handleViewTranscript}
      />
    </div>
  );
}
