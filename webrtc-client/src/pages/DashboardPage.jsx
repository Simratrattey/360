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
  Hash,
  X
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { openMeetingWindow, generateRoomId } from '../utils/meetingWindow';
import { AuthContext } from '../context/AuthContext';
import ScheduleMeetingModal from '../components/ScheduleMeetingModal.jsx';
import CreateMeetingModal from '../components/CreateMeetingModal.jsx';
import API from '../api/client.js';
import * as conversationAPI from '../api/conversationService';
import { useChatSocket } from '../context/ChatSocketContext';
import { useNotifications } from '../context/NotificationContext';
import { useCurrentConversation } from '../context/CurrentConversationContext';
import { useSocket } from '../context/SocketContext';

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
  const { sfuSocket } = useSocket() || {};
  const { currentConversationId, isOnMessagesPage } = useCurrentConversation();
  const navigate = useNavigate();
  const { unreadCount: globalUnreadCount, notifications: generalNotifications, markAsRead, refreshNotifications, clearNotificationsForConversation } = useNotifications();
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  // Using only global notifications to avoid duplicates
  const [scheduling, setScheduling] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  
  // Join request system
  const [joinRequestNotifications, setJoinRequestNotifications] = useState([]);
  const [approvedRooms, setApprovedRooms] = useState(new Set());

  const loadRooms = () => {
    API.get('/rooms')
      .then(res => {
        setRooms(res.data.rooms || []);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching rooms:', err);
        setLoading(false);
      });
  };

  useEffect(() => {
    // Fetch active rooms
    loadRooms();
  }, []);

  // Fetch unread message notifications


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

        // Notification will be handled by NotificationContext globally

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

        // Notification will be handled by NotificationContext globally

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
    setIsCreateModalOpen(true);
  };

  const joinMeeting = (roomId) => {
    openMeetingWindow(roomId);
  };

  // Helper function to add custom notifications
  const addJoinRequestNotification = (type, message, roomId = null) => {
    const notification = {
      id: Date.now(),
      type, // 'success', 'error', 'approved', 'denied'
      message,
      roomId,
      timestamp: new Date().toISOString()
    };
    
    setJoinRequestNotifications(prev => [...prev, notification]);
    
    // Auto-remove after 5 seconds for success/error, 10 seconds for approved/denied
    const timeout = type === 'approved' || type === 'denied' ? 10000 : 5000;
    setTimeout(() => {
      setJoinRequestNotifications(prev => prev.filter(n => n.id !== notification.id));
    }, timeout);
    
    return notification.id;
  };

  const requestJoinMeeting = (roomId) => {
    if (!sfuSocket || !user) {
      addJoinRequestNotification('error', 'Unable to send join request. Please try again.');
      return;
    }

    console.log('[Dashboard] Sending join request for room:', roomId);
    
    sfuSocket.emit('requestJoinRoom', {
      roomId,
      requesterName: user.fullName || user.username || user.email,
      requesterUserId: user.id || user._id
    });

    // Listen for join request result
    sfuSocket.once('joinRequestResult', (result) => {
      if (result.success) {
        addJoinRequestNotification('success', 'Join request sent to host successfully!');
        
        // Listen for host's response
        sfuSocket.once('joinRequestApproved', () => {
          addJoinRequestNotification('approved', 'Host approved your request! You can now join the meeting.', roomId);
          // Mark room as approved so button changes to "Join"
          setApprovedRooms(prev => new Set([...prev, roomId]));
        });
        
        sfuSocket.once('joinRequestDenied', (data) => {
          addJoinRequestNotification('denied', data.message || 'Host denied your join request.');
        });
        
      } else {
        addJoinRequestNotification('error', result.message || 'Failed to send join request.');
      }
    });
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
        </div>
        {(() => {
          // Filter unread notifications, excluding message notifications for currently selected conversation
          const unreadNotifications = (Array.isArray(generalNotifications) ? generalNotifications : [])
            .filter(notif => !notif.read)
            .filter(notif => {
              // If this is a message notification and user is on messages page with this conversation selected, hide it
              if (notif.type === 'message' && isOnMessagesPage && currentConversationId === notif.data?.conversationId) {
                return false;
              }
              return true;
            });
          
          return unreadNotifications.length > 0;
        })() ? (
          <div className="space-y-3 max-h-96 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 pr-2">
            
            {/* General notifications (group/conversation events) */}
            {(() => {
              // Filter unread notifications, excluding message notifications for currently selected conversation
              const filteredNotifications = (Array.isArray(generalNotifications) ? generalNotifications : [])
                .filter(notif => !notif.read)
                .filter(notif => {
                  // If this is a message notification and user is on messages page with this conversation selected, hide it
                  if (notif.type === 'message' && isOnMessagesPage && currentConversationId === notif.data?.conversationId) {
                    return false;
                  }
                  return true;
                });
              
              return filteredNotifications;
            })().map((notif, idx) => (
              <motion.div
                key={`general-${notif._id}-${idx}`}
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.07, duration: 0.5 }}
                className="flex items-center gap-4 p-4 bg-white/60 rounded-xl border border-white/20 shadow hover:scale-105 transition-transform cursor-pointer"
                onClick={async () => {
                  // Mark notification as read
                  if (markAsRead && notif._id) {
                    await markAsRead(notif._id);
                    // Note: refreshNotifications() removed to prevent race conditions
                    // markAsRead already updates the local state correctly
                  }
                  // Navigate based on notification type
                  if (notif.type === 'conversation_created' || notif.type === 'community_created' || notif.type === 'conversation_deleted') {
                    navigate('/messages');
                  } else if (notif.type === 'message' && notif.data?.conversationId) {
                    // Navigate to specific conversation for message notifications
                    // Notifications will be cleared when the conversation is actually opened in MessagesPage
                    navigate(`/messages?conversation=${notif.data.conversationId}`);
                  }
                }}
              >
                <div className="relative">
                  <div className={`h-12 w-12 rounded-full bg-gradient-to-r ${
                    notif.type === 'conversation_created' || notif.type === 'community_created' 
                      ? 'from-green-500 to-emerald-500' 
                      : notif.type === 'conversation_deleted' 
                      ? 'from-red-500 to-pink-500'
                      : notif.type === 'message'
                      ? 'from-purple-500 to-blue-500'
                      : 'from-blue-500 to-cyan-500'
                  } flex items-center justify-center text-white font-bold text-lg shadow-lg`}>
                    {notif.type === 'conversation_created' || notif.type === 'community_created' ? '🎉' : 
                     notif.type === 'conversation_deleted' ? '🗑️' : 
                     notif.type === 'message' ? '💬' : '🔔'}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-secondary-800 truncate">{notif.title}</p>
                  {/* Show conversation name for group/community notifications */}
                  {(notif.type === 'conversation_created' || notif.type === 'community_created') && notif.data?.conversationName && (
                    <p className="text-sm font-medium text-blue-600 truncate">"{notif.data.conversationName}"</p>
                  )}
                  {/* Show conversation context for message notifications */}
                  {notif.type === 'message' && notif.data?.conversationType && notif.data?.conversationType !== 'dm' && notif.data?.conversationName && (
                    <p className="text-sm font-medium text-green-600 truncate">in "{notif.data.conversationName}"</p>
                  )}
                  <p className="text-sm text-secondary-600 truncate">{notif.message}</p>
                  <p className="text-xs text-secondary-400 mt-1">{new Date(notif.createdAt).toLocaleTimeString()}</p>
                </div>
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
                  onClick={() => {
                    if (room.visibility === 'approval' && !approvedRooms.has(room.roomId)) {
                      requestJoinMeeting(room.roomId);
                    } else {
                      joinMeeting(room.roomId);
                    }
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-bold text-primary-800 truncate">{room.name}</p>
                      {room.isRecording && (
                        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" title="Recording in progress"></div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-secondary-600">{room.participantCount} participant{room.participantCount !== 1 ? 's' : ''}</p>
                      <span className="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full">
                        {room.visibility === 'public' ? 'Public' : 'Approval Required'}
                      </span>
                    </div>
                  </div>
                  <button className={`text-sm py-1 px-4 rounded-lg shadow transition-colors ${
                    room.visibility === 'approval' && !approvedRooms.has(room.roomId)
                      ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                      : 'btn-primary'
                  }`}>
                    {room.visibility === 'approval' && !approvedRooms.has(room.roomId) ? 'Request' : 'Join'}
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
      
      <CreateMeetingModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onMeetingCreated={loadRooms}
      />

      {/* Custom Join Request Notifications */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {joinRequestNotifications.map((notification) => (
          <motion.div
            key={notification.id}
            initial={{ opacity: 0, x: 300, scale: 0.8 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 300, scale: 0.8 }}
            className={`p-4 rounded-lg shadow-lg border-l-4 max-w-md ${
              notification.type === 'success'
                ? 'bg-green-50 border-green-400 text-green-800'
                : notification.type === 'error'
                ? 'bg-red-50 border-red-400 text-red-800'
                : notification.type === 'approved'
                ? 'bg-blue-50 border-blue-400 text-blue-800'
                : notification.type === 'denied'
                ? 'bg-orange-50 border-orange-400 text-orange-800'
                : 'bg-gray-50 border-gray-400 text-gray-800'
            }`}
          >
            <div className="flex items-start">
              <div className="flex-shrink-0 mr-3">
                {notification.type === 'success' && (
                  <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                    <div className="w-3 h-3 bg-white rounded-full"></div>
                  </div>
                )}
                {notification.type === 'error' && (
                  <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
                    <div className="w-1 h-3 bg-white rounded-full"></div>
                  </div>
                )}
                {notification.type === 'approved' && (
                  <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                    <div className="w-3 h-1 bg-white rounded-full rotate-45 relative">
                      <div className="w-1 h-2 bg-white rounded-full absolute -top-0.5 left-1"></div>
                    </div>
                  </div>
                )}
                {notification.type === 'denied' && (
                  <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center">
                    <div className="w-3 h-0.5 bg-white rounded-full"></div>
                  </div>
                )}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">{notification.message}</p>
                {notification.type === 'approved' && notification.roomId && (
                  <button
                    onClick={() => joinMeeting(notification.roomId)}
                    className="mt-2 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-md transition-colors"
                  >
                    Join Now
                  </button>
                )}
              </div>
              <button
                onClick={() => setJoinRequestNotifications(prev => 
                  prev.filter(n => n.id !== notification.id)
                )}
                className="flex-shrink-0 ml-2 text-gray-400 hover:text-gray-600"
              >
                <X size={16} />
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
} 