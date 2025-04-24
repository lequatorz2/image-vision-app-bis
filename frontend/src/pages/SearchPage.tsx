import { useState, useEffect } from 'react';
import './SearchPage.css';
import SearchBar from '../components/SearchBar';
import HexagonalGrid from '../components/HexagonalGrid';
import MetadataVisualizer from '../components/MetadataVisualizer';
import { searchImages } from '../api';
import { Image } from '../types';

interface SearchPageProps {
  images: Image[];
}

interface FilterGroup {
  name: string;
  field: string;
  options: string[];
}

const SearchPage: React.FC<SearchPageProps> = ({ images: initialImages }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [searchResults, setSearchResults] = useState<Image[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchPerformed, setSearchPerformed] = useState(false);
  const [availableFilters, setAvailableFilters] = useState<FilterGroup[]>([]);
  const [selectedFilterGroup, setSelectedFilterGroup] = useState<string | null>(null);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showVisualizer, setShowVisualizer] = useState(false);

  // Initialize with the full image collection
  useEffect(() => {
    setSearchResults(initialImages);
    
    // Extract available filter options from the initial images
    if (initialImages.length > 0) {
      extractFilterOptions(initialImages);
    }
    
    // Load search history from localStorage
    const savedHistory = localStorage.getItem('searchHistory');
    if (savedHistory) {
      try {
        setSearchHistory(JSON.parse(savedHistory));
      } catch (error) {
        console.error('Error parsing search history:', error);
      }
    }
  }, [initialImages]);

  // Extract filter options from the image collection
  const extractFilterOptions = (images: Image[]) => {
    const mediums = new Set<string>();
    const styles = new Set<string>();
    const moods = new Set<string>();
    const environments = new Set<string>();
    const colors = new Set<string>();
    
    images.forEach(image => {
      const metadata = image.metadata;
      
      if (metadata.medium) mediums.add(metadata.medium);
      if (metadata.style) styles.add(metadata.style);
      if (metadata.mood) moods.add(metadata.mood);
      if (metadata.environment) environments.add(metadata.environment);
      
      if (metadata.colors && Array.isArray(metadata.colors)) {
        metadata.colors.forEach(color => colors.add(color));
      }
    });
    
    const filterGroups: FilterGroup[] = [
      { name: 'Medium', field: 'medium', options: Array.from(mediums).sort() },
      { name: 'Style', field: 'style', options: Array.from(styles).sort() },
      { name: 'Mood', field: 'mood', options: Array.from(moods).sort() },
      { name: 'Environment', field: 'environment', options: Array.from(environments).sort() },
      { name: 'Colors', field: 'colors', options: Array.from(colors).sort() },
    ];
    
    setAvailableFilters(filterGroups);
  };

  // Handle search with query and filters
  const handleSearch = async (query: string, selectedFilters: Record<string, string>) => {
    if (!query && Object.keys(selectedFilters).length === 0) {
      // If no query or filters, show all images
      setSearchResults(initialImages);
      setSearchPerformed(false);
      setShowVisualizer(false);
      return;
    }
    
    setIsLoading(true);
    setSearchQuery(query);
    setFilters(selectedFilters);
    
    try {
      // Add to search history if it's a new query
      if (query && !searchHistory.includes(query)) {
        const newHistory = [query, ...searchHistory.slice(0, 9)]; // Keep only the 10 most recent
        setSearchHistory(newHistory);
        localStorage.setItem('searchHistory', JSON.stringify(newHistory));
      }
      
      // Perform server-side search
      const results = await searchImages(query, selectedFilters);
      setSearchResults(results);
      setSearchPerformed(true);
      
      // Show visualizer if we have enough results
      setShowVisualizer(results.length >= 3);
    } catch (error) {
      console.error('Search error:', error);
      // Fallback to client-side filtering if server search fails
      const filteredResults = performClientSideSearch(initialImages, query, selectedFilters);
      setSearchResults(filteredResults);
      setSearchPerformed(true);
      
      // Show visualizer if we have enough results
      setShowVisualizer(filteredResults.length >= 3);
    } finally {
      setIsLoading(false);
    }
  };

  // Fallback client-side search function
  const performClientSideSearch = (
    images: Image[], 
    query: string, 
    selectedFilters: Record<string, string>
  ): Image[] => {
    return images.filter(image => {
      const metadata = image.metadata;
      
      // Check if the image matches all selected filters
      for (const [field, value] of Object.entries(selectedFilters)) {
        if (!value) continue;
        
        const filterValue = value.toLowerCase();
        
        switch (field) {
          case 'medium':
            if (!metadata.medium?.toLowerCase().includes(filterValue)) return false;
            break;
          case 'style':
            if (!metadata.style?.toLowerCase().includes(filterValue)) return false;
            break;
          case 'mood':
            if (!metadata.mood?.toLowerCase().includes(filterValue)) return false;
            break;
          case 'environment':
            if (!metadata.environment?.toLowerCase().includes(filterValue)) return false;
            break;
          case 'colors':
            if (!metadata.colors?.some(color => color.toLowerCase().includes(filterValue))) return false;
            break;
          case 'people':
            const hasMatchingPeople = 
              metadata.people?.number?.toString().includes(filterValue) ||
              metadata.people?.gender?.toLowerCase().includes(filterValue);
            if (!hasMatchingPeople) return false;
            break;
          case 'actions':
            if (!metadata.actions?.toLowerCase().includes(filterValue)) return false;
            break;
          case 'clothes':
            if (!metadata.clothes?.toLowerCase().includes(filterValue)) return false;
            break;
        }
      }
      
      // If no search query, return all images that match the filters
      if (!query) return true;
      
      // Check if the image matches the search query
      const queryLower = query.toLowerCase();
      return (
        metadata.medium?.toLowerCase().includes(queryLower) ||
        metadata.style?.toLowerCase().includes(queryLower) ||
        metadata.mood?.toLowerCase().includes(queryLower) ||
        metadata.environment?.toLowerCase().includes(queryLower) ||
        metadata.colors?.some(color => color.toLowerCase().includes(queryLower)) ||
        metadata.people?.gender?.toLowerCase().includes(queryLower) ||
        metadata.actions?.toLowerCase().includes(queryLower) ||
        metadata.clothes?.toLowerCase().includes(queryLower) ||
        metadata.scene?.toLowerCase().includes(queryLower)
      );
    });
  };

  // Handle filter group selection
  const handleFilterGroupSelect = (groupField: string) => {
    setSelectedFilterGroup(prev => prev === groupField ? null : groupField);
  };

  // Handle filter selection
  const handleFilterSelect = (field: string, value: string) => {
    setFilters(prev => ({
      ...prev,
      [field]: prev[field] === value ? '' : value
    }));
    
    // Perform search with the updated filters
    handleSearch(searchQuery, {
      ...filters,
      [field]: filters[field] === value ? '' : value
    });
  };

  // Handle clicking on a search history item
  const handleHistoryClick = (query: string) => {
    setSearchQuery(query);
    handleSearch(query, filters);
    setShowHistory(false);
  };

  // Clear all filters and search query
  const handleClearSearch = () => {
    setSearchQuery('');
    setFilters({});
    setSearchResults(initialImages);
    setSearchPerformed(false);
    setShowVisualizer(false);
  };

  return (
    <div className="search-page">
      <div className="page-header">
        <h1>Advanced Image Search</h1>
        <p className="subtitle">Find exactly what you're looking for in your image collection</p>
      </div>
      
      <div className="search-tools">
        <div className="search-bar-wrapper">
          <SearchBar 
            onSearch={handleSearch}
            initialQuery={searchQuery}
            initialFilters={filters}
          />
          
          {searchPerformed && (
            <div className="search-meta">
              <p>
                Found <span className="results-count">{searchResults.length}</span> results
                {searchQuery && <span> for "<span className="search-term">{searchQuery}</span>"</span>}
              </p>
              
              <button 
                className="clear-search-button"
                onClick={handleClearSearch}
              >
                Clear Search
              </button>
            </div>
          )}
        </div>
        
        <div className="search-history-button-wrapper">
          <button 
            className="search-history-button"
            onClick={() => setShowHistory(!showHistory)}
            aria-label="Search History"
            title="Search History"
          >
            <span className="history-icon">⏱️</span>
          </button>
          
          {showHistory && searchHistory.length > 0 && (
            <div className="search-history-dropdown">
              <div className="history-header">Recent Searches</div>
              <div className="history-list">
                {searchHistory.map((query, index) => (
                  <div 
                    key={index} 
                    className="history-item"
                    onClick={() => handleHistoryClick(query)}
                  >
                    <span className="history-query">{query}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      
      {showVisualizer && searchResults.length >= 3 && (
        <MetadataVisualizer images={searchResults} />
      )}
      
      <div className="search-content">
        <div className="filter-sidebar">
          <div className="filter-sidebar-header">
            <h2>Filters</h2>
            {Object.values(filters).some(v => v) && (
              <button 
                className="clear-filters-button"
                onClick={() => handleSearch(searchQuery, {})}
              >
                Clear All
              </button>
            )}
          </div>
          
          {availableFilters.map(group => (
            <div key={group.field} className="filter-group">
              <div 
                className={`filter-group-header ${selectedFilterGroup === group.field ? 'active' : ''}`}
                onClick={() => handleFilterGroupSelect(group.field)}
              >
                <h3>{group.name}</h3>
                <span className="expand-icon">{selectedFilterGroup === group.field ? '−' : '+'}</span>
              </div>
              
              {selectedFilterGroup === group.field && (
                <div className="filter-options">
                  {group.options.map(option => (
                    <label 
                      key={option} 
                      className={`filter-option ${filters[group.field] === option ? 'selected' : ''}`}
                    >
                      <input 
                        type="checkbox"
                        checked={filters[group.field] === option}
                        onChange={() => handleFilterSelect(group.field, option)}
                      />
                      <span className="option-name">{option}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
        
        <div className="search-results">
          {isLoading ? (
            <div className="loading-container">
              <div className="loading-spinner"></div>
              <p>Searching images...</p>
            </div>
          ) : searchResults.length > 0 ? (
            <HexagonalGrid images={searchResults} />
          ) : (
            <div className="no-results">
              <div className="no-results-icon">🔍</div>
              <h3>No Images Found</h3>
              <p>Try adjusting your search terms or filters to find what you're looking for.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SearchPage;