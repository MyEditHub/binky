import SearchResultCard from './SearchResultCard';
import type { EpisodeGroup } from '../../hooks/useSearch';

interface SearchResultGroupProps {
  group: EpisodeGroup;
  query: string;
}

export default function SearchResultGroup({ group, query }: SearchResultGroupProps) {
  return (
    <div className="search-result-group">
      <h3 className="search-result-group-title">{group.title}</h3>
      {group.results.map((result, i) => (
        <SearchResultCard key={i} result={result} query={query} />
      ))}
    </div>
  );
}
