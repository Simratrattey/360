import React, { useState } from 'react';
import { Smile, Edit, Trash2, Reply, Download, X, Check, CheckCheck, Play, Pause, Volume2, FileText, Code, Archive } from 'lucide-react';
import { downloadFile, getFileIcon, formatFileSize, canPreview, getPreviewUrl } from '../../api/messageService';

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
}) {
  const messageId = msg._id || msg.id;
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showReadTooltip, setShowReadTooltip] = useState(false);
  const [imgError, setImgError] = useState(false);
  
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

  // Helper: highlight mentions in text
  const renderTextWithMentions = (text) => {
    if (!text) return null;
    // Regex for @username (alphanumeric, underscore, dot)
    return text.split(/(\s+)/).map((part, i) => {
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
    if (!msg.file) return null;

    const fileIcon = getFileIcon(msg.file.category || 'other', msg.file.type);
    const fileSize = formatFileSize(msg.file.size || 0);
    // Determine preview capability and URL for this file
    const previewUrl = getPreviewUrl(msg.file);
    const canPreviewFile = canPreview(msg.file.category || 'other', msg.file.type);

    // If the file type can be previewed, show an appropriate preview based on type
    if (canPreviewFile) {
      // Image preview with fallback
      if (isImage) {
        return (
          <div className="relative">
            <img
              src={previewUrl}
              alt={msg.file.name}
              onError={() => setImgError(true)}
              className={`max-w-full max-h-60 rounded-lg ${imgError ? 'hidden' : ''}`}
            />
            {imgError && (
              <div className="flex items-center space-x-2 p-3 bg-gray-100 rounded-lg">
                <span className="text-2xl">{fileIcon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{msg.file.name}</p>
                  <p className="text-xs text-gray-500">{fileSize}</p>
                </div>
                <button
                  onClick={() => handleDownload(msg.file.url, msg.file.name)}
                  className="px-2 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded-md text-sm"
                >
                  Download
                </button>
              </div>
            )}
            {!imgError && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDownload(msg.file.url, msg.file.name);
                }}
                className="absolute bottom-2 right-2 p-2 bg-black bg-opacity-50 hover:bg-opacity-70 text-white rounded-full shadow-lg"
                title="Download"
              >
                <Download size={16} />
              </button>
            )}
          </div>
        );
      }
      // Video preview
      if (isVideo) {
        return (
          <div className="relative">
            <video
              src={previewUrl}
              controls
              className="max-w-full max-h-60 rounded-lg"
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
            <button
              onClick={() => handleDownload(msg.file.url, msg.file.name)}
              className="absolute bottom-2 right-2 p-2 bg-black bg-opacity-50 hover:bg-opacity-70 text-white rounded-full"
              title="Download"
            >
              <Download size={16} />
            </button>
            <div className="mt-1 flex items-center space-x-2 text-sm text-gray-600">
              <span>{fileIcon}</span>
              <span className="truncate flex-1">{msg.file.name}</span>
              <span className="text-xs">{fileSize}</span>
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
              onClick={() => handleDownload(msg.file.url, msg.file.name)}
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
                onClick={() => handleDownload(msg.file.url, msg.file.name)}
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
          onClick={() => handleDownload(msg.file.url, msg.file.name)}
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
              {/* Message text */}
              <div className={`text-base leading-relaxed break-words ${isOwn ? 'text-white' : 'text-gray-800'}`}>
                {renderTextWithMentions(msg.text)}
              </div>

              {/* File attachments */}
              {renderFilePreview()}

              {/* Edited indicator */}
              {msg.edited && (
                <span className={`text-xs mt-2 inline-block ${isOwn ? 'text-blue-100' : 'text-gray-500'}`}>
                  (edited)
                </span>
              )}

              {/* Message actions */}
              <div className={`absolute top-2 right-2 opacity-0 group-hover:opacity-100 flex space-x-1 transition-opacity duration-200 ${
                isOwn ? 'bg-blue-500 bg-opacity-20' : 'bg-gray-100'
              }`}>
                <button 
                  className="p-1 hover:bg-white hover:bg-opacity-30 rounded transition-colors" 
                  onClick={() => onReply(msg)}
                  title="Reply"
                >
                  <Reply className="h-4 w-4" />
                </button>
                {isOwn && (
                  <>
                    {/* Only show Edit if no file is attached */}
                    {!msg.file && (
                      <button 
                        onClick={() => onEdit(msg)} 
                        className="p-1 hover:bg-white hover:bg-opacity-30 rounded transition-colors"
                        title="Edit"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                    )}
                    <button 
                      onClick={() => setShowDeleteConfirm(true)} 
                      className="p-1 hover:bg-white hover:bg-opacity-30 rounded transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </>
                )}
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