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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-2xl flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white/95 backdrop-blur-2xl rounded-xl sm:rounded-2xl shadow-2xl border border-white/20 w-full max-w-sm sm:max-w-2xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto flex flex-col animate-in slide-in-from-bottom-4 duration-300">
        {/* Header */}
        <div className={`relative p-3 sm:p-6 bg-gradient-to-br from-blue-50/80 via-purple-50/80 to-pink-50/80 backdrop-blur-sm border-b border-white/30`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 sm:space-x-4">
              <div className={`p-1.5 sm:p-3 rounded-xl sm:rounded-2xl bg-gradient-to-br ${currentConfig.gradient} text-white shadow-xl`}>
                <currentConfig.icon className="h-5 w-5 sm:h-7 sm:w-7" />
              </div>
              <div>
                <h2 className="text-lg sm:text-2xl font-bold bg-gradient-to-r from-primary-800 to-secondary-700 bg-clip-text text-transparent">New Conversation</h2>
                <p className="text-xs sm:text-sm text-secondary-600 font-medium hidden sm:block">{currentConfig.description}</p>
              </div>
            </div>
            <button 
              onClick={handleClose} 
              className="p-2 sm:p-2.5 rounded-xl hover:bg-white/60 transition-all duration-200 text-secondary-500 hover:text-secondary-700 backdrop-blur-sm"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Type Selector */}
        <div className="p-4 sm:p-6 bg-gradient-to-br from-gray-50/60 via-white/80 to-blue-50/60 backdrop-blur-sm">
          <h3 className="text-lg font-bold text-primary-800 mb-4 text-center">Choose Conversation Type</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {['dm', 'group', 'community'].map((type) => {
              const config = getTypeConfig(type);
              const isActive = conversationType === type;
              return (
                <button
                  key={type}
                  onClick={() => setConversationType(type)}
                  className={`relative p-6 rounded-2xl border-2 transition-all duration-300 transform hover:scale-105 ${
                    isActive 
                      ? `border-transparent bg-gradient-to-br ${config.gradient} text-white shadow-2xl scale-105` 
                      : 'border-white/40 bg-white/60 backdrop-blur-sm text-secondary-700 hover:border-white/60 hover:shadow-xl'
                  }`}
                >
                  <div className="flex flex-col items-center space-y-3">
                    <div className={`p-3 rounded-xl ${isActive ? 'bg-white/20' : 'bg-gradient-to-br ' + config.gradient} transition-all duration-300`}>
                      <config.icon className={`h-6 w-6 ${isActive ? 'text-white' : 'text-white'}`} />
                    </div>
                    <div className="text-center">
                      <span className="text-sm font-bold block">{config.title}</span>
                      <span className={`text-xs ${isActive ? 'text-white/80' : 'text-secondary-500'} font-medium`}>
                        {config.description}
                      </span>
                    </div>
                  </div>
                  {isActive && (
                    <div className="absolute -top-2 -right-2 w-6 h-6 bg-white rounded-full flex items-center justify-center shadow-lg">
                      <Check className="h-3 w-3 text-green-600" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Form Fields */}
        {(conversationType === 'group' || conversationType === 'community') && (
          <div className="p-4 sm:p-6 bg-gradient-to-br from-cyan-50/60 via-white/80 to-blue-50/60 backdrop-blur-sm space-y-5">
            <div className="space-y-3">
              <label className="block text-base font-bold text-primary-800">
                {conversationType === 'group' ? 'Group Name' : 'Community Name'}
                <span className="text-red-500 ml-1">*</span>
              </label>
              <input
                type="text"
                placeholder={conversationType === 'group' ? 'Enter group name...' : 'Enter community name...'}
                value={conversationType === 'group' ? groupName : communityName}
                onChange={(e) => conversationType === 'group' ? setGroupName(e.target.value) : setCommunityName(e.target.value)}
                className="w-full px-5 py-4 border border-white/60 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-300 transition-all duration-200 bg-white/80 backdrop-blur-sm shadow-lg focus:shadow-xl text-primary-800 font-medium"
              />
            </div>
            <div className="space-y-3">
              <label className="block text-base font-bold text-primary-800">
                Description 
                <span className="text-secondary-500 font-medium ml-2">(Optional)</span>
              </label>
              <textarea
                placeholder={conversationType === 'group' ? 'Enter group description...' : 'Enter community description...'}
                value={conversationType === 'group' ? groupDescription : communityDescription}
                onChange={(e) => conversationType === 'group' ? setGroupDescription(e.target.value) : setCommunityDescription(e.target.value)}
                rows={3}
                className="w-full px-5 py-4 border border-white/60 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-300 resize-none transition-all duration-200 bg-white/80 backdrop-blur-sm shadow-lg focus:shadow-xl text-primary-800 font-medium"
              />
            </div>
          </div>
        )}

        {/* Selected Users for Group */}
        {conversationType === 'group' && selectedUsers.length > 0 && (
          <div className="p-4 sm:p-6 bg-gradient-to-br from-green-50/60 via-white/80 to-emerald-50/60 backdrop-blur-sm">
            <h3 className="text-base font-bold text-primary-800 mb-4 flex items-center space-x-2">
              <div className="p-1 rounded-lg bg-gradient-to-br from-green-500 to-emerald-500">
                <Users className="h-3 w-3 text-white" />
              </div>
              <span>Selected Members ({selectedUsers.length})</span>
            </h3>
            <div className="flex flex-wrap gap-3">
              {selectedUsers.map((user) => (
                <div key={user._id} className="flex items-center space-x-3 bg-white/60 backdrop-blur-sm px-4 py-3 rounded-2xl shadow-lg border border-white/40 min-w-max">
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center shadow-md">
                    <span className="text-xs font-bold text-white">
                      {getInitials(user.fullName || user.username)}
                    </span>
                  </div>
                  <span className="text-sm font-bold text-primary-800">{user.fullName || user.username}</span>
                  <button
                    onClick={() => setSelectedUsers(prev => prev.filter(u => u._id !== user._id))}
                    className="p-1 rounded-full bg-red-100 text-red-600 hover:bg-red-200 transition-all duration-200 hover:scale-110"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="p-4 sm:p-6">
            <div className="bg-gradient-to-r from-red-50/90 to-pink-50/90 backdrop-blur-sm border border-red-200/60 text-red-700 px-5 py-4 rounded-2xl shadow-lg flex items-center space-x-3 animate-in slide-in-from-top-2 duration-300">
              <div className="p-1 rounded-full bg-red-100">
                <X className="h-4 w-4 text-red-600" />
              </div>
              <span className="font-semibold">{error}</span>
            </div>
          </div>
        )}

        {/* User Search */}
        {conversationType !== 'community' && (
          <div className="p-4 sm:p-6 bg-gradient-to-br from-purple-50/60 via-white/80 to-pink-50/60 backdrop-blur-sm">
            <h3 className="text-base font-bold text-primary-800 mb-4 flex items-center space-x-2">
              <div className="p-1 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500">
                <Search className="h-3 w-3 text-white" />
              </div>
              <span>{conversationType === 'dm' ? 'Find User' : 'Search Members'}</span>
            </h3>
            <div className="relative">
              <Search className="absolute left-5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-secondary-400" />
              <input
                type="text"
                placeholder={conversationType === 'dm' ? 'Search users...' : 'Search users to add...'}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-14 pr-5 py-4 border border-white/60 rounded-2xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-300 transition-all duration-200 bg-white/80 backdrop-blur-sm shadow-lg focus:shadow-xl text-primary-800 font-medium"
              />
            </div>
          </div>
        )}

        {/* User List - Modal is scrollable, user list grows naturally */}
        {conversationType !== 'community' && (
          <div className="p-4 sm:p-6">
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mx-auto"></div>
                <p className="text-secondary-500 mt-6 font-bold">Loading users...</p>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-12">
                <div className="p-6 rounded-2xl bg-gradient-to-br from-gray-50 to-blue-50 w-20 h-20 mx-auto mb-6 flex items-center justify-center shadow-lg">
                  <User className="h-10 w-10 text-secondary-400" />
                </div>
                <p className="text-secondary-500 font-bold text-lg">
                  {searchTerm ? 'No users found matching your search' : 'No users available'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredUsers.map((user) => (
                  <button
                    key={user._id}
                    onClick={() => handleUserToggle(user)}
                    className={`w-full flex items-center space-x-4 p-5 rounded-2xl transition-all duration-200 text-left group transform hover:scale-[1.02] ${
                      isUserSelected(user) 
                        ? 'bg-gradient-to-r from-blue-50/90 to-cyan-50/90 backdrop-blur-sm border-2 border-blue-200/60 shadow-xl' 
                        : 'bg-white/60 backdrop-blur-sm border-2 border-white/40 hover:border-blue-200/60 hover:shadow-xl'
                    }`}
                  >
                    <div className="relative">
                      <div className="h-14 w-14 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-xl">
                        {user.avatarUrl ? (
                          <img
                            src={user.avatarUrl}
                            alt={user.fullName || user.username}
                            className="h-14 w-14 rounded-full object-cover"
                          />
                        ) : (
                          <span className="text-white font-bold text-xl">
                            {getInitials(user.fullName || user.username)}
                          </span>
                        )}
                      </div>
                      {isUserSelected(user) && (
                        <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center border-2 border-white shadow-lg">
                          <Check className="h-3 w-3 text-white" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-primary-800 truncate text-lg">
                        {user.fullName || user.username}
                      </p>
                      {user.fullName && (
                        <p className="text-sm text-secondary-500 truncate font-medium">@{user.username}</p>
                      )}
                      {user.email && (
                        <p className="text-xs text-secondary-400 truncate">{user.email}</p>
                      )}
                    </div>
                    {conversationType === 'group' && !isUserSelected(user) && (
                      <div className="p-3 rounded-xl bg-blue-100 group-hover:bg-blue-200 transition-all duration-200 shadow-md">
                        <Plus className="h-5 w-5 text-blue-600" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        {conversationType === 'group' && selectedUsers.length > 0 && (
          <div className="sticky bottom-0 left-0 right-0 bg-white/95 backdrop-blur-2xl border-t border-white/30 z-10 p-4 sm:p-6">
            <button
              onClick={() => handleCreateConversation()}
              disabled={!groupName.trim()}
              className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 text-white px-8 py-4 rounded-2xl font-bold hover:from-blue-600 hover:to-cyan-600 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all duration-200 shadow-2xl hover:shadow-3xl transform hover:scale-[1.02] text-lg"
            >
              Create Group
            </button>
          </div>
        )}
        {conversationType === 'community' && (
          <div className="sticky bottom-0 left-0 right-0 bg-white/95 backdrop-blur-2xl border-t border-white/30 z-10 p-4 sm:p-6">
            <button
              onClick={() => handleCreateConversation([])}
              disabled={!communityName.trim()}
              className="w-full bg-gradient-to-r from-green-500 to-emerald-500 text-white px-8 py-4 rounded-2xl font-bold hover:from-green-600 hover:to-emerald-600 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all duration-200 shadow-2xl hover:shadow-3xl transform hover:scale-[1.02] text-lg"
            >
              Create Community
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
