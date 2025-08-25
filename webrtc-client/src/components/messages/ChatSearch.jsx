import React, { useState, useRef, useEffect } from 'react';
import { Search, X, ChevronDown, ChevronUp, Calendar, User, FileText, Image, MessageCircle } from 'lucide-react';
import { formatFileSize } from '../../api/messageService';

export default function ChatSearch({
  onSearch,
  onClose,
  searchResults = [],
  isSearching = false,
  currentResult = 0,
  totalResults = 0,
  onNavigateResult,
  onClearSearch
}) {
  const [query, setQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    type: 'all', // all, text, file, image
    sender: 'all', // all, me, specific user
    dateRange: 'all', // all, today, week, month, custom
    customDate: { start: '', end: '' }
  });
  const [searchHistory, setSearchHistory] = useState([]);
  const inputRef = useRef(null);

  useEffect(() => {
    // Load search history from localStorage
    const history = JSON.parse(localStorage.getItem('chatSearchHistory') || '[]');
    setSearchHistory(history.slice(0, 5)); // Keep only last 5 searches
  }, []);

  useEffect(() => {
    // Focus input when component mounts
    inputRef.current?.focus();
  }, []);

  const handleSearch = (searchQuery = query) => {
    if (!searchQuery.trim()) return;
    
    // Add to search history
    const newHistory = [searchQuery, ...searchHistory.filter(h => h !== searchQuery)].slice(0, 5);
    setSearchHistory(newHistory);
    localStorage.setItem('chatSearchHistory', JSON.stringify(newHistory));
    
    // Perform search with filters
    onSearch(searchQuery, filters);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch();
    }
    if (e.key === 'Escape') {
      onClose();
    }
  };

  const clearSearch = () => {
    setQuery('');
    onClearSearch();
    inputRef.current?.focus();
  };

  const applyFilter = (filterType, value) => {
    const newFilters = { ...filters, [filterType]: value };
    setFilters(newFilters);
    if (query.trim()) {
      handleSearch(query);
    }
  };

  const formatResultDate = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    
    if (messageDate.getTime() === today.getTime()) {
      return `Today ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else if (messageDate.getTime() === today.getTime() - 86400000) {
      return `Yesterday ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else {
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
  };

  const getMessagePreview = (result) => {
    if (result.text) {
      // Highlight search term in text
      const regex = new RegExp(`(${query})`, 'gi');
      const highlightedText = result.text.replace(regex, '<mark class="bg-yellow-200 font-bold">$1</mark>');
      return (
        <div 
          className="text-sm text-gray-700"
          dangerouslySetInnerHTML={{ __html: highlightedText }}
        />
      );
    } else if (result.file) {
      return (
        <div className="flex items-center space-x-2 text-sm text-gray-600">
          {result.file.type?.startsWith('image/') ? <Image size={16} /> : <FileText size={16} />}
          <span>{result.file.name}</span>
          <span className="text-xs">({formatFileSize(result.file.size)})</span>
        </div>
      );
    }
    return <span className="text-sm text-gray-500 italic">Message content</span>;
  };

  return (
    <div className="border-b border-gray-200 bg-gradient-to-r from-blue-50 via-white to-purple-50">
      {/* Search Input */}
      <div className="p-4">
        <div className="flex items-center space-x-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Search messages, files, or media..."
              className="w-full pl-10 pr-10 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white shadow-sm"
            />
            {query && (
              <button
                onClick={clearSearch}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 rounded-full hover:bg-gray-100"
              >
                <X className="h-4 w-4 text-gray-400" />
              </button>
            )}
          </div>
          
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-3 rounded-xl border transition-colors ${
              showFilters 
                ? 'bg-blue-100 border-blue-300 text-blue-700' 
                : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
            title="Search Filters"
          >
            <ChevronDown className={`h-4 w-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>

          <button
            onClick={onClose}
            className="p-3 rounded-xl bg-white border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
            title="Close Search"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Search History */}
        {!query && searchHistory.length > 0 && (
          <div className="mt-3">
            <div className="text-xs font-medium text-gray-500 mb-2">Recent searches:</div>
            <div className="flex flex-wrap gap-2">
              {searchHistory.map((historyQuery, index) => (
                <button
                  key={index}
                  onClick={() => {
                    setQuery(historyQuery);
                    handleSearch(historyQuery);
                  }}
                  className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded-full transition-colors"
                >
                  {historyQuery}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Search Filters */}
        {showFilters && (
          <div className="mt-4 p-4 bg-white rounded-xl border border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Message Type Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Message Type</label>
                <select
                  value={filters.type}
                  onChange={(e) => applyFilter('type', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Messages</option>
                  <option value="text">Text Only</option>
                  <option value="file">Files & Documents</option>
                  <option value="image">Images & Media</option>
                </select>
              </div>

              {/* Sender Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">From</label>
                <select
                  value={filters.sender}
                  onChange={(e) => applyFilter('sender', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">Anyone</option>
                  <option value="me">Me</option>
                </select>
              </div>

              {/* Date Range Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
                <select
                  value={filters.dateRange}
                  onChange={(e) => applyFilter('dateRange', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Time</option>
                  <option value="today">Today</option>
                  <option value="week">This Week</option>
                  <option value="month">This Month</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Search Results Summary */}
        {query && (
          <div className="mt-3 flex items-center justify-between">
            <div className="text-sm text-gray-600">
              {isSearching ? (
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  <span>Searching...</span>
                </div>
              ) : totalResults > 0 ? (
                <span>{totalResults} result{totalResults !== 1 ? 's' : ''} found</span>
              ) : query ? (
                <span>No results found</span>
              ) : null}
            </div>
            
            {totalResults > 0 && (
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-500">
                  {currentResult + 1} of {totalResults}
                </span>
                <div className="flex space-x-1">
                  <button
                    onClick={() => onNavigateResult('previous')}
                    disabled={currentResult <= 0}
                    className="p-1 rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronUp className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => onNavigateResult('next')}
                    disabled={currentResult >= totalResults - 1}
                    className="p-1 rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Search Results List */}
      {searchResults.length > 0 && (
        <div className="max-h-60 overflow-y-auto border-t border-gray-200">
          {searchResults.map((result, index) => (
            <div
              key={result._id}
              className={`p-3 border-b border-gray-100 cursor-pointer hover:bg-blue-50 transition-colors ${
                index === currentResult ? 'bg-blue-100 border-blue-300' : ''
              }`}
              onClick={() => onNavigateResult('goto', index)}
            >
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-purple-400 rounded-full flex items-center justify-center text-white text-sm font-bold">
                    {result.sender?.fullName?.charAt(0) || result.sender?.username?.charAt(0) || 'U'}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-900 truncate">
                      {result.sender?.fullName || result.sender?.username || 'Unknown User'}
                    </span>
                    <span className="text-xs text-gray-500 ml-2">
                      {formatResultDate(result.createdAt)}
                    </span>
                  </div>
                  {getMessagePreview(result)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}