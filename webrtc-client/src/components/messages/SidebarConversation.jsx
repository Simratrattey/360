import React, { useState } from 'react';
import { Star, Trash2, MessageCircle, Users, Hash } from 'lucide-react';
import { useChatSocket } from '../../context/ChatSocketContext';

function getConversationDisplayName(conversation, currentUserId) {
  console.log('SidebarConversation getConversationDisplayName called with:', { conversation, currentUserId });
  
  try {
    if (!conversation) {
      console.log('No conversation provided, returning Unknown');
      return 'Unknown';
    }
    
    // If conversation has a name (group/community), use it
    if (conversation.name) {
      console.log('Using conversation name:', conversation.name);
      return String(conversation.name);
    }
    
    // For DMs, show the other person's name
    if (conversation.type === 'dm' && conversation.members) {
      console.log('Looking for other member in DM, members:', conversation.members);
      console.log('Current user ID:', currentUserId);
      
      const otherMember = conversation.members.find(m => {
        console.log('Checking member:', m);
        console.log('Member _id:', m?._id);
        console.log('Current user ID:', currentUserId);
        console.log('Match result:', m?._id !== currentUserId);
        return m?._id !== currentUserId;
      });
      
      console.log('Other member found:', otherMember);
      console.log('Other member type:', typeof otherMember);
      
      if (otherMember && typeof otherMember === 'object') {
        console.log('Processing other member object');
        
        // Ensure we're working with a user object and extract string values
        const fullName = otherMember.fullName;
        const username = otherMember.username;
        const email = otherMember.email;
        
        console.log('Member properties:', { fullName, username, email });
        
        const displayName = fullName || username || email || 'Unknown User';
        console.log('Final display name:', displayName, 'type:', typeof displayName);
        
        // Ensure we return a string
        const result = String(displayName);
        console.log('Returning result:', result);
        return result;
      } else {
        console.log('No valid other member found, using fallback');
        return 'Unknown User';
      }
    }
    
    // Fallback
    console.log('Using fallback name: Unknown Conversation');
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
    if (conv.type === 'dm' && conv.members) {
      return conv.members.find(member => member._id !== currentUserId);
    }
    return null;
  };

  const otherUser = getOtherUser();
  const isOnline = otherUser && onlineUsers.has(otherUser._id);

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
      className={`group relative mx-3 mb-2 p-4 rounded-xl cursor-pointer transition-all duration-300 ${
        isActive 
          ? `bg-gradient-to-r ${typeConfig.bgGradient} border-2 ${typeConfig.borderColor} shadow-lg transform scale-[1.02] dark:bg-secondary-800/80 dark:border-gray-800` 
          : 'hover:bg-gray-50 border-2 border-transparent hover:border-gray-200 hover:shadow-md dark:hover:bg-secondary-800/60 dark:hover:border-gray-800'
      }`}
      onClick={onSelect}
    >
      <div className="flex items-center space-x-3">
        {/* Avatar/Icon */}
        <div className="relative">
          {conv?.avatar ? (
            <img src={conv.avatar} alt={displayName} className="h-12 w-12 rounded-full object-cover shadow-md" />
          ) : (
            <div className={`h-12 w-12 rounded-full bg-gradient-to-r ${typeConfig.gradient} flex items-center justify-center text-white font-bold text-lg shadow-lg`}>
              {conv.type === 'dm' ? initials : <typeConfig.icon className="h-6 w-6" />}
            </div>
          )}
          
          {/* Online status indicator */}
          {(conv?.status === 'online' || (conv.type === 'dm' && isOnline)) && (
            <span className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-3 border-white bg-green-500 shadow-md"></span>
          )}
          
          {/* Type indicator for groups/communities */}
          {conv.type !== 'dm' && (
            <div className={`absolute -top-1 -right-1 h-5 w-5 rounded-full bg-gradient-to-r ${typeConfig.gradient} flex items-center justify-center border-2 border-white shadow-md`}>
              <typeConfig.icon className="h-3 w-3 text-white" />
            </div>
          )}

          {/* Blue dot for unread messages */}
          {conv?.unread > 0 && (
            <span className="absolute -top-1 -left-1 h-3 w-3 rounded-full bg-blue-500 border-2 border-white shadow-md z-10"></span>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h3 className={`font-semibold truncate ${isActive ? 'text-gray-900' : 'text-gray-800'}`}>
              {displayName}
            </h3>
            <div className="flex items-center space-x-1">
              {/* Star button */}
              <button 
                onClick={e => { e.stopPropagation(); onStar(); }} 
                className={`p-1.5 rounded-full transition-all duration-200 ${
                  starred 
                    ? 'text-yellow-500 bg-yellow-50 hover:bg-yellow-100' 
                    : 'text-gray-400 hover:text-yellow-500 hover:bg-yellow-50'
                }`}
              >
                <Star fill={starred ? 'currentColor' : 'none'} className="h-4 w-4" />
              </button>
              
              {/* Delete button */}
              {canDelete && (
                <button 
                  onClick={e => { e.stopPropagation(); setShowDeleteConfirm(true); }} 
                  className="p-1.5 rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all duration-200 opacity-0 group-hover:opacity-100"
                  title="Delete conversation"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
          
          {/* Subtitle */}
          <div className="flex items-center justify-between mt-1">
            <p className="text-sm text-gray-500 truncate">
              {conv.type === 'dm' ? (isOnline ? 'Online' : 'Offline') : 
               conv.type === 'group' ? `${conv.members?.length || 0} members` :
               `${conv.members?.length || 0} members`}
            </p>
            
            {/* Unread count */}
            {conv?.unread > 0 && (
              <span className="bg-gradient-to-r from-red-500 to-pink-500 text-white text-xs font-bold rounded-full px-2 py-1 min-w-[20px] text-center shadow-md">
                {conv.unread > 99 ? '99+' : conv.unread}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Active indicator */}
      {isActive && (
        <div className={`absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b ${typeConfig.gradient} rounded-r-full`}></div>
      )}

      {/* Delete confirmation dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-xs w-full flex flex-col items-center">
            <Trash2 className="h-8 w-8 text-red-500 mb-2" />
            <h3 className="text-lg font-bold mb-2 text-gray-900">Delete Conversation?</h3>
            <p className="text-gray-600 mb-4 text-center">Are you sure you want to delete this conversation? This action cannot be undone.</p>
            <div className="flex gap-4 w-full">
              <button
                className="flex-1 px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 font-medium"
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </button>
              <button
                className="flex-1 px-4 py-2 rounded-lg bg-gradient-to-r from-red-500 to-pink-500 text-white font-semibold hover:from-red-600 hover:to-pink-600 shadow"
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