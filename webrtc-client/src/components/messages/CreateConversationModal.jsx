import React, { useState, useEffect } from 'react';
import { Search, User, Users, Hash, X, Plus, MessageCircle, Shield, Globe, Check } from 'lucide-react';
import API from '../../api/client';

function getInitials(name) {
  if (!name || typeof name !== 'string') {
    return 'U';
  }
  return name.split(' ').map(n => n[0]).join('').toUpperCase();
}

export default function CreateConversationModal({ isOpen, onClose, onConversationCreated, currentUserId }) {
  const [conversationType, setConversationType] = useState('dm');
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [communityName, setCommunityName] = useState('');
  const [communityDescription, setCommunityDescription] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetchUsers();
    }
  }, [isOpen]);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await API.get('/users');
      const allUsers = response.data.users || response.data || [];
      const otherUsers = allUsers.filter(user => user._id !== currentUserId);
      setUsers(otherUsers);
      setFilteredUsers(otherUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
      setError('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredUsers(users);
    } else {
      const filtered = users.filter(user => 
        user.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredUsers(filtered);
    }
  }, [searchTerm, users]);

  const handleUserToggle = (user) => {
    if (conversationType === 'dm') {
      handleCreateConversation([user._id]);
    } else if (conversationType === 'group') {
      setSelectedUsers(prev => {
        const isSelected = prev.find(u => u._id === user._id);
        if (isSelected) {
          return prev.filter(u => u._id !== user._id);
        } else {
          return [...prev, user];
        }
      });
    }
  };

  const handleCreateConversation = async (memberIds = selectedUsers.map(u => u._id)) => {
    if (conversationType === 'dm' && memberIds.length !== 1) {
      setError('Direct messages can only have one other member');
      return;
    }
    
    if (conversationType === 'group' && (!groupName.trim() || memberIds.length === 0)) {
      setError('Group name and at least one member are required');
      return;
    }
    
    if (conversationType === 'community' && !communityName.trim()) {
      setError('Community name is required');
      return;
    }

    try {
      const conversationData = {
        type: conversationType,
        memberIds: conversationType === 'community' ? [] : memberIds
      };

      if (conversationType === 'group') {
        conversationData.name = groupName.trim();
        conversationData.description = groupDescription.trim();
      } else if (conversationType === 'community') {
        conversationData.name = communityName.trim();
        conversationData.description = communityDescription.trim();
      }

      const response = await API.post('/conversations', conversationData);
      
      // Check if this is an existing DM being returned
      if (response.data.message && response.data.message.includes('already exists')) {
        // Existing DM found, just select it
        onConversationCreated(response.data.conversation);
        handleClose();
        return;
      }
      
      onConversationCreated(response.data.conversation);
      handleClose();
    } catch (error) {
      console.error('Error creating conversation:', error);
      setError(error.response?.data?.message || 'Failed to create conversation');
    }
  };

  const handleClose = () => {
    setConversationType('dm');
    setSearchTerm('');
    setError(null);
    setGroupName('');
    setGroupDescription('');
    setSelectedUsers([]);
    setCommunityName('');
    setCommunityDescription('');
    onClose();
  };

  const isUserSelected = (user) => {
    return selectedUsers.find(u => u._id === user._id);
  };

  const getTypeConfig = (type) => {
    const configs = {
      dm: {
        icon: MessageCircle,
        title: 'Direct Message',
        description: 'Start a private conversation',
        gradient: 'from-purple-500 to-pink-500',
        bgGradient: 'from-purple-50 to-pink-50',
        borderColor: 'border-purple-200'
      },
      group: {
        icon: Users,
        title: 'Group Chat',
        description: 'Create a private group',
        gradient: 'from-blue-500 to-cyan-500',
        bgGradient: 'from-blue-50 to-cyan-50',
        borderColor: 'border-blue-200'
      },
      community: {
        icon: Globe,
        title: 'Community',
        description: 'Create a public community',
        gradient: 'from-green-500 to-emerald-500',
        bgGradient: 'from-green-50 to-emerald-50',
        borderColor: 'border-green-200'
      }
    };
    return configs[type];
  };

  if (!isOpen) return null;

  const currentConfig = getTypeConfig(conversationType);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden mx-2">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">{currentConfig.title}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-gray-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
          </div>
        </div>

        {/* User List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading ? (
            <div className="flex items-center justify-center p-4">
              <span className="text-gray-500">Loading users...</span>
            </div>
          ) : error ? (
            <div className="p-4 text-center text-red-500">{error}</div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-4 text-center text-gray-500">No users found</div>
          ) : (
            <div className="space-y-2">
              {filteredUsers.map((user) => (
                <button
                  key={user._id}
                  onClick={() => handleUserToggle(user)}
                  className={`w-full flex items-center space-x-4 p-3 rounded-xl transition-all duration-200 text-left group text-sm ${
                    isUserSelected(user)
                      ? 'bg-gradient-to-r from-blue-50 to-cyan-50 border-2 border-blue-200 shadow-md'
                      : 'hover:bg-gray-50 border-2 border-transparent hover:border-gray-200'
                  }`}
                >
                  <div className="relative">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg">
                      {user.avatarUrl ? (
                        <img
                          src={user.avatarUrl}
                          alt={user.fullName || user.username}
                          className="h-10 w-10 rounded-full object-cover"
                        />
                      ) : (
                        <span className="text-white font-bold text-base">
                          {getInitials(user.fullName || user.username)}
                        </span>
                      )}
                    </div>
                    {isUserSelected(user) && (
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center border-2 border-white">
                        <Check className="h-3 w-3 text-white" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate">
                      {user.fullName || user.username}
                    </p>
                    {user.fullName && (
                      <p className="text-xs text-gray-500 truncate">@{user.username}</p>
                    )}
                  </div>
                  {conversationType === 'group' && !isUserSelected(user) && (
                    <div className="p-2 rounded-full bg-gray-100 group-hover:bg-blue-100 transition-colors">
                      <Plus className="h-4 w-4 text-gray-500 group-hover:text-blue-600" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        {conversationType === 'group' && selectedUsers.length > 0 && (
          <div className="p-4 border-t border-gray-100">
            <button
              onClick={() => handleCreateConversation()}
              disabled={!groupName.trim()}
              className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 text-white px-6 py-3 rounded-xl font-semibold hover:from-blue-600 hover:to-cyan-600 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02] text-base"
            >
              Create Group
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
