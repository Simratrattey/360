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
      className={`group relative mx-1 md:mx-2 mb-1 p-2 md:p-3 rounded-lg cursor-pointer transition-all duration-200 ${
        isActive 
          ? `bg-gradient-to-r ${typeConfig.bgGradient} border ${typeConfig.borderColor} shadow-md transform scale-[1.01]` 
          : 'hover:bg-gray-50 border border-transparent hover:border-gray-200 hover:shadow-sm'
      }`}
      onClick={onSelect}
    >
      <div className="flex items-center space-x-2">
        {/* Avatar/Icon - Smaller size for better space utilization */}
        <div className="relative flex-shrink-0">
          {conv?.avatar ? (
            <img src={conv.avatar} alt={displayName} className="h-8 w-8 md:h-10 md:w-10 rounded-full object-cover shadow-sm" />
          ) : (
            <div className={`h-8 w-8 md:h-10 md:w-10 rounded-full bg-gradient-to-r ${typeConfig.gradient} flex items-center justify-center text-white font-bold text-xs md:text-sm shadow-sm`}>
              {conv.type === 'dm' ? initials : <typeConfig.icon className="h-3 w-3 md:h-4 md:w-4" />}
            </div>
          )}
          
          {/* Type indicator for groups/communities - Smaller */}
          {conv.type !== 'dm' && (
            <div className={`absolute -top-0.5 -right-0.5 h-3 w-3 md:h-4 md:w-4 rounded-full bg-gradient-to-r ${typeConfig.gradient} flex items-center justify-center border border-white shadow-sm`}>
              <typeConfig.icon className="h-1.5 w-1.5 md:h-2 md:w-2 text-white" />
            </div>
          )}

          {/* Blue dot for unread messages - Smaller */}
          {conv?.unread > 0 && (
            <span className="absolute -top-0.5 -left-0.5 h-2 w-2 md:h-2.5 md:w-2.5 rounded-full bg-blue-500 border border-white shadow-sm z-10"></span>
          )}
        </div>

        {/* Content - More compact layout */}
        <div className="flex-1 min-w-0 flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <h3 className={`font-medium truncate text-sm ${isActive ? 'text-gray-900' : 'text-gray-800'} flex items-center`}>
              {displayName}
              {/* Notification badge - Smaller and more compact */}
              {conv?.unread > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center bg-red-500 text-white text-xs font-bold rounded-full w-4 h-4 md:w-5 md:h-5 shadow-sm border border-white">
                  {conv.unread > 99 ? '99+' : conv.unread}
                </span>
              )}
            </h3>
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
            {/* Delete button - Smaller */}
            {canDelete && (
              <button 
                onClick={e => { e.stopPropagation(); setShowDeleteConfirm(true); }} 
                className="p-0.5 md:p-1 rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all duration-200 opacity-0 group-hover:opacity-100"
                title="Delete conversation"
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

      {/* Delete confirmation dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 md:p-8 max-w-xs w-full flex flex-col items-center">
            <Trash2 className="h-6 w-6 md:h-8 md:w-8 text-red-500 mb-2" />
            <h3 className="text-base md:text-lg font-bold mb-2 text-gray-900 text-center">Delete Conversation?</h3>
            <p className="text-sm md:text-base text-gray-600 mb-4 text-center">Are you sure you want to delete this conversation? This action cannot be undone.</p>
            <div className="flex gap-3 md:gap-4 w-full">
              <button
                className="flex-1 px-3 md:px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 font-medium text-sm md:text-base"
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </button>
              <button
                className="flex-1 px-3 md:px-4 py-2 rounded-lg bg-gradient-to-r from-red-500 to-pink-500 text-white font-semibold hover:from-red-600 hover:to-pink-600 shadow text-sm md:text-base"
                onClick={() => { setShowDeleteConfirm(false); onDelete(); }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 