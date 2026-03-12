import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearch } from '../../hooks/useSearch';
import SearchResultGroup from '../Search/SearchResultGroup';

export default function SearchPage() {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const { groups, loading } = useSearch(query);

  const isEmpty = query.trim().length < 2;
  const noResults = !isEmpty && !loading && groups.length === 0;

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">{t('nav.search')}</h2>
      </div>
      <div className="search-input-wrap">
        <input
          type="text"
          className="search-input"
          placeholder={t('pages.search.placeholder')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
      </div>
      {loading && (
        <div className="search-loading">
          <span className="spinner" />
        </div>
      )}
      {noResults && (
        <p className="search-no-results">{t('pages.search.no_results')}</p>
      )}
      {!isEmpty && !loading && groups.map((group) => (
        <SearchResultGroup key={group.episode_id} group={group} query={query} />
      ))}
    </div>
  );
}
