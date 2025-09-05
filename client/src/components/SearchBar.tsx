import React, { useState, useCallback, useEffect } from 'react';
import { Search, X } from 'lucide-react';

interface SearchBarProps {
  onSearch: (query: string) => void;
  onClear: () => void;
  isSearching?: boolean;
  placeholder?: string;
}

const SearchBar: React.FC<SearchBarProps> = ({ 
  onSearch, 
  onClear, 
  isSearching = false, 
  placeholder = "Search your experiences..." 
}) => {
  const [query, setQuery] = useState('');

  // Debounce search with 300ms delay
  const debounceTimeout = React.useRef<NodeJS.Timeout | null>(null);

  const debouncedSearch = useCallback((searchQuery: string) => {
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }

    debounceTimeout.current = setTimeout(() => {
      if (searchQuery.length >= 3) {
        onSearch(searchQuery);
      } else if (searchQuery.length === 0) {
        onClear();
      }
    }, 300);
  }, [onSearch, onClear]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    debouncedSearch(value);
  };

  const handleClear = () => {
    setQuery('');
    onClear();
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current);
      }
    };
  }, []);

  return (
    <div className="relative w-full mb-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
        <input
          type="text"
          value={query}
          onChange={handleInputChange}
          placeholder={placeholder}
          className="w-full pl-10 pr-10 py-3 border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-900 placeholder-gray-500"
          disabled={isSearching}
        />
        {query && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
            disabled={isSearching}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      {isSearching && (
        <div className="absolute top-full left-0 right-0 bg-white border-x border-b border-gray-200 rounded-b-lg p-3 text-sm text-gray-600">
          Searching...
        </div>
      )}
    </div>
  );
};

export default SearchBar;