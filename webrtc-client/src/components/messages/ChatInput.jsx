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

  return (
    <div className="p-3 sm:p-6 border-t border-gray-100 bg-white/80 backdrop-blur-sm">
      {/* File error message */}
      {fileError && (
        <div className="mb-3 sm:mb-4 p-2 sm:p-3 bg-gradient-to-r from-red-50 to-pink-50 border border-red-200 text-red-700 rounded-xl shadow-sm flex items-center space-x-2">
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm font-medium">{fileError}</span>
          <button 
            onClick={() => setFileError(null)} 
            className="ml-auto text-red-500 hover:text-red-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* File preview */}
      {uploadFile && (
        <div className="mb-3 sm:mb-4 p-3 sm:p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {uploadFile.type && uploadFile.type.startsWith('image/') ? (
                <div className="relative">
                  <img 
                    src={URL.createObjectURL(uploadFile)} 
                    alt={uploadFile.name} 
                    className="h-12 w-12 rounded-lg object-cover shadow-md" 
                  />
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                    <span className="text-xs text-white font-bold">IMG</span>
                  </div>
                </div>
              ) : (
                <div className="h-12 w-12 rounded-lg bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center shadow-md">
                  <span className="text-2xl">{getFileIcon('other', uploadFile.type)}</span>
                </div>
              )}
              <div>
                <p className="text-sm font-semibold text-gray-900 truncate max-w-xs">{uploadFile.name}</p>
                <p className="text-xs text-gray-500">{formatFileSize(uploadFile.size)}</p>
              </div>
            </div>
            <button 
              onClick={onRemoveFile} 
              className="p-2 rounded-full hover:bg-red-50 text-gray-400 hover:text-red-500 transition-all duration-200"
              disabled={isSending}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          
          {/* Upload progress bar */}
          {isSending && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                <span>Uploading...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-300"
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
            <div className="absolute bottom-full left-0 mb-2 bg-white border border-gray-200 rounded-xl shadow-xl py-2 min-w-[180px] z-50">
              <button
                onClick={() => handleAttachmentSelect('image')}
                className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-3 transition-colors"
              >
                <ImageIcon className="h-4 w-4 text-green-500" />
                <span>Photos</span>
              </button>
              
              <button
                onClick={() => handleAttachmentSelect('video')}
                className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-3 transition-colors"
              >
                <Camera className="h-4 w-4 text-red-500" />
                <span>Videos</span>
              </button>
              
              <button
                onClick={() => handleAttachmentSelect('document')}
                className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-3 transition-colors"
              >
                <FileText className="h-4 w-4 text-blue-500" />
                <span>Documents</span>
              </button>
              
              <button
                onClick={() => handleAttachmentSelect('any')}
                className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-3 transition-colors"
              >
                <Paperclip className="h-4 w-4 text-gray-500" />
                <span>Any File</span>
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