import React, { useEffect, useRef, useState } from 'react';
import { Paperclip, Smile, X, Send, AlertCircle } from 'lucide-react';
import { validateFile, formatFileSize, getFileIcon } from '../../api/messageService';
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
}) {
  const typingTimeoutRef = useRef(null);
  const [fileError, setFileError] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const textareaRef = useRef(null);
  const [mentionDropdown, setMentionDropdown] = useState({ open: false, query: '', start: 0 });
  const [mentionIndex, setMentionIndex] = useState(0);

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

  const handleSend = () => {
    // Stop typing when sending
    if (onTyping) {
      onTyping(false);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    }
    onSend();
  };

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

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
    <div className="p-6 border-t border-gray-100 bg-white/80 backdrop-blur-sm">
      {/* File error message */}
      {fileError && (
        <div className="mb-4 p-3 bg-gradient-to-r from-red-50 to-pink-50 border border-red-200 text-red-700 rounded-xl shadow-sm flex items-center space-x-2">
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
        <div className="mb-4 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border border-gray-200">
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
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="flex items-end space-x-3 relative">
        {/* File upload button */}
        <label className="cursor-pointer p-3 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:from-blue-600 hover:to-purple-600 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105" title="Upload any file type (max 50MB)">
          <Paperclip className="h-5 w-5" />
          <input 
            type="file" 
            className="hidden" 
            onChange={handleFileChange}
            accept="*/*"
          />
        </label>

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
            className="w-full px-4 py-3 pr-12 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white resize-none shadow-sm"
            style={{ minHeight: '48px', maxHeight: '120px' }}
          />
          
          {/* Emoji button */}
          <button 
            type="button"
            onClick={() => setShowEmojiPicker(v => !v)} 
            className="absolute right-3 top-1/2 transform -translate-y-1/2 p-2 rounded-full hover:bg-gray-100 transition-all duration-200 text-gray-400 hover:text-gray-600"
            tabIndex={-1}
          >
            <Smile className="h-5 w-5" />
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
          disabled={!input.trim() && !uploadFile}
          className="p-3 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:from-blue-600 hover:to-purple-600 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 disabled:transform-none"
        >
          <Send className="h-5 w-5" />
        </button>
      </div>

      {/* Helper text */}
      <div className="mt-2 text-center">
        <p className="text-xs text-gray-500">
          Press Enter to send, Shift+Enter for new line • Max file size: 50MB
        </p>
      </div>
    </div>
  );
} 