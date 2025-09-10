import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Smile, Edit, Trash2, Reply, Download, X, Check, CheckCheck, Play, Pause, Volume2, FileText, Code, Archive, MoreVertical, Copy, Pin, Star, ExternalLink, Clock, AlertCircle, RotateCcw } from 'lucide-react';
import { downloadFile, getFileIcon, formatFileSize, canPreview, getPreviewUrl, constructFileUrl, isAvatarMessage } from '../../api/messageService';
import DOMPurify from 'dompurify';
import MessageErrorBoundary from '../MessageErrorBoundary';
import LinkPreview from './LinkPreview';
import AvatarMessageBubble from './AvatarMessageBubble';
import { messageStatus, MESSAGE_STATUS, getMessageStatusInfo } from '../../services/messageStatus';

// Memoize MessageBubble to prevent unnecessary re-renders when props haven't changed.
function MessageBubble({
  msg,
  isOwn,
  conversationType,
  onEdit,
  onDelete,
  onReply,
  onEmoji,
  reactions = [],
  showEmojiPicker,
  setShowEmojiPicker,
  emojiList,
  editMsgId,
  editInput,
  setEditInput,
  handleEditSave,
  handleEditCancel,
  replyContext,
  messageStatus,
  onlineUsers,
  currentUserId,
  searchFilters,
  onPin,
  onStar,
  isPinned = false,
  isStarred = false,
}) {
  const messageId = msg._id || msg.id;
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [showReadTooltip, setShowReadTooltip] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [imgLoading, setImgLoading] = useState(false);
  const [imgRetryCount, setImgRetryCount] = useState(0);
  const [showDropdown, setShowDropdown] = useState(false);
  const [copiedToClipboard, setCopiedToClipboard] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 100, left: 100, placement: 'bottom-right' });
  const dropdownRef = useRef(null);
  const dropdownButtonRef = useRef(null);
  
  // File type checks - moved up to prevent hoisting issues
  const isImage = msg.file && msg.file.type && msg.file.type.startsWith('image/');
  const isVideo = msg.file && msg.file.type && msg.file.type.startsWith('video/');
  
  // Avatar conversation detection
  const isAvatarConversation = msg.isAvatarConversationMessage || 
                               conversationType === 'ai_avatar' || 
                               msg.conversationId?.startsWith('avatar_conversation_');
  const isAudio = msg.file && msg.file.type && msg.file.type.startsWith('audio/');
  const isDocument = msg.file && msg.file.type && (msg.file.type.startsWith('application/pdf') || msg.file.type.includes('document') || msg.file.type.includes('spreadsheet') || msg.file.type.includes('presentation'));
  
  // Click outside handler to close dropdown and emoji picker
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Check if click is outside dropdown (accounting for portal)
      if (showDropdown && dropdownRef.current && !dropdownRef.current.contains(event.target) && 
          dropdownButtonRef.current && !dropdownButtonRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
      
      // Close emoji picker when clicking outside (but not when clicking on reaction buttons)
      if (showEmojiPicker === messageId && 
          !event.target.closest('.emoji-picker') && 
          !event.target.closest('[data-emoji-trigger]')) {
        setShowEmojiPicker(false);
      }
    };

    if (showDropdown || showEmojiPicker === messageId) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDropdown, showEmojiPicker, messageId, setShowEmojiPicker]);

  // Calculate position when dropdown opens
  useEffect(() => {
    if (showDropdown && dropdownButtonRef.current) {
      calculateDropdownPosition();
    }
  }, [showDropdown]);

  // Reset image states when message changes
  useEffect(() => {
    setImgError(false);
    setImgLoading(true);
  }, [messageId]);

  // Reset image loading state when file changes
  useEffect(() => {
    if (msg.file && msg.file.type && msg.file.type.startsWith('image/')) {
      setImgError(false);
      setImgLoading(true);
    } else if (msg.file && !msg.file.type?.startsWith('image/')) {
      // For non-images, set loading to false immediately
      setImgLoading(false);
      setImgError(false);
    }
  }, [msg.file?.url, msg.file?.type]);

  // Additional effect to handle cases where file URL might be invalid
  useEffect(() => {
    if (isImage && msg.file) {
      // Check if we can construct a valid URL
      if (!msg.file.url) {
        setImgError(true);
        setImgLoading(false);
      }
    }
  }, [isImage, msg.file]);
  
  // Handle populated sender object or sender ID
  let senderName = 'Unknown';
  if (msg.sender) {
    if (typeof msg.sender === 'object' && msg.sender.fullName) {
      senderName = msg.sender.fullName;
    } else if (typeof msg.sender === 'object' && msg.sender.username) {
      senderName = msg.sender.username;
    } else if (typeof msg.sender === 'string') {
      senderName = msg.sender; // Fallback to ID if no populated data
    }
  } else if (msg.senderName) {
    senderName = msg.senderName;
  }

  const handleDownload = async (url, filename) => {
    try {
      await downloadFile(url, filename, msg.file?.type);
    } catch (error) {
      console.error('Download failed:', error);
      // You could show a notification here
    }
  };

  const renderStatusIndicator = () => {
    // Only show status for own messages
    if (!isOwn) return null;
    
    // Don't show status indicators for avatar conversation messages
    if (msg.isAvatarConversationMessage || 
        conversationType === 'ai_avatar' || 
        msg.conversationId?.startsWith('avatar_conversation_')) {
      return null;
    }
    
    // Get status info from the message status service with error handling
    const tempId = msg.tempId || messageId;
    let statusInfo;
    
    try {
      if (typeof getMessageStatusInfo === 'function') {
        statusInfo = getMessageStatusInfo(tempId, messageId);
      } else if (messageStatus && typeof messageStatus.getMessageStatusInfo === 'function') {
        statusInfo = messageStatus.getMessageStatusInfo(tempId, messageId);
      } else {
        console.error('getMessageStatusInfo is not available');
        // Fallback to basic status
        statusInfo = {
          status: MESSAGE_STATUS.SENT,
          isFailed: false,
          isSending: false
        };
      }
    } catch (error) {
      console.error('Error getting message status info:', error);
      // Fallback to basic status
      statusInfo = {
        status: MESSAGE_STATUS.SENT,
        isFailed: false,
        isSending: false
      };
    }
    
    const getStatusIcon = () => {
      switch (statusInfo.status) {
        case MESSAGE_STATUS.SENDING:
          return <Clock className="h-3 w-3 text-gray-400 animate-pulse" title="Sending..." />;
        case MESSAGE_STATUS.SENT:
          return <Check className="h-3 w-3 text-gray-400" title="Sent" />;
        case MESSAGE_STATUS.DELIVERED:
          return <CheckCheck className="h-3 w-3 text-gray-400" title="Delivered" />;
        case MESSAGE_STATUS.READ:
          return <CheckCheck className="h-3 w-3 text-blue-400" title="Read" />;
        case MESSAGE_STATUS.FAILED:
          return <AlertCircle className="h-3 w-3 text-red-400" title="Failed to send" />;
        default:
          return <Clock className="h-3 w-3 text-gray-400 animate-pulse" title="Sending..." />;
      }
    };

    return (
      <div className="flex items-center space-x-1">
        {getStatusIcon()}
      </div>
    );
  };

  // Helper: get user object from onlineUsers (Map or array)
  const getUserObj = (userId) => {
    if (!onlineUsers) return null;
    if (onlineUsers instanceof Map) return onlineUsers.get(userId);
    if (Array.isArray(onlineUsers)) return onlineUsers.find(u => u._id === userId);
    return null;
  };

  // Helper: safely highlight search terms in text with XSS protection
  const highlightSearchTerms = useMemo(() => (text, searchQuery) => {
    if (!text || !searchQuery) return text;
    
    try {
      // First sanitize the input text
      const sanitizedText = DOMPurify.sanitize(text, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
      
      // Escape special regex characters in search query
      const escapedQuery = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(${escapedQuery})`, 'gi');
      
      // Apply highlighting and sanitize the result
      const highlighted = sanitizedText.replace(regex, '<mark class="bg-yellow-200 text-yellow-900 font-semibold px-1 py-0.5 rounded">$1</mark>');
      
      // Final sanitization to ensure only safe HTML
      return DOMPurify.sanitize(highlighted, { 
        ALLOWED_TAGS: ['mark'], 
        ALLOWED_ATTR: ['class'] 
      });
    } catch (error) {
      console.warn('Error highlighting search terms:', error);
      // Return sanitized text without highlighting on error
      return DOMPurify.sanitize(text, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
    }
  }, []);

  // Helper functions for modern messaging features
  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedToClipboard(true);
      setTimeout(() => setCopiedToClipboard(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const handlePinMessage = () => {
    // Pin/unpin message functionality
    if (onPin) onPin(messageId);
    setShowDropdown(false);
  };

  const handleStarMessage = () => {
    // Star/unstar message functionality
    if (onStar) onStar(messageId);
    setShowDropdown(false);
  };

  // Calculate optimal dropdown position to prevent cutoff
  const calculateDropdownPosition = () => {
    if (!dropdownButtonRef.current) return;
    
    const buttonRect = dropdownButtonRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const dropdownWidth = 180; // min-w-[180px]
    const dropdownHeight = 400; // estimated max height
    
    let placement = 'bottom-right';
    let top = buttonRect.bottom + 4; // mt-1
    let left = buttonRect.right - dropdownWidth;
    
    // Check if dropdown would go off the right edge
    if (left < 8) {
      left = buttonRect.left;
      placement = 'bottom-left';
    }
    
    // Check if dropdown would go off the bottom edge
    if (top + dropdownHeight > viewportHeight - 20) {
      top = buttonRect.top - dropdownHeight - 4;
      placement = placement.replace('bottom', 'top');
    }
    
    // Ensure it doesn't go off the top
    if (top < 8) {
      top = 8;
    }
    
    // Ensure it doesn't go off the left
    if (left < 8) {
      left = 8;
    }
    
    // Ensure it doesn't go off the right
    if (left + dropdownWidth > viewportWidth - 8) {
      left = viewportWidth - dropdownWidth - 8;
    }
    
    setDropdownPosition({ top, left, placement });
  };

  // Helper function to detect URLs in text
  const detectUrls = (text) => {
    if (!text) return [];
    const urlRegex = /(https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*))/g;
    return text.match(urlRegex) || [];
  };

  const urls = detectUrls(msg.text);

  // Helper: safely highlight mentions in text with XSS protection
  const renderTextWithMentions = useMemo(() => {
    const renderText = (text) => {
    if (!text) return null;
    
    // First sanitize the input text to prevent XSS
    let processedText = DOMPurify.sanitize(text, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
    
    // Apply search highlighting if we have search filters
    if (searchFilters && searchFilters.query) {
      processedText = highlightSearchTerms(processedText, searchFilters.query);
    }
    
    // If we have HTML from search highlighting, handle it safely
    if (processedText.includes('<mark')) {
      // Process mentions in the highlighted text
      const processedWithMentions = processedText.replace(
        /@(\w[\w.]*)/g, 
        (match, username) => {
          // Sanitize the username
          const sanitizedUsername = DOMPurify.sanitize(username, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
          const userObj = getUserObj(currentUserId);
          const isMe = sanitizedUsername.toLowerCase() === (userObj?.username?.toLowerCase() || '');
          
          const spanClass = isMe
            ? 'bg-gradient-to-r from-yellow-300 to-pink-300 text-pink-900 font-bold px-1 py-0.5 rounded'
            : 'bg-yellow-100 text-yellow-800 font-semibold px-1 py-0.5 rounded';
          
          return `<span class="${spanClass} ml-0.5 mr-0.5">@${sanitizedUsername}</span>`;
        }
      );
      
      // Final sanitization with allowed tags for mentions and search highlights
      const finalSafeHTML = DOMPurify.sanitize(processedWithMentions, { 
        ALLOWED_TAGS: ['mark', 'span'], 
        ALLOWED_ATTR: ['class'],
        ALLOW_DATA_ATTR: false
      });
      
      return (
        <div dangerouslySetInnerHTML={{ __html: finalSafeHTML }} />
      );
    }
    
    // Otherwise, process normally with React components (no HTML)
    return processedText.split(/(\s+)/).map((part, i) => {
      if (/^@\w[\w.]*$/.test(part)) {
        const username = part.slice(1);
        const userObj = getUserObj(currentUserId);
        const isMe = username.toLowerCase() === (userObj?.username?.toLowerCase() || '');
        return (
          <span
            key={i}
            className={
              isMe
                ? 'bg-gradient-to-r from-yellow-300 to-pink-300 text-pink-900 font-bold px-1 py-0.5 rounded'
                : 'bg-yellow-100 text-yellow-800 font-semibold px-1 py-0.5 rounded'
            }
          >
            {part}
          </span>
        );
      }
      return part;
    });
    };
    return renderText;
  }, [searchFilters, currentUserId, getUserObj, highlightSearchTerms]);

  const renderFilePreview = () => {
    if (!msg.file) {
      return null;
    }

    const fileIcon = getFileIcon(msg.file.category || 'other', msg.file.type);
    const fileSize = formatFileSize(msg.file.size || 0);
    
    // Fix file URL construction for persistent storage
    const fileUrl = constructFileUrl(msg.file);
    
    // Determine preview capability and URL for this file
    const previewUrl = getPreviewUrl(msg.file);
    const canPreviewFile = canPreview(msg.file.category || 'other', msg.file.type);


    // If we don't have a valid URL, show error state
    if (!fileUrl) {
      console.warn('No valid file URL constructed for file:', msg.file);
      return (
        <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-200">
          <div className="flex items-center space-x-3">
            <div className="text-2xl">{fileIcon}</div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{msg.file.name}</p>
              <p className="text-xs text-red-500">File URL not available</p>
            </div>
          </div>
        </div>
      );
    }

    // If the file type can be previewed, show an appropriate preview based on type
    if (canPreviewFile) {
      // Enhanced WhatsApp/Slack-style image preview with progressive loading
      if (isImage) {
        // Try different URL construction approaches
        const getImageSrc = () => {
          const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8181';
          let src;
          
          
          if (imgRetryCount === 0) {
            // First attempt: Use the constructed file URL
            src = constructFileUrl(msg.file, true);
          } else if (imgRetryCount === 1) {
            // Second attempt: Try without auth token
            src = constructFileUrl(msg.file, false);
          } else if (imgRetryCount === 2) {
            // Third attempt: Direct construction from base URL + filename
            const filename = msg.file.url || msg.file.name;
            // Extract just the filename if it's a full URL
            const cleanFilename = filename.split('/').pop().split('?')[0];
            
            // Add auth token for this attempt too
            const token = localStorage.getItem('token');
            let directUrl = `${baseUrl}/uploads/messages/${cleanFilename}`;
            if (token) {
              directUrl += `?token=${encodeURIComponent(token)}`;
            }
            src = directUrl;
          }
          
          console.log('[getImageSrc] Generated URL:', src);
          return src;
        };
        
        const imageSrc = getImageSrc();
        
        return (
          <div className="relative group">
            {/* Image container with better loading states */}
            <div className="relative overflow-hidden rounded-lg bg-gray-100 min-h-[120px] max-w-sm">
              {/* Background blur for progressive loading effect */}
              {imgLoading && !imgError && (
                <div className="absolute inset-0 bg-gradient-to-br from-gray-100 to-gray-200 animate-pulse">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                </div>
              )}
              
              {/* Main image */}
              {!imgError && (
                <img
                  src={imageSrc}
                  alt={msg.file.name}
                  onError={(e) => {
                    console.error('Image failed to load:', imageSrc, e);
                    setImgError(true);
                    setImgLoading(false);
                    
                    // Retry with different approach after delay
                    if (imgRetryCount < 2) {
                      setTimeout(() => {
                        setImgRetryCount(prev => prev + 1);
                        setImgError(false);
                        setImgLoading(true);
                      }, 1000);
                    }
                  }}
                  onLoad={() => {
                    setImgError(false);
                    setImgLoading(false);
                  }}
                  onLoadStart={() => {
                    setImgLoading(true);
                    setImgError(false);
                  }}
                  className={`w-full h-auto max-h-80 object-cover transition-all duration-500 cursor-pointer hover:brightness-110 ${
                    imgLoading ? 'opacity-0' : 'opacity-100'
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    // Create image modal/lightbox instead of opening in new tab
                    window.open(imageSrc, '_blank');
                  }}
                  title="Click to view full size"
                  loading="lazy"
                />
              )}
              
              {/* Download button overlay */}
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownload(getImageSrc(), msg.file.name);
                  }}
                  className="p-1.5 bg-black/50 hover:bg-black/70 text-white rounded-full transition-colors"
                  title="Download image"
                >
                  <Download className="h-3 w-3" />
                </button>
              </div>
            </div>
            
            {/* Enhanced error fallback */}
            {imgError && (
              <div className="flex items-center space-x-3 p-4 bg-gradient-to-br from-red-50 to-pink-50 border border-red-100 rounded-lg">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                    <span className="text-2xl">🖼️</span>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{msg.file.name}</p>
                  <p className="text-xs text-gray-500">{fileSize} • {msg.file.type}</p>
                  <p className="text-xs text-red-600">
                    {imgRetryCount >= 2 ? 'Image cannot be loaded' : 'Loading failed, retrying...'}
                  </p>
                </div>
                <div className="flex flex-col space-y-1">
                  {imgRetryCount < 2 && (
                    <button
                      onClick={() => {
                        setImgError(false);
                        setImgLoading(true);
                        setImgRetryCount(prev => prev + 1);
                      }}
                      className="px-2 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded text-xs transition-colors"
                      title="Try loading again"
                    >
                      Retry
                    </button>
                  )}
                  <button
                    onClick={() => handleDownload(getImageSrc(), msg.file.name)}
                    className="px-2 py-1 bg-green-500 hover:bg-green-600 text-white rounded text-xs transition-colors"
                    title="Download file"
                  >
                    Download
                  </button>
                </div>
              </div>
            )}
            
            {/* Download button overlay - only show on hover */}
            {!imgError && !imgLoading && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDownload(getImageSrc(), msg.file.name);
                }}
                className="absolute bottom-3 right-3 p-2 bg-black bg-opacity-60 hover:bg-opacity-80 text-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-all duration-200"
                title="Download image"
              >
                <Download size={16} />
              </button>
            )}
            
            {/* File info overlay */}
            {!imgError && !imgLoading && (
              <div className="absolute top-3 left-3 bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                {fileSize}
              </div>
            )}
          </div>
        );
      }
      // Enhanced video preview
      if (isVideo) {
        return (
          <div className="relative group">
            <div className="relative overflow-hidden rounded-lg bg-gray-100">
              <video
                src={previewUrl}
                controls
                className="max-w-full max-h-80 rounded-lg"
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
                preload="metadata"
              />
            </div>
            
            {/* Download button overlay - only show on hover */}
            <button
              onClick={() => handleDownload(fileUrl, msg.file.name)}
              className="absolute bottom-3 right-3 p-2 bg-black bg-opacity-60 hover:bg-opacity-80 text-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-all duration-200"
              title="Download video"
            >
              <Download size={16} />
            </button>
            
            {/* File info overlay */}
            <div className="absolute top-3 left-3 bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              {fileSize}
            </div>
            
            {/* File details below video */}
            <div className="mt-2 flex items-center space-x-2 text-sm text-gray-600">
              <span className="text-lg">{fileIcon}</span>
              <span className="truncate flex-1 font-medium">{msg.file.name}</span>
            </div>
          </div>
        );
      }
      // Audio preview
      if (isAudio) {
        return (
          <div className="flex flex-col space-y-2 p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center space-x-3">
              <div className="text-2xl text-blue-500">{fileIcon}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{msg.file.name}</p>
                <p className="text-xs text-gray-500">{fileSize}</p>
              </div>
            </div>
            <audio
              src={previewUrl}
              controls
              className="w-full mt-1"
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
            <button
              onClick={() => handleDownload(fileUrl, msg.file.name)}
              className="self-end px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded-md text-sm mt-2"
            >
              Download
            </button>
          </div>
        );
      }
      // Enhanced PDF preview - first page only
      if (msg.file.type === 'application/pdf') {
        const pdfPreviewUrl = `${previewUrl}#page=1&toolbar=0&navpanes=0&scrollbar=0&view=FitH`;
        
        return (
          <div className="flex flex-col space-y-2">
            <div className="relative w-full h-64 bg-white rounded-lg border border-gray-200 overflow-hidden group">
              {/* PDF Preview iframe - first page only */}
              <iframe
                src={pdfPreviewUrl}
                title={`${msg.file.name} - Page 1`}
                className="w-full h-full"
                style={{ border: 'none' }}
                onError={() => {
                  // Fallback to basic preview if iframe fails
                  console.warn('PDF iframe failed to load, showing file info only');
                }}
              />
              
              {/* Overlay for first page indicator */}
              <div className="absolute top-2 left-2 bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded-md">
                Page 1 Preview
              </div>
              
              {/* Download button overlay */}
              <button
                onClick={() => handleDownload(fileUrl, msg.file.name)}
                className="absolute top-2 right-2 p-2 bg-black bg-opacity-50 hover:bg-opacity-70 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                title="Download PDF"
              >
                <Download size={16} />
              </button>
              
              {/* Click overlay to open full PDF */}
              <div 
                className="absolute inset-0 cursor-pointer bg-transparent hover:bg-blue-500 hover:bg-opacity-10 transition-colors duration-200"
                onClick={() => window.open(fileUrl, '_blank')}
                title="Click to view full PDF"
              />
            </div>
            
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <span className="text-red-500">{fileIcon}</span>
              <span className="truncate flex-1 font-medium">{msg.file.name}</span>
              <span className="text-xs bg-gray-100 px-2 py-1 rounded">{fileSize}</span>
            </div>
          </div>
        );
      }
      
      // Text and other document preview via iframe
      if (
        msg.file.type.startsWith('text/') ||
        msg.file.type === 'application/json' ||
        msg.file.type === 'application/xml'
      ) {
        return (
          <div className="flex flex-col space-y-2">
            <div className="relative w-full h-64 bg-white rounded-lg border border-gray-200 overflow-hidden">
              <iframe
                src={previewUrl}
                title={msg.file.name}
                className="w-full h-full"
                style={{ border: 'none' }}
              />
              <button
                onClick={() => handleDownload(fileUrl, msg.file.name)}
                className="absolute top-2 right-2 p-2 bg-black bg-opacity-50 hover:bg-opacity-70 text-white rounded-full"
                title="Download"
              >
                <Download size={16} />
              </button>
            </div>
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <span>{fileIcon}</span>
              <span className="truncate flex-1">{msg.file.name}</span>
              <span className="text-xs">{fileSize}</span>
            </div>
          </div>
        );
      }
    }
    
    // Fallback for non-previewable files
    return (
      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
        <div className="flex items-center space-x-3">
          <div className="text-2xl">{fileIcon}</div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{msg.file.name}</p>
            <p className="text-xs text-gray-500">{fileSize} • {msg.file.type || 'File'}</p>
          </div>
        </div>
        <button
          onClick={() => handleDownload(fileUrl, msg.file.name)}
          className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded-md text-sm"
        >
          Download
        </button>
      </div>
    );
  };

  // Helper function to handle reaction clicks
  const handleReactionClick = (emoji, e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!currentUserId || !onEmoji) return;
    
    // Let the backend handle the toggle logic
    onEmoji(emoji, messageId);
    
    // Close emoji picker
    setShowEmojiPicker(false);
  };

  // Helper function to group reactions by emoji (memoized for performance)
  const reactionGroups = useMemo(() => {
    const reactionsArray = reactions || msg.reactions || [];
    const grouped = {};
    
    reactionsArray.forEach(reaction => {
      if (!reaction?.emoji) return; // Skip invalid reactions
      
      const emoji = reaction.emoji;
      if (!grouped[emoji]) {
        grouped[emoji] = [];
      }
      grouped[emoji].push(reaction);
    });
    
    return grouped;
  }, [reactions, msg.reactions]);

  const hasUserReacted = useMemo(() => (emoji) => {
    return reactionGroups[emoji]?.some(r => 
      r.user === currentUserId || r.user?._id === currentUserId
    ) || false;
  }, [reactionGroups, currentUserId]);

  // Handle avatar messages with special rendering
  if (isAvatarMessage(msg)) {
    return (
      <MessageErrorBoundary>
        <AvatarMessageBubble message={msg} />
      </MessageErrorBoundary>
    );
  }

  return (
    <div 
      className={`flex flex-col items-${isOwn ? 'end' : 'start'} mb-2 sm:mb-4 group relative message-bubble`}
    >
      {/* Emoji reactions below the bubble, on opposite side for mobile */}
      {Object.keys(reactionGroups).length > 0 && (
        <div className={`flex flex-wrap items-center gap-1 mt-1 ${isOwn ? 'justify-start sm:justify-end' : 'justify-end sm:justify-start'} order-2`}>
          {Object.entries(reactionGroups).map(([emoji, reactionList]) => (
            <button
              key={emoji}
              onClick={(e) => handleReactionClick(emoji, e)}
              className={`flex items-center space-x-1 text-xs sm:text-sm cursor-pointer hover:scale-105 transition-all duration-200 rounded-full px-1.5 sm:px-2 py-0.5 sm:py-1 shadow-sm border ${
                hasUserReacted(emoji)
                  ? 'bg-blue-100 border-blue-300 text-blue-800'
                  : 'bg-white/90 border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
              title={`${reactionList.length} reaction${reactionList.length !== 1 ? 's' : ''}`}
            >
              <span className="text-sm sm:text-base" style={{ fontSize: '0.875rem' }}>{emoji}</span>
              {reactionList.length > 1 && (
                <span className="text-xs font-medium">{reactionList.length}</span>
              )}
            </button>
          ))}
        </div>
      )}
      <div className={`flex ${isOwn ? 'justify-end sm:justify-end' : 'justify-start sm:justify-start'} w-full relative`}>
        <div className={`max-w-[75%] sm:max-w-sm px-2 sm:px-3 py-1.5 sm:py-2 rounded-2xl relative shadow-sm ${
          isOwn
            ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white'
            : 'bg-white text-gray-900 border border-gray-200 hover:border-gray-300'
        }`}>
          {/* Sender name and timestamp */}
          <div className="flex items-center justify-between mb-2 min-w-0">
            {/* Only show sender name for group/community conversations, not for direct messages */}
            {conversationType !== 'dm' && (
              <div className={`text-sm font-semibold truncate flex-1 ${isOwn ? 'text-blue-100' : 'text-gray-700'}`}>
                {senderName}
              </div>
            )}
            <div className={`flex items-center space-x-2 flex-shrink-0 ${conversationType === 'dm' ? 'ml-auto' : 'ml-2'} ${isOwn ? 'text-blue-100' : 'text-gray-500'}`}>
              <span className="text-xs whitespace-nowrap">
                {new Date(msg.timestamp || msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
              <span
                className="relative"
                onMouseEnter={() => setShowReadTooltip(true)}
                onMouseLeave={() => setShowReadTooltip(false)}
                tabIndex={0}
              >
                {renderStatusIndicator()}
                {/* Read receipts tooltip/modal */}
                {showReadTooltip && messageStatus && messageStatus[messageId]?.recipients?.length > 0 && (
                  <div className="absolute right-0 top-6 z-30 bg-white border border-gray-200 rounded-xl shadow-lg px-4 py-2 text-xs text-gray-700 min-w-[120px] animate-in fade-in duration-200">
                    <div className="font-semibold mb-1 text-gray-900">Read by:</div>
                    <ul>
                      {messageStatus[messageId].recipients.map(uid => {
                        const user = getUserObj(uid);
                        return (
                          <li key={uid} className="flex items-center gap-2 py-0.5">
                            <span className="w-2 h-2 rounded-full bg-green-400 inline-block"></span>
                            <span>{user?.fullName || user?.username || uid}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </span>
            </div>
          </div>

          {/* Reply context */}
          {(replyContext || msg.replyTo) && (replyContext?.text || replyContext?.file || msg.replyTo?.text || msg.replyTo?.file) && (
            <div className={`text-xs mb-2 p-2 rounded-lg break-words ${
              isOwn ? 'bg-blue-400 bg-opacity-30' : 'bg-gray-100'
            }`}>
              <span className={`font-medium ${isOwn ? 'text-blue-100' : 'text-gray-600'}`}>
                Replying to: 
              </span>
              <span className={`italic ${isOwn ? 'text-blue-100' : 'text-gray-500'}`}>
                {((replyContext || msg.replyTo)?.text || (replyContext || msg.replyTo)?.file?.name || '').slice(0, 50)}{((replyContext || msg.replyTo)?.text || (replyContext || msg.replyTo)?.file?.name || '').length > 50 ? '...' : ''}
              </span>
            </div>
          )}

          {/* Edit mode */}
          {editMsgId === messageId ? (
            <div className="flex flex-col space-y-2">
              <input 
                value={editInput} 
                onChange={e => setEditInput(e.target.value)} 
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" 
              />
              <div className="flex space-x-2">
                <button 
                  onClick={handleEditSave} 
                  className="px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 text-sm font-medium"
                >
                  Save
                </button>
                <button 
                  onClick={handleEditCancel} 
                  className="px-3 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 text-sm font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* File attachments - show first */}
              {renderFilePreview()}

              {/* Message text - show after files */}
              {msg.text && (
                <div className={`text-sm sm:text-base leading-relaxed break-words ${isOwn ? 'text-white' : 'text-gray-800'} ${msg.file ? 'mt-3' : ''}`}>
                  {renderTextWithMentions(msg.text)}
                </div>
              )}
              
              {/* Link previews */}
              {urls.length > 0 && (
                <div className="mt-2 space-y-2">
                  {urls.slice(0, 3).map((url, index) => (
                    <LinkPreview key={index} url={url} message={msg} />
                  ))}
                  {urls.length > 3 && (
                    <div className="text-xs text-gray-500 italic">
                      +{urls.length - 3} more link{urls.length - 3 !== 1 ? 's' : ''}
                    </div>
                  )}
                </div>
              )}
              
              {/* Sending indicator - only for own messages (but not for avatar conversations) */}
              {isOwn && !msg.isAvatarConversationMessage && 
               conversationType !== 'ai_avatar' && 
               !msg.conversationId?.startsWith('avatar_conversation_') && (() => {
                const tempId = msg.tempId || messageId;
                let isSending = false;
                
                try {
                  if (typeof getMessageStatusInfo === 'function') {
                    const statusInfo = getMessageStatusInfo(tempId, messageId);
                    isSending = statusInfo.isSending;
                  } else if (messageStatus && typeof messageStatus.getMessageStatusInfo === 'function') {
                    const statusInfo = messageStatus.getMessageStatusInfo(tempId, messageId);
                    isSending = statusInfo.isSending;
                  } else {
                    // Fallback to legacy property
                    isSending = msg.sending;
                  }
                } catch (error) {
                  // Fallback to legacy property
                  isSending = msg.sending;
                }
                
                return isSending && (
                  <div className="flex items-center space-x-2 mt-2">
                    <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin opacity-60"></div>
                    <span className={`text-xs ${isOwn ? 'text-blue-100' : 'text-gray-500'}`}>
                      Sending...
                    </span>
                  </div>
                );
              })()}

              {/* Failed message retry button - more prominent */}
              {isOwn && (() => {
                const tempId = msg.tempId || messageId;
                let isFailed = false;
                
                try {
                  if (typeof getMessageStatusInfo === 'function') {
                    const statusInfo = getMessageStatusInfo(tempId, messageId);
                    isFailed = statusInfo.isFailed;
                  } else if (messageStatus && typeof messageStatus.getMessageStatusInfo === 'function') {
                    const statusInfo = messageStatus.getMessageStatusInfo(tempId, messageId);
                    isFailed = statusInfo.isFailed;
                  } else {
                    // Fallback to legacy property
                    isFailed = msg.failed;
                  }
                } catch (error) {
                  // Fallback to legacy property
                  isFailed = msg.failed;
                }
                
                return isFailed && (
                  <div className="flex items-center justify-center mt-2 p-2 bg-red-50 border border-red-200 rounded-lg">
                    <button
                      onClick={() => {
                        if (window.retryMessage) {
                          window.retryMessage(tempId);
                        }
                      }}
                      className="flex items-center space-x-2 px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-md text-sm font-medium transition-colors"
                      title="Retry sending message"
                    >
                      <RotateCcw className="h-4 w-4" />
                      <span>Retry</span>
                    </button>
                  </div>
                );
              })()}

              {/* Edited indicator */}
              {msg.edited && (
                <span className={`text-xs mt-2 inline-block ${isOwn ? 'text-blue-100' : 'text-gray-500'}`}>
                  (edited)
                </span>
              )}

              {/* Message actions dropdown */}
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <div className="relative" ref={dropdownRef}>
                  <button 
                    ref={dropdownButtonRef}
                    className={`p-1.5 rounded-lg transition-all duration-200 hover:scale-105 ${
                      isOwn 
                        ? 'bg-blue-500 bg-opacity-20 hover:bg-blue-500 hover:bg-opacity-30 text-blue-100' 
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                    }`}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (!showDropdown) {
                        calculateDropdownPosition();
                        setShowDropdown(true);
                      } else {
                        setShowDropdown(false);
                      }
                    }}
                    title="More options"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                  
                  {/* Enhanced dropdown menu with modern messaging features */}
                  {showDropdown && createPortal(
                    <div 
                      className="fixed z-[9999] bg-white border border-gray-200 rounded-lg shadow-xl py-1 min-w-[180px] max-w-[200px] animate-in fade-in duration-200 backdrop-blur-sm max-h-80 overflow-y-auto"
                      style={{
                        top: `${dropdownPosition.top}px`,
                        left: `${dropdownPosition.left}px`,
                      }}
                      ref={dropdownRef}
                    >
                      {/* Reply option - available for all messages except avatar conversations */}
                      {!isAvatarConversation && (
                        <button 
                          className="w-full px-3 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-3 transition-all duration-150"
                          onClick={() => {
                            onReply(msg);
                            setShowDropdown(false);
                          }}
                        >
                          <Reply className="h-4 w-4 text-gray-500" />
                          <span className="font-medium">Reply</span>
                        </button>
                      )}
                      
                      {/* Copy text option - only if message has text */}
                      {msg.text && (
                        <button 
                          className="w-full px-3 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-3 transition-all duration-150"
                          onClick={() => {
                            copyToClipboard(msg.text);
                            setShowDropdown(false);
                          }}
                        >
                          <Copy className={`h-4 w-4 ${copiedToClipboard ? 'text-green-500' : 'text-gray-500'}`} />
                          <span className="font-medium">{copiedToClipboard ? 'Copied!' : 'Copy Text'}</span>
                        </button>
                      )}
                      
                      {/* Copy link option - if message has URLs */}
                      {urls.length > 0 && (
                        <button 
                          className="w-full px-3 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-3 transition-all duration-150"
                          onClick={() => {
                            copyToClipboard(urls[0]);
                            setShowDropdown(false);
                          }}
                        >
                          <Copy className="h-4 w-4 text-gray-500" />
                          <span className="font-medium">Copy Link</span>
                        </button>
                      )}
                      
                      {/* Star/Unstar option */}
                      <button 
                        className="w-full px-3 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-3 transition-all duration-150"
                        onClick={handleStarMessage}
                      >
                        <Star className={`h-4 w-4 ${isStarred ? 'text-yellow-500 fill-current' : 'text-gray-500'}`} />
                        <span className="font-medium">{isStarred ? 'Unstar' : 'Star'}</span>
                      </button>
                      
                      {/* Pin/Unpin option */}
                      <button 
                        className="w-full px-3 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-3 transition-all duration-150"
                        onClick={handlePinMessage}
                      >
                        <Pin className={`h-4 w-4 ${isPinned ? 'text-blue-500' : 'text-gray-500'}`} />
                        <span className="font-medium">{isPinned ? 'Unpin' : 'Pin'}</span>
                      </button>
                      
                      {/* Open file in new tab - only for files */}
                      {msg.file && (
                        <button 
                          className="w-full px-3 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-3 transition-all duration-150"
                          onClick={() => {
                            const fileUrl = constructFileUrl(msg.file);
                            if (fileUrl) window.open(fileUrl, '_blank');
                            setShowDropdown(false);
                          }}
                        >
                          <ExternalLink className="h-4 w-4 text-gray-500" />
                          <span className="font-medium">Open in New Tab</span>
                        </button>
                      )}
                      
                      
                      <div className="border-t border-gray-100 my-1"></div>
                      
                      {/* Edit option - only for own messages without files, not in avatar conversations */}
                      {isOwn && !msg.file && !isAvatarConversation && (
                        <button 
                          className="w-full px-3 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-3 transition-all duration-150"
                          onClick={() => {
                            onEdit(msg);
                            setShowDropdown(false);
                          }}
                        >
                          <Edit className="h-4 w-4 text-gray-500" />
                          <span className="font-medium">Edit</span>
                        </button>
                      )}
                      
                      {/* Delete option - only for own messages, not in avatar conversations */}
                      {isOwn && !isAvatarConversation && (
                        <button 
                          className="w-full px-3 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 flex items-center space-x-3 transition-all duration-150"
                          onClick={() => {
                            onDelete(messageId);
                            setShowDropdown(false);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                          <span className="font-medium">Delete</span>
                        </button>
                      )}
                    </div>,
                    document.body
                  )}
                </div>
              </div>
            </>
          )}
        </div>
        
        {/* Reactions button for own messages - left side */}
        {isOwn && (
          <div className="hidden sm:flex items-center mr-2 order-first">
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowEmojiPicker(showEmojiPicker === messageId ? false : messageId);
              }}
              className={`p-1 rounded-lg transition-all duration-200 opacity-0 group-hover:opacity-100 hover:bg-blue-100 focus:opacity-100 focus:bg-blue-100`}
              tabIndex={-1}
              data-emoji-trigger="true"
            >
              <Smile className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500" />
            </button>
            {showEmojiPicker === messageId && (
              <div className="emoji-picker absolute left-0 bottom-full z-20 bg-white border border-gray-200 rounded-xl shadow-xl p-2 sm:p-3 flex flex-wrap gap-1 sm:gap-2 mb-2 min-w-[180px] sm:min-w-[220px] animate-in fade-in duration-200">
                {emojiList.map(emoji => {
                  const userHasThisReaction = hasUserReacted(emoji);
                  return (
                    <button
                      key={emoji}
                      className={`text-base sm:text-xl cursor-pointer hover:scale-110 transition-all duration-200 p-1 sm:p-1.5 rounded-lg ${
                        userHasThisReaction 
                          ? 'bg-blue-100 border-2 border-blue-300' 
                          : 'hover:bg-gray-100'
                      }`}
                      onClick={(e) => handleReactionClick(emoji, e)}
                      title={userHasThisReaction ? 'Remove reaction' : 'Add reaction'}
                    >
                      {emoji}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
        
        {/* Reactions button for received messages - right side */}
        {!isOwn && (
          <div className="hidden sm:flex items-center ml-2">
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowEmojiPicker(showEmojiPicker === messageId ? false : messageId);
              }}
              className={`p-1 rounded-lg transition-all duration-200 opacity-0 group-hover:opacity-100 hover:bg-gray-100 focus:opacity-100 focus:bg-gray-100`}
              tabIndex={-1}
              data-emoji-trigger="true"
            >
              <Smile className="h-5 w-5 text-gray-400" />
            </button>
            {showEmojiPicker === messageId && (
              <div className="emoji-picker absolute right-0 bottom-full z-20 bg-white border border-gray-200 rounded-xl shadow-xl p-3 flex flex-wrap gap-2 mb-2 min-w-[220px] animate-in fade-in duration-200">
                {emojiList.map(emoji => {
                  const userHasThisReaction = hasUserReacted(emoji);
                  return (
                    <button
                      key={emoji}
                      className={`text-base sm:text-xl cursor-pointer hover:scale-110 transition-all duration-200 p-1 sm:p-1.5 rounded-lg ${
                        userHasThisReaction 
                          ? 'bg-blue-100 border-2 border-blue-300' 
                          : 'hover:bg-gray-100'
                      }`}
                      onClick={(e) => handleReactionClick(emoji, e)}
                      title={userHasThisReaction ? 'Remove reaction' : 'Add reaction'}
                    >
                      {emoji}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
        
        {/* Mobile reaction buttons - proper side positioning */}
        <div className={`sm:hidden absolute ${isOwn ? 'left-0' : 'right-0'} top-1/2 transform -translate-y-1/2 ${isOwn ? '-translate-x-8' : 'translate-x-8'}`}>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowEmojiPicker(showEmojiPicker === messageId ? false : messageId);
            }}
            className="p-1.5 rounded-full transition-all duration-200 opacity-0 group-hover:opacity-100 hover:bg-gray-100 focus:opacity-100 focus:bg-gray-100 bg-white shadow-md border border-gray-200"
            tabIndex={-1}
            data-emoji-trigger="true"
          >
            <Smile className="h-4 w-4 text-gray-500" />
          </button>
          {showEmojiPicker === messageId && (
            <div className={`emoji-picker absolute ${isOwn ? 'left-0' : 'right-0'} top-full z-20 bg-white border border-gray-200 rounded-xl shadow-xl p-2 flex flex-wrap gap-1 mt-1 w-[160px] animate-in fade-in duration-200`}>
              {emojiList.map(emoji => {
                const userHasThisReaction = hasUserReacted(emoji);
                return (
                  <button
                    key={emoji}
                    className={`text-sm cursor-pointer hover:scale-110 transition-all duration-200 p-1 rounded-lg ${
                      userHasThisReaction 
                        ? 'bg-blue-100 border-2 border-blue-300' 
                        : 'hover:bg-gray-100'
                    }`}
                    onClick={(e) => handleReactionClick(emoji, e)}
                    title={userHasThisReaction ? 'Remove reaction' : 'Add reaction'}
                  >
                    {emoji}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
      
      {/* Status indicators for pinned/starred messages */}
      {(isPinned || isStarred) && (
        <div className={`absolute -top-2 ${isOwn ? '-left-2' : '-right-2'} flex space-x-1`}>
          {isPinned && (
            <div className="bg-blue-500 text-white rounded-full p-1 shadow-sm">
              <Pin className="h-3 w-3" />
            </div>
          )}
          {isStarred && (
            <div className="bg-yellow-500 text-white rounded-full p-1 shadow-sm">
              <Star className="h-3 w-3" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Wrap with error boundary to handle any errors in message rendering
const MessageBubbleWithErrorBoundary = (props) => (
  <MessageErrorBoundary>
    <MessageBubble {...props} />
  </MessageErrorBoundary>
);

MessageBubbleWithErrorBoundary.displayName = 'MessageBubbleWithErrorBoundary';

export default MessageBubbleWithErrorBoundary;