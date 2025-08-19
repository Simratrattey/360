import React, { useState, useEffect } from 'react';
import { X, Crown, Users, Hash, Edit, Save, X as CloseIcon, Plus, UserPlus, UserMinus, Shield, MoreVertical, MessageCircle, Check, AlertCircle } from 'lucide-react';
import API from '../../api/client';
import { useChatSocket } from '../../context/ChatSocketContext';

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
    title: 'Direct Message Details',
  },
  group: {
    icon: Users,
    gradient: 'from-blue-500 to-cyan-500',
    bgGradient: 'from-blue-50 to-cyan-50',
    borderColor: 'border-blue-200',
    title: 'Group Details',
  },
  community: {
    icon: Hash,
    gradient: 'from-green-500 to-emerald-500',
    bgGradient: 'from-green-50 to-emerald-50',
    borderColor: 'border-green-200',
    title: 'Community Details',
  },
};

export default function ConversationDetailsModal({ 
  isOpen, 
  onClose, 
  conversation, 
  currentUserId,
  onConversationUpdated
}) {
  const { onlineUsers, socket } = useChatSocket();
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  const [selectedUserToAdd, setSelectedUserToAdd] = useState(null);
  const [memberActionMenu, setMemberActionMenu] = useState(null);

  useEffect(() => {
    if (isOpen && conversation) {
      setName(conversation.name || '');
      setDescription(conversation.description || '');
      fetchAllUsers();
      
      // Debug: Log conversation updates
      console.log('💬 Conversation updated in modal:', {
        id: conversation._id,
        membersCount: conversation.members?.length || 0,
        adminsCount: conversation.admins?.length || 0
      });
    }
  }, [isOpen, conversation]);

  const fetchAllUsers = async () => {
    try {
      const response = await API.get('/users');
      const users = response.data.users || response.data || [];
      // Filter out users who are already members
      const nonMembers = users.filter(user => 
        user._id !== currentUserId && 
        !conversation.members?.some(member => member._id === user._id)
      );
      setAllUsers(nonMembers);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const isOwner = conversation?.createdBy === currentUserId;
  const isAdmin = conversation?.admins?.includes(currentUserId);
  const canEdit = isAdmin || conversation?.type === 'dm';
  const canManageMembers = (isOwner || isAdmin) && conversation?.type !== 'dm';
  const config = typeConfig[conversation?.type] || typeConfig.dm;

  const handleSaveName = async () => {
    if (!name.trim()) {
      setError('Name cannot be empty');
      return;
    }

    try {
      await API.put(`/conversations/${conversation._id}`, { name: name.trim() });
      setIsEditingName(false);
      setSuccess('Name updated successfully');
      onConversationUpdated();
      setSuccess(null);
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to update name');
      setError(null);
    }
  };

  const handleSaveDescription = async () => {
    try {
      await API.put(`/conversations/${conversation._id}`, { description: description.trim() });
      setIsEditingDescription(false);
      setSuccess('Description updated successfully');
      onConversationUpdated();
      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      console.error('Description update error:', error);
      setError(error.response?.data?.message || 'Failed to update description');
      setTimeout(() => setError(null), 5000);
    }
  };

  const handleMakeAdmin = async (userId) => {
    try {
      await API.post(`/conversations/${conversation._id}/admins`, { userId });
      setSuccess('Admin added successfully');
      
      // Emit socket event for real-time updates
      if (socket) {
        socket.emit('conversation:adminAdded', {
          conversationId: conversation._id,
          userId,
          adminId: currentUserId
        });
      }
      
      if (typeof onConversationUpdated === 'function') {
        onConversationUpdated();
      }
      setMemberActionMenu(null);
      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      console.error('Admin add error:', error);
      setError(error.response?.data?.message || 'Failed to add admin');
      setTimeout(() => setError(null), 5000);
    }
  };

  const handleRemoveAdmin = async (userId) => {
    try {
      await API.delete(`/conversations/${conversation._id}/admins/${userId}`);
      setSuccess('Admin removed successfully');
      
      // Emit socket event for real-time updates
      if (socket) {
        socket.emit('conversation:adminRemoved', {
          conversationId: conversation._id,
          userId,
          adminId: currentUserId
        });
      }
      
      if (typeof onConversationUpdated === 'function') {
        onConversationUpdated();
      }
      setMemberActionMenu(null);
      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      console.error('Admin remove error:', error);
      setError(error.response?.data?.message || 'Failed to remove admin');
      setTimeout(() => setError(null), 5000);
    }
  };

  const handleRemoveMember = async (userId) => {
    try {
      await API.delete(`/conversations/${conversation._id}/members/${userId}`);
      setSuccess('Member removed successfully');
      
      // Emit socket event for real-time updates
      if (socket) {
        socket.emit('conversation:memberRemoved', {
          conversationId: conversation._id,
          userId,
          removedBy: currentUserId
        });
      }
      
      if (typeof onConversationUpdated === 'function') {
        onConversationUpdated();
      }
      setMemberActionMenu(null);
      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      console.error('Member remove error:', error);
      setError(error.response?.data?.message || 'Failed to remove member');
      setTimeout(() => setError(null), 5000);
    }
  };

  const handleAddMember = async () => {
    if (!selectedUserToAdd) return;
    
    try {
      await API.post(`/conversations/${conversation._id}/members`, { userId: selectedUserToAdd._id });
      setSuccess('Member added successfully');
      
      // Emit socket event for real-time updates
      if (socket) {
        socket.emit('conversation:memberAdded', {
          conversationId: conversation._id,
          userId: selectedUserToAdd._id,
          addedBy: currentUserId
        });
      }
      
      if (typeof onConversationUpdated === 'function') {
        onConversationUpdated();
      }
      setShowAddMemberModal(false);
      setSelectedUserToAdd(null);
      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      console.error('Member add error:', error);
      setError(error.response?.data?.message || 'Failed to add member');
      setTimeout(() => setError(null), 5000);
    }
  };

  const handleClose = () => {
    setIsEditingName(false);
    setIsEditingDescription(false);
    setError(null);
    setSuccess(null);
    setShowAddMemberModal(false);
    setSelectedUserToAdd(null);
    setMemberActionMenu(null);
    onClose();
  };

  if (!isOpen || !conversation) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
        {/* Header */}
        <div className={`relative p-6 bg-gradient-to-r ${config.bgGradient} border-b ${config.borderColor}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className={`p-2 rounded-xl bg-gradient-to-r ${config.gradient} text-white shadow-lg`}>
                <config.icon className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">{config.title}</h2>
                <p className="text-sm text-gray-600">View and manage conversation details</p>
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

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Error/Success Messages */}
          {error && (
            <div className="bg-gradient-to-r from-red-50 to-pink-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl shadow-sm flex items-center space-x-2">
              <AlertCircle className="h-4 w-4" />
              <span className="font-medium">{error}</span>
            </div>
          )}
          {success && (
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl shadow-sm flex items-center space-x-2">
              <Check className="h-4 w-4" />
              <span className="font-medium">{success}</span>
            </div>
          )}

          {/* Conversation Info */}
          <div className="bg-gradient-to-r from-gray-50 to-blue-50 p-4 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center space-x-2">
              <div className="p-1 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500">
                <Shield className="h-3 w-3 text-white" />
              </div>
              <span>Conversation Info</span>
            </h3>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Type:</span>
                <span className="text-sm font-medium text-gray-900 capitalize">{conversation.type}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Members:</span>
                <span className="text-sm font-medium text-gray-900">{conversation.members?.length || 0} total</span>
              </div>
              {conversation.createdAt && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Created:</span>
                  <span className="text-sm font-medium text-gray-900">{new Date(conversation.createdAt).toLocaleDateString()}</span>
                </div>
              )}
            </div>
          </div>

          {/* Name Section */}
          <div className="bg-gradient-to-r from-gray-50 to-blue-50 p-4 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900 flex items-center space-x-2">
                <div className="p-1 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500">
                  <Edit className="h-3 w-3 text-white" />
                </div>
                <span>
                  {conversation.type === 'dm' ? 'Direct Message' : 
                   conversation.type === 'group' ? 'Group Name' : 'Community Name'}
                </span>
              </h3>
              {canEdit && !isEditingName && (
                <button
                  onClick={() => setIsEditingName(true)}
                  className="p-1 rounded-lg hover:bg-white/50 transition-all duration-200 text-blue-600 hover:text-blue-700"
                >
                  <Edit className="h-4 w-4" />
                </button>
              )}
            </div>
            {isEditingName ? (
              <div className="space-y-3">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white shadow-sm"
                  placeholder="Enter name..."
                />
                <div className="flex space-x-2">
                  <button
                    onClick={handleSaveName}
                    className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl font-semibold hover:from-blue-600 hover:to-cyan-600 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02] flex items-center justify-center space-x-2"
                  >
                    <Save className="h-4 w-4" />
                    <span>Save</span>
                  </button>
                  <button
                    onClick={() => {
                      setIsEditingName(false);
                      setName(conversation.name || '');
                    }}
                    className="px-4 py-2 bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 rounded-xl font-semibold hover:from-gray-200 hover:to-gray-300 transition-all duration-200 shadow hover:shadow-lg transform hover:scale-[1.02]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100">
                <p className="text-gray-900 font-semibold">{conversation.name || 'Unnamed'}</p>
              </div>
            )}
          </div>

          {/* Description Section (for Groups and Communities) */}
          {(conversation.type === 'group' || conversation.type === 'community') && (
            <div className="bg-gradient-to-r from-gray-50 to-blue-50 p-4 rounded-xl shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-900 flex items-center space-x-2">
                  <div className="p-1 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500">
                    <Edit className="h-3 w-3 text-white" />
                  </div>
                  <span>Description</span>
                </h3>
                {canEdit && !isEditingDescription && (
                  <button
                    onClick={() => setIsEditingDescription(true)}
                    className="p-1 rounded-lg hover:bg-white/50 transition-all duration-200 text-blue-600 hover:text-blue-700"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                )}
              </div>
              {isEditingDescription ? (
                <div className="space-y-3">
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white shadow-sm resize-none"
                    placeholder="Enter description..."
                  />
                  <div className="flex space-x-2">
                    <button
                      onClick={handleSaveDescription}
                      className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl font-semibold hover:from-blue-600 hover:to-cyan-600 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02]"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setIsEditingDescription(false);
                        setDescription(conversation.description || '');
                      }}
                      className="px-4 py-2 bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 rounded-xl font-semibold hover:from-gray-200 hover:to-gray-300 transition-all duration-200 shadow hover:shadow-lg transform hover:scale-[1.02]"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100">
                  <p className="text-gray-700">
                    {conversation.description || 'No description available'}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Members List */}
          <div className="bg-gradient-to-r from-gray-50 to-blue-50 p-4 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900 flex items-center space-x-2">
                <div className="p-1 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500">
                  <Users className="h-3 w-3 text-white" />
                </div>
                <span>Members ({conversation.members?.length || 0})</span>
              </h3>
              {canManageMembers && (conversation.type === 'group' || conversation.type === 'community') && (
                <button
                  onClick={() => setShowAddMemberModal(true)}
                  className="flex items-center space-x-2 px-3 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl font-semibold hover:from-blue-600 hover:to-cyan-600 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02] text-sm"
                >
                  <UserPlus className="h-4 w-4" />
                  <span>Add Member</span>
                </button>
              )}
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {conversation.members?.map((member) => (
                <div key={member._id} className="relative">
                  <div className="flex items-center justify-between p-3 bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all duration-200">
                    <div className="flex items-center space-x-3">
                      <div className="relative">
                        <div className="h-10 w-10 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg">
                          {member.avatarUrl ? (
                            <img
                              src={member.avatarUrl}
                              alt={member.fullName || member.username}
                              className="h-10 w-10 rounded-full object-cover"
                              onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.nextElementSibling.style.display = 'flex';
                              }}
                            />
                          ) : null}
                          <span 
                            className="text-white font-bold text-sm flex items-center justify-center h-full w-full"
                            style={{ display: member.avatarUrl ? 'none' : 'flex' }}
                          >
                            {getInitials(member.fullName || member.username)}
                          </span>
                        </div>
                        {/* Online status indicator */}
                        {onlineUsers.has(member._id) && (
                          <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white shadow-sm"></div>
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">
                          {member.fullName || member.username}
                        </p>
                        <div className="flex items-center space-x-2">
                          {member._id === conversation.createdBy && (
                            <span className="text-xs bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700 px-2 py-1 rounded-full font-medium">Owner</span>
                          )}
                          {(conversation.type === 'group' || conversation.type === 'community') && 
                           conversation.admins?.includes(member._id) && (
                            <span className="text-xs bg-gradient-to-r from-blue-100 to-cyan-100 text-blue-700 px-2 py-1 rounded-full font-medium flex items-center">
                              <Crown className="h-3 w-3 mr-1" />
                              Admin
                            </span>
                          )}
                          {onlineUsers.has(member._id) && (
                            <span className="text-xs bg-gradient-to-r from-green-100 to-emerald-100 text-green-700 px-2 py-1 rounded-full font-medium flex items-center">
                              <div className="w-2 h-2 bg-green-500 rounded-full mr-1"></div>
                              Online
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {canManageMembers && member._id !== currentUserId && (
                      <button
                        onClick={() => setMemberActionMenu(memberActionMenu === member._id ? null : member._id)}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-all duration-200"
                      >
                        <MoreVertical className="h-4 w-4 text-gray-500" />
                      </button>
                    )}
                  </div>
                  
                  {/* Member Action Menu */}
                  {memberActionMenu === member._id && canManageMembers && member._id !== currentUserId && (
                    <div className="absolute right-0 top-full mt-2 bg-white border border-gray-200 rounded-xl shadow-xl z-10 min-w-40 overflow-hidden">
                      {/* Only show admin options for groups and communities, not DMs */}
                      {(conversation.type === 'group' || conversation.type === 'community') && (
                        !conversation.admins?.includes(member._id) ? (
                          <button
                            onClick={() => handleMakeAdmin(member._id)}
                            className="w-full px-4 py-3 text-left text-sm hover:bg-gradient-to-r hover:from-blue-50 hover:to-cyan-50 flex items-center space-x-3 transition-all duration-200"
                          >
                            <div className="p-1 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500">
                              <Shield className="h-3 w-3 text-white" />
                            </div>
                            <span>Make Admin</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => handleRemoveAdmin(member._id)}
                            className="w-full px-4 py-3 text-left text-sm hover:bg-gradient-to-r hover:from-red-50 hover:to-pink-50 flex items-center space-x-3 transition-all duration-200 text-red-600"
                          >
                            <div className="p-1 rounded-lg bg-gradient-to-r from-red-500 to-pink-500">
                              <UserMinus className="h-3 w-3 text-white" />
                            </div>
                            <span>Remove Admin</span>
                          </button>
                        )
                      )}
                      <button
                        onClick={() => handleRemoveMember(member._id)}
                        className="w-full px-4 py-3 text-left text-sm hover:bg-gradient-to-r hover:from-red-50 hover:to-pink-50 flex items-center space-x-3 transition-all duration-200 text-red-600"
                      >
                        <div className="p-1 rounded-lg bg-gradient-to-r from-red-500 to-pink-500">
                          <UserMinus className="h-3 w-3 text-white" />
                        </div>
                        <span>Remove Member</span>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Add Member Modal */}
        {showAddMemberModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
              {/* Header */}
              <div className="relative p-6 bg-gradient-to-r from-blue-50 to-cyan-50 border-b border-blue-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg">
                      <UserPlus className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">Add Member</h3>
                      <p className="text-sm text-gray-600">Select a user to add to the conversation</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setShowAddMemberModal(false)}
                    className="p-2 rounded-full hover:bg-white/50 transition-all duration-200 text-gray-500 hover:text-gray-700"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                {allUsers.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="p-4 rounded-full bg-gradient-to-r from-gray-100 to-gray-200 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                      <Users className="h-8 w-8 text-gray-400" />
                    </div>
                    <p className="text-gray-500 font-medium">No users available to add</p>
                    <p className="text-sm text-gray-400 mt-1">All users are already members</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {allUsers.map((user) => (
                      <button
                        key={user._id}
                        onClick={() => setSelectedUserToAdd(user)}
                        className={`w-full flex items-center space-x-3 p-4 rounded-xl transition-all duration-200 text-left ${
                          selectedUserToAdd?._id === user._id 
                            ? 'bg-gradient-to-r from-blue-50 to-cyan-50 border-2 border-blue-200 shadow-lg transform scale-[1.02]' 
                            : 'hover:bg-gradient-to-r hover:from-gray-50 hover:to-blue-50 hover:shadow-md transform hover:scale-[1.01]'
                        }`}
                      >
                        <div className="h-10 w-10 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg">
                          {user.avatarUrl ? (
                            <img
                              src={user.avatarUrl}
                              alt={user.fullName || user.username}
                              className="h-10 w-10 rounded-full object-cover"
                              onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.nextElementSibling.style.display = 'flex';
                              }}
                            />
                          ) : null}
                          <span 
                            className="text-white font-bold text-sm flex items-center justify-center h-full w-full"
                            style={{ display: user.avatarUrl ? 'none' : 'flex' }}
                          >
                            {getInitials(user.fullName || user.username)}
                          </span>
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">
                            {user.fullName || user.username}
                          </p>
                          {user.fullName && (
                            <p className="text-sm text-gray-500">@{user.username}</p>
                          )}
                        </div>
                        {selectedUserToAdd?._id === user._id && (
                          <div className="ml-auto p-1 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500">
                            <Check className="h-4 w-4 text-white" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-gray-100 bg-gradient-to-r from-gray-50 to-blue-50">
                <div className="flex space-x-3">
                  <button
                    onClick={() => setShowAddMemberModal(false)}
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 rounded-xl font-semibold hover:from-gray-200 hover:to-gray-300 transition-all duration-200 shadow hover:shadow-lg transform hover:scale-[1.02]"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddMember}
                    disabled={!selectedUserToAdd}
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl font-semibold hover:from-blue-600 hover:to-cyan-600 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02] disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed disabled:transform-none"
                  >
                    Add Member
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 