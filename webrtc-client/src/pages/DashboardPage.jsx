import React, { useContext, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Video, 
  Users, 
  Clock, 
  Calendar,
  Plus,
  Phone,
  MessageSquare,
  TrendingUp,
  Activity,
  Sparkles,
  User,
  Hash
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { openMeetingWindow, generateRoomId } from '../utils/meetingWindow';
import { AuthContext } from '../context/AuthContext';
import ScheduleMeetingModal from '../components/ScheduleMeetingModal.jsx';
import API from '../api/client.js';
import * as conversationAPI from '../api/conversationService';
import { useChatSocket } from '../context/ChatSocketContext';
import { useNotifications } from '../context/NotificationContext';

const stats = [
  { name: 'Total Meetings', value: '24', icon: Video, change: '+12%', changeType: 'positive' },
  { name: 'Active Contacts', value: '156', icon: Users, change: '+8%', changeType: 'positive' },
  { name: 'Hours This Week', value: '18.5', icon: Clock, change: '+5%', changeType: 'positive' },
  { name: 'Upcoming', value: '3', icon: Calendar, change: '0%', changeType: 'neutral' },
];

const recentMeetings = [
  { id: 1, title: 'Team Standup', participants: 8, duration: '30m', date: '2 hours ago', status: 'completed' },
  { id: 2, title: 'Client Presentation', participants: 12, duration: '1h 15m', date: 'Yesterday', status: 'completed' },
  { id: 3, title: 'Project Review', participants: 5, duration: '45m', date: '2 days ago', status: 'completed' },
  { id: 4, title: 'Weekly Sync', participants: 15, duration: '1h', date: '3 days ago', status: 'completed' },
];

export default function DashboardPage() {
  const { user } = useContext(AuthContext);
  const chatSocket = useChatSocket();
  const navigate = useNavigate();
  const { unreadCount: globalUnreadCount, notifications: generalNotifications, markAsRead } = useNotifications();
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [messageNotifications, setMessageNotifications] = useState([]);
  // Removed localGeneralNotifications to avoid duplicates - using only global notifications
  const [scheduling, setScheduling] = useState(false);

  useEffect(() => {
    // Fetch active rooms
    API.get('/rooms')
      .then(res => {
        setRooms(res.data.rooms || []);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching rooms:', err);
        setLoading(false);
      });
  }, []);

  // Fetch unread message notifications
  useEffect(() => {
    async function fetchUnread() {
      try {
        const res = await conversationAPI.getConversations();
        const conversations = res.data.conversations || res.data || [];
        // Create message notifications for unread messages
        const messageNotifs = conversations
          .filter(c => c.unread > 0)
          .map(c => ({
            id: c._id,
            type: c.type,
            name: c.name || (c.type === 'dm' && c.members ? (c.members.find(m => m._id !== user?._id)?.fullName || c.members.find(m => m._id !== user?._id)?.username || 'Unknown') : ''),
            unread: c.unread,
            avatar: c.avatar,
            icon: c.type === 'dm' ? User : c.type === 'group' ? Users : Hash,
            lastText: 'New messages',
            lastSender: ''
          }));
        setMessageNotifications(messageNotifs);
      } catch (err) {
        console.error('Error fetching unread messages:', err);
        setMessageNotifications([]);
      }
    }
    fetchUnread();
  }, [user]);

  // Real-time message notification updates
  useEffect(() => {
    if (!chatSocket || !chatSocket.socket) return;
    const handleNewMessage = (msg) => {
      // Only show notification if the sender is NOT the current user
      if (
        (msg.senderId && msg.senderId !== user.id) ||
        (typeof msg.sender === 'string' && msg.sender !== user.id) ||
        (typeof msg.sender === 'object' && msg.sender && msg.sender._id !== user.id)
      ) {
        setMessageNotifications(prev => {
          // Find if this conversation already exists
          const idx = prev.findIndex(n => n.id === msg.conversationId);
          if (idx !== -1) {
            // Update unread count and move to top
            const updated = [...prev];
            updated[idx] = {
              ...updated[idx],
              unread: (updated[idx].unread || 0) + 1,
              lastText: msg.text || (msg.file ? 'Sent a file' : 'New message'),
              lastSender: msg.senderName || (msg.sender && msg.sender.fullName) || 'New Message',
            };
            // Move to top
            const [item] = updated.splice(idx, 1);
            return [item, ...updated];
          } else {
            // New conversation notification
            return [
              {
                id: msg.conversationId,
                type: msg.conversationType || 'dm',
                name: msg.conversationName || msg.senderName || (msg.sender && msg.sender.fullName) || 'New Message',
                unread: 1,
                avatar: msg.conversationAvatar || '',
                icon: msg.conversationType === 'group' ? Users : msg.conversationType === 'community' ? Hash : User,
                lastText: msg.text || (msg.file ? 'Sent a file' : 'New message'),
                lastSender: msg.senderName || (msg.sender && msg.sender.fullName) || 'New Message',
              },
              ...prev
            ];
          }
        });
      }
    };
    chatSocket.on('chat:new', handleNewMessage);
    return () => {
      chatSocket.off('chat:new', handleNewMessage);
    };
  }, [chatSocket, user.id]);

  // Real-time conversation creation/deletion updates for dashboard
  useEffect(() => {
    if (!chatSocket || !chatSocket.socket) return;
    
    const handleConversationCreated = (data) => {
      console.log('📢 Dashboard received conversation:created event:', data);
      // Only show if the creator is NOT the current user (others created it)
      if (data.createdBy && data.createdBy !== user.id) {
        // Add to general notifications for dashboard display
        const notification = {
          _id: `conv-created-${data._id}-${Date.now()}`,
          type: 'conversation_created',
          title: `New ${data.type === 'dm' ? 'Direct Message' : data.type === 'group' ? 'Group' : 'Community'}`,
          message: `You were added to ${data.name || 'a new conversation'}`,
          createdAt: new Date().toISOString(),
          read: false,
          data: {
            conversationId: data._id,
            conversationName: data.name,
            conversationType: data.type,
            createdBy: data.createdBy
          }
        };

        // Notification will be handled by NotificationContext globally

        // Show browser notification
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(notification.title, {
            body: notification.message,
            icon: '/favicon.ico',
            tag: `conversation-created-${data._id}`
          });
        }
      }
    };

    const handleConversationDeleted = (data) => {
      console.log('📢 Dashboard received conversation:deleted event:', data);
      // Only show if the deleter is NOT the current user (others deleted it)
      if (data.deletedBy && data.deletedBy !== user.id) {
        // Add to general notifications for dashboard display
        const notification = {
          _id: `conv-deleted-${data.conversationId}-${Date.now()}`,
          type: 'conversation_deleted',
          title: 'Conversation Deleted',
          message: `${data.conversationName || 'A conversation'} was deleted`,
          createdAt: new Date().toISOString(),
          read: false,
          data: {
            conversationId: data.conversationId,
            conversationName: data.conversationName,
            deletedBy: data.deletedBy
          }
        };

        // Notification will be handled by NotificationContext globally

        // Show browser notification
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(notification.title, {
            body: notification.message,
            icon: '/favicon.ico',
            tag: `conversation-deleted-${data.conversationId}`
          });
        }
      }
    };

    // Handle group membership changes for dashboard notifications
    const handleMemberAdded = (data) => {
      console.log('📢 Dashboard received conversation:memberAdded event:', data);
      const { conversationId, conversationName, conversationType, userId, addedBy, addedUser, adderUser } = data;
      
      // Show notification if current user was added to a group
      if (userId === user.id) {
        const notification = {
          _id: `member-added-${conversationId}-${Date.now()}`,
          type: 'member_added',
          title: 'Added to Group',
          message: `You were added to ${conversationName || 'a group'} by ${adderUser?.fullName || adderUser?.username || 'someone'}`,
          createdAt: new Date().toISOString(),
          read: false,
          data: {
            conversationId,
            conversationName,
            conversationType,
            addedBy,
            addedUser,
            adderUser
          }
        };

        setLocalGeneralNotifications(prev => {
          const updated = [notification, ...(Array.isArray(prev) ? prev : [])];
          return updated;
        });

        // Show browser notification
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(notification.title, {
            body: notification.message,
            icon: '/favicon.ico',
            tag: `member-added-${conversationId}`
          });
        }
      }
    };

    const handleMemberRemoved = (data) => {
      console.log('📢 Dashboard received conversation:memberRemoved event:', data);
      const { conversationId, conversationName, conversationType, userId, removedBy, removedUser, removerUser } = data;
      
      // Show notification if current user was removed from a group
      if (userId === user.id) {
        const notification = {
          _id: `member-removed-${conversationId}-${Date.now()}`,
          type: 'member_removed',
          title: 'Removed from Group',
          message: `You were removed from ${conversationName || 'a group'} by ${removerUser?.fullName || removerUser?.username || 'an admin'}`,
          createdAt: new Date().toISOString(),
          read: false,
          data: {
            conversationId,
            conversationName,
            conversationType,
            removedBy,
            removedUser,
            removerUser
          }
        };

        setLocalGeneralNotifications(prev => {
          const updated = [notification, ...(Array.isArray(prev) ? prev : [])];
          return updated;
        });

        // Show browser notification
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(notification.title, {
            body: notification.message,
            icon: '/favicon.ico',
            tag: `member-removed-${conversationId}`
          });
        }
      }
    };

    chatSocket.on('conversation:created', handleConversationCreated);
    chatSocket.on('conversation:deleted', handleConversationDeleted);
    chatSocket.on('conversation:memberAdded', handleMemberAdded);
    chatSocket.on('conversation:memberRemoved', handleMemberRemoved);
    
    return () => {
      chatSocket.off('conversation:created', handleConversationCreated);
      chatSocket.off('conversation:deleted', handleConversationDeleted);
      chatSocket.off('conversation:memberAdded', handleMemberAdded);
      chatSocket.off('conversation:memberRemoved', handleMemberRemoved);
    };
  }, [chatSocket, user.id]);

  const createNewMeeting = () => {
    const roomId = generateRoomId();
    openMeetingWindow(roomId);
  };

  const joinMeeting = (roomId) => {
    openMeetingWindow(roomId);
  };

  return (
    <div className="relative space-y-8">
      {/* Hero background illustration */}
      <div className="absolute inset-0 -z-10 pointer-events-none">
        <div className="absolute left-1/2 top-0 -translate-x-1/2 w-[80vw] h-[40vh] bg-gradient-to-br from-blue-400/30 via-purple-400/20 to-pink-400/10 rounded-full blur-3xl opacity-60 animate-pulse" />
        <div className="absolute right-0 bottom-0 w-64 h-64 bg-gradient-to-br from-purple-400/30 to-blue-400/10 rounded-full blur-2xl opacity-40" />
      </div>
      {/* Welcome Section */}
      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }} className="card glass-effect p-8 flex items-center justify-between bg-white/70 shadow-2xl rounded-2xl border border-white/30">
        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-primary-800 flex items-center gap-2">
            <Sparkles className="h-7 w-7 text-blue-400 animate-bounce" />
            Welcome back, {user?.fullName || user?.username}!
          </h1>
          <p className="text-secondary-700 mt-2 text-lg">Here's what's happening with your meetings today.</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.07 }}
          whileTap={{ scale: 0.97 }}
          onClick={createNewMeeting}
          className="btn-primary flex items-center space-x-2 px-6 py-3 text-lg rounded-xl shadow-lg"
        >
          <Plus className="h-5 w-5" />
          <span>New Meeting</span>
        </motion.button>
      </motion.div>

      {/* Notifications Section */}
      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }} className="glass-effect card bg-white/80 shadow-xl rounded-2xl p-6 border border-white/30">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-primary-800 flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-blue-400" />
            Notifications
          </h2>
          {(globalUnreadCount && globalUnreadCount > 0) && (
            <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
              {globalUnreadCount} unread
            </span>
          )}
        </div>
        {((Array.isArray(messageNotifications) ? messageNotifications : []).length > 0 || (Array.isArray(generalNotifications) ? generalNotifications : []).length > 0) ? (
          <div className="space-y-3 max-h-96 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 pr-2">
            {/* General notifications (conversation creation/deletion, etc.) */}
            {(Array.isArray(generalNotifications) ? generalNotifications : []).filter(n => !n.read).slice(0, 5).map((notif, idx) => (
              <motion.div
                key={`general-${notif._id}-${idx}`}
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.07, duration: 0.5 }}
                className="flex items-center gap-4 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border border-blue-200 shadow hover:scale-105 transition-transform cursor-pointer"
                onClick={() => {
                  // Mark notification as read
                  if (notif._id) {
                    markAsRead(notif._id);
                  }
                  // Navigate to messages page for conversation notifications
                  if (notif.data?.conversationId) {
                    navigate(`/messages?conversation=${notif.data.conversationId}`);
                  }
                }}
              >
                <div className="relative">
                  <div className="h-12 w-12 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-lg shadow-lg">
                    {notif.type === 'conversation_created' ? '🎉' : 
                     notif.type === 'community_created' ? '🌍' : 
                     notif.type === 'conversation_deleted' ? '🗑️' : '🔔'}
                  </div>
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white"></div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-primary-800">{notif.title}</h3>
                  </div>
                  <p className="text-secondary-600 text-sm">{notif.message}</p>
                  <p className="text-secondary-500 text-xs">
                    {new Date(notif.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </motion.div>
            ))}
            
            {/* Message notifications */}
            {(Array.isArray(messageNotifications) ? messageNotifications : []).map((notif, idx) => (
              <motion.div
                key={`message-${notif.id}-${idx}`}
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: ((Array.isArray(generalNotifications) ? generalNotifications : []).filter(n => !n.read).slice(0, 5).length + idx) * 0.07, duration: 0.5 }}
                className="flex items-center gap-4 p-4 bg-white/60 rounded-xl border border-white/20 shadow hover:scale-105 transition-transform cursor-pointer"
                onClick={() => {
                  // Clear this message notification
                  setMessageNotifications(prev => prev.filter(n => n.id !== notif.id));
                  // Navigate to messages
                  navigate(`/messages?conversation=${notif.id}`);
                }}
              >
                <div className="relative">
                  {notif.avatar ? (
                    <img src={notif.avatar} alt={notif.name} className="h-12 w-12 rounded-full object-cover shadow-md" />
                  ) : (
                    <div className={`h-12 w-12 rounded-full bg-gradient-to-r ${notif.type === 'dm' ? 'from-purple-500 to-pink-500' : notif.type === 'group' ? 'from-blue-500 to-cyan-500' : 'from-green-500 to-emerald-500'} flex items-center justify-center text-white font-bold text-lg shadow-lg`}>
                      <notif.icon className="h-6 w-6" />
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-primary-800">
                      {notif.name || (notif.type === 'group' ? 'Group' : notif.type === 'community' ? 'Community' : 'Direct Message')}
                    </h3>
                    {notif.unread > 0 && (
                      <span className="bg-blue-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                        {notif.unread}
                      </span>
                    )}
                  </div>
                  {notif.lastText && (
                    <p className="text-secondary-500 text-xs truncate max-w-xs">{notif.lastSender}: {notif.lastText}</p>
                  )}
                  <p className="text-secondary-600 text-sm">
                    {notif.unread} new message{notif.unread > 1 ? 's' : ''} {notif.type === 'dm' ? 'from this person' : notif.type === 'group' ? 'from this group' : 'from this community'}
                  </p>
                </div>
                <span className="bg-gradient-to-r from-blue-500 to-purple-500 text-white text-xs font-bold rounded-full px-3 py-1 min-w-[32px] text-center shadow-md">
                  {notif.unread > 99 ? '99+' : notif.unread}
                </span>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center text-secondary-400 py-8 text-lg">No new notifications 🎉</div>
        )}
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.name}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.12, duration: 0.6 }}
            className="glass-effect bg-white/70 shadow-xl rounded-2xl p-6 flex items-center justify-between border border-white/30 hover:scale-105 hover:shadow-2xl transition-transform duration-200"
          >
            <div>
              <p className="text-base font-semibold text-secondary-700 mb-1">{stat.name}</p>
              <p className="text-3xl font-extrabold text-primary-800">{stat.value}</p>
              <p className={`text-xs mt-1 ${
                stat.changeType === 'positive' ? 'text-green-600' : 
                stat.changeType === 'negative' ? 'text-red-600' : 'text-secondary-500'
              }`}>
                {stat.change} from last month
              </p>
            </div>
            <div className="h-14 w-14 bg-gradient-to-br from-blue-400 to-purple-400 rounded-xl flex items-center justify-center shadow-lg">
              <stat.icon className="h-7 w-7 text-white" />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Active Rooms */}
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }} className="glass-effect card bg-white/70 shadow-xl rounded-2xl p-6 border border-white/30">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-primary-800">Active Rooms</h2>
            <Activity className="h-6 w-6 text-blue-400" />
          </div>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="animate-pulse">
                  <div className="h-4 bg-secondary-200 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-secondary-200 rounded w-1/2"></div>
                </div>
              ))}
            </div>
          ) : rooms.length > 0 ? (
            <div className="space-y-3">
              {rooms.slice(0, 5).map((room) => (
                <motion.div
                  key={room.roomId}
                  whileHover={{ scale: 1.03 }}
                  className="flex items-center justify-between p-4 bg-white/60 rounded-xl hover:bg-blue-50/60 transition-colors cursor-pointer border border-white/20 shadow"
                  onClick={() => joinMeeting(room.roomId)}
                >
                  <div>
                    <p className="font-bold text-primary-800">Room {room.roomId}</p>
                    <p className="text-sm text-secondary-600">{room.participants || 0} participants</p>
                  </div>
                  <button className="btn-primary text-sm py-1 px-4 rounded-lg shadow">
                    Join
                  </button>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Video className="h-12 w-12 text-secondary-400 mx-auto mb-3" />
              <p className="text-secondary-600">No active rooms</p>
              <button 
                onClick={createNewMeeting}
                className="btn-primary mt-3 px-6 py-2 rounded-xl shadow"
              >
                Start a meeting
              </button>
            </div>
          )}
        </motion.div>

        {/* Recent Meetings */}
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }} className="glass-effect card bg-white/70 shadow-xl rounded-2xl p-6 border border-white/30">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-primary-800">Recent Meetings</h2>
            <TrendingUp className="h-6 w-6 text-blue-400" />
          </div>
          <div className="space-y-3">
            {recentMeetings.map((meeting) => (
              <div key={meeting.id} className="flex items-center justify-between p-4 bg-white/60 rounded-xl border border-white/20 shadow">
                <div className="flex items-center space-x-3">
                  <div className="h-10 w-10 bg-gradient-to-br from-blue-400 to-purple-400 rounded-lg flex items-center justify-center shadow-lg">
                    <Video className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="font-bold text-primary-800">{meeting.title}</p>
                    <p className="text-sm text-secondary-600">
                      {meeting.participants} participants • {meeting.duration}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-secondary-500">{meeting.date}</p>
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    {meeting.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Quick Actions */}
      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }} className="glass-effect card bg-white/70 shadow-xl rounded-2xl p-6 border border-white/30">
        <h2 className="text-xl font-bold text-primary-800 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.97 }}
            onClick={createNewMeeting}
            className="btn-primary flex flex-col items-center gap-2 py-6 rounded-xl shadow-lg text-lg"
          >
            <Phone className="h-7 w-7 mb-2" />
            Start Call
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate('/messages')}
            className="btn-primary flex flex-col items-center gap-2 py-6 rounded-xl shadow-lg text-lg"
          >
            <MessageSquare className="h-7 w-7 mb-2" />
            New Message
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/contacts')}
            className="btn-primary flex flex-col items-center gap-2 py-6 rounded-xl shadow-lg text-lg"
          >
            <Users className="h-7 w-7 mb-2" />
            Add Contact
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setScheduling(true)}
            className="btn-primary flex flex-col items-center gap-2 py-6 rounded-xl shadow-lg text-lg"
          >
            <Calendar className="h-7 w-7 mb-2" />
            Schedule
          </motion.button>
        </div>
      </motion.div>
      <ScheduleMeetingModal
        open={scheduling}
        onClose={() => setScheduling(false)}
      />
    </div>
  );
} 