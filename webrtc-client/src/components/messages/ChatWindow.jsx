import React, { useEffect, useRef, useLayoutEffect } from 'react';
import MessageBubble from './MessageBubble';

// Utility function to detect system messages
function isSystemMessage(msg) {
  // Check explicit system message properties
  if (msg.type === 'system' || msg.isSystemMessage === true || msg.senderId === 'system') {
    return true;
  }
  
  // Check if sender is system (various formats)
  if (msg.sender === 'system' || (msg.sender && msg.sender._id === 'system')) {
    return true;
  }
  
  // Check common system message text patterns
  if (msg.text) {
    const text = msg.text.toLowerCase();
    const systemKeywords = [
      'was created',
      'was added', 
      'was removed',
      'joined the',
      'left the',
      'no longer exists',
      'created this group'
    ];
    
    return systemKeywords.some(keyword => text.includes(keyword));
  }
  
  return false;
}

function groupMessagesByDate(messages) {
  if (!messages || !Array.isArray(messages)) return {};
  return messages.reduce((acc, msg) => {
    const date = new Date(msg.createdAt || msg.timestamp || Date.now()).toLocaleDateString();
    if (!acc[date]) acc[date] = [];
    acc[date].push(msg);
    return acc;
  }, {});
}

export default function ChatWindow({
  messages = [],
  loading = false,
  currentUserId,
  conversationType,
  onEdit,
  onDelete,
  onReply,
  onEmoji,
  reactions = {},
  showEmojiPicker,
  setShowEmojiPicker,
  emojiList,
  editMsgId,
  editInput,
  setEditInput,
  handleEditSave,
  handleEditCancel,
  typing = {},
  messageStatus,
  onlineUsers = [],
  shouldAutoScroll = true,
  searchResults = [],
  currentSearchResult = 0,
  searchFilters = null,
  onPin,
  onStar,
  pinnedMessages = [],
  starredMessages = [],
  onLoadMore,
  hasMoreMessages = false,
  loadingMore = false,
  unreadStartIndex = null,
  isConversationSwitch = false,
}) {
  const chatRef = useRef(null);
  const lastScrollHeight = useRef(0);
  const isScrollingToBottom = useRef(false);
  const lastScrollTop = useRef(0);
  const isUserScrolling = useRef(false);
  const scrollTimeoutRef = useRef(null);
  const grouped = groupMessagesByDate(messages);
  
  // Debug: Log messages length to see if ChatWindow receives updated messages
  console.log('📨 ChatWindow messages count:', messages.length, 'Latest message ID:', messages[messages.length - 1]?._id);

  // Pre-position scroll for conversation switches BEFORE render
  useLayoutEffect(() => {
    if (!chatRef.current || !isConversationSwitch) return;
    
    const chatElement = chatRef.current;
    chatElement.style.scrollBehavior = 'auto';
    
    // Force scroll to bottom immediately, before any rendering happens
    const scrollToBottom = () => {
      const maxScroll = chatElement.scrollHeight - chatElement.clientHeight;
      chatElement.scrollTop = Math.max(0, maxScroll);
    };
    
    scrollToBottom();
    
    // Double-check on next frame and then reset the flag
    requestAnimationFrame(() => {
      if (chatElement) {
        scrollToBottom();
        // Reset the flag immediately after positioning
        requestAnimationFrame(() => {
          console.log('🔧 Pre-positioned scroll completed, resetting flag');
        });
      }
    });
    
    console.log('🔧 Pre-positioned scroll to bottom for conversation switch');
  }, [messages, isConversationSwitch]);

  // Enhanced scroll management with performance optimizations
  useEffect(() => {
    if (!chatRef.current) return;
    
    const chatElement = chatRef.current;
    const currentScrollHeight = chatElement.scrollHeight;
    const previousScrollHeight = lastScrollHeight.current;
    
    if (shouldAutoScroll && !isUserScrolling.current) {
      isScrollingToBottom.current = true;
      
      if (isConversationSwitch) {
        // For conversation switches, scroll immediately without any delay or animation
        chatElement.style.scrollBehavior = 'auto';
        
        // Set scroll position immediately, even before the layout is complete
        const scrollToBottom = () => {
          const maxScroll = chatElement.scrollHeight - chatElement.clientHeight;
          chatElement.scrollTop = Math.max(0, maxScroll);
        };
        
        // Scroll immediately
        scrollToBottom();
        
        // Also scroll on next frame to catch any layout changes
        requestAnimationFrame(() => {
          if (chatElement) {
            scrollToBottom();
          }
        });
        
        isScrollingToBottom.current = false;
      } else {
        // Smooth scroll for new messages in the same conversation
        chatElement.style.scrollBehavior = 'smooth';
        chatElement.scrollTop = chatElement.scrollHeight;
        
        // Reset after scrolling completes
        setTimeout(() => {
          if (chatElement) {
            chatElement.style.scrollBehavior = 'auto';
          }
          isScrollingToBottom.current = false;
        }, 500);
      }
      
    } else if (previousScrollHeight > 0 && currentScrollHeight > previousScrollHeight) {
      // When loading previous messages, maintain scroll position without animation
      const heightDifference = currentScrollHeight - previousScrollHeight;
      const currentScrollTop = chatElement.scrollTop;
      
      // Use RAF for smooth position update
      requestAnimationFrame(() => {
        if (chatElement && !isScrollingToBottom.current) {
          chatElement.style.scrollBehavior = 'auto';
          chatElement.scrollTop = currentScrollTop + heightDifference;
        }
      });
    }
    
    lastScrollHeight.current = currentScrollHeight;
  }, [messages, typing, shouldAutoScroll]);
  
  // Enhanced scroll detection with infinite loading
  useEffect(() => {
    const chatElement = chatRef.current;
    if (!chatElement) return;
    
    let scrollThrottleTimer = null;
    
    const handleScroll = () => {
      // Throttle scroll events for better performance
      if (scrollThrottleTimer) return;
      
      scrollThrottleTimer = setTimeout(() => {
        scrollThrottleTimer = null;
        
        // Detect if user is actively scrolling
        isUserScrolling.current = true;
        
        // Check for infinite scroll - load more when near top
        if (chatElement.scrollTop < 100 && hasMoreMessages && !loadingMore && onLoadMore) {
          onLoadMore();
        }
        
        // Clear existing timeout
        if (scrollTimeoutRef.current) {
          clearTimeout(scrollTimeoutRef.current);
        }
        
        // Set timeout to detect when scrolling stops
        scrollTimeoutRef.current = setTimeout(() => {
          isUserScrolling.current = false;
        }, 150);
        
        lastScrollTop.current = chatElement.scrollTop;
      }, 16); // ~60fps throttling
    };
    
    // Use passive listeners for better performance
    chatElement.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      chatElement.removeEventListener('scroll', handleScroll);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      if (scrollThrottleTimer) {
        clearTimeout(scrollThrottleTimer);
      }
    };
  }, [hasMoreMessages, loadingMore, onLoadMore]);

  const isLoading = loading;

  const typingUsers = Object.keys(typing || {}).filter(
    userId => typing[userId] && userId !== currentUserId,
  );
  
  const typingNames = typingUsers
    .map(uid => {
      let user = null;
      if (onlineUsers instanceof Map) {
        user = onlineUsers.get(uid);
      } else if (Array.isArray(onlineUsers)) {
        user = onlineUsers.find(u => u._id === uid);
      }
      return user?.fullName || user?.username || 'Someone';
    })
    .filter(Boolean);

  return (
    <div
      ref={chatRef}
      className="flex-1 overflow-y-auto overflow-x-hidden bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50 relative"
    >
      {/* Loading more messages indicator */}
      {loadingMore && (
        <div className="flex justify-center py-4">
          <div className="flex items-center space-x-2 bg-white/80 backdrop-blur-sm px-4 py-2 rounded-full shadow-md border border-gray-200">
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-gray-600 font-medium">Loading older messages...</span>
          </div>
        </div>
      )}
      
      {isLoading ? (
        <div className="flex h-full items-center justify-center">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="p-3 sm:p-6 space-y-4 sm:space-y-8 w-full message-container">
          {Object.entries(grouped).map(([date, msgs]) => (
            <div key={date} className="space-y-3 sm:space-y-6">
              {/* Date separator - Modern elegant */}
              <div className="flex items-center justify-center my-8">
                <div className="bg-white/80 backdrop-blur-sm px-6 py-3 rounded-full shadow-lg border border-gray-200/50">
                  <span className="text-sm font-bold text-gray-700 tracking-wide">{date}</span>
                </div>
              </div>
              <div className="space-y-2 sm:space-y-4">
                {msgs.map((msg, msgIndex) => {
                  const isSystemMsg = isSystemMessage(msg);
                  
                  if (isSystemMsg) {
                    // System message detected - render as centered notification
                  }
                  
                  // Calculate global index for unread indicator
                  const globalIndex = messages.findIndex(m => m._id === msg._id);
                  const showUnreadIndicator = unreadStartIndex !== null && globalIndex === unreadStartIndex;
                  
                  const isSearchResult = searchResults.some(result => result._id === msg._id);
                  const isCurrentSearchResult = searchResults.length > 0 && 
                    searchResults[currentSearchResult]?._id === msg._id;
                  
                  if (isSystemMsg) {
                    const isDeletionNotice = msg.isDeletionNotice || (msg.text && msg.text.includes('no longer exists'));
                    
                    return (
                      <div 
                        key={msg._id || msg.id}
                        id={`message-${msg._id || msg.id}`}
                        className="flex justify-center my-4"
                      >
                        <div 
                          className={`px-4 py-2 rounded-full text-xs font-medium max-w-md text-center shadow-sm backdrop-blur-sm ${
                            isDeletionNotice
                              ? 'bg-red-100/70 text-red-600 border border-red-200/50' 
                              : 'bg-blue-100/70 text-blue-600 border border-blue-200/50'
                          }`}
                        >
                          {msg.text}
                        </div>
                      </div>
                    );
                  }
                  
                  return (
                    <>
                      {/* Unread messages indicator */}
                      {showUnreadIndicator && (
                        <div className="flex items-center justify-center my-6">
                          <div className="flex items-center bg-blue-500/90 backdrop-blur-sm px-4 py-2 rounded-full shadow-lg border border-blue-200/50">
                            <div className="w-2 h-2 bg-white rounded-full mr-2 animate-pulse"></div>
                            <span className="text-sm font-semibold text-white">New Messages</span>
                          </div>
                        </div>
                      )}
                      
                      <div 
                        key={msg._id || msg.id}
                        id={`message-${msg._id || msg.id}`}
                        className={`transition-all duration-300 ${
                          isCurrentSearchResult 
                            ? 'ring-2 ring-blue-400 ring-opacity-75 bg-blue-50 rounded-lg p-2 -m-2'
                            : isSearchResult 
                            ? 'bg-yellow-50 rounded-lg p-1 -m-1'
                            : ''
                        }`}
                      >
                      <MessageBubble
                        msg={msg}
                        isOwn={
                          msg.senderId === currentUserId ||
                          msg.sender === currentUserId ||
                          (msg.sender && typeof msg.sender === 'object' && msg.sender._id === currentUserId)
                        }
                        conversationType={conversationType}
                        onEdit={onEdit}
                        onDelete={onDelete}
                        onReply={onReply}
                        onEmoji={onEmoji}
                        reactions={reactions[msg._id || msg.id]}
                        showEmojiPicker={showEmojiPicker}
                        setShowEmojiPicker={setShowEmojiPicker}
                        emojiList={emojiList}
                        editMsgId={editMsgId}
                        editInput={editInput}
                        setEditInput={setEditInput}
                        handleEditSave={handleEditSave}
                        handleEditCancel={handleEditCancel}
                        replyContext={
                          msg.replyTo && typeof msg.replyTo === 'object' 
                            ? msg.replyTo 
                            : msg.replyTo && typeof msg.replyTo === 'string'
                            ? messages.find(m => m._id === msg.replyTo)
                            : null
                        }
                        messageStatus={messageStatus}
                        onlineUsers={onlineUsers}
                        currentUserId={currentUserId}
                        searchFilters={searchFilters}
                        onPin={onPin}
                        onStar={onStar}
                        isPinned={pinnedMessages.includes(msg._id || msg.id)}
                        isStarred={starredMessages.includes(msg._id || msg.id)}
                      />
                      </div>
                    </>
                  );
                })}
              </div>
            </div>
          ))}
          {/* Typing indicator - Modern elegant */}
          {typingUsers.length > 0 && (
            <div className="flex items-center justify-center space-x-4 p-6 bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200/50 max-w-xs mx-auto animate-in slide-in-from-bottom-4 duration-300">
              <div className="flex space-x-1">
                <div className="w-3 h-3 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full animate-bounce"></div>
                <div className="w-3 h-3 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-3 h-3 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>
              <span className="text-sm text-gray-700 font-medium">
                {typingNames.length === 1
                  ? `${typingNames[0]} is typing...`
                  : typingNames.length === 2
                  ? `${typingNames[0]} and ${typingNames[1]} are typing...`
                  : typingNames.length > 2
                  ? `${typingNames.slice(0, 2).join(', ')} and ${typingNames.length - 2} others are typing...`
                  : ''}
              </span>
            </div>
          )}
          {/* Empty state - Modern elegant */}
          {Object.keys(grouped).length === 0 && (
            <div className="text-center py-16">
              <div className="p-6 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 w-20 h-20 mx-auto mb-6 flex items-center justify-center shadow-2xl">
                <svg className="h-10 w-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">No messages yet</h3>
              <p className="text-gray-600">Start the conversation by sending a message!</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}