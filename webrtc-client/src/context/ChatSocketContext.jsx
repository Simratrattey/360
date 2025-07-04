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
    });

    s.on('connect', () => {
      setConnected(true);
      // Get online users when connected
      s.emit('getOnlineUsers');
    });

    s.on('disconnect', () => {
      setConnected(false);
    });

    s.on('connect_error', (err) => {
      console.error('Chat socket connection error:', err);
    });

    // Online status events
    s.on('user:online', ({ userId, user }) => {
      setOnlineUsers(prev => new Map(prev).set(userId, user));
    });

    s.on('user:offline', ({ userId }) => {
      setOnlineUsers(prev => {
        const newMap = new Map(prev);
        newMap.delete(userId);
        return newMap;
      });
    });

    s.on('onlineUsers', (users) => {
      const userMap = new Map();
      users.forEach(user => userMap.set(user.id, user));
      setOnlineUsers(userMap);
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
    if (socket) {
      socket.emit('joinConversation', conversationId);
    }
  };
  
  const leaveConversation = (conversationId) => {
    if (socket) {
      socket.emit('leaveConversation', conversationId);
    }
  };
  
  const sendMessage = (data) => {
    if (socket) {
      socket.emit('chat:send', data);
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