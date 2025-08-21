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

    // Debug: Listen for conversation events
    s.on('conversation:created', (data) => {
      console.log('🔔 [DEBUG] Received conversation:created event:', data);
    });
    
    s.on('conversation:deleted', (data) => {
      console.log('🔔 [DEBUG] Received conversation:deleted event:', data);
    });
    
    s.on('conversation:updated', (data) => {
      console.log('🔔 [DEBUG] Received conversation:updated event:', data);
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

    // Note: Removed notify-message handler to prevent duplicate notifications
    // All message notifications are now handled through chat:new events in MessagesPage

    setSocket(s);

    // Cleanup function to prevent memory leaks
    return () => {
      console.log('🔔 Cleaning up socket connection and listeners');
      
      // Clear heartbeat interval if exists
      if (s.heartbeatInterval) {
        clearInterval(s.heartbeatInterval);
        s.heartbeatInterval = null;
      }
      
      // Remove all event listeners to prevent memory leaks
      s.removeAllListeners();
      
      // Clear listeners ref
      listeners.current = {};
      
      // Disconnect socket
      s.disconnect();
      
      // Reset state
      setSocket(null);
      setConnected(false);
      setOnlineUsers(new Map());
      setMessageStatus(new Map());
    };
  }, [user]);

  // Register event listeners with proper cleanup tracking
  const on = (event, cb) => {
    if (!socket) return;
    
    // Remove existing listener if present to prevent duplicates
    if (listeners.current[event]) {
      socket.off(event, listeners.current[event]);
    }
    
    socket.on(event, cb);
    listeners.current[event] = cb;
  };
  
  const off = (event) => {
    if (!socket) return;
    
    if (listeners.current[event]) {
      socket.off(event, listeners.current[event]);
      delete listeners.current[event];
    }
  };

  // Cleanup function to remove all custom listeners
  useEffect(() => {
    return () => {
      // Cleanup all registered listeners on component unmount
      Object.keys(listeners.current).forEach(event => {
        if (socket) {
          socket.off(event, listeners.current[event]);
        }
      });
      listeners.current = {};
    };
  }, [socket]);

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

  const createConversation = (data) => {
    if (socket) {
      socket.emit('conversation:create', data);
    }
  };

  const deleteConversation = (data) => {
    if (socket) {
      socket.emit('conversation:delete', data);
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
      createConversation,
      deleteConversation,
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