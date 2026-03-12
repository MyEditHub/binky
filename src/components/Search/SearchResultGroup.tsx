import SearchResultCard from './SearchResultCard';
import type { EpisodeGroup } from '../../hooks/useSearch';

interface SearchResultGroupProps {
  group: EpisodeGroup;
  query: string;
  host0Name: string | null;
  host1Name: string | null;
}

export default function SearchResultGroup({ group, query, host0Name, host1Name }: SearchResultGroupProps) {
  return (
    <div className="search-result-group">
      <h3 className="search-result-group-title">{group.title}</h3>
      {group.results.map((result, i) => (
        <SearchResultCard key={i} result={result} query={query} host0Name={host0Name} host1Name={host1Name} />
      ))}
    </div>
  );
}
