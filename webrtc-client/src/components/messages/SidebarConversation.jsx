import React, { useState } from 'react';
import { Star, Trash2, MessageCircle, Users, Hash } from 'lucide-react';
import { useChatSocket } from '../../context/ChatSocketContext';

function getConversationDisplayName(conversation, currentUserId) {
  try {
    if (!conversation) {
      return 'Unknown';
    }
    
    // If conversation has a name (group/community), use it
    if (conversation.name) {
      return String(conversation.name);
    }
    
    // For DMs, show the other person's name
    if (conversation.type === 'dm' && Array.isArray(conversation.members)) {
      const otherMember = conversation.members.find(m => m._id !== currentUserId);
      
      if (otherMember && typeof otherMember === 'object') {
        // Ensure we're working with a user object and extract string values
        const fullName = otherMember.fullName;
        const username = otherMember.username;
        const email = otherMember.email;
        
        const displayName = fullName || username || email || 'Unknown User';
        
        // Ensure we return a string
        return String(displayName);
      } else {
        return 'Unknown User';
      }
    }
    
    // Fallback
    return 'Unknown Conversation';
  } catch (error) {
    console.error('Error in getConversationDisplayName:', error);
    return 'Error';
  }
}

export default function SidebarConversation({
  conv,
  isActive,
  onSelect,
  onStar,
  onDelete,
  onDismissDeleted,
  starred,
  getInitials,
  currentUserId,
  canDelete,
}) {
  const { onlineUsers } = useChatSocket();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  const displayName = getConversationDisplayName(conv, currentUserId);
  const initials = getInitials(displayName);
  
  // Get the other user in DM
  const getOtherUser = () => {
    if (conv.type === 'dm' && Array.isArray(conv.members)) {
      return conv.members.find(member => member._id !== currentUserId);
    }
    return null;
  };

  const otherUser = getOtherUser();
  // Online status tracking removed for a more compact layout

  // Get conversation type config
  const getTypeConfig = (type) => {
    const configs = {
      dm: {
        icon: MessageCircle,
        gradient: 'from-purple-500 to-pink-500',
        bgGradient: 'from-purple-50 to-pink-50',
        borderColor: 'border-purple-200'
      },
      group: {
        icon: Users,
        gradient: 'from-blue-500 to-cyan-500',
        bgGradient: 'from-blue-50 to-cyan-50',
        borderColor: 'border-blue-200'
      },
      community: {
        icon: Hash,
        gradient: 'from-green-500 to-emerald-500',
        bgGradient: 'from-green-50 to-emerald-50',
        borderColor: 'border-green-200'
      }
    };
    return configs[type] || configs.dm;
  };

  const typeConfig = getTypeConfig(conv.type);
  
  return (
    <div
      className={`group relative mx-1 md:mx-2 mb-1 p-3 md:p-4 rounded-xl cursor-pointer transition-all duration-300 ${
        conv.isDeleted
          ? 'bg-red-50/50 border border-red-200 opacity-80'
          : isActive 
            ? `bg-gradient-to-r ${typeConfig.bgGradient} border ${typeConfig.borderColor} shadow-lg transform scale-[1.02]` 
            : 'hover:bg-white/60 border border-transparent hover:border-gray-200/50 hover:shadow-md backdrop-blur-sm'
      }`}
      onClick={onSelect}
    >
      <div className="flex items-center space-x-2">
        {/* Avatar/Icon - Smaller size for better space utilization */}
        <div className="relative flex-shrink-0">
          {conv?.avatar ? (
            <img 
              src={conv.avatar} 
              alt={displayName} 
              className={`h-10 w-10 md:h-12 md:w-12 rounded-full object-cover shadow-md ring-1 ring-white/50 ${conv.isDeleted ? 'grayscale' : ''}`} 
            />
          ) : (
            <div className={`h-10 w-10 md:h-12 md:w-12 rounded-full flex items-center justify-center text-white font-medium text-sm shadow-md ${
              conv.isDeleted 
                ? 'bg-gray-400' 
                : `bg-gradient-to-br ${typeConfig.gradient}`
            }`}>
              {conv.type === 'dm' ? initials : <typeConfig.icon className="h-4 w-4 md:h-5 md:w-5" />}
            </div>
          )}
          
          {/* Online status indicator for DMs */}
          {conv.type === 'dm' && otherUser && onlineUsers.has && onlineUsers.has(otherUser._id) && (
            <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 border-2 border-white shadow-sm" />
          )}
          
          {/* Type indicator for groups/communities */}
          {conv.type !== 'dm' && (
            <div className={`absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-gradient-to-br ${typeConfig.gradient} flex items-center justify-center border-2 border-white shadow-sm`}>
              <typeConfig.icon className="h-2 w-2 text-white" />
            </div>
          )}

          {/* Unread indicator - Modern minimalist */}
          {conv?.unread > 0 && (
            <span className="absolute -top-1 -left-1 h-4 w-4 rounded-full bg-blue-500 border-2 border-white shadow-sm z-10 flex items-center justify-center">
              {conv.unread > 9 && (
                <span className="text-xs font-bold text-white">9+</span>
              )}
            </span>
          )}
        </div>

        {/* Content - More compact layout */}
        <div className="flex-1 min-w-0 flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <h3 className={`font-semibold truncate text-sm md:text-base flex items-center ${
              conv.isDeleted 
                ? 'text-gray-500 line-through' 
                : isActive 
                  ? 'text-gray-900' 
                  : 'text-gray-800'
            }`}>
              {conv.isDeleted ? `${displayName} (Deleted)` : displayName}
              {/* Unread badge */}
              {conv?.unread > 0 && !conv.isDeleted && (
                <span className="ml-2 inline-flex items-center justify-center bg-blue-500 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] px-1 shadow-sm">
                  {conv.unread > 99 ? '99+' : conv.unread}
                </span>
              )}
              {/* Deleted indicator */}
              {conv.isDeleted && (
                <span className="ml-2 inline-flex items-center justify-center bg-red-400 text-white text-xs font-medium rounded-full px-2 py-0.5 shadow-sm">
                  Deleted
                </span>
              )}
            </h3>
            {/* Last message preview - Modern minimalist */}
            {conv?.lastMessage && (
              <div className="mt-1">
                <p className="text-xs md:text-sm text-gray-500 truncate">
                  {/* Sender name for groups */}
                  {conv.type !== 'dm' && conv.lastMessage.senderName && (
                    <span className="font-medium text-gray-600">{conv.lastMessage.senderName}: </span>
                  )}
                  {conv.lastMessage.text ? (
                    conv.lastMessage.text.length > 35 ? 
                      conv.lastMessage.text.substring(0, 35) + '...' : 
                      conv.lastMessage.text
                  ) : conv.lastMessage.file ? (
                    <span className="italic flex items-center">
                      <span className="mr-1">📎</span>
                      {conv.lastMessage.file.name || 'File'}
                    </span>
                  ) : (
                    <span className="italic">No messages yet</span>
                  )}
                </p>
                {conv.lastMessageAt && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(conv.lastMessageAt).toLocaleDateString() === new Date().toLocaleDateString() 
                      ? new Date(conv.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : new Date(conv.lastMessageAt).toLocaleDateString([], { month: 'short', day: 'numeric' })
                    }
                  </p>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center space-x-0.5 ml-1">
            {/* Star button - Smaller */}
            <button 
              onClick={e => { e.stopPropagation(); onStar(); }} 
              className={`p-0.5 md:p-1 rounded-full transition-all duration-200 ${
                starred 
                  ? 'text-yellow-500 bg-yellow-50 hover:bg-yellow-100' 
                  : 'text-gray-400 hover:text-yellow-500 hover:bg-yellow-50'
              }`}
            >
              <Star fill={starred ? 'currentColor' : 'none'} className="h-3 w-3 md:h-3.5 md:w-3.5" />
            </button>
            {/* Delete/Dismiss button - Different behavior for deleted conversations */}
            {(canDelete || conv.isDeleted) && (
              <button 
                onClick={e => { 
                  e.stopPropagation(); 
                  if (conv.isDeleted) {
                    // For deleted conversations, dismiss immediately
                    onDismissDeleted && onDismissDeleted();
                  } else {
                    // For active conversations, show confirmation
                    setShowDeleteConfirm(true);
                  }
                }} 
                className={`p-0.5 md:p-1 rounded-full transition-all duration-200 md:opacity-0 md:group-hover:opacity-100 opacity-70 active:scale-95 hover:scale-110 ${
                  conv.isDeleted 
                    ? 'text-orange-500 hover:text-orange-600 hover:bg-orange-50 active:bg-orange-100' 
                    : 'text-gray-400 hover:text-red-500 hover:bg-red-50 active:bg-red-100'
                }`}
                title={conv.isDeleted ? "Dismiss deleted conversation" : "Delete conversation"}
              >
                <Trash2 className="h-3 w-3 md:h-3.5 md:w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Active indicator - Thinner */}
      {isActive && (
        <div className={`absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b ${typeConfig.gradient} rounded-r-full`}></div>
      )}

      {/* Enhanced delete confirmation modal with fixed UI */}
      {showDeleteConfirm && (
        <>
          {/* Backdrop - Higher z-index */}
          <div 
            className="fixed inset-0 z-[99999] bg-black/60 backdrop-blur-sm transition-opacity duration-300"
            onClick={() => setShowDeleteConfirm(false)}
          />
          {/* Modal - Highest z-index */}
          <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 pointer-events-none">
            <div 
              className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4 pointer-events-auto transform transition-all duration-300 scale-100 opacity-100 border border-gray-200"
              style={{
                animation: 'modalSlideIn 0.3s ease-out',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
              }}
            >
              <div className="flex flex-col items-center text-center">
                {/* Icon */}
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                  <Trash2 className="h-8 w-8 text-red-500" />
                </div>
                
                {/* Title */}
                <h3 className="text-lg font-bold mb-2 text-gray-900">
                  Delete Conversation?
                </h3>
                
                {/* Description */}
                <p className="text-sm text-gray-600 mb-6 leading-relaxed">
                  Are you sure you want to delete{' '}
                  <span className="font-semibold text-gray-800">
                    {displayName}
                  </span>
                  ? This action cannot be undone and all messages will be permanently lost.
                </p>
                
                {/* Buttons */}
                <div className="flex gap-3 w-full">
                  <button
                    className="flex-1 px-4 py-2.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 active:bg-gray-300 font-medium transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-gray-300"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowDeleteConfirm(false);
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    className="flex-1 px-4 py-2.5 rounded-lg bg-red-500 text-white font-semibold hover:bg-red-600 active:bg-red-700 shadow-lg hover:shadow-xl transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-red-300"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowDeleteConfirm(false); 
                      onDelete(); 
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
          
          {/* CSS for modal animation */}
          <style jsx>{`
            @keyframes modalSlideIn {
              from {
                opacity: 0;
                transform: scale(0.9) translateY(-10px);
              }
              to {
                opacity: 1;
                transform: scale(1) translateY(0);
              }
            }
          `}</style>
        </>
      )}
    </div>
  );
} 