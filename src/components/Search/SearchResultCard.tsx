import { useTranslation } from 'react-i18next';
import type { SearchResult } from '../../hooks/useSearch';

/** Highlight matched query terms in snippet text using indexOf (NOT RegExp — safe with special chars). */
function highlightSnippet(snippet: string, query: string): React.ReactNode {
  const trimmedQ = query.trim();
  if (!trimmedQ) return snippet;
  const lower = snippet.toLowerCase();
  const lowerQ = trimmedQ.toLowerCase();
  const parts: React.ReactNode[] = [];
  let idx = 0;
  let key = 0;
  while (idx < snippet.length) {
    const found = lower.indexOf(lowerQ, idx);
    if (found === -1) {
      parts.push(snippet.slice(idx));
      break;
    }
    if (found > idx) parts.push(snippet.slice(idx, found));
    parts.push(
      <mark key={key++} className="transcript-highlight">
        {snippet.slice(found, found + lowerQ.length)}
      </mark>
    );
    idx = found + lowerQ.length;
  }
  return <>{parts}</>;
}

interface SearchResultCardProps {
  result: SearchResult;
  query: string;
}

export default function SearchResultCard({ result, query }: SearchResultCardProps) {
  const { t } = useTranslation();

  // Speaker label with fallback: null → 'Sprecher A' or 'Sprecher B' based on raw speaker string
  function getSpeakerLabel(speaker: string | null): string {
    if (!speaker) return t('pages.search.speaker_fallback_a');
    if (speaker === 'SPEAKER_0') return t('pages.search.speaker_fallback_a');
    if (speaker === 'SPEAKER_1') return t('pages.search.speaker_fallback_b');
    return speaker;
  }

  function handleClick() {
    if (result.segment_type === 'transcript') {
      window.dispatchEvent(new CustomEvent('navigate-to-transcript', {
        detail: { episodeId: result.episode_id, startMs: result.start_ms, title: result.title }
      }));
    } else {
      window.dispatchEvent(new CustomEvent('navigate-to-episode-topics', {
        detail: { episodeId: result.episode_id }
      }));
    }
  }

  const badgeLabel = result.segment_type === 'transcript'
    ? t('pages.search.badge_transcript')
    : t('pages.search.badge_topic');

  return (
    <button className="search-result-card" onClick={handleClick} type="button">
      <div className="search-result-card-meta">
        <span className="search-result-badge">{badgeLabel}</span>
        {result.segment_type === 'transcript' && (
          <span className="search-result-speaker">{getSpeakerLabel(result.speaker)}</span>
        )}
      </div>
      <p className="search-result-snippet">{highlightSnippet(result.snippet, query)}</p>
    </button>
  );
}
