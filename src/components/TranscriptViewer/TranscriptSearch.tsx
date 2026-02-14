import { useTranslation } from 'react-i18next';

interface TranscriptSearchProps {
  query: string;
  matchCount: number;
  currentMatch: number;
  onSearch: (query: string) => void;
  onNavigate: (direction: 'prev' | 'next') => void;
  onClear: () => void;
}

export default function TranscriptSearch({
  query,
  matchCount,
  currentMatch,
  onSearch,
  onNavigate,
  onClear,
}: TranscriptSearchProps) {
  const { t } = useTranslation();

  return (
    <div className="transcript-search">
      <div className="transcript-search-input-wrap">
        <input
          type="text"
          className="transcript-search-input"
          placeholder={t('pages.episodes.transcript_search_placeholder')}
          value={query}
          onChange={(e) => onSearch(e.target.value)}
          autoFocus
        />
        {query && (
          <button
            className="transcript-search-clear"
            onClick={onClear}
            title="Suche löschen"
            aria-label="Suche löschen"
          >
            ×
          </button>
        )}
      </div>

      {query && (
        <div className="transcript-search-nav">
          {matchCount > 0 ? (
            <span className="transcript-search-count">
              {t('pages.episodes.transcript_search_results', {
                current: matchCount > 0 ? currentMatch + 1 : 0,
                total: matchCount,
              })}
            </span>
          ) : (
            <span className="transcript-search-count transcript-search-no-results">
              {t('pages.episodes.transcript_no_results')}
            </span>
          )}
          <button
            className="transcript-search-nav-btn"
            onClick={() => onNavigate('prev')}
            disabled={matchCount === 0}
            title="Vorherige Übereinstimmung"
            aria-label="Vorherige Übereinstimmung"
          >
            ▲
          </button>
          <button
            className="transcript-search-nav-btn"
            onClick={() => onNavigate('next')}
            disabled={matchCount === 0}
            title="Nächste Übereinstimmung"
            aria-label="Nächste Übereinstimmung"
          >
            ▼
          </button>
        </div>
      )}
    </div>
  );
}
