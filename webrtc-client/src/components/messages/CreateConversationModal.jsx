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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-full sm:max-w-md max-h-[95vh] sm:max-h-[90vh] flex flex-col h-full relative overflow-hidden">
        {/* Header */}
        <div className={`relative p-3 sm:p-6 bg-gradient-to-r ${currentConfig.bgGradient} border-b ${currentConfig.borderColor}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className={`p-2 rounded-xl bg-gradient-to-r ${currentConfig.gradient} text-white shadow-lg`}>
                <currentConfig.icon className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">New Conversation</h2>
                <p className="text-sm text-gray-600">{currentConfig.description}</p>
              </div>
            </div>
            <button 
              onClick={handleClose} 
              className="p-2 rounded-full hover:bg-white/50 transition-all duration-200 text-gray-500 hover:text-gray-700"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Type Selector */}
        <div className="p-3 sm:p-6 border-b border-gray-100">
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {['dm', 'group', 'community'].map((type) => {
              const config = getTypeConfig(type);
              const isActive = conversationType === type;
              return (
                <button
                  key={type}
                  onClick={() => setConversationType(type)}
                  className={`relative p-4 rounded-xl border-2 transition-all duration-300 ${
                    isActive 
                      ? `border-transparent bg-gradient-to-r ${config.gradient} text-white shadow-lg transform scale-105` 
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:shadow-md'
                  }`}
                >
                  <div className="flex flex-col items-center space-y-2">
                    <config.icon className={`h-5 w-5 ${isActive ? 'text-white' : 'text-gray-500'}`} />
                    <span className="text-xs font-medium">{config.title}</span>
                  </div>
                  {isActive && (
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-white rounded-full flex items-center justify-center">
                      <Check className="h-2 w-2 text-gray-900" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Form Fields */}
        {(conversationType === 'group' || conversationType === 'community') && (
          <div className="p-3 sm:p-6 border-b border-gray-100">
            <div className="max-h-40 sm:max-h-56 overflow-y-auto scrollbar-thin space-y-3 sm:space-y-4">
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">
                  {conversationType === 'group' ? 'Group Name' : 'Community Name'}
                </label>
                <input
                  type="text"
                  placeholder={conversationType === 'group' ? 'Enter group name...' : 'Enter community name...'}
                  value={conversationType === 'group' ? groupName : communityName}
                  onChange={(e) => conversationType === 'group' ? setGroupName(e.target.value) : setCommunityName(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white"
                />
              </div>
              {conversationType === 'community' && (
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">
                    Description <span className="text-gray-400 font-normal">(Optional)</span>
                  </label>
                  <textarea
                    placeholder="Enter community description..."
                    value={communityDescription}
                    onChange={(e) => setCommunityDescription(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none transition-all duration-200 bg-gray-50 focus:bg-white"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex-1 min-h-0 flex flex-col">
          {/* Selected Users for Group */}

          {/* Community Info */}
          {conversationType === 'community' && (
            <div className="p-3 sm:p-6 border-b border-gray-100">
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4">
                <div className="flex items-start space-x-3">
                  <div className="p-2 rounded-lg bg-gradient-to-r from-green-500 to-emerald-500 text-white">
                    <Globe className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-green-800">Public Community</p>
                    <p className="text-xs text-green-600 mt-1">
                      All users in the system will automatically be added to this community.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="p-3 sm:p-6 border-b border-gray-100">
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <p className="text-red-600 text-sm font-medium">{error}</p>
              </div>
            </div>
          )}

          {/* User List with Sticky Search */}
          {conversationType !== 'community' && (
            <div className="relative flex-1 min-h-0 p-0">
              <div className="sticky top-0 z-10 bg-white p-3 sm:p-6 border-b border-gray-100">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder={conversationType === 'dm' ? 'Search users...' : 'Search users to add...'}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white"
                  />
                </div>
              </div>
              <div className="relative">
                <div className="border-t border-gray-200 shadow-sm"></div>
                <div className="overflow-y-auto overscroll-contain scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 scrollbar-thumb-rounded max-h-48 sm:max-h-72 space-y-2 p-3 sm:p-6 overflow-hidden">
                  {loading ? (
                    <div className="text-center py-12">
                      <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-500 border-t-transparent mx-auto"></div>
                      <p className="text-gray-500 mt-4 font-medium">Loading users...</p>
                    </div>
                  ) : filteredUsers.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="p-4 rounded-full bg-gray-100 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                        <User className="h-8 w-8 text-gray-400" />
                      </div>
                      <p className="text-gray-500 font-medium">
                        {searchTerm ? 'No users found matching your search' : 'No users available'}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {filteredUsers.map((user) => (
                        <button
                          key={user._id}
                          onClick={() => handleUserToggle(user)}
                          className={`w-full min-w-0 flex items-center space-x-4 p-3 sm:p-4 rounded-xl min-h-[44px] transition-all duration-200 text-left group ${
                            isUserSelected(user) 
                              ? 'bg-gradient-to-r from-blue-50 to-cyan-50 border-2 border-blue-200 shadow-md' 
                              : 'hover:bg-gray-50 border-2 border-transparent hover:border-gray-200'
                          }`}
                        >
                          <div className="relative">
                            <div className="h-12 w-12 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg">
                              {user.avatarUrl ? (
                                <img
                                  src={user.avatarUrl}
                                  alt={user.fullName || user.username}
                                  className="h-12 w-12 rounded-full object-cover"
                                />
                              ) : (
                                <span className="text-white font-bold text-lg">
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
                              <p className="text-sm text-gray-500 truncate">@{user.username}</p>
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
                {/* Fade effect at bottom */}
                <div className="pointer-events-none absolute bottom-0 left-0 w-full h-6 bg-gradient-to-t from-white to-transparent"></div>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        {conversationType === 'group' && selectedUsers.length > 0 && (
          <div className="p-3 sm:p-6 border-t border-gray-100">
            <button
              onClick={() => handleCreateConversation()}
              disabled={!groupName.trim()}
              className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 text-white px-6 py-3 rounded-xl font-semibold hover:from-blue-600 hover:to-cyan-600 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02]"
            >
              Create Group
            </button>
          </div>
        )}
        
        {conversationType === 'community' && (
          <div className="p-3 sm:p-6 border-t border-gray-100">
            <button
              onClick={() => handleCreateConversation([])}
              disabled={!communityName.trim()}
              className="w-full bg-gradient-to-r from-green-500 to-emerald-500 text-white px-6 py-3 rounded-xl font-semibold hover:from-green-600 hover:to-emerald-600 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02]"
            >
              Create Community
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
