import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { useSocket } from './SocketContext';
import * as notificationService from '../services/notificationService';

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
  const socket = useSocket();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  // Load notifications on mount and when user changes
  useEffect(() => {
    if (user) {
      loadNotifications();
      loadUnreadCount();
    } else {
      setNotifications([]);
      setUnreadCount(0);
    }
  }, [user]);

  // Listen for real-time notifications
  useEffect(() => {
    if (!socket || !user) return;

    const handleNewNotification = (notification) => {
<<<<<<< HEAD
=======
      console.log('Received notification:new event:', notification);
>>>>>>> main
      setNotifications(prev => [notification, ...prev]);
      setUnreadCount(prev => prev + 1);
      
      // Show browser notification if permission is granted
<<<<<<< HEAD
      if (window.Notification && Notification.permission === 'granted') {
        new Notification(notification.title, {
          body: notification.message,
          icon: '/favicon.ico'
        });
=======
      if (window.Notification) {
        if (Notification.permission === 'granted') {
          try {
            const browserNotification = new Notification(notification.title, {
              body: notification.message,
              icon: '/favicon.ico'
            });
            
            // Handle notification click
            browserNotification.onclick = () => {
              window.focus();
              browserNotification.close();
            };
            
            // Auto-close after 5 seconds
            setTimeout(() => {
              browserNotification.close();
            }, 5000);
          } catch (error) {
            console.error('Error creating browser notification:', error);
          }
        } else if (Notification.permission === 'default') {
          // Request permission if not yet requested
          Notification.requestPermission().then(permission => {
            console.log('Notification permission result:', permission);
            if (permission === 'granted') {
              try {
                const browserNotification = new Notification(notification.title, {
                  body: notification.message,
                  icon: '/favicon.ico'
                });
                
                browserNotification.onclick = () => {
                  window.focus();
                  browserNotification.close();
                };
                
                setTimeout(() => {
                  browserNotification.close();
                }, 5000);
              } catch (error) {
                console.error('Error creating browser notification after permission grant:', error);
              }
            }
          }).catch(error => {
            console.error('Error requesting notification permission:', error);
          });
        } else {
          console.warn('Notification permission denied by user');
        }
      } else {
        console.warn('Notification API not supported in this browser');
>>>>>>> main
      }
    };

    if (socket?.on) {
      socket.on('notification:new', handleNewNotification);
    }

    return () => {
      if (socket?.off) {
        socket.off('notification:new', handleNewNotification);
      }
    };
  }, [socket, user]);

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