import React, { useState, useEffect } from 'react';
import { Search } from 'lucide-react';

interface HeaderProps {
  showSearch?: boolean;
  searchPlaceholder?: string;
  onSearch?: (query: string) => void;
  onClearSearch?: () => void;
  searchQuery?: string;
  isSearching?: boolean;
}

const Header: React.FC<HeaderProps> = ({ 
  showSearch = false, 
  searchPlaceholder = "Search your experiences...",
  onSearch,
  onClearSearch,
  searchQuery = '',
  isSearching = false
}) => {
  const [localSearchQuery, setLocalSearchQuery] = useState(searchQuery);
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setLocalSearchQuery(searchQuery);
  }, [searchQuery]);

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }
    };
  }, [searchTimeout]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setLocalSearchQuery(value);
    
    // Clear existing timeout
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    
    // Set new timeout for debounced search
    const newTimeout = setTimeout(() => {
      if (value.trim() && onSearch) {
        onSearch(value);
      } else if (!value.trim() && onClearSearch) {
        onClearSearch();
      }
    }, 400); // 400ms debounce delay
    
    setSearchTimeout(newTimeout);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (localSearchQuery.trim() && onSearch) {
      onSearch(localSearchQuery);
    }
  };

  return (
    <>
      <style>
        {`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}
      </style>
      <header style={styles.header}>
        <div style={styles.headerContent}>
          <div style={styles.titleSection}>
            <h1 style={styles.appName}>Replay</h1>
          </div>
          
          {showSearch && (
            <form onSubmit={handleSearchSubmit} style={styles.searchSection}>
              <div style={styles.searchContainer}>
                <Search size={20} style={styles.searchIcon} />
                <input
                  type="text"
                  placeholder={searchPlaceholder}
                  value={localSearchQuery}
                  onChange={handleSearchChange}
                  style={styles.searchInput}
                  disabled={isSearching}
                />
                {isSearching && (
                  <div style={styles.searchSpinner}>
                    <div style={styles.spinner} />
                  </div>
                )}
              </div>
            </form>
          )}
        </div>
      </header>
    </>
  );
};

const styles = {
  header: {
    backgroundColor: '#f8f9ff',
    padding: '1.5rem 1rem 1rem 1rem',
    position: 'sticky' as const,
    top: 0,
    left: 0,
    right: 0,
    width: '100%',
    zIndex: 100,
    boxSizing: 'border-box' as const,
  },
  headerContent: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '1rem',
    maxWidth: '100%',
    margin: '0 auto',
    boxSizing: 'border-box',
  },
  titleSection: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  appName: {
    fontSize: '2rem',
    fontWeight: '700',
    color: '#6366f1',
    margin: 0,
    fontFamily: 'system-ui, -apple-system, sans-serif',
    letterSpacing: '-0.025em',
  },
  searchSection: {
    width: '100%',
  },
  searchContainer: {
    position: 'relative' as const,
    display: 'flex',
    alignItems: 'center',
  },
  searchIcon: {
    position: 'absolute' as const,
    left: '12px',
    color: '#9ca3af',
    zIndex: 1,
  },
  searchInput: {
    width: '100%',
    padding: '12px 12px 12px 44px',
    borderRadius: '12px',
    border: 'none',
    backgroundColor: '#ffffff',
    fontSize: '16px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#374151',
    outline: 'none',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
    boxSizing: 'border-box',
    '::placeholder': {
      color: '#9ca3af',
    },
  },
  searchSpinner: {
    position: 'absolute' as const,
    right: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinner: {
    width: '16px',
    height: '16px',
    border: '2px solid #e5e7eb',
    borderTop: '2px solid #6366f1',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
};

export default Header;