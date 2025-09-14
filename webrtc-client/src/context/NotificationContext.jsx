import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { useChatSocket } from './ChatSocketContext';
import { useCurrentConversation } from './CurrentConversationContext';
import * as notificationService from '../services/notificationService';
import { 
  NOTIFICATION_TYPES, 
  getNotificationConfig, 
  shouldShowNotification 
} from '../utils/notificationTypes';

// Local storage keys - user-specific
const getStorageKeys = (userId) => ({
  NOTIFICATIONS: `notifications_cache_${userId}`,
  UNREAD_COUNT: `unread_count_cache_${userId}`
});

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
  const { currentConversationId, isOnMessagesPage } = useCurrentConversation();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [error, setError] = useState(null);

  // Load notifications from cache on mount - user-specific
  // Clear old notification data on mount to fix stale notifications
  useEffect(() => {
    if (!user?.id) return;
    
    try {
      const STORAGE_KEYS = getStorageKeys(user.id);
      
      // Clear old cached notifications to ensure fresh data
      localStorage.removeItem(STORAGE_KEYS.NOTIFICATIONS);
      localStorage.removeItem(STORAGE_KEYS.UNREAD_COUNT);
      
      // Clear any legacy notification cache keys
      Object.keys(localStorage).forEach(key => {
        if (key.includes('notifications_cache') || key.includes('unread_count_cache')) {
          localStorage.removeItem(key);
        }
      });
      
      console.log('🧹 Cleared notification cache for fresh data');
    } catch (err) {
      console.error('Error clearing notification cache:', err);
    }
  }, [user?.id]);

  // Declare functions early to avoid hoisting issues
  const loadNotifications = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const STORAGE_KEYS = getStorageKeys(user.id);
      
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
  }, [isOnline, user?.id]);

  const loadUnreadCount = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      setError(null);
      const STORAGE_KEYS = getStorageKeys(user.id);
      
      const count = await notificationService.getUnreadCount();
      setUnreadCount(count);
      // Update cache
      localStorage.setItem(STORAGE_KEYS.UNREAD_COUNT, count.toString());
    } catch (error) {
      console.error('Error loading unread count:', error);
      if (!isOnline) {
        const STORAGE_KEYS = getStorageKeys(user.id);
        const cached = localStorage.getItem(STORAGE_KEYS.UNREAD_COUNT);
        if (cached) {
          setUnreadCount(parseInt(cached, 10));
          setError('Using cached unread count - offline mode');
        }
      } else {
        setError('Failed to load unread count');
      }
    }
  }, [isOnline, user?.id]);

  // Load notifications from server when user changes
  useEffect(() => {
    if (user) {
      loadNotifications();
      loadUnreadCount();
    } else {
      // Clear user-specific cache when user logs out
      setNotifications([]);
      setUnreadCount(0);
      // Clear all user caches on logout
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('notifications_cache_') || key.startsWith('unread_count_cache_')) {
          localStorage.removeItem(key);
        }
      });
    }
  }, [user, loadNotifications, loadUnreadCount]);

  // Handle page visibility change - refresh notifications when page becomes visible after being hidden
  useEffect(() => {
    let wasHidden = false;
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        wasHidden = true;
      } else if (document.visibilityState === 'visible' && wasHidden && user && isOnline) {
        // Only refresh notifications when page becomes visible after being hidden (returning from another tab/app)
        // Don't refresh on initial page load or regular navigation
        console.log('🔄 Page became visible after being hidden, refreshing notifications');
        loadNotifications();
        loadUnreadCount();
        wasHidden = false;
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [user, isOnline, loadNotifications, loadUnreadCount]);

  // Handle storage changes across tabs (sync notifications between tabs)
  useEffect(() => {
    if (!user?.id) return;
    
    const handleStorageChange = (event) => {
      const STORAGE_KEYS = getStorageKeys(user.id);
      
      if (event.key === STORAGE_KEYS.NOTIFICATIONS && event.newValue) {
        try {
          const updatedNotifications = JSON.parse(event.newValue);
          setNotifications(updatedNotifications);
        } catch (err) {
          console.error('Error parsing notifications from storage event:', err);
        }
      } else if (event.key === STORAGE_KEYS.UNREAD_COUNT && event.newValue) {
        setUnreadCount(parseInt(event.newValue, 10) || 0);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [user?.id]);

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
          // Permission requested
        }).catch(err => {
          console.error('Error requesting notification permission:', err);
          setError('Failed to request notification permissions');
        });
      }
    }
  }, []);

  // Mark notification as read function
  const markAsRead = useCallback(async (notificationId) => {
    if (!user?.id) return;
    
    try {
      const STORAGE_KEYS = getStorageKeys(user.id);
      
      // Find the notification to get its details
      const notification = (Array.isArray(notifications) ? notifications : []).find(n => n._id === notificationId);
      
      await notificationService.markAsRead(notificationId);
      
      setNotifications(prev => {
        const updated = prev.map(notification => 
          notification._id === notificationId 
            ? { ...notification, read: true }
            : notification
        );
        
        // Update cache with new state
        localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(updated));
        return updated;
      });
      
      setUnreadCount(prev => {
        const newCount = Math.max(0, prev - 1);
        // Update cache with new unread count
        localStorage.setItem(STORAGE_KEYS.UNREAD_COUNT, newCount.toString());
        return newCount;
      });
    } catch (error) {
      console.error('Error marking notification as read:', error);
      setError('Failed to mark notification as read');
    }
  }, [notifications, user?.id]);

  // Show browser notification helper
  const showBrowserNotification = useCallback((notification) => {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
      return null;
    }

    try {
      const config = getNotificationConfig(notification.type);
      const notificationId = notification._id || `notif-${Date.now()}`;
      
      // Skip showing notification if not applicable (e.g., user is on the same conversation)
      if (!shouldShowNotification(notification, currentConversationId, isOnMessagesPage)) {
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
  }, [markAsRead, currentConversationId, isOnMessagesPage]);

  // Handle new notification
  const handleNewNotification = useCallback((notification) => {
    if (!user?.id) return;
    
    // Skip if this is a duplicate notification
    const isDuplicate = (Array.isArray(notifications) ? notifications : []).some(n => n._id === notification._id);
    if (isDuplicate) {
      return;
    }
    
    const STORAGE_KEYS = getStorageKeys(user.id);
    
    // Add to notifications list
    setNotifications(prev => {
      const updated = [notification, ...(Array.isArray(prev) ? prev : [])];
      // Update cache
      localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(updated));
      return updated;
    });
    
    // Update unread count
    if (!notification.read) {
      setUnreadCount(prev => {
        const newCount = prev + 1;
        localStorage.setItem(STORAGE_KEYS.UNREAD_COUNT, newCount.toString());
        return newCount;
      });
    }
    
    // Show browser notification for important notification types (always show for conversation events)
    const alwaysShowTypes = ['conversation_created', 'community_created', 'conversation_deleted'];
    const shouldShowBrowser = alwaysShowTypes.includes(notification.type) || 
                             (document.visibilityState !== 'visible' || !document.hasFocus());
    
    if (shouldShowBrowser) {
      showBrowserNotification(notification);
    }
  }, [notifications, showBrowserNotification, user?.id]);

  // Setup socket event listeners
  const setupListeners = useCallback(() => {
    if (!socket) {
      return () => {}; // Return empty cleanup function
    }
    
    const handleConnect = () => {
      if (socket) {
        socket.on('notification:new', handleNewNotification);
      }
    };

    const handleDisconnect = (reason) => {
      // Socket disconnected
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
    
    // Cleanup function
    return () => {
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
      return () => {};
    }

    const cleanup = setupListeners();
    return cleanup;
  }, [socket, user, setupListeners]);

  const markAllAsRead = async () => {
    if (!user?.id) return;
    
    try {
      const STORAGE_KEYS = getStorageKeys(user.id);
      
      await notificationService.markAllAsRead();
      setNotifications(prev => {
        const updated = prev.map(notification => ({ ...notification, read: true }));
        // Update cache
        localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(updated));
        return updated;
      });
      setUnreadCount(0);
      // Update cache
      localStorage.setItem(STORAGE_KEYS.UNREAD_COUNT, '0');
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const deleteNotification = async (notificationId) => {
    if (!user?.id) return;
    
    try {
      const STORAGE_KEYS = getStorageKeys(user.id);
      
      await notificationService.deleteNotification(notificationId);
      
      // Update unread count if the deleted notification was unread
      const deletedNotification = notifications.find(n => n._id === notificationId);
      
      setNotifications(prev => {
        const updated = prev.filter(notification => notification._id !== notificationId);
        // Update cache
        localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(updated));
        return updated;
      });
      
      if (deletedNotification && !deletedNotification.read) {
        setUnreadCount(prev => {
          const newCount = Math.max(0, prev - 1);
          // Update cache
          localStorage.setItem(STORAGE_KEYS.UNREAD_COUNT, newCount.toString());
          return newCount;
        });
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const refreshNotifications = () => {
    loadNotifications();
    loadUnreadCount();
  };

  const clearNotificationsForConversation = useCallback((conversationId) => {
    if (!conversationId) return;
    
    // Find ALL notifications to see what we're working with
    const allUnreadNotifs = (Array.isArray(notifications) ? notifications : []).filter(notif => !notif.read);
    
    // Find message notifications for this conversation
    const conversationNotifications = allUnreadNotifs.filter(notif => 
      notif.type === 'message' && 
      notif.data?.conversationId === conversationId
    );
    
    // Mark them as read
    conversationNotifications.forEach(async (notif) => {
      if (notif._id) {
        try {
          await markAsRead(notif._id);
        } catch (error) {
          console.error('Error marking conversation notification as read:', error);
        }
      }
    });
  }, [notifications, markAsRead]);

  const value = {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refreshNotifications,
    clearNotificationsForConversation
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};
