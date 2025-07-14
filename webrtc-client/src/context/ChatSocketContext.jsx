import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const ChatSocketContext = createContext();

export function ChatSocketProvider({ children }) {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState(new Map());
  const [messageStatus, setMessageStatus] = useState(new Map());
  const listeners = useRef({});

  useEffect(() => {
    if (!user) return;
    
    const token = localStorage.getItem('token');
    if (!token) return;

    // Use the same URL format as SocketContext
    const backendRoot = import.meta.env.VITE_API_URL.replace(/\/api$/, '');
    const s = io(backendRoot, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 20000,
    });

    s.on('connect', () => {
      console.log('🔔 Chat socket connected - User ID:', user?.id);
      setConnected(true);
      // Get online users when connected
      s.emit('getOnlineUsers');
      // Join all user conversations
      s.emit('joinAllConversations');
      
      // Start heartbeat to keep connection alive
      const heartbeat = setInterval(() => {
        if (s.connected) {
          console.log('🔔 Sending heartbeat to keep connection alive');
          s.emit('heartbeat');
        } else {
          console.log('🔔 Socket disconnected, stopping heartbeat');
          clearInterval(heartbeat);
        }
      }, 30000); // Send heartbeat every 30 seconds
      
      // Store heartbeat interval for cleanup
      s.heartbeatInterval = heartbeat;
    });

    s.on('disconnect', (reason) => {
      console.log('🔔 Chat socket disconnected - User ID:', user?.id, 'Reason:', reason);
      setConnected(false);
      
      // Clear heartbeat interval
      if (s.heartbeatInterval) {
        clearInterval(s.heartbeatInterval);
        s.heartbeatInterval = null;
      }
    });

    s.on('connect_error', (err) => {
      console.error('🔔 Chat socket connection error - User ID:', user?.id, 'Error:', err);
      setConnected(false);
    });

    s.on('reconnect', (attemptNumber) => {
      console.log('🔔 Chat socket reconnected - User ID:', user?.id, 'Attempt:', attemptNumber);
      setConnected(true);
      // Refresh online users after reconnection
      s.emit('getOnlineUsers');
      // Rejoin all conversations after reconnection
      s.emit('joinAllConversations');
    });

    s.on('reconnect_error', (err) => {
      console.error('🔔 Chat socket reconnection error - User ID:', user?.id, 'Error:', err);
    });

    // Online status events
    s.on('user:online', ({ userId, user }) => {
      console.log('User came online:', user?.username);
      setOnlineUsers(prev => new Map(prev).set(userId, user));
    });

    s.on('user:offline', ({ userId }) => {
      console.log('User went offline:', userId);
      setOnlineUsers(prev => {
        const newMap = new Map(prev);
        newMap.delete(userId);
        return newMap;
      });
    });

    s.on('onlineUsers', (users) => {
      console.log('Received online users:', users.length);
      console.log('🔔 Online users list:', users.map(u => ({ id: u.id, username: u.username })));
      const userMap = new Map();
      users.forEach(user => userMap.set(user.id, user));
      setOnlineUsers(userMap);
    });

    // Debug: Add specific event listeners for debugging
    s.on('chat:new', (message) => {
      console.log('🔔 Received chat:new event:', message);
      // Show browser notification if message is not from current user
      if (
        window.Notification &&
        Notification.permission === 'granted' &&
        user &&
        (
          (message.senderId && message.senderId !== user.id) ||
          (typeof message.sender === 'string' && message.sender !== user.id) ||
          (typeof message.sender === 'object' && message.sender && message.sender._id !== user.id)
        )
      ) {
        const title = message.senderName || (message.sender && message.sender.fullName) || 'New Message';
        const body = message.text || (message.file ? 'Sent a file' : 'New message');
        try {
          new Notification(title, { body });
          console.log('[Notification Debug] Notification shown:', title, body);
        } catch (e) {
          console.error('[Notification Debug] Notification error:', e);
        }
      }
    });

    s.on('chat:delivered', (data) => {
      console.log('🔔 Received chat:delivered event:', data);
    });

    s.on('chat:read', (data) => {
      console.log('🔔 Received chat:read event:', data);
    });

    // Message status events
    s.on('chat:delivered', ({ messageId, recipients }) => {
      setMessageStatus(prev => {
        const newMap = new Map(prev);
        const status = newMap.get(messageId) || { sent: true, delivered: false, read: false, recipients: [] };
        status.delivered = true;
        status.recipients = [...new Set([...status.recipients, ...recipients])];
        newMap.set(messageId, status);
        return newMap;
      });
    });

    s.on('chat:read', ({ messageId, userId }) => {
      setMessageStatus(prev => {
        const newMap = new Map(prev);
        const status = newMap.get(messageId) || { sent: true, delivered: false, read: false, recipients: [] };
        status.read = true;
        newMap.set(messageId, status);
        return newMap;
      });
    });

    // Listen for notification events
    s.on('notify-message', (payload) => {
      try {
        console.log('🔔 Received notify-message event:', payload);
        console.log('🔔 Notification permission:', Notification.permission);
        console.log('🔔 Window focused:', document.hasFocus());
        console.log('🔔 Current user ID:', user?.id);
        console.log('🔔 Socket connected:', s.connected);
        
        // Validate payload
        if (!payload || !payload.title) {
          console.warn('❌ Invalid notification payload:', payload);
          return;
        }

        // Check if notifications are supported
        if (!('Notification' in window)) {
          console.warn('❌ Notifications not supported in this browser');
          return;
        }

        // Function to create and show notification
        const showNotification = () => {
          console.log('🔔 Creating browser notification:', payload.title);
          
          // Check if window is focused - some browsers don't show notifications when focused
          const isWindowFocused = document.hasFocus();
          console.log('🔔 Window focused:', isWindowFocused);
          
          // For Safari and some Chrome versions, we might need to handle focused state differently
          if (isWindowFocused) {
            console.log('🔔 Window is focused - notification might not show visually');
          }
          
          try {
            const notification = new Notification(payload.title, {
              body: payload.body || 'New message',
              icon: '/favicon.ico',
              tag: `message-${payload.messageId || 'unknown'}`,
              requireInteraction: false, // Allow auto-close
              silent: false // Play notification sound
            });

            // Handle notification click
            notification.onclick = () => {
              console.log('🔔 Notification clicked');
              window.focus();
              if (payload.conversationId) {
                window.location.href = `/messages?conversation=${payload.conversationId}`;
              }
              notification.close();
            };

            // Handle notification show event
            notification.onshow = () => {
              console.log('🔔 Notification shown successfully');
            };

            // Handle notification error
            notification.onerror = (error) => {
              console.error('🔔 Notification error:', error);
            };

            // Auto-close after 5 seconds
            setTimeout(() => {
              notification.close();
            }, 5000);
            
            console.log('✅ Browser notification created successfully');
            
            // For Safari, try an alternative approach if notification doesn't show
            if (isWindowFocused) {
              console.log('🔔 Window is focused - trying alternative notification method');
              // Try to show a simple alert as fallback for testing
              setTimeout(() => {
                console.log('🔔 If you didn\'t see a notification, check browser settings');
              }, 1000);
              
              // Show a visual indicator in the app for focused windows
              try {
                // Create a temporary visual notification in the app
                const notificationEvent = new CustomEvent('showInAppNotification', {
                  detail: {
                    title: payload.title,
                    body: payload.body,
                    type: 'message',
                    conversationId: payload.conversationId
                  }
                });
                window.dispatchEvent(notificationEvent);
                console.log('🔔 Dispatched in-app notification event');
              } catch (error) {
                console.error('🔔 Error dispatching in-app notification:', error);
              }
            }
          } catch (error) {
            console.error('🔔 Error creating notification:', error);
            // Fallback to in-app notification if browser notification fails
            showInAppNotification(payload);
          }
        };

        // Function to show in-app notification as fallback
        const showInAppNotification = (notificationData) => {
          console.log('🔔 Showing in-app notification as fallback');
          
          const notificationDiv = document.createElement('div');
          notificationDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #2196F3;
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 10000;
            font-family: Arial, sans-serif;
            font-size: 14px;
            max-width: 300px;
            animation: slideIn 0.3s ease-out;
            cursor: pointer;
          `;
          
          notificationDiv.innerHTML = `
            <div style="font-weight: bold; margin-bottom: 5px;">${notificationData.title}</div>
            <div>${notificationData.body}</div>
          `;
          
          // Add CSS animation if not already present
          if (!document.getElementById('notification-animations')) {
            const style = document.createElement('style');
            style.id = 'notification-animations';
            style.textContent = `
              @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
              }
              @keyframes slideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
              }
            `;
            document.head.appendChild(style);
          }
          
          document.body.appendChild(notificationDiv);
          
          // Handle click
          notificationDiv.onclick = () => {
            window.focus();
            if (notificationData.conversationId) {
              window.location.href = `/messages?conversation=${notificationData.conversationId}`;
            }
            notificationDiv.remove();
          };
          
          // Auto-remove after 8 seconds
          setTimeout(() => {
            notificationDiv.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => {
              if (notificationDiv.parentNode) {
                notificationDiv.remove();
              }
            }, 300);
          }, 8000);
        };

        // Check permission and show notification
        if (Notification.permission === 'granted') {
          showNotification();
        } else if (Notification.permission === 'default') {
          // Request permission if not yet requested
          console.log('🔔 Requesting notification permission...');
          Notification.requestPermission().then(permission => {
            console.log('🔔 Notification permission result:', permission);
            if (permission === 'granted') {
              showNotification();
            } else {
              console.warn('❌ Notification permission denied or not granted');
            }
          }).catch(error => {
            console.error('❌ Error requesting notification permission:', error);
          });
        } else {
          console.warn('❌ Notification permission denied by user');
        }
      } catch (error) {
        console.error('❌ Error handling notify-message event:', error);
      }
    });

    setSocket(s);

    return () => {
      s.disconnect();
    };
  }, [user]);

  // Register event listeners
  const on = (event, cb) => {
    if (!socket) return;
    socket.on(event, cb);
    listeners.current[event] = cb;
  };
  
  const off = (event) => {
    if (!socket) return;
    socket.off(event, listeners.current[event]);
    delete listeners.current[event];
  };

  // Chat actions
  const joinConversation = (conversationId) => {
    if (socket && conversationId) {
      try {
        console.log('Joining conversation:', conversationId);
        socket.emit('joinConversation', conversationId);
      } catch (error) {
        console.error('Error joining conversation:', error);
      }
    }
  };
  
  const leaveConversation = (conversationId) => {
    if (socket && conversationId) {
      try {
        console.log('Leaving conversation:', conversationId);
        socket.emit('leaveConversation', conversationId);
      } catch (error) {
        console.error('Error leaving conversation:', error);
      }
    }
  };
  
  const sendMessage = (data) => {
    if (socket && data) {
      try {
        console.log('Sending message:', data);
        socket.emit('chat:send', data);
      } catch (error) {
        console.error('Error sending message:', error);
      }
    }
  };
  
  const editMessage = (data) => {
    if (socket) {
      socket.emit('chat:edit', data);
    }
  };
  
  const deleteMessage = (data) => {
    if (socket) {
      socket.emit('chat:delete', data);
    }
  };
  
  const reactMessage = (data) => {
    if (socket) {
      socket.emit('chat:react', data);
    }
  };
  
  const unreactMessage = (data) => {
    if (socket) {
      socket.emit('chat:unreact', data);
    }
  };
  
  const sendTyping = (data) => {
    if (socket) {
      socket.emit('chat:typing', data);
    }
  };

  const markAsRead = (messageId) => {
    if (socket) {
      socket.emit('chat:read', { messageId });
    }
  };

  return (
    <ChatSocketContext.Provider value={{
      socket,
      connected,
      onlineUsers,
      messageStatus,
      on,
      off,
      joinConversation,
      leaveConversation,
      sendMessage,
      editMessage,
      deleteMessage,
      reactMessage,
      unreactMessage,
      sendTyping,
      markAsRead,
    }}>
      {children}
    </ChatSocketContext.Provider>
  );
}

export function useChatSocket() {
  const context = useContext(ChatSocketContext);
  if (!context) {
    throw new Error('useChatSocket must be used within a ChatSocketProvider');
  }
  return context;
} 