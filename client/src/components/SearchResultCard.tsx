import React from 'react';
import { Mic, Camera } from 'lucide-react';
import type { SearchResult } from '../types';

interface SearchResultCardProps {
  result: SearchResult;
  onResultClick: (id: string) => void;
  searchQuery: string;
}

const SearchResultCard: React.FC<SearchResultCardProps> = ({ result, onResultClick, searchQuery }) => {
  // Format date to show month and day
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Get type icon
  const getTypeIcon = () => {
    if (result.type === 'audio') {
      return <Mic className="h-4 w-4 text-blue-600" />;
    } else {
      return <Camera className="h-4 w-4 text-green-600" />;
    }
  };

  // Get category badge color
  const getCategoryColor = () => {
    if (result.category === 'ideas') {
      return 'text-purple-700 bg-purple-100';
    } else {
      return 'text-green-700 bg-green-100';
    }
  };

  // Highlight matched text in the snippet
  const highlightSnippet = (text: string, query: string) => {
    if (!text || !query) return text;
    
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    
    // Find all matches
    const parts: JSX.Element[] = [];
    let lastIndex = 0;
    let currentIndex = lowerText.indexOf(lowerQuery, 0);
    let keyCounter = 0;
    
    while (currentIndex !== -1) {
      // Add text before match
      if (currentIndex > lastIndex) {
        parts.push(
          <span key={`before-${keyCounter}`}>
            {text.substring(lastIndex, currentIndex)}
          </span>
        );
      }
      
      // Add highlighted match
      parts.push(
        <mark key={`highlight-${keyCounter}`} className="bg-yellow-200 px-1 py-0.5 rounded">
          {text.substring(currentIndex, currentIndex + query.length)}
        </mark>
      );
      
      lastIndex = currentIndex + query.length;
      currentIndex = lowerText.indexOf(lowerQuery, lastIndex);
      keyCounter++;
    }
    
    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(
        <span key={`after-${keyCounter}`}>
          {text.substring(lastIndex)}
        </span>
      );
    }
    
    return <>{parts}</>;
  };

  return (
    <div 
      className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md cursor-pointer transition-shadow duration-200"
      onClick={() => onResultClick(result.id)}
    >
      {/* Header with title */}
      <div className="flex items-start justify-between mb-2">
        <h3 className="font-medium text-gray-900 line-clamp-2 flex-1 pr-2">
          {result.title}
        </h3>
      </div>
      
      {/* Date, type icon, and category */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm text-gray-500">
          {formatDate(result.date)}
        </span>
        <span className="text-gray-300">•</span>
        {getTypeIcon()}
        <span className={`text-xs px-2 py-1 rounded-full ${getCategoryColor()}`}>
          {result.category}
        </span>
      </div>
      
      {/* Highlighted snippet */}
      {result.snippet.text && (
        <div className="text-sm text-gray-600 line-clamp-3">
          {highlightSnippet(result.snippet.text, searchQuery)}
        </div>
      )}
      
      {/* Match count (optional, for debugging) */}
      {result.snippet.matchCount > 1 && (
        <div className="text-xs text-gray-400 mt-2">
          {result.snippet.matchCount} matches
        </div>
      )}
    </div>
  );
};

export default SearchResultCard;