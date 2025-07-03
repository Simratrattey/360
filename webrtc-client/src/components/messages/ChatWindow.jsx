import React, { useEffect, useRef } from 'react';
import MessageBubble from './MessageBubble';

export default function ChatWindow({
  grouped,
  selected,
  reactions,
  showEmojiPicker,
  setShowEmojiPicker,
  emojiList,
  editMsgId,
  editInput,
  setEditInput,
  handleEditSave,
  handleEditCancel,
  onEdit,
  onDelete,
  onReply,
  onEmoji,
  replyContext,
  typing,
  currentUserId,
  messageStatus,
  onlineUsers,
}) {
  const chatRef = useRef(null);

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [grouped, typing]);

  // Get typing users
  const typingUsers = Object.keys(typing || {}).filter(userId => 
    typing[userId] && userId !== currentUserId
  );
  const typingNames = typingUsers
    .map(uid => {
      const user = onlineUsers?.find(u => u._id === uid);
      return user?.fullName || user?.username || 'Someone';
    })
    .filter(Boolean);

  return (
    <div ref={chatRef} className="flex-1 overflow-y-auto bg-gray-950 dark:bg-gray-950 text-secondary-100">
      <div className="p-6 space-y-8">
        {Object.entries(grouped).map(([date, msgs]) => (
          <div key={date} className="space-y-6">
            {/* Date separator with modern styling */}
            <div className="flex items-center justify-center my-8">
              <div className="bg-secondary-800 px-6 py-3 rounded-full shadow-lg border border-secondary-700">
                <span className="text-sm font-bold text-secondary-100 tracking-wide">{date}</span>
              </div>
            </div>
            
            {/* Messages container */}
            <div className="space-y-4">
              {msgs.map(msg => (
                <MessageBubble
                  key={msg._id || msg.id}
                  msg={msg}
                  isOwn={
                    (msg.senderId === currentUserId) || 
                    (msg.sender === currentUserId) || 
                    (msg.sender && typeof msg.sender === 'object' && msg.sender._id === currentUserId)
                  }
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
                />
              ))}
            </div>
          </div>
        ))}
        
        {/* Enhanced Typing Indicator */}
        {typingUsers.length > 0 && (
          <div className="flex items-center space-x-4 p-6 bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200 max-w-xs animate-in slide-in-from-bottom-4 duration-300">
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

        {/* Empty state */}
        {Object.keys(grouped).length === 0 && (
          <div className="text-center py-16">
            <div className="p-6 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 w-20 h-20 mx-auto mb-6 flex items-center justify-center shadow-2xl">
              <svg className="h-10 w-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">No messages yet</h3>
            <p className="text-gray-600">Start the conversation by sending a message!</p>
          </div>
        )}
      </div>
    </div>
  );
} 