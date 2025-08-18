import React, { useState, useEffect, useRef } from 'react';
import { Smile, Edit, Trash2, Reply, Download, X, Check, CheckCheck, Play, Pause, Volume2, FileText, Code, Archive, MoreVertical } from 'lucide-react';
import { downloadFile, getFileIcon, formatFileSize, canPreview, getPreviewUrl, constructFileUrl } from '../../api/messageService';

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
}) {
  const messageId = msg._id || msg.id;
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showReadTooltip, setShowReadTooltip] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [imgLoading, setImgLoading] = useState(true);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);
  
  // Click outside handler to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
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

  const isImage = msg.file && msg.file.type && msg.file.type.startsWith('image/');
  const isVideo = msg.file && msg.file.type && msg.file.type.startsWith('video/');
  const isAudio = msg.file && msg.file.type && msg.file.type.startsWith('audio/');
  const isDocument = msg.file && msg.file.type && (msg.file.type.startsWith('application/pdf') || msg.file.type.includes('document') || msg.file.type.includes('spreadsheet') || msg.file.type.includes('presentation'));

  const renderStatusIndicator = () => {
    if (!messageStatus) return null;
    
    const status = messageStatus[messageId];
    if (!status) return null;

    if (status.read) {
      return <CheckCheck className="h-3 w-3" />;
    } else if (status.delivered) {
      return <Check className="h-3 w-3" />;
    } else if (status.sent) {
      return <div className="h-3 w-3 border border-current rounded-full" />;
    }
    return null;
  };

  // Helper: get user object from onlineUsers (Map or array)
  const getUserObj = (userId) => {
    if (!onlineUsers) return null;
    if (onlineUsers instanceof Map) return onlineUsers.get(userId);
    if (Array.isArray(onlineUsers)) return onlineUsers.find(u => u._id === userId);
    return null;
  };

  // Helper: highlight search terms in text
  const highlightSearchTerms = (text, searchQuery) => {
    if (!text || !searchQuery) return text;
    
    try {
      const regex = new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
      return text.replace(regex, '<mark class="bg-yellow-200 text-yellow-900 font-semibold px-1 py-0.5 rounded">$1</mark>');
    } catch (error) {
      console.warn('Error highlighting search terms:', error);
      return text;
    }
  };

  // Helper: highlight mentions in text
  const renderTextWithMentions = (text) => {
    if (!text) return null;
    
    let processedText = text;
    
    // First, apply search highlighting if we have search filters
    if (searchFilters && searchFilters.query) {
      processedText = highlightSearchTerms(processedText, searchFilters.query);
    }
    
    // Then process mentions - but we need to be careful with the HTML from search highlighting
    if (processedText.includes('<mark')) {
      // If we have search highlights, render as HTML
      return (
        <div 
          dangerouslySetInnerHTML={{ 
            __html: processedText.replace(
              /@(\w[\w.]*)/g, 
              (match, username) => {
                const userObj = getUserObj(currentUserId);
                const isMe = username.toLowerCase() === (userObj?.username?.toLowerCase() || '');
                return `<span class="${
                  isMe
                    ? 'bg-gradient-to-r from-yellow-300 to-pink-300 text-pink-900 font-bold px-1 py-0.5 rounded'
                    : 'bg-yellow-100 text-yellow-800 font-semibold px-1 py-0.5 rounded'
                } ml-0.5 mr-0.5">${match}</span>`;
              }
            )
          }} 
        />
      );
    }
    
    // Otherwise, process normally with React components
    // Regex for @username (alphanumeric, underscore, dot)
    return processedText.split(/(\s+)/).map((part, i) => {
      if (/^@\w[\w.]*$/.test(part)) {
        const username = part.slice(1);
        // Highlight if it's the current user
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

  const renderFilePreview = () => {
    if (!msg.file) {
      console.log('[MessageBubble] No file object in message');
      return null;
    }

    console.log('[MessageBubble] File object:', msg.file);

    const fileIcon = getFileIcon(msg.file.category || 'other', msg.file.type);
    const fileSize = formatFileSize(msg.file.size || 0);
    
    // Fix file URL construction for persistent storage
    const fileUrl = constructFileUrl(msg.file);
    
    // Determine preview capability and URL for this file
    const previewUrl = getPreviewUrl(msg.file);
    const canPreviewFile = canPreview(msg.file.category || 'other', msg.file.type);

    console.log('[MessageBubble] Final URLs - fileUrl:', fileUrl, 'previewUrl:', previewUrl);

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
      // Enhanced image preview with better styling and loading states
      if (isImage) {
        return (
          <div className="relative group">
            {/* Image container with loading state */}
            <div className="relative overflow-hidden rounded-lg bg-gray-100">
              {/* Always try to show the image first */}
              <img
                src={previewUrl || fileUrl}
                alt={msg.file.name}
                onError={(e) => {
                  console.error('[MessageBubble] Image failed to load:', e.target.src);
                  setImgError(true);
                  setImgLoading(false);
                }}
                onLoad={() => {
                  console.log('[MessageBubble] Image loaded successfully');
                  setImgError(false);
                  setImgLoading(false);
                }}
                onLoadStart={() => {
                  console.log('[MessageBubble] Image loading started');
                  setImgLoading(true);
                  setImgError(false);
                }}
                className={`max-w-full max-h-80 object-cover transition-all duration-300 hover:scale-105 cursor-pointer ${
                  imgLoading ? 'opacity-0' : 'opacity-100'
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  // Open image in full screen or modal
                  window.open(previewUrl || fileUrl, '_blank');
                }}
                title="Click to view full size"
                style={{ display: imgError ? 'none' : 'block' }}
              />
              
              {/* Loading placeholder - show while loading */}
              {imgLoading && !imgError && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                  <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
              )}
            </div>
            
            {/* Error fallback */}
            {imgError && (
              <div className="flex items-center space-x-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <span className="text-3xl">{fileIcon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{msg.file.name}</p>
                  <p className="text-xs text-gray-500">{fileSize}</p>
                  <p className="text-xs text-gray-400">Image preview unavailable</p>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => {
                      setImgError(false);
                      setImgLoading(true);
                    }}
                    className="px-2 py-1 bg-gray-500 hover:bg-gray-600 text-white rounded text-xs transition-colors"
                    title="Retry loading preview"
                  >
                    Retry
                  </button>
                  <button
                    onClick={() => handleDownload(fileUrl, msg.file.name)}
                    className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-md text-sm transition-colors"
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
                  handleDownload(fileUrl, msg.file.name);
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
      // PDF and text preview via iframe
      if (
        msg.file.type === 'application/pdf' ||
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

  return (
    <div className={`flex flex-col items-${isOwn ? 'end' : 'start'} mb-4 group relative`}>
      {/* Emoji reactions above the bubble, outside */}
      {(reactions || msg.reactions || []).length > 0 && (
        <div className={`flex flex-wrap items-center gap-1 mb-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
          {(reactions || msg.reactions || []).map((reaction, i) => (
            <span
              key={i}
              className="text-base cursor-pointer hover:scale-110 transition-transform bg-white/80 border border-gray-200 rounded-full px-1.5 py-0.5 shadow-sm"
              style={{ fontSize: '1.1rem' }}
            >
              {reaction.emoji}
            </span>
          ))}
        </div>
      )}
      <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} w-full`}>
        {/* Reactions button outside bubble, only on hover */}
        {!isOwn && (
          <div className="flex items-center mr-2">
            <button
              onClick={() => setShowEmojiPicker(showEmojiPicker === messageId ? false : messageId)}
              className={`p-1 rounded-lg transition-colors opacity-0 group-hover:opacity-100 hover:bg-gray-100 focus:opacity-100 focus:bg-gray-100`}
              tabIndex={-1}
            >
              <Smile className="h-5 w-5 text-gray-400" />
            </button>
            {showEmojiPicker === messageId && (
              <div className="absolute left-0 bottom-full z-20 bg-white border border-gray-200 rounded-lg shadow-lg p-3 flex flex-wrap gap-2 mb-2 min-w-[200px]">
                {emojiList.map(emoji => (
                  <span
                    key={emoji}
                    className="text-xl cursor-pointer hover:scale-110 transition-transform"
                    onClick={() => onEmoji(emoji, messageId)}
                  >
                    {emoji}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
        <div className={`max-w-sm px-3 py-2 rounded-2xl relative shadow-sm ${
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
                <div className={`text-base leading-relaxed break-words ${isOwn ? 'text-white' : 'text-gray-800'} ${msg.file ? 'mt-3' : ''}`}>
                  {renderTextWithMentions(msg.text)}
                </div>
              )}
              
              {/* Sending indicator */}
              {msg.sending && (
                <div className="flex items-center space-x-2 mt-2">
                  <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin opacity-60"></div>
                  <span className={`text-xs ${isOwn ? 'text-blue-100' : 'text-gray-500'}`}>
                    Sending...
                  </span>
                </div>
              )}

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
                    className={`p-1.5 rounded-lg transition-all duration-200 hover:scale-105 ${
                      isOwn 
                        ? 'bg-blue-500 bg-opacity-20 hover:bg-blue-500 hover:bg-opacity-30 text-blue-100' 
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                    }`}
                    onClick={() => setShowDropdown(!showDropdown)}
                    title="More options"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                  
                  {/* Dropdown menu */}
                  {showDropdown && (
                    <div className="absolute right-0 top-full mt-1 z-30 bg-white border border-gray-200 rounded-lg shadow-xl py-1 min-w-[140px] animate-in fade-in duration-200 backdrop-blur-sm">
                      {/* Reply option - available for all messages */}
                      <button 
                        className="w-full px-3 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-3 transition-all duration-150 rounded-none first:rounded-t-lg last:rounded-b-lg"
                        onClick={() => {
                          onReply(msg);
                          setShowDropdown(false);
                        }}
                      >
                        <Reply className="h-4 w-4 text-gray-500" />
                        <span className="font-medium">Reply</span>
                      </button>
                      
                      {/* Edit option - only for own messages without files */}
                      {isOwn && !msg.file && (
                        <button 
                          className="w-full px-3 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-3 transition-all duration-150 rounded-none first:rounded-t-lg last:rounded-b-lg"
                          onClick={() => {
                            onEdit(msg);
                            setShowDropdown(false);
                          }}
                        >
                          <Edit className="h-4 w-4 text-gray-500" />
                          <span className="font-medium">Edit</span>
                        </button>
                      )}
                      
                      {/* Delete option - only for own messages */}
                      {isOwn && (
                        <button 
                          className="w-full px-3 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 flex items-center space-x-3 transition-all duration-150 rounded-none first:rounded-t-lg last:rounded-b-lg"
                          onClick={() => {
                            setShowDeleteConfirm(true);
                            setShowDropdown(false);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                          <span className="font-medium">Delete</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
        {/* Reactions button for own messages, right side */}
        {isOwn && (
          <div className="flex items-center ml-2">
            <button
              onClick={() => setShowEmojiPicker(showEmojiPicker === messageId ? false : messageId)}
              className={`p-1 rounded-lg transition-colors opacity-0 group-hover:opacity-100 hover:bg-blue-100 focus:opacity-100 focus:bg-blue-100`}
              tabIndex={-1}
            >
              <Smile className="h-5 w-5 text-blue-100" />
            </button>
            {showEmojiPicker === messageId && (
              <div className="absolute right-0 bottom-full z-20 bg-white border border-gray-200 rounded-lg shadow-lg p-3 flex flex-wrap gap-2 mb-2 min-w-[200px]">
                {emojiList.map(emoji => (
                  <span
                    key={emoji}
                    className="text-xl cursor-pointer hover:scale-110 transition-transform"
                    onClick={() => onEmoji(emoji, messageId)}
                  >
                    {emoji}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      {/* Delete confirmation dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-xs w-full flex flex-col items-center">
            <Trash2 className="h-8 w-8 text-red-500 mb-2" />
            <h3 className="text-lg font-bold mb-2 text-gray-900">Delete Message?</h3>
            <p className="text-gray-600 mb-4 text-center">Are you sure you want to delete this message? This action cannot be undone.</p>
            <div className="flex gap-4 w-full">
              <button
                className="flex-1 px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 font-medium"
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </button>
              <button
                className="flex-1 px-4 py-2 rounded-lg bg-gradient-to-r from-red-500 to-pink-500 text-white font-semibold hover:from-red-600 hover:to-pink-600 shadow"
                onClick={() => { setShowDeleteConfirm(false); onDelete(messageId); }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Memoize MessageBubble to prevent unnecessary re-renders when props haven't changed.
export default React.memo(MessageBubble);