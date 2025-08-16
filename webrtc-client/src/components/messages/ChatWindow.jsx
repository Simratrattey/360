import React, { useEffect, useRef } from 'react';
import MessageBubble from './MessageBubble';

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
  /**
   * Indicates whether the parent component is currently fetching messages.
   * When true, a spinner will be rendered instead of the message list.
   */
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
}) {
  // Ref used to scroll to bottom on new messages
  const chatRef = useRef(null);
  // Group messages by date; safe to pass an empty array
  const grouped = groupMessagesByDate(messages);

  // Scroll to bottom whenever messages or typing users change
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages, typing]);

  // Use the passed-in loading prop to determine if messages are being fetched
  const isLoading = loading;

  // Determine typing users excluding the current user
  const typingUsers = Object.keys(typing || {}).filter(
    userId => typing[userId] && userId !== currentUserId,
  );
  // Resolve user names for typing indicator; handle onlineUsers as Map or Array
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
      className="flex-1 overflow-y-auto bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50"
    >
      {isLoading ? (
        <div className="flex h-full items-center justify-center">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="p-6 space-y-8">
          {Object.entries(grouped).map(([date, msgs]) => (
            <div key={date} className="space-y-6">
              {/* Date separator */}
              <div className="flex items-center justify-center my-8">
                <div className="bg-white/80 backdrop-blur-sm px-6 py-3 rounded-full shadow-lg border border-gray-200">
                  <span className="text-sm font-bold text-gray-700 tracking-wide">{date}</span>
                </div>
              </div>
              <div className="space-y-4">
                {msgs.map(msg => (
                  <MessageBubble
                    key={msg._id || msg.id}
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
                  />
                ))}
              </div>
            </div>
          ))}
          {/* Typing indicator */}
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