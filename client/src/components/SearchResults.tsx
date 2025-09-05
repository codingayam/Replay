import React from 'react';
import { Search } from 'lucide-react';
import type { SearchResult } from '../types';
import SearchResultCard from './SearchResultCard';

interface SearchResultsProps {
  results: SearchResult[];
  isLoading: boolean;
  query: string;
  totalCount: number;
  onResultClick: (id: string) => void;
}

const SearchResults: React.FC<SearchResultsProps> = ({
  results,
  isLoading,
  query,
  totalCount,
  onResultClick,
}) => {
  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center gap-2 text-gray-500">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-900"></div>
          <span>Searching...</span>
        </div>
      </div>
    );
  }

  // No results state
  if (!isLoading && results.length === 0 && query.length >= 3) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Search className="h-12 w-12 text-gray-300 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No results found</h3>
        <p className="text-gray-500 max-w-md">
          No experiences match "<span className="font-medium">{query}</span>". 
          Try different keywords or check your spelling.
        </p>
        <div className="mt-4 text-sm text-gray-400">
          <p>Search tips:</p>
          <ul className="list-disc list-inside mt-1 text-left">
            <li>Try broader terms</li>
            <li>Check for typos</li>
            <li>Use different keywords</li>
          </ul>
        </div>
      </div>
    );
  }

  // Results found state
  if (!isLoading && results.length > 0) {
    return (
      <div className="space-y-4">
        {/* Results count header */}
        <div className="flex items-center justify-between border-b border-gray-200 pb-2">
          <div className="text-sm text-gray-600">
            <span className="font-medium">{totalCount}</span> result{totalCount !== 1 ? 's' : ''} found
            {query && (
              <>
                {' '}for "<span className="font-medium text-gray-900">{query}</span>"
              </>
            )}
          </div>
        </div>

        {/* Results list */}
        <div className="space-y-3">
          {results.map((result) => (
            <SearchResultCard
              key={result.id}
              result={result}
              onResultClick={onResultClick}
              searchQuery={query}
            />
          ))}
        </div>

        {/* Footer with total count if many results */}
        {totalCount > 10 && (
          <div className="text-center text-sm text-gray-500 py-4 border-t border-gray-200">
            Showing {Math.min(results.length, totalCount)} of {totalCount} results
          </div>
        )}
      </div>
    );
  }

  // Default empty state (when query is less than 3 characters)
  return null;
};

export default SearchResults;