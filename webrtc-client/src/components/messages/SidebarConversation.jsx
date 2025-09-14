import React, { useState } from 'react';
import { Star, MessageCircle, Users, Hash, Pin, VolumeX, Edit3, Check, CheckCheck, Bot, Sparkles } from 'lucide-react';
import { useChatSocket } from '../../context/ChatSocketContext';
import { isAvatarConversation } from '../../api/messageService';

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
  starred,
  getInitials,
  currentUserId,
  onPin,
  onMute,
  typing = {},
  draftMessage,
}) {
  const { onlineUsers } = useChatSocket();
  
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
  
  // Helper functions for modern messaging features
  const getMessageStatusIcon = () => {
    if (!conv.lastMessage || conv.lastMessage.senderId !== currentUserId) return null;
    
    const status = conv.lastMessage.status || 'sent';
    switch (status) {
      case 'sending':
        return <div className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin" />;
      case 'sent':
        return <Check className="w-3 h-3 text-gray-400" />;
      case 'delivered':
        return <CheckCheck className="w-3 h-3 text-gray-400" />;
      case 'read':
        return <CheckCheck className="w-3 h-3 text-blue-500" />;
      default:
        return null;
    }
  };

  const getTypingIndicator = () => {
    const typingUsers = Object.entries(typing)
      .filter(([userId, isTyping]) => isTyping && userId !== currentUserId)
      .map(([userId]) => {
        // Get user name from conversation members
        const user = conv.members?.find(m => m._id === userId);
        return user?.fullName || user?.username || 'Someone';
      });

    if (typingUsers.length === 0) return null;
    
    const displayText = typingUsers.length === 1 
      ? `${typingUsers[0]} is typing...`
      : typingUsers.length === 2
      ? `${typingUsers[0]} and ${typingUsers[1]} are typing...`
      : `${typingUsers[0]} and ${typingUsers.length - 1} others are typing...`;

    return (
      <div className="flex items-center text-xs text-blue-600">
        <div className="flex space-x-1 mr-2">
          <div className="w-1 h-1 bg-blue-600 rounded-full animate-bounce"></div>
          <div className="w-1 h-1 bg-blue-600 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
          <div className="w-1 h-1 bg-blue-600 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
        </div>
        <span className="font-medium">{displayText}</span>
      </div>
    );
  };

  const getLastActiveTime = () => {
    if (!conv.lastMessageAt) return null;
    
    const date = new Date(conv.lastMessageAt);
    const now = new Date();
    const diffInMs = now - date;
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffInDays = Math.floor(diffInHours / 24);

    if (diffInMinutes < 1) return 'now';
    if (diffInMinutes < 60) return `${diffInMinutes}m`;
    if (diffInHours < 24) return `${diffInHours}h`;
    if (diffInDays < 7) return `${diffInDays}d`;
    
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  // Special rendering for avatar conversations
  const isAvatar = isAvatarConversation(conv);
  
  if (isAvatar) {
    return (
      <div
        className={`group relative mx-1 md:mx-2 mb-1 p-2 md:p-3 rounded-xl cursor-pointer transition-all duration-300 border-2 ${
          isActive 
            ? 'bg-gradient-to-r from-blue-50 to-purple-50 border-blue-300 shadow-lg transform scale-[1.02]' 
            : 'bg-gradient-to-r from-blue-100/30 to-purple-100/30 border-blue-200 hover:border-blue-300 hover:shadow-md'
        }`}
        onClick={onSelect}
      >
        <div className="flex items-center space-x-2">
          {/* Avatar Icon */}
          <div className="relative flex-shrink-0">
            <div className="h-10 w-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center shadow-lg ring-2 ring-blue-100">
              <Bot className="h-5 w-5 text-white" />
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-green-500 rounded-full border-2 border-white shadow-sm">
              <Sparkles className="w-2 h-2 text-white m-0.5" />
            </div>
          </div>

          {/* Conversation Details */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-bold text-gray-900 text-sm flex items-center space-x-1">
                <span>Avatar</span>
                <span className="px-1.5 py-0.5 text-xs font-medium bg-gradient-to-r from-blue-100 to-purple-100 text-blue-700 rounded-full">
                  AI
                </span>
              </h3>
              <div className="flex items-center space-x-1 text-xs text-gray-500">
                <span>Always available</span>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <p className="text-xs text-blue-600 font-medium truncate">
                Ask me anything about 360!
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`group relative mx-1 md:mx-2 mb-1 p-2 md:p-3 rounded-xl cursor-pointer transition-all duration-300 ${
        conv.isDeleted
          ? 'bg-red-50 bg-opacity-50 border border-red-200 opacity-80'
          : isActive 
            ? `bg-gradient-to-r ${typeConfig.bgGradient} border ${typeConfig.borderColor} shadow-lg transform scale-[1.02]` 
            : 'hover:bg-white hover:bg-opacity-60 border border-transparent hover:border-gray-200 hover:border-opacity-50 hover:shadow-md backdrop-blur-sm'
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
              className={`h-9 w-9 md:h-10 md:w-10 rounded-full object-cover shadow-md ring-1 ring-white ring-opacity-50 ${conv.isDeleted ? 'grayscale' : ''}`} 
            />
          ) : (
            <div className={`h-9 w-9 md:h-10 md:w-10 rounded-full flex items-center justify-center text-white font-medium text-xs shadow-md ${
              conv.isDeleted 
                ? 'bg-gray-400' 
                : `bg-gradient-to-br ${typeConfig.gradient}`
            }`}>
              {conv.type === 'dm' ? initials : <typeConfig.icon className="h-3 w-3 md:h-4 md:w-4" />}
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
            <div className="flex items-center justify-between">
              <h3 className={`font-medium truncate text-xs md:text-sm flex items-center ${
                conv.isDeleted 
                  ? 'text-gray-500 line-through' 
                  : isActive 
                    ? 'text-gray-900' 
                    : 'text-gray-800'
              }`}>
                {conv.isDeleted ? `${displayName} (Deleted)` : displayName}
                
                {/* Status indicators */}
                <div className="flex items-center ml-1.5 space-x-1">
                  {/* Pinned indicator */}
                  {conv.isPinned && (
                    <Pin className="w-3 h-3 text-blue-500" />
                  )}
                  {/* Muted indicator */}
                  {conv.isMuted && (
                    <VolumeX className="w-3 h-3 text-gray-400" />
                  )}
                  {/* Unread badge */}
                  {conv?.unread > 0 && !conv.isDeleted && (
                    <span className="inline-flex items-center justify-center bg-blue-500 text-white text-xs font-bold rounded-full min-w-[16px] h-[16px] px-1 shadow-sm">
                      {conv.unread > 99 ? '99+' : conv.unread}
                    </span>
                  )}
                  {/* Deleted indicator */}
                  {conv.isDeleted && (
                    <span className="inline-flex items-center justify-center bg-red-400 text-white text-xs font-medium rounded-full px-1.5 py-0.5 shadow-sm">
                      Deleted
                    </span>
                  )}
                </div>
              </h3>
              
              {/* Time and message status */}
              <div className="flex items-center space-x-1 ml-2">
                {getMessageStatusIcon()}
                <span className="text-xs text-gray-400">{getLastActiveTime()}</span>
              </div>
            </div>
            {/* Status indicators: typing, draft, or last message */}
            <div className="mt-0.5">
              {getTypingIndicator() || (
                draftMessage ? (
                  <p className="text-xs text-red-600 truncate flex items-center">
                    <Edit3 className="w-3 h-3 mr-1" />
                    <span className="font-medium">Draft:</span>
                    <span className="ml-1">{draftMessage.length > 35 ? draftMessage.substring(0, 35) + '...' : draftMessage}</span>
                  </p>
                ) : conv?.lastMessage ? (
                  <p className="text-xs text-gray-500 truncate">
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
                ) : (
                  <p className="text-xs text-gray-500 italic">No messages yet</p>
                )
              )}
            </div>
          </div>
          <div className="flex items-center space-x-0.5 ml-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {/* Pin button */}
            <button 
              onClick={e => { 
                e.stopPropagation(); 
                if (onPin) onPin(); 
              }} 
              className={`p-1 rounded-full transition-all duration-200 ${
                conv.isPinned 
                  ? 'text-blue-500 bg-blue-50 hover:bg-blue-100' 
                  : 'text-gray-400 hover:text-blue-500 hover:bg-blue-50'
              }`}
              title={conv.isPinned ? 'Unpin conversation' : 'Pin conversation'}
            >
              <Pin className="h-3 w-3" />
            </button>
            
            {/* Mute button */}
            <button 
              onClick={e => { 
                e.stopPropagation(); 
                if (onMute) onMute(); 
              }} 
              className={`p-1 rounded-full transition-all duration-200 ${
                conv.isMuted 
                  ? 'text-gray-600 bg-gray-100 hover:bg-gray-200' 
                  : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
              }`}
              title={conv.isMuted ? 'Unmute conversation' : 'Mute conversation'}
            >
              <VolumeX className="h-3 w-3" />
            </button>
            
            {/* Star button */}
            <button 
              onClick={e => { e.stopPropagation(); onStar(); }} 
              className={`p-1 rounded-full transition-all duration-200 ${
                starred 
                  ? 'text-yellow-500 bg-yellow-50 hover:bg-yellow-100' 
                  : 'text-gray-400 hover:text-yellow-500 hover:bg-yellow-50'
              }`}
              title={starred ? 'Unstar conversation' : 'Star conversation'}
            >
              <Star fill={starred ? 'currentColor' : 'none'} className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Active indicator - Thinner */}
      {isActive && (
        <div className={`absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b ${typeConfig.gradient} rounded-r-full`}></div>
      )}

    </div>
  );
} 