import React, { useEffect, useRef, useState } from 'react';
import { Paperclip, Smile, X, Send, AlertCircle, Loader2, Camera, Image as ImageIcon, FileText } from 'lucide-react';
import { validateFile, formatFileSize, getFileIcon, isAvatarConversation } from '../../api/messageService';
import { useAvatarConversation } from '../../hooks/useAvatarConversation';
import Picker from '@emoji-mart/react';
import data from '@emoji-mart/data';

export default function ChatInput({
  input,
  setInput,
  onSend,
  onFileChange,
  uploadFile,
  onRemoveFile,
  onShowEmojiPicker,
  onTyping,
  members = [],
  isSending = false,
  uploadProgress = 0,
  conversation = null, // Add conversation prop for avatar detection
  onAvatarQuery = null, // Add avatar query handler prop
}) {
  const typingTimeoutRef = useRef(null);
  const [fileError, setFileError] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const textareaRef = useRef(null);
  const [mentionDropdown, setMentionDropdown] = useState({ open: false, query: '', start: 0 });
  const [mentionIndex, setMentionIndex] = useState(0);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const attachmentMenuRef = useRef(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const chatInputRef = useRef(null);
  
  // Avatar conversation state (simplified - just for conversation detection)
  const { isAvatarConversation: checkIsAvatarConversation } = useAvatarConversation();

  const handleInputChange = (e) => {
    setInput(e.target.value);
    // Mention detection
    const cursor = e.target.selectionStart;
    const value = e.target.value;
    const match = value.slice(0, cursor).match(/@([\w.]*)$/);
    if (match) {
      setMentionDropdown({ open: true, query: match[1], start: cursor - match[1].length - 1 });
    } else {
      setMentionDropdown({ open: false, query: '', start: 0 });
    }
    // Send typing indicator
    if (onTyping) {
      onTyping(true);
      // Clear previous timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      // Stop typing instantly when input is cleared
      if (e.target.value === '') {
        onTyping(false);
      }
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      try {
        // Validate file
        validateFile(file);
        setFileError(null);
        onFileChange(e);
      } catch (error) {
        setFileError(error.message);
        // Clear the input
        e.target.value = '';
        setTimeout(() => setFileError(null), 5000);
      }
    }
  };

  const handleSend = async () => {
    // Stop typing when sending
    if (onTyping) {
      onTyping(false);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    }

    // For avatar conversations, just send the regular message
    // MessagesPage will handle the avatar response processing automatically
    if (checkIsAvatarConversation && checkIsAvatarConversation(conversation) && input.trim()) {
      onSend();
    } else {
      // Regular message sending for non-avatar conversations
      onSend();
    }
  };


  const handleAttachmentSelect = (type) => {
    setShowAttachmentMenu(false);
    
    // Create file input with appropriate accept types
    const input = document.createElement('input');
    input.type = 'file';
    input.style.display = 'none';
    
    switch (type) {
      case 'image':
        input.accept = 'image/*';
        break;
      case 'video':
        input.accept = 'video/*';
        break;
      case 'document':
        input.accept = '.pdf,.doc,.docx,.txt,.rtf';
        break;
      default:
        input.accept = '*/*';
    }
    
    input.onchange = (e) => {
      handleFileChange(e);
      // Clean up the input element
      if (document.body.contains(input)) {
        document.body.removeChild(input);
      }
    };
    
    input.oncancel = () => {
      // Clean up if user cancels the file dialog
      if (document.body.contains(input)) {
        document.body.removeChild(input);
      }
    };
    
    document.body.appendChild(input);
    input.click();
    
    // Fallback cleanup after a timeout
    setTimeout(() => {
      if (document.body.contains(input)) {
        document.body.removeChild(input);
      }
    }, 10000);
  };

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  // Close attachment menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (attachmentMenuRef.current && !attachmentMenuRef.current.contains(event.target)) {
        setShowAttachmentMenu(false);
      }
    };

    if (showAttachmentMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showAttachmentMenu]);

  // Insert emoji at cursor position (emoji-mart v5+)
  const handleEmojiSelect = (emoji) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newValue = input.slice(0, start) + emoji.native + input.slice(end);
    setInput(newValue);
    setShowEmojiPicker(false);
    setTimeout(() => {
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd = start + emoji.native.length;
    }, 0);
  };

  // Filter members for mention
  const mentionOptions = mentionDropdown.open
    ? members.filter(m => {
        const uname = m.username || m.fullName || '';
        return uname.toLowerCase().includes(mentionDropdown.query.toLowerCase());
      })
    : [];

  // Insert mention at cursor
  const insertMention = (member) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const before = input.slice(0, mentionDropdown.start);
    const after = input.slice(textarea.selectionStart);
    const mentionText = `@${member.username || member.fullName || ''} `;
    const newValue = before + mentionText + after;
    setInput(newValue);
    setMentionDropdown({ open: false, query: '', start: 0 });
    setTimeout(() => {
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd = before.length + mentionText.length;
    }, 0);
  };

  // Keyboard navigation for mention dropdown
  const handleKeyDown = (e) => {
    if (mentionDropdown.open && mentionOptions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex(i => (i + 1) % mentionOptions.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex(i => (i - 1 + mentionOptions.length) % mentionOptions.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        insertMention(mentionOptions[mentionIndex]);
      } else if (e.key === 'Escape') {
        setMentionDropdown({ open: false, query: '', start: 0 });
      }
    }
  };

  // Drag and drop handlers
  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set dragOver to false if we're leaving the chat input container
    if (!chatInputRef.current?.contains(e.relatedTarget)) {
      setIsDragOver(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      const file = files[0]; // Take first file for now
      handleFileSelect(file);
    }
  };

  // Clipboard paste handler
  const handlePaste = (e) => {
    const items = Array.from(e.clipboardData.items);
    const imageItem = items.find(item => item.type.startsWith('image/'));
    
    if (imageItem) {
      e.preventDefault();
      const file = imageItem.getAsFile();
      if (file) {
        handleFileSelect(file);
      }
    }
  };

  const handleFileSelect = (file) => {
    try {
      validateFile(file);
      setFileError(null);
      onFileChange({ target: { files: [file] } });
    } catch (error) {
      setFileError(error.message);
      setTimeout(() => setFileError(null), 5000);
    }
  };

  return (
    <div 
      ref={chatInputRef}
      className={`p-3 sm:p-6 border-t border-gray-100 bg-white/80 backdrop-blur-sm relative ${
        isDragOver ? 'ring-2 ring-blue-400 bg-blue-50/50' : ''
      }`}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {isDragOver && (
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/30 via-purple-500/20 to-pink-500/30 border-2 border-dashed border-blue-400/80 rounded-2xl flex items-center justify-center z-10 backdrop-blur-2xl animate-in fade-in duration-300">
          <div className="text-center p-8">
            <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-2xl animate-pulse">
              <Paperclip className="h-10 w-10 text-white" />
            </div>
            <p className="text-blue-800 font-bold text-xl mb-2">Drop files here</p>
            <p className="text-blue-700 font-medium">Release to upload • Max 50MB</p>
            <div className="flex items-center justify-center space-x-2 mt-4">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
              <div className="w-2 h-2 bg-pink-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
            </div>
          </div>
        </div>
      )}

      {/* File error message */}
      {fileError && (
        <div className="mb-3 sm:mb-4 p-4 sm:p-5 bg-gradient-to-r from-red-50/90 to-pink-50/90 backdrop-blur-sm border border-red-200/60 text-red-700 rounded-2xl shadow-xl flex items-center space-x-3 animate-in slide-in-from-top-2 duration-300">
          <div className="p-2 rounded-xl bg-red-100">
            <AlertCircle className="h-5 w-5 text-red-600" />
          </div>
          <span className="text-sm font-bold flex-1">{fileError}</span>
          <button 
            onClick={() => setFileError(null)} 
            className="p-1.5 rounded-lg bg-red-100 hover:bg-red-200 text-red-600 hover:text-red-700 transition-all duration-200 hover:scale-110"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* File preview */}
      {uploadFile && (
        <div className="mb-3 sm:mb-4 p-4 sm:p-5 bg-gradient-to-br from-blue-50/90 via-white/80 to-purple-50/90 backdrop-blur-sm rounded-2xl border border-white/40 shadow-xl animate-in slide-in-from-bottom-2 duration-300">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {uploadFile.type && uploadFile.type.startsWith('image/') ? (
                <div className="relative">
                  <img 
                    src={URL.createObjectURL(uploadFile)} 
                    alt={uploadFile.name} 
                    className="h-16 w-16 rounded-2xl object-cover shadow-xl border-2 border-white/60" 
                  />
                  <div className="absolute -top-2 -right-2 w-6 h-6 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full flex items-center justify-center shadow-lg">
                    <ImageIcon className="h-3 w-3 text-white" />
                  </div>
                </div>
              ) : (
                <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-xl border-2 border-white/60">
                  <span className="text-3xl">{getFileIcon('other', uploadFile.type)}</span>
                </div>
              )}
              <div>
                <p className="text-base font-bold text-primary-800 truncate max-w-xs mb-1">{uploadFile.name}</p>
                <p className="text-sm text-secondary-500 font-medium">{formatFileSize(uploadFile.size)}</p>
                <div className="flex items-center space-x-2 mt-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-xs text-green-600 font-bold">Ready to send</span>
                </div>
              </div>
            </div>
            <button 
              onClick={onRemoveFile} 
              className="p-2.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-500 hover:text-red-600 transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-110 disabled:opacity-50"
              disabled={isSending}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          
          {/* Upload progress bar */}
          {isSending && (
            <div className="mt-4 p-4 bg-white/60 backdrop-blur-sm rounded-2xl border border-white/40">
              <div className="flex items-center justify-between text-sm text-primary-800 mb-3">
                <div className="flex items-center space-x-2">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                  <span className="font-bold">Uploading...</span>
                </div>
                <span className="font-bold text-blue-600">{uploadProgress}%</span>
              </div>
              <div className="w-full bg-gray-200/60 rounded-full h-3 overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 h-3 rounded-full transition-all duration-500 shadow-inner animate-pulse"
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Input area */}
      <div className="flex items-end space-x-2 sm:space-x-3 relative">
        {/* Enhanced attachment menu */}
        <div className="relative" ref={attachmentMenuRef}>
          <button
            onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
            disabled={isSending}
            className={`cursor-pointer p-2 sm:p-3 rounded-xl transition-all duration-200 shadow-lg transform ${
              isSending 
                ? 'bg-gray-300 cursor-not-allowed transform-none' 
                : 'bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:from-blue-600 hover:to-purple-600 hover:shadow-xl hover:scale-105'
            }`}
            title="Attach files or record voice"
          >
            <Paperclip className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>
          
          {/* Attachment menu */}
          {showAttachmentMenu && (
            <div className="absolute bottom-full left-0 mb-3 bg-white/95 backdrop-blur-2xl border border-white/20 rounded-2xl shadow-2xl py-3 min-w-[200px] z-50 animate-in slide-in-from-bottom-2 duration-300">
              <div className="px-4 py-2 border-b border-gray-100">
                <p className="text-xs font-bold text-primary-800 uppercase tracking-wider">Attach Files</p>
              </div>
              
              <button
                onClick={() => handleAttachmentSelect('image')}
                className="w-full px-4 py-3 text-left text-sm text-primary-800 hover:bg-gradient-to-r hover:from-green-50 hover:to-emerald-50 flex items-center space-x-3 transition-all duration-200 font-medium hover:shadow-sm"
              >
                <div className="p-2 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500">
                  <ImageIcon className="h-4 w-4 text-white" />
                </div>
                <div>
                  <span className="font-bold">Photos</span>
                  <p className="text-xs text-secondary-500">JPEG, PNG, GIF, WebP</p>
                </div>
              </button>
              
              <button
                onClick={() => handleAttachmentSelect('video')}
                className="w-full px-4 py-3 text-left text-sm text-primary-800 hover:bg-gradient-to-r hover:from-red-50 hover:to-pink-50 flex items-center space-x-3 transition-all duration-200 font-medium hover:shadow-sm"
              >
                <div className="p-2 rounded-xl bg-gradient-to-br from-red-500 to-pink-500">
                  <Camera className="h-4 w-4 text-white" />
                </div>
                <div>
                  <span className="font-bold">Videos</span>
                  <p className="text-xs text-secondary-500">MP4, WebM, AVI, MOV</p>
                </div>
              </button>
              
              <button
                onClick={() => handleAttachmentSelect('document')}
                className="w-full px-4 py-3 text-left text-sm text-primary-800 hover:bg-gradient-to-r hover:from-blue-50 hover:to-cyan-50 flex items-center space-x-3 transition-all duration-200 font-medium hover:shadow-sm"
              >
                <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500">
                  <FileText className="h-4 w-4 text-white" />
                </div>
                <div>
                  <span className="font-bold">Documents</span>
                  <p className="text-xs text-secondary-500">PDF, Word, Excel, PowerPoint</p>
                </div>
              </button>
              
              <button
                onClick={() => handleAttachmentSelect('any')}
                className="w-full px-4 py-3 text-left text-sm text-primary-800 hover:bg-gradient-to-r hover:from-gray-50 hover:to-blue-50 flex items-center space-x-3 transition-all duration-200 font-medium hover:shadow-sm"
              >
                <div className="p-2 rounded-xl bg-gradient-to-br from-gray-500 to-blue-500">
                  <Paperclip className="h-4 w-4 text-white" />
                </div>
                <div>
                  <span className="font-bold">Any File</span>
                  <p className="text-xs text-secondary-500">All supported formats</p>
                </div>
              </button>
            </div>
          )}
        </div>

        {/* Text input */}
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={e => {
              handleKeyDown(e);
              if (!mentionDropdown.open && e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            onPaste={handlePaste}
            placeholder="Type a message..."
            rows={1}
            className="w-full px-3 py-2 sm:px-4 sm:py-3 pr-10 sm:pr-12 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white resize-none shadow-sm text-sm sm:text-base"
            style={{ minHeight: '48px', maxHeight: '120px' }}
          />
          
          {/* Emoji button */}
          <button 
            type="button"
            onClick={() => setShowEmojiPicker(v => !v)} 
            className="absolute right-2 sm:right-3 top-1/2 transform -translate-y-1/2 p-1.5 sm:p-2 rounded-full hover:bg-gray-100 transition-all duration-200 text-gray-400 hover:text-gray-600"
            tabIndex={-1}
          >
            <Smile className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>
          {/* Emoji picker popover (emoji-mart v5+) */}
          {showEmojiPicker && (
            <div className="absolute bottom-12 right-0 z-50">
              <Picker
                data={data}
                onEmojiSelect={handleEmojiSelect}
                theme="light"
                previewPosition="none"
                skinTonePosition="none"
              />
            </div>
          )}
          {/* Mention dropdown */}
          {mentionDropdown.open && mentionOptions.length > 0 && (
            <div className="absolute left-0 bottom-14 z-50 bg-white border border-gray-200 rounded-xl shadow-lg w-64 max-h-60 overflow-y-auto animate-in fade-in duration-100">
              {mentionOptions.map((m, i) => (
                <div
                  key={m._id || m.username || m.fullName}
                  className={`px-4 py-2 cursor-pointer flex items-center gap-2 hover:bg-blue-50 ${i === mentionIndex ? 'bg-blue-100' : ''}`}
                  onMouseDown={e => { e.preventDefault(); insertMention(m); }}
                  onMouseEnter={() => setMentionIndex(i)}
                >
                  <span className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-purple-400 flex items-center justify-center text-white font-bold text-sm">
                    {(m.fullName || m.username || '?')[0]}
                  </span>
                  <span className="font-medium text-gray-900">{m.fullName || m.username}</span>
                  {m.username && <span className="text-xs text-gray-500 ml-2">@{m.username}</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Send button */}
        <button
          onClick={handleSend}
          disabled={(!input.trim() && !uploadFile) || isSending}
          className={`p-2 sm:p-3 rounded-xl text-white transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 disabled:transform-none relative ${
            isAvatarConversation(conversation)
              ? 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700'
              : 'bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600'
          } ${
            isSending
              ? 'from-gray-300 to-gray-400 cursor-not-allowed'
              : ''
          }`}
        >
          {isSending ? (
            <div className="flex items-center space-x-1">
              <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
            </div>
          ) : (
            <Send className="h-4 w-4 sm:h-5 sm:w-5" />
          )}
          
          {/* Upload progress indicator for files */}
          {isSending && uploadFile && uploadProgress > 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}
        </button>
      </div>

      {/* Helper text */}
      <div className="mt-1 sm:mt-2 text-center">
        <p className="text-xs text-gray-500 px-2">
          Press Enter to send, Shift+Enter for new line • Max file size: 50MB
        </p>
      </div>
    </div>
  );
} 