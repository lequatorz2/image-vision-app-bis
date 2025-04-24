import { useState, useEffect, useRef } from 'react';
import { naturalLanguageSearch } from '../api';
import './SearchBar.css';

interface SearchBarProps {
  onSearch: (query: string, filters: Record<string, string>) => void;
  initialQuery?: string;
  initialFilters?: Record<string, string>;
}

const SearchBar: React.FC<SearchBarProps> = ({ 
  onSearch, 
  initialQuery = '', 
  initialFilters = {} 
}) => {
  const [query, setQuery] = useState(initialQuery);
  const [filters, setFilters] = useState<Record<string, string>>(initialFilters);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [inputMode, setInputMode] = useState<'standard' | 'natural'>('standard');
  const [isLoading, setIsLoading] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Predefined search suggestions
  const searchSuggestions = [
    { query: "outdoor portraits", description: "Find portrait images taken outdoors" },
    { query: "abstract art with blue colors", description: "Abstract artwork featuring blue tones" },
    { query: "people dancing", description: "Images of people performing dance actions" },
    { query: "happy mood nature", description: "Natural scenes with a happy atmosphere" },
    { query: "vintage style photography", description: "Photos with a vintage aesthetic" },
    { query: "people wearing formal clothes", description: "Images of people in formal attire" },
  ];

  // Natural language suggestions
  const nlSuggestions = [
    { query: "Find photos of people in outdoor environments", description: "Searches for outdoor portraits" },
    { query: "Show me digital art with a mysterious mood", description: "Searches for digital art with mysterious atmosphere" },
    { query: "I want to see paintings with blue and red colors", description: "Finds paintings with blue and red tones" },
    { query: "Look for images with people wearing formal clothes", description: "Searches for formal attire images" },
    { query: "Find pictures of nature with a peaceful mood", description: "Searches for peaceful nature scenes" },
    { query: "Show artwork in abstract style", description: "Finds abstract artwork" },
  ];

  // Natural language patterns to extract filters
  const nlpPatterns = [
    { regex: /medium(?:\s+is|\s*:\s*)?\s+"?([a-zA-Z\s]+)"?/i, filter: 'medium' },
    { regex: /style(?:\s+is|\s*:\s*)?\s+"?([a-zA-Z\s]+)"?/i, filter: 'style' },
    { regex: /mood(?:\s+is|\s*:\s*)?\s+"?([a-zA-Z\s]+)"?/i, filter: 'mood' },
    { regex: /environment(?:\s+is|\s*:\s*)?\s+"?([a-zA-Z\s]+)"?/i, filter: 'environment' },
    { regex: /colors?(?:\s+(?:is|are|includes?)|\s*:\s*)?\s+"?([a-zA-Z\s,]+)"?/i, filter: 'colors' },
    { regex: /people(?:\s+(?:is|are)|\s*:\s*)?\s+"?([a-zA-Z0-9\s]+)"?/i, filter: 'people' },
    { regex: /actions?(?:\s+(?:is|are|includes?)|\s*:\s*)?\s+"?([a-zA-Z\s]+)"?/i, filter: 'actions' },
    { regex: /clothes?(?:\s+(?:is|are)|\s*:\s*)?\s+"?([a-zA-Z\s]+)"?/i, filter: 'clothes' },
  ];

  useEffect(() => {
    // Close suggestions when clicking outside
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        searchInputRef.current &&
        !searchInputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSearch = async () => {
    if (!query.trim()) {
      onSearch('', {});
      return;
    }
    
    if (inputMode === 'natural') {
      // Use AI-powered natural language search
      try {
        setIsLoading(true);
        setProcessingMessage('Analyzing your query...');
        
        const { results, extractedCriteria } = await naturalLanguageSearch(query);
        
        // Show what the AI extracted
        setFilters(extractedCriteria.filters);
        
        // Perform the search with the results from the AI
        onSearch('', extractedCriteria.filters);
      } catch (error) {
        console.error('Natural language search error:', error);
        
        // Fallback to client-side extraction
        const extractedFilters = processNaturalLanguageQuery(query);
        setFilters(extractedFilters);
        onSearch(query, extractedFilters);
      } finally {
        setIsLoading(false);
        setProcessingMessage('');
      }
    } else {
      // Standard search
      onSearch(query, filters);
    }
    
    setShowSuggestions(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setQuery(suggestion);
    setShowSuggestions(false);
    
    // Focus the input after selection
    setTimeout(() => {
      searchInputRef.current?.focus();
      
      // If in natural language mode, process the query immediately
      if (inputMode === 'natural') {
        const extractedFilters = processNaturalLanguageQuery(suggestion);
        setFilters(prev => ({ ...prev, ...extractedFilters }));
      }
    }, 100);
  };

  const handleInputFocus = () => {
    setShowSuggestions(true);
  };

  const toggleInputMode = () => {
    setInputMode(prevMode => (prevMode === 'standard' ? 'natural' : 'standard'));
    // Clear filters when switching modes
    setFilters({});
    // Focus the input field
    setTimeout(() => searchInputRef.current?.focus(), 100);
  };

  // Process natural language query to extract filters
  const processNaturalLanguageQuery = (text: string): Record<string, string> => {
    const extractedFilters: Record<string, string> = {};
    
    nlpPatterns.forEach(({ regex, filter }) => {
      const match = text.match(regex);
      if (match && match[1]) {
        // Clean up the extracted value
        const value = match[1].trim().replace(/^"(.*)"$/, '$1');
        extractedFilters[filter] = value;
      }
    });
    
    return extractedFilters;
  };

  // Handle real-time extraction of filters in natural language mode
  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = e.target.value;
    setQuery(newQuery);
    
    if (inputMode === 'natural') {
      // Extract filters from the natural language query in real-time
      const extractedFilters = processNaturalLanguageQuery(newQuery);
      setFilters(extractedFilters);
    }
  };

  return (
    <div className="search-bar-container">
      <div className="input-container">
        <div className="search-input-wrapper">
          <div className="search-icon">🔍</div>
          <input
            ref={searchInputRef}
            type="text"
            className={`search-input ${inputMode === 'natural' ? 'natural-mode' : ''}`}
            placeholder={inputMode === 'natural' 
              ? "Try 'Find photos of people in outdoor environments'"
              : "Search images..."}
            value={query}
            onChange={handleQueryChange}
            onKeyPress={handleKeyPress}
            onFocus={handleInputFocus}
            disabled={isLoading}
          />
          <button 
            className={`search-button ${isLoading ? 'loading' : ''}`}
            onClick={handleSearch}
            disabled={isLoading}
          >
            {isLoading ? 'Processing...' : 'Search'}
          </button>
          <button
            className={`mode-toggle ${inputMode === 'natural' ? 'natural-active' : ''}`}
            onClick={toggleInputMode}
            title={inputMode === 'natural' ? 'Switch to standard search' : 'Switch to AI-powered natural language search'}
            disabled={isLoading}
          >
            {inputMode === 'natural' ? 'AI' : 'A'}
          </button>
        </div>
        
        {showSuggestions && (
          <div className="search-suggestions" ref={suggestionsRef}>
            <div className="suggestions-header">
              {inputMode === 'natural' ? 'Natural Language Examples' : 'Suggested Searches'}
            </div>
            <div className="suggestions-list">
              {(inputMode === 'natural' ? nlSuggestions : searchSuggestions).map((suggestion, index) => (
                <div 
                  key={index} 
                  className="suggestion-item"
                  onClick={() => handleSuggestionClick(suggestion.query)}
                >
                  <div className="suggestion-query">{suggestion.query}</div>
                  <div className="suggestion-description">{suggestion.description}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      
      {isLoading && processingMessage && (
        <div className="processing-message">
          <div className="processing-indicator"></div>
          <span>{processingMessage}</span>
        </div>
      )}
      
      {inputMode === 'natural' && Object.keys(filters).length > 0 && !isLoading && (
        <div className="extracted-filters">
          <div className="filters-title">Detected Filters:</div>
          <div className="filters-list">
            {Object.entries(filters).map(([key, value]) => (
              <div key={key} className="filter-tag">
                <span className="filter-name">{key}:</span> 
                <span className="filter-value">{value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchBar;