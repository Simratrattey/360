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
export const uploadMessageFile = (file, onProgress = null) => {
  const formData = new FormData();
  formData.append('file', file);
  return API.post('/messages/upload', formData, { 
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (progressEvent) => {
      const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
      if (onProgress) {
        onProgress(percentCompleted);
      }
    }
  });
};
export const getFileUrl = (filename) => {
  const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8181';
  // Remove /api suffix if present, since file serving is directly from base URL
  const fileBaseUrl = baseUrl.replace(/\/api$/, '');
  return `${fileBaseUrl}/uploads/messages/${filename}`;
};

// Helper function to construct proper file URL from file object
export const constructFileUrl = (fileObj, includeAuth = true) => {
  if (!fileObj) {
    return null;
  }
  
  if (!fileObj.url) {
    return null;
  }
  
  let url = fileObj.url;
  const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8181';
  
  
  // If it's already a complete URL, check if we need to fix the domain
  if (url.startsWith('http') || url.startsWith('blob:')) {
    // Don't modify blob URLs
    if (url.startsWith('blob:')) {
      return url;
    }
    
    // Check if the URL is pointing to the wrong server and fix it
    const wrongDomains = [
      'webrtc-signaling-server.onrender.com',
      'three60-za2d.onrender.com',
      'localhost:8181',
      '.onrender.com' // Catch any render.com subdomain
    ];
    
    const needsDomainFix = wrongDomains.some(domain => url.includes(domain));
    
    // More restrictive domain check - only fix if we're certain it's wrong
    const isWrongDomain = needsDomainFix;
    
    if ((needsDomainFix || isWrongDomain) && !url.startsWith(baseUrl)) {
      try {
        // Extract the path after the domain
        const urlObj = new URL(url);
        const pathAndQuery = urlObj.pathname + urlObj.search;
        // Reconstruct with correct base URL
        const oldUrl = url;
        url = `${baseUrl}${pathAndQuery}`;
      } catch (error) {
      }
    }
    
    // For HTTP URLs, add auth token if needed
    if (includeAuth && !url.includes('token=')) {
      const token = localStorage.getItem('token');
      if (token) {
        const separator = url.includes('?') ? '&' : '?';
        return `${url}${separator}token=${encodeURIComponent(token)}`;
      }
    }
    return url;
  }
  
  // Handle relative URLs
  let finalUrl;
  
  // If it starts with /, it's an absolute path from the base URL
  if (url.startsWith('/')) {
    finalUrl = `${baseUrl}${url}`;
  } else {
    // If it's just a filename, construct full URL
    // Check if it looks like a message file (has timestamp prefix)
    if (url.match(/^\d+-\d+-/)) {
      // This looks like a message file, use the uploads/messages path
      finalUrl = `${baseUrl}/uploads/messages/${url}`;
    } else {
      // Use API endpoint for other files
      finalUrl = `${baseUrl}/api/files/${url}`;
    }
  }
  
  // Add authentication token
  if (includeAuth) {
    const token = localStorage.getItem('token');
    if (token) {
      const separator = finalUrl.includes('?') ? '&' : '?';
      finalUrl += `${separator}token=${encodeURIComponent(token)}`;
    }
  }
  
  return finalUrl;
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
    // Fix domain if needed and add auth token
    let downloadUrl = url;
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8181';
    
    // Fix wrong server domains
    const wrongDomains = [
      'webrtc-signaling-server.onrender.com',
      'three60-za2d.onrender.com',
      'localhost:8181'
    ];
    
    const needsDomainFix = wrongDomains.some(domain => downloadUrl.includes(domain));
    
    if (needsDomainFix && !downloadUrl.startsWith(baseUrl)) {
      const urlObj = new URL(downloadUrl);
      const pathAndQuery = urlObj.pathname + urlObj.search;
      downloadUrl = `${baseUrl}${pathAndQuery}`;
    }
    
    // Add auth token to URL if not present
    if (downloadUrl && !downloadUrl.includes('token=')) {
      const token = localStorage.getItem('token');
      if (token) {
        const separator = downloadUrl.includes('?') ? '&' : '?';
        downloadUrl += `${separator}token=${encodeURIComponent(token)}`;
      }
    }

    // For same-origin files, use direct download
    if (downloadUrl.startsWith(window.location.origin) || downloadUrl.startsWith('/')) {
      const link = document.createElement('a');
      link.href = downloadUrl;
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
      // First attempt: Fetch with auth token in URL
      const response = await fetch(downloadUrl, {
        method: 'GET',
        mode: 'cors',
        credentials: 'include',
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
      
      // Second attempt: Try with Authorization header
      try {
        const token = localStorage.getItem('token');
        const headers = {
          'Content-Type': 'application/octet-stream',
        };
        
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        
        const response = await fetch(url, {
          method: 'GET',
          mode: 'cors',
          credentials: 'include',
          headers,
        });

        if (!response.ok) {
          throw new Error(`Auth header fetch failed with status: ${response.status}`);
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
      } catch (authFetchError) {
      }
      
      // Third attempt: Try the API file endpoint
      try {
        const urlParts = url.split('/');
        const originalFilename = urlParts[urlParts.length - 1].split('?')[0]; // Remove query params
        
        const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8181';
        const apiUrl = `${baseUrl}/api/files/${originalFilename}`;
        
        const token = localStorage.getItem('token');
        const headers = {
          'Content-Type': 'application/octet-stream',
        };
        
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        
        const response = await fetch(apiUrl, {
          method: 'GET',
          mode: 'cors',
          credentials: 'include',
          headers,
        });

        if (!response.ok) {
          throw new Error(`API endpoint failed with status: ${response.status}`);
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
      } catch (apiError) {
      }
      
      // Final fallback: Open in new tab with auth token
      window.open(downloadUrl, '_blank');
    }
  } catch (error) {
    // Ultimate fallback: try to open in new tab
    try {
      window.open(url, '_blank');
    } catch (fallbackError) {
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

// Avatar-specific message functions
export const sendAvatarQuery = async (conversationId, text, userId) => {
  try {
    console.log('📤 Sending avatar query:', { conversationId, text, userId });
    
    const response = await API.post(`/messages/conversation/${conversationId}/avatar-query`, {
      text,
      userId,
      type: 'avatar_query'
    });
    
    return response.data;
  } catch (error) {
    console.error('❌ Failed to send avatar query:', error);
    throw error;
  }
};

export const createAvatarMessage = (avatarResponseData) => {
  return {
    _id: `avatar_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    tempId: `avatar_temp_${Date.now()}`,
    conversationId: avatarResponseData.conversationId,
    senderId: 'avatar_system_user',
    sender: {
      _id: 'avatar_system_user',
      fullName: 'Avatar',
      username: 'avatar',
      userType: 'ai_avatar',
      isSystem: true,
      avatar: '/assets/avatar-profile.png'
    },
    text: avatarResponseData.text,
    type: 'avatar',
    isSystemMessage: false,
    isAvatarMessage: true,
    avatarData: avatarResponseData.avatarData,
    timestamp: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    status: 'sent'
  };
};

export const isAvatarMessage = (message) => {
  return message?.isAvatarMessage === true || 
         message?.sender?.userType === 'ai_avatar' ||
         message?.type === 'avatar' ||
         message?.senderId === 'avatar_system_user';
};

export const isAvatarConversation = (conversation) => {
  return conversation?.conversationType === 'ai_avatar' || 
         conversation?.settings?.isAvatarConversation === true ||
         conversation?.name === 'Avatar' ||
         conversation?._id?.startsWith('avatar_conversation_');
}; 