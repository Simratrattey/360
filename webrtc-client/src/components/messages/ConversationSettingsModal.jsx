import React, { useState, useEffect } from 'react';
import { X, Crown, UserPlus, UserMinus, Settings as SettingsIcon, Trash2, Users, Hash, MessageCircle, Check } from 'lucide-react';
import API from '../../api/client';

function getInitials(name) {
  if (!name || typeof name !== 'string') {
    return 'U';
  }
  return name.split(' ').map(n => n[0]).join('').toUpperCase();
}

const typeConfig = {
  dm: {
    icon: MessageCircle,
    gradient: 'from-purple-500 to-pink-500',
    bgGradient: 'from-purple-50 to-pink-50',
    borderColor: 'border-purple-200',
    title: 'Direct Message Settings',
  },
  group: {
    icon: Users,
    gradient: 'from-blue-500 to-cyan-500',
    bgGradient: 'from-blue-50 to-cyan-50',
    borderColor: 'border-blue-200',
    title: 'Group Settings',
  },
  community: {
    icon: Hash,
    gradient: 'from-green-500 to-emerald-500',
    bgGradient: 'from-green-50 to-emerald-50',
    borderColor: 'border-green-200',
    title: 'Community Settings',
  },
};

export default function ConversationSettingsModal({ 
  isOpen, 
  onClose, 
  conversation, 
  currentUserId,
  onConversationUpdated,
  onConversationDeleted 
}) {
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [groupName, setGroupName] = useState('');
  const [communityName, setCommunityName] = useState('');

  const isOwner = conversation?.createdBy === currentUserId;
  const isAdmin = conversation?.admins?.includes(currentUserId);
  const config = typeConfig[conversation?.type] || typeConfig.dm;

  useEffect(() => {
    if (isOpen && conversation) {
      setGroupName(conversation.name || '');
      setCommunityName(conversation.name || '');
      fetchUsers();
    }
  }, [isOpen, conversation]);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await API.get('/users');
      const allUsers = response.data.users || response.data || [];
      // Filter out current user and existing members
      const existingMemberIds = conversation?.members?.map(m => m._id || m) || [];
      const availableUsers = allUsers.filter(user => 
        user._id !== currentUserId && !existingMemberIds.includes(user._id)
      );
      setUsers(availableUsers);
      setFilteredUsers(availableUsers);
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

  const handleAddMember = async (userId) => {
    try {
      await API.post(`/conversations/${conversation._id}/members`, { userId });
      setSuccess('Member added successfully');
      onConversationUpdated();
      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to add member');
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleRemoveMember = async (userId) => {
    try {
      await API.delete(`/conversations/${conversation._id}/members/${userId}`);
      setSuccess('Member removed successfully');
      onConversationUpdated();
      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to remove member');
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleToggleAdmin = async (userId) => {
    try {
      const isCurrentlyAdmin = conversation.admins?.includes(userId);
      if (isCurrentlyAdmin) {
        await API.delete(`/conversations/${conversation._id}/admins/${userId}`);
        setSuccess('Admin removed successfully');
      } else {
        await API.post(`/conversations/${conversation._id}/admins`, { userId });
        setSuccess('Admin added successfully');
      }
      onConversationUpdated();
      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to update admin status');
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleUpdateName = async () => {
    try {
      const newName = conversation.type === 'group' ? groupName : communityName;
      if (!newName.trim()) {
        setError('Name is required');
        return;
      }
      
      await API.put(`/conversations/${conversation._id}`, { name: newName.trim() });
      setSuccess('Name updated successfully');
      onConversationUpdated();
      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to update name');
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleDeleteConversation = async () => {
    if (!window.confirm('Are you sure you want to delete this conversation? This action cannot be undone.')) {
      return;
    }

    try {
      await API.delete(`/conversations/${conversation._id}`);
      setSuccess('Conversation deleted successfully');
      onConversationDeleted();
      setTimeout(() => onClose(), 1000);
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to delete conversation');
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleClose = () => {
    setSearchTerm('');
    setError(null);
    setSuccess(null);
    setGroupName('');
    setCommunityName('');
    onClose();
  };

  if (!isOpen || !conversation) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4">
      <div className={`bg-white rounded-xl sm:rounded-2xl shadow-2xl w-full max-w-sm sm:max-w-md max-h-[95vh] sm:max-h-[90vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-300`}>
        {/* Header */}
        <div className={`relative p-3 sm:p-6 bg-gradient-to-r ${config.bgGradient} border-b ${config.borderColor}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 sm:space-x-3">
              <div className={`p-1.5 sm:p-2 rounded-xl bg-gradient-to-r ${config.gradient} text-white shadow-lg`}>
                <SettingsIcon className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-gray-900">{config.title}</h2>
                <p className="text-xs sm:text-sm text-gray-600 hidden sm:block">Manage members, admins, and settings</p>
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

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {/* Error/Success Messages */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl shadow">
              {error}
            </div>
          )}
          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl shadow">
              {success}
            </div>
          )}

          {/* Conversation Info */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Conversation Info</h3>
            <div className="bg-gradient-to-r from-gray-50 to-blue-50 p-4 rounded-xl shadow border border-gray-100">
              <p className="text-sm text-gray-600">
                <span className="font-medium">Type:</span> {conversation.type.charAt(0).toUpperCase() + conversation.type.slice(1)}
              </p>
              <p className="text-sm text-gray-600">
                <span className="font-medium">Members:</span> {conversation.members?.length || 0}
              </p>
              {conversation.createdAt && (
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Created:</span> {new Date(conversation.createdAt).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>

          {/* Name Update (for Groups and Communities) */}
          {(conversation.type === 'group' || conversation.type === 'community') && isAdmin && (
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">
                {conversation.type === 'group' ? 'Group Name' : 'Community Name'}
              </h3>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={conversation.type === 'group' ? groupName : communityName}
                  onChange={(e) => conversation.type === 'group' ? setGroupName(e.target.value) : setCommunityName(e.target.value)}
                  className="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white shadow"
                />
                <button
                  onClick={handleUpdateName}
                  className="px-5 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl font-semibold hover:from-blue-600 hover:to-cyan-600 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02]"
                >
                  Update
                </button>
              </div>
            </div>
          )}

          {/* Add Members (for Groups) */}
          {conversation.type === 'group' && isAdmin && (
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Add Members</h3>
              <div className="relative mb-2">
                <input
                  type="text"
                  placeholder="Search users..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white shadow"
                />
              </div>
              <div className="max-h-32 overflow-y-auto space-y-2">
                {filteredUsers.map((user) => (
                  <div key={user._id} className="flex items-center justify-between p-3 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl shadow border border-blue-100">
                    <div className="flex items-center space-x-3">
                      <div className="h-8 w-8 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center shadow">
                        <span className="text-white font-bold text-sm">
                          {getInitials(user.fullName || user.username)}
                        </span>
                      </div>
                      <span className="text-sm text-gray-900 font-semibold">{user.fullName || user.username}</span>
                    </div>
                    <button
                      onClick={() => handleAddMember(user._id)}
                      className="px-3 py-2 text-xs bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl font-semibold hover:from-blue-600 hover:to-cyan-600 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02]"
                    >
                      Add
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Members List */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Members</h3>
            <div className="space-y-3">
              {conversation.members?.map((member) => (
                <div key={member._id} className="flex items-center justify-between p-3 bg-gradient-to-r from-gray-50 to-blue-50 rounded-xl shadow border border-gray-100">
                  <div className="flex items-center space-x-4">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center shadow">
                      {member.avatarUrl ? (
                        <img src={member.avatarUrl} alt={member.fullName || member.username} className="h-10 w-10 rounded-full object-cover" />
                      ) : (
                        <span className="text-white font-bold text-lg">
                          {getInitials(member.fullName || member.username)}
                        </span>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        {member.fullName || member.username}
                      </p>
                      {member._id === conversation.createdBy && (
                        <span className="text-xs text-gray-500">Owner</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {(conversation.type === 'group' || conversation.type === 'community') && (
                      conversation.admins?.includes(member._id) ? (
                        <span className="text-xs text-blue-600 flex items-center">
                          <Crown className="h-3 w-3 mr-1" />
                          Admin
                        </span>
                      ) : (
                        <span className="text-xs text-gray-500">Member</span>
                      )
                    )}
                    {isOwner && member._id !== currentUserId && (conversation.type === 'group' || conversation.type === 'community') && (
                      <button
                        onClick={() => handleToggleAdmin(member._id)}
                        className={`px-3 py-2 text-xs rounded-xl font-semibold transition-all duration-200 shadow hover:shadow-lg transform hover:scale-[1.02] ${
                          conversation.admins?.includes(member._id)
                            ? 'bg-gradient-to-r from-red-100 to-pink-100 text-red-700 hover:from-red-200 hover:to-pink-200'
                            : 'bg-gradient-to-r from-blue-100 to-cyan-100 text-blue-700 hover:from-blue-200 hover:to-cyan-200'
                        }`}
                      >
                        {conversation.admins?.includes(member._id) ? 'Remove Admin' : 'Make Admin'}
                      </button>
                    )}
                    {(isAdmin || conversation.type === 'dm') && member._id !== currentUserId && (
                      <button
                        onClick={() => handleRemoveMember(member._id)}
                        className="px-3 py-2 text-xs bg-gradient-to-r from-red-100 to-pink-100 text-red-700 rounded-xl font-semibold hover:from-red-200 hover:to-pink-200 transition-all duration-200 shadow hover:shadow-lg transform hover:scale-[1.02]"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Delete Conversation */}
          {(conversation.type === 'dm' || isAdmin) && (
            <div className="border-t pt-6">
              <button
                onClick={handleDeleteConversation}
                className="w-full flex items-center justify-center space-x-3 px-6 py-4 bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-xl font-semibold hover:from-red-600 hover:to-pink-600 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02]"
              >
                <Trash2 className="h-5 w-5" />
                <span>Delete Conversation</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 