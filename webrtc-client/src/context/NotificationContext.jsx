import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { useChatSocket } from './ChatSocketContext';
import * as notificationService from '../services/notificationService';
import { 
  NOTIFICATION_TYPES, 
  getNotificationConfig, 
  shouldShowNotification 
} from '../utils/notificationTypes';

// Local storage keys
const STORAGE_KEYS = {
  NOTIFICATIONS: 'notifications_cache',
  UNREAD_COUNT: 'unread_count_cache'
};

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
  const { socket } = useChatSocket();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [error, setError] = useState(null);

  // Load notifications from cache on mount
  useEffect(() => {
    try {
      const cachedNotifications = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
      const cachedUnread = localStorage.getItem(STORAGE_KEYS.UNREAD_COUNT);
      
      if (cachedNotifications) {
        setNotifications(JSON.parse(cachedNotifications));
      }
      
      if (cachedUnread) {
        setUnreadCount(parseInt(cachedUnread, 10));
      }
    } catch (err) {
      console.error('Error loading notifications from cache:', err);
    }
  }, []);

  // Load notifications from server when user changes
  useEffect(() => {
    if (user) {
      loadNotifications();
      loadUnreadCount();
    } else {
      setNotifications([]);
      setUnreadCount(0);
    }
  }, [user]);

  // Handle online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window) {
      // Only request if not previously denied
      if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(permission => {
          console.log('📢 Notification permission:', permission);
        }).catch(err => {
          console.error('Error requesting notification permission:', err);
          setError('Failed to request notification permissions');
        });
      }
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

    const markAsRead = useCallback(async (notificationId) => {
    try {
      await notificationService.markAsRead(notificationId);
      setNotifications(prev => 
        prev.map(n => 
          n._id === notificationId ? { ...n, read: true } : n
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
      setError('Failed to mark notification as read');
    }
  }, []);

  const showBrowserNotification = useCallback((notification) => {
    if (!window.Notification || Notification.permission !== 'granted') {
      console.log('Browser notifications not supported or permission not granted');
      return null;
    }

    const config = getNotificationConfig(notification.type);
    const notificationId = notification._id || `notif-${Date.now()}`;
    
    // Skip showing notification if not applicable (e.g., user is on the same conversation)
    if (!shouldShowNotification(notification)) {
      console.log('Skipping notification display based on context');
      return null;
    }

    const notificationOptions = {
      body: notification.message,
      icon: notification.data?.senderAvatar || '/favicon.ico',
      tag: `notification-${notificationId}`,
      requireInteraction: config.requiresAck,
      silent: false,
      data: {
        ...notification.data,
        notificationId,
        type: notification.type
      },
      badge: '/notification-badge.png',
      timestamp: notification.createdAt ? new Date(notification.createdAt).getTime() : Date.now()
    };

    try {
      const browserNotification = new Notification(
        notification.title || config.title, 
        notificationOptions
      );

      // Handle notification click
      browserNotification.onclick = (event) => {
        event.preventDefault();
        window.focus();
        
        // Handle navigation based on notification type
        if (notification.data?.url) {
          window.location.href = notification.data.url;
        } else {
          switch (notification.type) {
            case NOTIFICATION_TYPES.MESSAGE:
              if (notification.data?.conversationId) {
                window.location.href = `/messages?conversation=${notification.data.conversationId}`;
              }
              break;
              
            case NOTIFICATION_TYPES.MEETING_INVITE:
              if (notification.data?.meetingId) {
                window.location.href = `/meetings/${notification.data.meetingId}`;
              }
              break;
              
            case NOTIFICATION_TYPES.TASK_ASSIGNMENT:
              if (notification.data?.taskId) {
                window.location.href = `/tasks/${notification.data.taskId}`;
              }
              break;
          }
        }
        
        // Mark as read when clicked
        if (notification._id) {
          markAsRead(notification._id);
        }
      };

      return browserNotification;
    } catch (error) {
      console.error('Error showing browser notification:', error);
      return null;
    }
  }, [markAsRead]);

  const handleNewNotification = useCallback((notification) => {
    console.log('📢 New notification received:', notification);
    
    // Skip if this is a duplicate notification
    const isDuplicate = notifications.some(n => n._id === notification._id);
    if (isDuplicate) {
      console.log('Skipping duplicate notification');
      return;
    }
    
    // Add to notifications list
    setNotifications(prev => {
      const updated = [notification, ...prev];
      // Update cache
      localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(updated));
      return updated;
    });
    
    // Update unread count
    setUnreadCount(prev => {
      const newCount = prev + 1;
      localStorage.setItem(STORAGE_KEYS.UNREAD_COUNT, newCount.toString());
      return newCount;
    });
    
    // Show browser notification if applicable
    if (document.visibilityState === 'visible' && document.hasFocus()) {
      console.log('App is in foreground, not showing browser notification');
      // You could show an in-app toast notification here instead
    } else {
      showBrowserNotification(notification);
    }
  }, [notifications, showBrowserNotification]);

  // Set up socket event listeners
  useEffect(() => {
    if (!socket || !user) return;
    
    const handleConnect = () => {
      console.log('📢 Socket connected, setting up notification listeners');
      socket.on('notification:new', handleNewNotification);
    };

    if (socket.connected) {
      handleConnect();
    } else {
      socket.on('connect', handleConnect);
    }

    return () => {
      socket.off('notification:new', handleNewNotification);
      socket.off('connect', handleConnect);
    };
  }, [socket, user, handleNewNotification]);

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

  const loadNotifications = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Try to fetch from server first
      try {
        const data = await notificationService.getNotifications();
        setNotifications(data);
        // Update cache
        localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(data));
      } catch (err) {
        console.error('Error fetching notifications from server:', err);
        // If offline, we'll use the cached version
        if (!isOnline) {
          const cached = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
          if (cached) {
            setNotifications(JSON.parse(cached));
            setError('Using cached notifications - offline mode');
          } else {
            throw new Error('No cached notifications available');
          }
        } else {
          throw err;
        }
      }
    } catch (error) {
      console.error('Error loading notifications:', error);
      setError('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, [isOnline]);

  const loadUnreadCount = useCallback(async () => {
    try {
      setError(null);
      const count = await notificationService.getUnreadCount();
      setUnreadCount(count);
      // Update cache
      localStorage.setItem(STORAGE_KEYS.UNREAD_COUNT, count.toString());
    } catch (error) {
      console.error('Error loading unread count:', error);
      if (!isOnline) {
        const cached = localStorage.getItem(STORAGE_KEYS.UNREAD_COUNT);
        if (cached) {
          setUnreadCount(parseInt(cached, 10));
          setError('Using cached unread count - offline mode');
        }
      } else {
        setError('Failed to load unread count');
      }
    }
  }, [isOnline]);

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
