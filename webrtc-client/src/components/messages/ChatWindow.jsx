import React, { useEffect, useRef } from 'react';
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
}) {
  const chatRef = useRef(null);
  const grouped = groupMessagesByDate(messages);

  useEffect(() => {
    if (chatRef.current && shouldAutoScroll) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages, typing, shouldAutoScroll]);

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
      className="flex-1 overflow-y-auto overflow-x-hidden bg-[#efeae2] relative"
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23d4d4d8' fill-opacity='0.1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
      }}
    >
      {isLoading ? (
        <div className="flex h-full items-center justify-center">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="p-3 sm:p-6 space-y-4 sm:space-y-8 w-full">
          {Object.entries(grouped).map(([date, msgs]) => (
            <div key={date} className="space-y-3 sm:space-y-6">
              {/* Date separator - WhatsApp style */}
              <div className="flex items-center justify-center my-6">
                <div className="bg-white/90 backdrop-blur-sm px-4 py-2 rounded-lg shadow-sm border border-gray-200">
                  <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">{date}</span>
                </div>
              </div>
              <div className="space-y-2 sm:space-y-4">
                {msgs.map((msg, index) => {
                  const isSystemMsg = isSystemMessage(msg);
                  
                  if (isSystemMsg) {
                    console.log('🔔 Detected system message:', {
                      type: msg.type,
                      isSystemMessage: msg.isSystemMessage,
                      senderId: msg.senderId,
                      sender: msg.sender,
                      text: msg.text
                    });
                  }
                  
                  const isSearchResult = searchResults.some(result => result._id === msg._id);
                  const isCurrentSearchResult = searchResults.length > 0 && 
                    searchResults[currentSearchResult]?._id === msg._id;
                  
                  if (isSystemMsg) {
                    const isDeletionNotice = msg.isDeletionNotice || (msg.text && msg.text.includes('no longer exists'));
                    
                    return (
                      <div 
                        key={msg._id || msg.id}
                        id={`message-${msg._id || msg.id}`}
                        className="flex justify-center my-3"
                      >
                        <div 
                          className={`px-3 py-1.5 rounded-full text-xs font-normal max-w-xs text-center shadow-sm ${
                            isDeletionNotice
                              ? 'bg-red-100 text-red-600 border border-red-200' 
                              : 'bg-yellow-100 text-yellow-700 border border-yellow-200'
                          }`}
                        >
                          {msg.text}
                        </div>
                      </div>
                    );
                  }
                  
                  return (
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
                        replyContext={null}
                        messageStatus={messageStatus}
                        onlineUsers={onlineUsers}
                        currentUserId={currentUserId}
                        searchFilters={searchFilters}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          {/* Typing indicator - WhatsApp style */}
          {typingUsers.length > 0 && (
            <div className="flex justify-start px-4 pb-4">
              <div className="bg-white rounded-2xl rounded-bl-md px-4 py-3 shadow-sm border border-gray-200 max-w-xs animate-in slide-in-from-bottom-2 duration-200">
                <div className="flex items-center space-x-3">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                  <span className="text-xs text-gray-500 font-medium">
                    {typingNames.length === 1
                      ? `${typingNames[0]} is typing...`
                      : typingNames.length === 2
                      ? `${typingNames[0]} and ${typingNames[1]} are typing...`
                      : typingNames.length > 2
                      ? `${typingNames.slice(0, 2).join(', ')} and ${typingNames.length - 2} others are typing...`
                      : ''}
                  </span>
                </div>
              </div>
            </div>
          )}
          {/* Empty state - WhatsApp style */}
          {Object.keys(grouped).length === 0 && (
            <div className="text-center py-20 px-8">
              <div className="p-8 rounded-full bg-green-100 w-24 h-24 mx-auto mb-6 flex items-center justify-center">
                <svg className="h-12 w-12 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-700 mb-2">No messages here yet...</h3>
              <p className="text-gray-500 text-sm leading-relaxed max-w-sm mx-auto">
                Send a message below to start the conversation. All messages are private and encrypted.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}