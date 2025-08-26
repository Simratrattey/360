import React, { useState, useEffect } from 'react';
import { ExternalLink, Globe, Image, Video, FileText } from 'lucide-react';

const LinkPreview = ({ url, message }) => {
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!url) return;

    // Simulate link preview fetching
    // In a real implementation, this would call an API to get link metadata
    const fetchLinkPreview = async () => {
      try {
        setLoading(true);
        setError(false);

        // Mock preview data - in real implementation, this would come from an API
        const mockPreviews = {
          'youtube.com': {
            title: 'Sample YouTube Video',
            description: 'This is a sample YouTube video description that would be fetched from the actual URL',
            image: '/api/placeholder/300/200',
            siteName: 'YouTube',
            type: 'video'
          },
          'github.com': {
            title: 'GitHub Repository',
            description: 'A sample GitHub repository description',
            image: '/api/placeholder/300/200',
            siteName: 'GitHub',
            type: 'website'
          },
          'twitter.com': {
            title: 'Tweet',
            description: 'Sample tweet content',
            image: '/api/placeholder/300/200',
            siteName: 'Twitter',
            type: 'social'
          }
        };

        // Extract domain for mock data
        const domain = new URL(url).hostname.replace('www.', '');
        const mockData = Object.keys(mockPreviews).find(key => domain.includes(key));
        
        if (mockData) {
          setTimeout(() => {
            setPreview({
              ...mockPreviews[mockData],
              url,
              favicon: `https://www.google.com/s2/favicons?domain=${domain}&sz=32`
            });
            setLoading(false);
          }, 500); // Reduced delay for better UX
        } else {
          // Generic preview for unknown domains
          setTimeout(() => {
            setPreview({
              title: new URL(url).hostname,
              description: 'Link preview',
              url,
              siteName: new URL(url).hostname,
              type: 'website',
              favicon: `https://www.google.com/s2/favicons?domain=${domain}&sz=32`
            });
            setLoading(false);
          }, 500); // Reduced delay for better UX
        }
      } catch (err) {
        console.error('Error fetching link preview:', err);
        setError(true);
        setLoading(false);
      }
    };

    fetchLinkPreview();
  }, [url]);

  const getTypeIcon = (type) => {
    switch (type) {
      case 'video':
        return <Video className="h-4 w-4" />;
      case 'image':
        return <Image className="h-4 w-4" />;
      case 'document':
        return <FileText className="h-4 w-4" />;
      default:
        return <Globe className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <div className="mt-2 border border-gray-200 rounded-lg p-3 bg-gray-50 animate-pulse">
        <div className="flex space-x-3">
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gray-300 rounded w-3/4"></div>
            <div className="h-3 bg-gray-300 rounded w-1/2"></div>
            <div className="h-3 bg-gray-300 rounded w-full"></div>
          </div>
          <div className="w-16 h-16 bg-gray-300 rounded"></div>
        </div>
      </div>
    );
  }

  if (error || !preview) {
    return null;
  }

  return (
    <div className="mt-2 border border-gray-200 rounded-lg overflow-hidden bg-white hover:border-gray-300 transition-colors">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="block hover:bg-gray-50 transition-colors"
      >
        <div className="p-3">
          <div className="flex space-x-3">
            <div className="flex-1 min-w-0">
              {/* Site info */}
              <div className="flex items-center space-x-2 mb-2">
                {preview.favicon && (
                  <img 
                    src={preview.favicon} 
                    alt="" 
                    className="w-4 h-4 rounded"
                    onError={(e) => e.target.style.display = 'none'}
                  />
                )}
                <span className="text-xs text-gray-500 truncate">
                  {preview.siteName || new URL(url).hostname}
                </span>
                {getTypeIcon(preview.type)}
                <ExternalLink className="h-3 w-3 text-gray-400" />
              </div>
              
              {/* Title */}
              <h4 className="font-medium text-sm text-gray-900 line-clamp-2 leading-tight mb-1">
                {preview.title}
              </h4>
              
              {/* Description */}
              {preview.description && (
                <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed">
                  {preview.description}
                </p>
              )}
              
              {/* URL */}
              <div className="mt-2 text-xs text-blue-600 truncate">
                {url}
              </div>
            </div>
            
            {/* Thumbnail - only show if we have a real image */}
            {preview.image && !preview.image.includes('placeholder') && (
              <div className="flex-shrink-0">
                <img
                  src={preview.image}
                  alt=""
                  className="w-16 h-16 object-cover rounded border bg-gray-100"
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </a>
    </div>
  );
};

export default LinkPreview;