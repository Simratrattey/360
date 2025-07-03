import React, { useState } from 'react';
import { Smile, Edit, Trash2, Reply, Download, X, Check, CheckCheck, Play, Pause, Volume2, FileText, Code, Archive } from 'lucide-react';
import { downloadFile, getFileIcon, formatFileSize, canPreview, getPreviewUrl } from '../../api/messageService';

export default function MessageBubble({
  msg,
  isOwn,
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
}) {
  const messageId = msg._id || msg.id;
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [videoPlaying, setVideoPlaying] = useState(false);
  
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

  const renderFilePreview = () => {
    if (!msg.file) return null;

    const fileIcon = getFileIcon(msg.file.category || 'other', msg.file.type);
    const fileSize = formatFileSize(msg.file.size || 0);

    if (isImage) {
      // Track if image failed to load
      const [imgError, setImgError] = useState(false);
      return (
        <div className="mt-3 relative group">
          <div className="relative inline-block">
            {!imgError ? (
              <img 
                src={msg.file.url} 
                alt={msg.file.name} 
                className="max-w-[280px] max-h-[220px] rounded-xl shadow-lg object-cover cursor-pointer hover:opacity-95 transition-all duration-200" 
                onError={() => setImgError(true)}
              />
            ) : (
              <div className="w-[220px] h-[180px] flex flex-col items-center justify-center bg-gray-100 rounded-xl shadow-lg p-4">
                <div className="text-5xl mb-2">{fileIcon}</div>
                <p className="text-sm text-gray-700 font-medium mb-2 text-center break-all max-w-full">{msg.file.name}</p>
                <button
                  onClick={() => handleDownload(msg.file.url, msg.file.name)}
                  className="mt-2 p-2 bg-blue-500 hover:bg-blue-600 text-white rounded-full shadow-lg"
                  title="Download"
                >
                  <Download className="h-5 w-5" />
                </button>
              </div>
            )}
            {/* Download button overlay (only if image loads) */}
            {!imgError && (
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownload(msg.file.url, msg.file.name);
                  }}
                  className="p-2 bg-black bg-opacity-70 hover:bg-opacity-90 text-white rounded-full shadow-lg backdrop-blur-sm"
                  title="Download"
                >
                  <Download className="h-4 w-4" />
                </button>
              </div>
            )}
            {/* File info overlay (only if image loads) */}
            {!imgError && (
              <div className="absolute bottom-2 left-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <div className="bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded-lg backdrop-blur-sm truncate">
                  {msg.file.name}
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }

    if (isVideo) {
      return (
        <div className="mt-3">
          <div className="relative">
            <video 
              src={msg.file.url} 
              className="max-w-[300px] max-h-[200px] rounded-xl shadow-lg"
              controls
              preload="metadata"
              onPlay={() => setVideoPlaying(true)}
              onPause={() => setVideoPlaying(false)}
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.nextSibling.style.display = 'flex';
              }}
            />
            {/* Download button overlay */}
            <div className="absolute top-2 right-2">
              <button
                onClick={() => handleDownload(msg.file.url, msg.file.name)}
                className="p-2 bg-black bg-opacity-70 hover:bg-opacity-90 text-white rounded-full shadow-lg backdrop-blur-sm"
                title="Download"
              >
                <Download className="h-4 w-4" />
              </button>
            </div>
          </div>
          {/* File info below video */}
          <div className="mt-2 p-2 bg-gradient-to-r from-gray-50 to-blue-50 rounded-lg border border-gray-200">
            <div className="flex items-center space-x-2">
              <div className="text-lg">{fileIcon}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{msg.file.name}</p>
                <p className="text-xs text-gray-500">{fileSize}</p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (isAudio) {
      return (
        <div className="mt-3 p-3 bg-gradient-to-r from-gray-50 to-blue-50 rounded-xl border border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="text-2xl">{fileIcon}</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{msg.file.name}</p>
              <p className="text-xs text-gray-500">{fileSize}</p>
            </div>
            <audio 
              src={msg.file.url} 
              controls
              className="flex-1"
              onPlay={() => setAudioPlaying(true)}
              onPause={() => setAudioPlaying(false)}
            />
            <button
              onClick={() => handleDownload(msg.file.url, msg.file.name)}
              className="p-2 hover:bg-gray-200 rounded-lg transition-colors flex-shrink-0"
              title="Download"
            >
              <Download className="h-4 w-4 text-gray-600" />
            </button>
          </div>
        </div>
      );
    }

    // For documents, code files, archives, and other files
    return (
      <div className="mt-3 p-3 bg-gradient-to-r from-gray-50 to-blue-50 rounded-xl border border-gray-200">
        <div className="flex items-center space-x-3">
          <div className="text-2xl">{fileIcon}</div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{msg.file.name}</p>
            <p className="text-xs text-gray-500">{fileSize} • {msg.file.type || 'Unknown type'}</p>
          </div>
          <button
            onClick={() => handleDownload(msg.file.url, msg.file.name)}
            className="p-2 hover:bg-gray-200 rounded-lg transition-colors flex-shrink-0"
            title="Download"
          >
            <Download className="h-4 w-4 text-gray-600" />
          </button>
        </div>
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
            <div className={`text-sm font-semibold truncate flex-1 ${isOwn ? 'text-blue-100' : 'text-gray-700'}`}>
              {senderName}
            </div>
            <div className={`flex items-center space-x-2 flex-shrink-0 ml-2 ${isOwn ? 'text-blue-100' : 'text-gray-500'}`}>
              <span className="text-xs whitespace-nowrap">
                {new Date(msg.timestamp || msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
              {renderStatusIndicator()}
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
                {msg.text}
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
                      onClick={() => onDelete(messageId)} 
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
    </div>
  );
} 