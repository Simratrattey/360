import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { useChatSocket } from './ChatSocketContext'; // ✅ Changed from useSocket
import * as notificationService from '../services/notificationService';
import { simulateNotification } from '../utils/notificationTest'; // Import the simulateNotification function

const NotificationContext = createContext();

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

export const NotificationProvider = ({ children }) => {
  const { user } = useAuth();
  const { socket } = useChatSocket(); // ✅ Use chat socket instead of general socket
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  // Load notifications on mount and when user changes
  simulateNotification(); // Call to simulate a notification for testing
  useEffect(() => {
    if (user) {
      loadNotifications();
      loadUnreadCount();
    } else {
      setNotifications([]);
      setUnreadCount(0);
    }
  }, [user]);

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window) {
  Notification.requestPermission().then(permission => {
    console.log('📢 Notification permission:', permission);
    if (permission === 'granted') {
      simulateNotification(); // Call to simulate a notification after permission is granted
    }
  });
}
      Notification.requestPermission().then(permission => {
        console.log('📢 Notification permission:', permission);
      });
    }
  }, []);

  // Listen for real-time notifications
  useEffect(() => {
    if (!socket || !user) {
      console.log('📢 Notification socket not ready - socket:', !!socket, 'user:', !!user);
      return () => {}; // Return empty cleanup function
    }

    console.log('📢 Setting up notification listener on socket:', socket.id);
    console.log('📢 Current socket connection state:', {
      connected: socket.connected,
      disconnected: socket.disconnected,
      hasListeners: socket.hasListeners('notification:new')
    });

    const handleNewNotification = (notification) => {
      console.log('📢 New notification received:', notification);
      console.log('📢 Current notification state before update:', {
        currentUnreadCount: unreadCount,
        notificationsCount: notifications.length
      });
      
      // Update notifications list and unread count
      setNotifications(prev => [notification, ...prev]);
      setUnreadCount(prev => {
        const newCount = prev + 1;
        console.log('📢 Updated unread count:', newCount);
        return newCount;
      });
      
      // Show browser notification if permission is granted
      if (window.Notification && Notification.permission === 'granted') {
        try {
          console.log('📢 Attempting to show browser notification');
          const notificationOptions = {
            body: notification.message,
            icon: notification.data?.senderAvatar || '/favicon.ico',
            tag: `notification-${notification._id || Date.now()}`,
            requireInteraction: false,
            silent: false,
            data: notification.data || {}
          };
          
          console.log('📢 Notification options:', notificationOptions);
          
          const browserNotification = new Notification(notification.title, notificationOptions);

          browserNotification.onclick = () => {
            console.log('📢 Notification clicked, handling navigation');
            window.focus();
            // Handle notification click based on type
            if (notification.type === 'message' && notification.data?.conversationId) {
              const url = `/messages?conversation=${notification.data.conversationId}`;
              console.log('📢 Navigating to message:', url);
              window.location.href = url;
            } else if (notification.type === 'meeting_invitation' && notification.data?.meetingId) {
              const url = `/meetings/${notification.data.meetingId}`;
              console.log('📢 Navigating to meeting:', url);
              window.location.href = url;
            }
            browserNotification.close();
          };

          // Auto-close after 5 seconds
          setTimeout(() => {
            browserNotification.close();
          }, 5000);
          
          console.log('📢 Browser notification shown successfully');
        } catch (error) {
          console.error('❌ Error showing browser notification:', error);
        }
      } else {
        console.log('📢 Browser notifications not available or permission not granted');
      }
    };

    // Setup socket event listeners
    const setupListeners = () => {
      if (!socket) return;
      
      console.log('📢 Adding notification listeners to socket');
      
      // Handle new notifications
      socket.on('notification:new', handleNewNotification);
      
      // Handle socket connection events
      socket.on('connect', () => {
        console.log('📢 Socket connected, ready for notifications');
      });
      
      socket.on('disconnect', (reason) => {
        console.log('📢 Socket disconnected:', reason);
      });
      
      socket.on('connect_error', (error) => {
        console.error('📢 Socket connection error:', error);
      });
      
      console.log('📢 Current socket event listeners:', {
        notification: socket.hasListeners('notification:new'),
        connect: socket.hasListeners('connect'),
        disconnect: socket.hasListeners('disconnect'),
        connect_error: socket.hasListeners('connect_error')
      });
    };

    // Setup listeners
    setupListeners();

    // Cleanup function
    return () => {
      if (socket) {
        console.log('📢 Cleaning up notification listeners');
        socket.off('notification:new', handleNewNotification);
        socket.off('connect');
        socket.off('disconnect');
        socket.off('connect_error');
      }
    };
  }, [socket, user, unreadCount, notifications.length]); // Added missing dependencies

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const response = await notificationService.getNotifications();
      setNotifications(response.notifications || []);
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUnreadCount = async () => {
    try {
      const response = await notificationService.getUnreadCount();
      setUnreadCount(response.unreadCount || 0);
    } catch (error) {
      console.error('Error loading unread count:', error);
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      await notificationService.markAsRead(notificationId);
      setNotifications(prev => 
        prev.map(notification => 
          notification._id === notificationId 
            ? { ...notification, read: true }
            : notification
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications(prev => 
        prev.map(notification => ({ ...notification, read: true }))
      );
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const deleteNotification = async (notificationId) => {
    try {
      await notificationService.deleteNotification(notificationId);
      setNotifications(prev => 
        prev.filter(notification => notification._id !== notificationId)
      );
      // Update unread count if the deleted notification was unread
      const deletedNotification = notifications.find(n => n._id === notificationId);
      if (deletedNotification && !deletedNotification.read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const refreshNotifications = () => {
    loadNotifications();
    loadUnreadCount();
  };

  const value = {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refreshNotifications
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};
