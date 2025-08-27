import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { messageStatus as messageStatusService, markAsDelivered, markAsRead } from '../services/messageStatus';

const ChatSocketContext = createContext();

export function ChatSocketProvider({ children }) {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState(new Map());
  const [legacyMessageStatus, setLegacyMessageStatus] = useState(new Map());
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
      const userMap = new Map();
      users.forEach(user => userMap.set(user.id, user));
      setOnlineUsers(userMap);
    });

    // Debug: Add specific event listeners for debugging
    s.on('chat:new', (message) => {
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

    // Message delivery status events
    s.on('chat:delivered', ({ messageId, recipients }) => {
      
      try {
        if (typeof markAsDelivered === 'function') {
          markAsDelivered(messageId, recipients);
        } else if (messageStatusService && typeof messageStatusService.markAsDelivered === 'function') {
          messageStatusService.markAsDelivered(messageId, recipients);
        } else {
          console.error('markAsDelivered is not available');
        }
      } catch (error) {
        console.error('Error marking message as delivered:', error);
      }
      
      // Update legacy status for backward compatibility
      setLegacyMessageStatus(prev => {
        const newMap = new Map(prev);
        const status = newMap.get(messageId) || { sent: true, delivered: false, read: false, recipients: [] };
        status.delivered = true;
        status.recipients = [...new Set([...status.recipients, ...recipients])];
        newMap.set(messageId, status);
        return newMap;
      });
    });

    s.on('chat:read', ({ messageId, userId, readBy }) => {
      
      try {
        if (typeof markAsRead === 'function') {
          markAsRead(messageId, readBy || [userId]);
        } else if (messageStatusService && typeof messageStatusService.markAsRead === 'function') {
          messageStatusService.markAsRead(messageId, readBy || [userId]);
        } else {
          console.error('markAsRead is not available');
        }
      } catch (error) {
        console.error('Error marking message as read:', error);
      }
      
      // Update legacy status for backward compatibility
      setLegacyMessageStatus(prev => {
        const newMap = new Map(prev);
        const status = newMap.get(messageId) || { sent: true, delivered: false, read: false, recipients: [] };
        status.read = true;
        newMap.set(messageId, status);
        return newMap;
      });
    });

    // Handle message sent acknowledgments globally
    s.on('chat:sent', ({ success, messageId, tempId }) => {
      console.log('Global chat:sent handler:', { success, messageId, tempId });
      if (success && tempId && messageId) {
        try {
          if (messageStatusService && typeof messageStatusService.markAsSent === 'function') {
            messageStatusService.markAsSent(tempId, messageId);
            console.log('Message marked as sent via global handler:', tempId, '->', messageId);
          }
        } catch (error) {
          console.error('Error in global chat:sent handler:', error);
        }
      }
    });

    // Note: conversation:created, conversation:deleted, and conversation:updated events
    // are handled in MessagesPage component to update UI directly

    // Note: Removed notify-message handler to prevent duplicate notifications
    // All message notifications are now handled through chat:new events in MessagesPage

    setSocket(s);

    // Cleanup function to prevent memory leaks
    return () => {
      
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
      setLegacyMessageStatus(new Map());
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
    return new Promise((resolve, reject) => {
      if (!socket || !data) {
        reject(new Error('Socket not connected or no data provided'));
        return;
      }

      try {
        console.log('Sending message:', data);
        
        // Set up one-time listeners for this message
        const successHandler = (response) => {
          if (response.tempId === data.tempId) {
            console.log('Message sent successfully:', response);
            resolve(response);
            // Clean up listeners
            socket.off('chat:sent', successHandler);
            socket.off('chat:send:error', errorHandler);
          }
        };

        const errorHandler = (error) => {
          // Only handle errors for this specific message
          if (error.tempId === data.tempId) {
            console.error('Message send error:', error);
            reject(new Error(error.message || 'Failed to send message'));
            // Clean up listeners
            socket.off('chat:sent', successHandler);
            socket.off('chat:send:error', errorHandler);
          }
        };

        // Set up listeners before sending
        socket.on('chat:sent', successHandler);
        socket.on('chat:send:error', errorHandler);

        // Send the message
        socket.emit('chat:send', data);

        // Set timeout to prevent hanging promises
        setTimeout(() => {
          socket.off('chat:sent', successHandler);
          socket.off('chat:send:error', errorHandler);
          reject(new Error('Message send timeout'));
        }, 10000); // 10 second timeout

      } catch (error) {
        console.error('Error sending message:', error);
        reject(error);
      }
    });
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
      messageStatus: legacyMessageStatus,
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