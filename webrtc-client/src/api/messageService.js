import API from './client';

/**
 * Fetch messages for a conversation.
 *
 * @param {string} conversationId The ID of the conversation to fetch.
 * @param {Object} [params] Optional query parameters for pagination (e.g. { limit, skip }).
 * @returns {Promise} The API response promise.
 */
export const getMessages = (conversationId, params = {}) => {
  // When params is provided, pass it to axios so that query parameters are included in the request.
  // If no params are given, axios will simply ignore the empty params object.
  return API.get(`/messages/conversation/${conversationId}`, { params });
};
export const sendMessage = (conversationId, data) => API.post(`/messages/conversation/${conversationId}`, data);
export const editMessage = (messageId, data) => API.put(`/messages/${messageId}`, data);
export const deleteMessage = (messageId) => API.delete(`/messages/${messageId}`);
export const reactMessage = (messageId, emoji) => API.post(`/messages/${messageId}/react`, { emoji });
export const unreactMessage = (messageId, emoji) => API.post(`/messages/${messageId}/unreact`, { emoji });
export const searchMessages = (conversationId, params = {}) => API.get(`/messages/conversation/${conversationId}/search`, { params });
export const uploadMessageFile = (file) => {
  const formData = new FormData();
  formData.append('file', file);
  return API.post('/messages/upload', formData, { 
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (progressEvent) => {
      const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
      // Upload progress tracking
    }
  });
};
export const getFileUrl = (filename) => {
  return `${import.meta.env.VITE_API_URL}/uploads/messages/${filename}`;
};

// Helper function to construct proper file URL from file object
export const constructFileUrl = (fileObj) => {
  if (!fileObj) {
    console.warn('[File URL] No file object provided');
    return null;
  }
  
  if (!fileObj.url) {
    console.warn('[File URL] No URL in file object:', fileObj);
    return null;
  }
  
  let url = fileObj.url;
  const baseUrl = import.meta.env.VITE_API_URL;
  
  if (!baseUrl) {
    console.error('[File URL] VITE_API_URL not defined! Make sure .env file exists with VITE_API_URL=http://localhost:8181/api');
    return null;
  }
  
  // If it's already a complete URL, return as-is
  if (url.startsWith('http') || url.startsWith('blob:')) {
    return url;
  }
  
  // If it starts with /, it's an absolute path
  if (url.startsWith('/')) {
    return `${baseUrl}${url}`;
  }
  
  // If it's just a filename, construct full URL
  return `${baseUrl}/uploads/messages/${url}`;
};

// File type utilities
export const getFileCategory = (mimeType) => {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType.startsWith('application/pdf') || 
      mimeType.includes('document') || 
      mimeType.includes('spreadsheet') || 
      mimeType.includes('presentation')) return 'document';
  if (mimeType.includes('zip') || 
      mimeType.includes('rar') || 
      mimeType.includes('compressed') || 
      mimeType.includes('tar')) return 'archive';
  if (mimeType.startsWith('text/') || 
      mimeType.includes('json') || 
      mimeType.includes('xml') || 
      mimeType.includes('javascript')) return 'code';
  return 'other';
};

export const getFileIcon = (category, mimeType) => {
  // Icons for different file categories
  const icons = {
    image: '🖼️',
    video: '🎥',
    audio: '🎵',
    document: '📄',
    archive: '📦',
    code: '💻',
    other: '📎'
  };

  // Specific icons for common file types
  const specificIcons = {
    'application/pdf': '📕',
    'application/msword': '📘',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '📘',
    'application/vnd.ms-excel': '📗',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '📗',
    'application/vnd.ms-powerpoint': '📙',
    'application/vnd.openxmlformats-officedocument.presentationml.sheet': '📙',
    'text/plain': '📝',
    'text/csv': '📊',
    'text/html': '🌐',
    'text/css': '🎨',
    'text/javascript': '⚡',
    'application/json': '📋',
    'application/xml': '📄',
    'application/zip': '🗜️',
    'application/x-rar-compressed': '🗜️',
    'application/x-7z-compressed': '🗜️',
    'application/gzip': '🗜️',
    'application/x-tar': '🗜️',
    'audio/mpeg': '🎵',
    'audio/wav': '🎵',
    'audio/ogg': '🎵',
    'audio/aac': '🎵',
    'video/mp4': '🎬',
    'video/webm': '🎬',
    'video/ogg': '🎬',
    'video/avi': '🎬',
    'video/mov': '🎬',
    'video/wmv': '🎬',
    'image/jpeg': '🖼️',
    'image/jpg': '🖼️',
    'image/png': '🖼️',
    'image/gif': '🖼️',
    'image/webp': '🖼️',
    'image/svg+xml': '🖼️'
  };

  // Return specific icon if available, otherwise category icon
  return specificIcons[mimeType] || icons[category] || icons.other;
};

export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Enhanced file download function with better error handling
export const downloadFile = async (url, filename, mimeType) => {
  try {
    // For same-origin files, use direct download
    if (url.startsWith(window.location.origin) || url.startsWith('/')) {
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    // For cross-origin files, try multiple approaches
    try {
      // First attempt: Fetch with CORS
      const response = await fetch(url, {
        method: 'GET',
        mode: 'cors',
        headers: {
          'Content-Type': 'application/octet-stream',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up blob URL
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch (fetchError) {
      console.warn('CORS fetch failed, trying download endpoint:', fetchError);
      
      // Second attempt: Try the download endpoint with auth
      try {
        // Extract filename from URL
        const urlParts = url.split('/');
        const originalFilename = urlParts[urlParts.length - 1];
        
        // Use the file endpoint
        const downloadUrl = `${import.meta.env.VITE_API_URL}/api/files/${originalFilename}`;
        
        // Get auth token from localStorage
        const token = localStorage.getItem('token');
        const headers = {
          'Content-Type': 'application/octet-stream',
        };
        
        // Add auth header if token exists
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        
        const response = await fetch(downloadUrl, {
          method: 'GET',
          mode: 'cors',
          headers,
        });

        if (!response.ok) {
          throw new Error(`File endpoint failed with status: ${response.status}`);
        }

        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = filename;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
        return;
      } catch (downloadEndpointError) {
        console.warn('File endpoint also failed:', downloadEndpointError);
      }
      
      // Third attempt: Try direct URL with different approach (for 426 errors)
      try {
        // For 426 Upgrade Required errors, try opening in new tab directly
        if (fetchError.message.includes('426') || fetchError.message.includes('Upgrade Required')) {
          // Detected 426 error, opening in new tab
          window.open(url, '_blank');
          return;
        }
        
        const response = await fetch(url, {
          method: 'GET',
          mode: 'no-cors',
        });
        
        if (response.type === 'opaque') {
          // For opaque responses, we can't access the content directly
          // So we'll fall back to opening in a new tab
          throw new Error('Opaque response, cannot download directly');
        }
      } catch (noCorsError) {
        console.warn('No-cors fetch also failed:', noCorsError);
      }
      
      // Fourth attempt: Try XMLHttpRequest
      try {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.responseType = 'blob';
        xhr.withCredentials = false;
        
        xhr.onload = function() {
          if (xhr.status === 200) {
            const blob = xhr.response;
            const blobUrl = URL.createObjectURL(blob);
            
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = filename;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
          } else {
            throw new Error(`XHR failed with status: ${xhr.status}`);
          }
        };
        
        xhr.onerror = function() {
          throw new Error('XHR request failed');
        };
        
        xhr.send();
        return; // Exit early if XHR succeeds
      } catch (xhrError) {
        console.warn('XHR also failed:', xhrError);
      }
      
      // Final fallback: Open in new tab
              // All download methods failed, opening in new tab as fallback
      window.open(url, '_blank');
    }
  } catch (error) {
    console.error('Download failed:', error);
    
    // Ultimate fallback: try to open in new tab
    try {
      window.open(url, '_blank');
    } catch (fallbackError) {
      console.error('Fallback download also failed:', fallbackError);
      throw new Error('Download failed. Please try again or contact support.');
    }
  }
};

// Preview functions for different file types
export const canPreview = (category, mimeType) => {
  const previewableTypes = [
    'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
    'video/mp4', 'video/webm', 'video/ogg', 'video/avi', 'video/mov', 'video/wmv',
    'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/aac',
    'application/pdf',
    'text/plain', 'text/csv', 'text/html', 'text/css', 'text/javascript',
    'application/json', 'application/xml'
  ];

  return previewableTypes.includes(mimeType);
};

export const getPreviewUrl = (file) => {
  if (!file || !canPreview(file.category, file.type)) {
    return null;
  }

  return constructFileUrl(file);
};

// File validation
export const validateFile = (file, maxSize = 50 * 1024 * 1024) => {
  const allowedTypes = [
    // Images
    'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
    // Documents
    'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.sheet',
    'text/plain', 'text/csv', 'text/html', 'text/css', 'text/javascript',
    // Archives
    'application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed',
    'application/gzip', 'application/x-tar',
    // Audio
    'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4', 'audio/aac', 'audio/webm',
    // Video
    'video/mp4', 'video/webm', 'video/ogg', 'video/avi', 'video/mov', 'video/wmv',
    // Code files
    'application/json', 'application/xml', 'text/xml',
    // Other common types
    'application/octet-stream'
  ];

  if (file.size > maxSize) {
    throw new Error(`File size too large. Maximum size is ${maxSize / (1024 * 1024)}MB`);
  }

  if (!allowedTypes.includes(file.type)) {
    throw new Error(`File type not allowed: ${file.type}`);
  }

  return true;
}; 