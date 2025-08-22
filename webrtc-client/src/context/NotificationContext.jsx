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

  // Mark notification as read function
  const markAsRead = useCallback(async (notificationId) => {
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
      setError('Failed to mark notification as read');
    }
  }, []);

  // Show browser notification helper
  const showBrowserNotification = useCallback((notification) => {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
      console.log('📢 Browser notifications not supported or permission not granted');
      return null;
    }

    try {
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

      // Auto-close after 5 seconds
      setTimeout(() => {
        browserNotification.close();
      }, 5000);

      return browserNotification;
    } catch (error) {
      console.error('Error showing browser notification:', error);
      return null;
    }
  }, [markAsRead]);

  // Handle new notification
  const handleNewNotification = useCallback((notification) => {
    console.log('📢 New notification received:', notification);
    
    // Skip if this is a duplicate notification
    const isDuplicate = (notifications || []).some(n => n._id === notification._id);
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
    
    // Note: Unread count is managed by the Layout component through API calls
    // to avoid double counting with the messages page unread logic
    
    // Show browser notification for important notification types (always show for conversation events)
    const alwaysShowTypes = ['conversation_created', 'community_created', 'conversation_deleted'];
    const shouldShowBrowser = alwaysShowTypes.includes(notification.type) || 
                             (document.visibilityState !== 'visible' || !document.hasFocus());
    
    if (shouldShowBrowser) {
      console.log('📢 Showing browser notification for type:', notification.type);
      showBrowserNotification(notification);
    } else {
      console.log('📢 App is in foreground, browser notification skipped for type:', notification.type);
    }
  }, [notifications, showBrowserNotification]);

  // Setup socket event listeners
  const setupListeners = useCallback(() => {
    if (!socket) {
      console.log('📢 Socket not available for notification listeners');
      return () => {}; // Return empty cleanup function
    }

    console.log('📢 Setting up notification listeners');
    
    const handleConnect = () => {
      console.log('📢 Socket connected, setting up notification listeners');
      if (socket) {
        socket.on('notification:new', handleNewNotification);
      }
    };

    const handleDisconnect = (reason) => {
      console.log('📢 Socket disconnected:', reason);
    };
    
    const handleConnectError = (error) => {
      console.error('📢 Socket connection error:', error);
    };

    // Set up event listeners
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);
    
    // Set up initial connection if already connected
    if (socket.connected) {
      handleConnect();
    }
    
    console.log('📢 Current socket event listeners:', {
      notification: socket.hasListeners('notification:new'),
      connect: socket.hasListeners('connect'),
      disconnect: socket.hasListeners('disconnect'),
      connect_error: socket.hasListeners('connect_error')
    });

    // Cleanup function
    return () => {
      console.log('📢 Cleaning up notification listeners');
      if (socket) {
        socket.off('notification:new', handleNewNotification);
        socket.off('connect', handleConnect);
        socket.off('disconnect', handleDisconnect);
        socket.off('connect_error', handleConnectError);
      }
    };
  }, [socket, handleNewNotification]);

  // Initialize socket listeners when socket or user changes
  useEffect(() => {
    if (!socket || !user) {
      console.log('📢 Socket or user not ready for notification listeners');
      return () => {};
    }

    const cleanup = setupListeners();
    return cleanup;
  }, [socket, user, setupListeners]);

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
