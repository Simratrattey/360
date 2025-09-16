import React, { useState, useEffect } from 'react';
import { Search, User, X } from 'lucide-react';
import API from '../../api/client';

function getInitials(name) {
  if (!name || typeof name !== 'string') {
    return 'U';
  }
  return name.split(' ').map(n => n[0]).join('').toUpperCase();
}

export default function UserSelectionModal({ isOpen, onClose, onSelectUser, currentUserId }) {
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch all users except current user
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
      // Filter out current user
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

  // Filter users based on search term
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

  const handleUserSelect = (user) => {
    onSelectUser(user);
    onClose();
  };

  const handleClose = () => {
    setSearchTerm('');
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-2xl flex items-center justify-center z-50 p-4">
      <div className="bg-white/95 backdrop-blur-2xl rounded-2xl shadow-2xl border border-white/20 w-full max-w-lg max-h-[80vh] flex flex-col animate-in slide-in-from-bottom-4 duration-300">
        {/* Header */}
        <div className="flex items-center justify-between p-6 bg-gradient-to-br from-purple-50/80 via-pink-50/80 to-blue-50/80 backdrop-blur-sm border-b border-white/30 rounded-t-2xl">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 text-white shadow-xl">
              <User className="h-5 w-5" />
            </div>
            <h2 className="text-xl font-bold bg-gradient-to-r from-primary-800 to-secondary-700 bg-clip-text text-transparent">New Direct Message</h2>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-xl hover:bg-white/60 transition-all duration-200 text-secondary-500 hover:text-secondary-700 backdrop-blur-sm"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search */}
        <div className="p-6 bg-gradient-to-br from-purple-50/60 via-white/80 to-pink-50/60 backdrop-blur-sm">
          <div className="relative">
            <Search className="absolute left-5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-secondary-400" />
            <input
              type="text"
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-14 pr-5 py-4 border border-white/60 rounded-2xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-300 transition-all duration-200 bg-white/80 backdrop-blur-sm shadow-lg focus:shadow-xl text-primary-800 font-medium"
            />
          </div>
        </div>

        {/* User List */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent mx-auto"></div>
              <p className="text-secondary-500 mt-6 font-bold">Loading users...</p>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <div className="bg-gradient-to-r from-red-50/90 to-pink-50/90 backdrop-blur-sm border border-red-200/60 text-red-700 px-5 py-4 rounded-2xl shadow-lg mb-4">
                <span className="font-semibold">{error}</span>
              </div>
              <button
                onClick={fetchUsers}
                className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-2xl font-bold hover:from-purple-600 hover:to-pink-600 transition-all duration-200 shadow-xl hover:shadow-2xl transform hover:scale-[1.02]"
              >
                Retry
              </button>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-12">
              <div className="p-6 rounded-2xl bg-gradient-to-br from-gray-50 to-purple-50 w-20 h-20 mx-auto mb-6 flex items-center justify-center shadow-lg">
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
                  onClick={() => handleUserSelect(user)}
                  className="w-full flex items-center space-x-4 p-5 rounded-2xl bg-white/60 backdrop-blur-sm border-2 border-white/40 hover:border-purple-200/60 hover:shadow-xl transition-all duration-200 text-left group transform hover:scale-[1.02]"
                >
                  <div className="h-14 w-14 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-xl">
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
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 