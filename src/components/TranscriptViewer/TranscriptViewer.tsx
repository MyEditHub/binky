import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useTranscript, groupIntoParagraphs } from '../../hooks/useTranscript';
import TranscriptSearch from './TranscriptSearch';

interface TranscriptViewerProps {
  episodeId: number;
  episodeTitle: string;
  onClose: () => void;
  onTranscriptDeleted: () => void;
}

/** Split text into segments: plain text and highlighted matches. */
function highlightText(text: string, query: string, isActive: (globalIdx: number) => boolean, offset: number) {
  if (!query) {
    return <>{text}</>;
  }

  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const parts: React.ReactNode[] = [];
  let idx = 0;
  let matchIdx = offset;

  while (idx < text.length) {
    const found = lowerText.indexOf(lowerQuery, idx);
    if (found === -1) {
      parts.push(text.slice(idx));
      break;
    }
    if (found > idx) {
      parts.push(text.slice(idx, found));
    }
    const active = isActive(matchIdx);
    parts.push(
      <mark
        key={matchIdx}
        className={`transcript-highlight${active ? ' transcript-highlight-active' : ''}`}
        data-match-index={matchIdx}
      >
        {text.slice(found, found + query.length)}
      </mark>
    );
    matchIdx++;
    idx = found + query.length;
  }

  return <>{parts}</>;
}

/** Count non-overlapping occurrences of query in text (case-insensitive). */
function countMatches(text: string, query: string): number {
  if (!query) return 0;
  const lower = text.toLowerCase();
  const lowerQ = query.toLowerCase();
  let count = 0;
  let idx = 0;
  while (true) {
    const found = lower.indexOf(lowerQ, idx);
    if (found === -1) break;
    count++;
    idx = found + lowerQ.length;
  }
  return count;
}

export default function TranscriptViewer({
  episodeId,
  episodeTitle,
  onClose,
  onTranscriptDeleted,
}: TranscriptViewerProps) {
  const { t } = useTranslation();
  const { transcript, loading, error, deleteTranscript } = useTranscript(episodeId);

  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [currentMatchIdx, setCurrentMatchIdx] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteBlocked, setDeleteBlocked] = useState(false);

  const bodyRef = useRef<HTMLDivElement>(null);

  // Build paragraphs from transcript
  const paragraphs = useMemo(() => {
    if (!transcript) return [];
    if (transcript.segments_json) {
      const groups = groupIntoParagraphs(transcript.segments_json);
      if (groups.length > 0) return groups;
    }
    // Fallback: split full_text by double newlines or render as single paragraph
    if (transcript.full_text) {
      return transcript.full_text
        .split(/\n{2,}/)
        .map((p, i) => ({ text: p.trim(), startMs: i * 1000 }))
        .filter((p) => p.text.length > 0);
    }
    return [];
  }, [transcript]);

  // Compute match counts per paragraph
  const matchCountsPerParagraph = useMemo(() => {
    if (!searchQuery) return paragraphs.map(() => 0);
    return paragraphs.map((p) => countMatches(p.text, searchQuery));
  }, [paragraphs, searchQuery]);

  const totalMatches = useMemo(
    () => matchCountsPerParagraph.reduce((a, b) => a + b, 0),
    [matchCountsPerParagraph]
  );

  // Clamp currentMatchIdx when totalMatches changes
  useEffect(() => {
    if (totalMatches === 0) {
      setCurrentMatchIdx(0);
    } else {
      setCurrentMatchIdx((prev) => Math.min(prev, totalMatches - 1));
    }
  }, [totalMatches]);

  // Scroll active match into view
  useEffect(() => {
    if (!searchQuery || totalMatches === 0) return;
    const el = bodyRef.current?.querySelector(`[data-match-index="${currentMatchIdx}"]`);
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [currentMatchIdx, searchQuery, totalMatches]);

  const handleNavigate = useCallback(
    (direction: 'prev' | 'next') => {
      if (totalMatches === 0) return;
      setCurrentMatchIdx((prev) => {
        if (direction === 'next') return (prev + 1) % totalMatches;
        return (prev - 1 + totalMatches) % totalMatches;
      });
    },
    [totalMatches]
  );

  const handleSearch = useCallback((q: string) => {
    setSearchQuery(q);
    setCurrentMatchIdx(0);
  }, []);

  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
    setCurrentMatchIdx(0);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    const success = await deleteTranscript(episodeId);
    if (!success) {
      setDeleteBlocked(true);
      setConfirmDelete(false);
      return;
    }
    onTranscriptDeleted();
  }, [deleteTranscript, episodeId, onTranscriptDeleted]);

  /** Get the global match offset at the start of paragraph i. */
  function getOffset(i: number): number {
    let offset = 0;
    for (let k = 0; k < i; k++) offset += matchCountsPerParagraph[k];
    return offset;
  }

  return (
    <div className="transcript-viewer">
      {/* Header */}
      <div className="transcript-header">
        <div className="transcript-header-left">
          <button
            className="transcript-back-btn"
            onClick={onClose}
            aria-label={t('pages.episodes.transcript_close')}
          >
            ←
          </button>
          <h2 className="transcript-title">{episodeTitle}</h2>
        </div>
        <div className="transcript-header-right">
          <button
            className={`transcript-search-toggle${showSearch ? ' transcript-search-toggle-active' : ''}`}
            onClick={() => {
              setShowSearch((v) => !v);
              if (showSearch) handleClearSearch();
            }}
            aria-label="Suche umschalten"
            title="Im Transkript suchen"
          >
            &#128269;
          </button>
        </div>
      </div>

      {/* Search bar */}
      {showSearch && (
        <TranscriptSearch
          query={searchQuery}
          matchCount={totalMatches}
          currentMatch={currentMatchIdx}
          onSearch={handleSearch}
          onNavigate={handleNavigate}
          onClear={handleClearSearch}
        />
      )}

      {/* Body */}
      <div className="transcript-body" ref={bodyRef}>
        {loading && (
          <div className="transcript-loading">
            <span className="spinner" />
          </div>
        )}

        {error && !loading && (
          <div className="transcript-error">{error}</div>
        )}

        {!loading && !error && paragraphs.length === 0 && (
          <div className="transcript-empty">
            {t('pages.episodes.transcript_no_text')}
          </div>
        )}

        {!loading && !error && paragraphs.length > 0 && paragraphs.map((para, i) => {
          const offset = getOffset(i);
          const isActiveMatch = (globalIdx: number) => globalIdx === currentMatchIdx;
          return (
            <p key={i} className="transcript-paragraph">
              {highlightText(para.text, searchQuery, isActiveMatch, offset)}
            </p>
          );
        })}
      </div>

      {/* Footer */}
      {transcript && (
        <div className="transcript-footer">
          <span className="transcript-footer-meta">
            {t('pages.episodes.transcript_model_info', {
              model: transcript.model_name ?? '?',
              language: transcript.language ?? '?',
            })}
          </span>
          <div className="transcript-footer-actions">
            {deleteBlocked && (
              <span className="transcript-delete-blocked">
                {t('pages.episodes.transcript_delete_blocked')}
              </span>
            )}
            {confirmDelete ? (
              <span className="transcript-delete-confirm-row">
                <span className="transcript-delete-confirm-text">
                  {t('pages.episodes.transcript_delete_confirm')}
                </span>
                <button className="transcript-delete-confirm-btn" onClick={handleDeleteConfirm}>
                  {t('pages.episodes.transcript_delete')}
                </button>
                <button
                  className="transcript-delete-cancel-btn"
                  onClick={() => {
                    setConfirmDelete(false);
                    setDeleteBlocked(false);
                  }}
                >
                  {t('common.cancel')}
                </button>
              </span>
            ) : (
              <button
                className="transcript-delete-btn"
                onClick={() => {
                  setDeleteBlocked(false);
                  setConfirmDelete(true);
                }}
              >
                {t('pages.episodes.transcript_delete')}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
