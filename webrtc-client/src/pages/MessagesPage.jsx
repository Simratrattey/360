import React, { useState, useEffect, useRef, useMemo } from 'react';
import { User, Users, Hash, Plus, Search, MoreVertical, Settings, Star, Trash2, Send, Paperclip, Smile, MessageCircle, X, Check } from 'lucide-react';
import SidebarConversation from '../components/messages/SidebarConversation';
import ChatWindow from '../components/messages/ChatWindow';
import ChatInput from '../components/messages/ChatInput';
import ChatSearch from '../components/messages/ChatSearch';
import CreateConversationModal from '../components/messages/CreateConversationModal';
import UserSelectionModal from '../components/messages/UserSelectionModal';
import ConversationSettingsModal from '../components/messages/ConversationSettingsModal';
import ConversationDetailsModal from '../components/messages/ConversationDetailsModal';
import * as conversationAPI from '../api/conversationService';
import * as messageAPI from '../api/messageService';
import { useAuth } from '../context/AuthContext';
import { useChatSocket } from '../context/ChatSocketContext';
import { useMediaQuery } from 'react-responsive';
import { useMessageNotifications } from '../components/Layout';
import ConnectionStatus from '../components/ConnectionStatus';


// Placeholder for emoji list
const emojiList = ['👍', '❤️', '😂', '😮', '😢', '😡', '👏', '🙏', '🔥', '💯', '✨', '🎉', '🤔', '😎', '🥳', '😴'];

function getInitials(name) {
  if (!name || typeof name !== 'string') {
    return 'U';
  }
  
  const result = name.split(' ').map(n => n[0]).join('').toUpperCase();
  return result;
}

function getConversationDisplayName(conversation, currentUserId) {
  try {
    if (!conversation) {
      return 'Unknown';
    }
    
    // If conversation has a name (group/community), use it
    if (conversation.name) {
      return String(conversation.name);
    }
    
    // For DMs, show the other person's name
    if (conversation.type === 'dm' && Array.isArray(conversation.members)) {
      const otherMember = conversation.members.find(m => m._id !== currentUserId);
      
      if (otherMember && typeof otherMember === 'object') {
        // Ensure we're working with a user object and extract string values
        const fullName = otherMember.fullName;
        const username = otherMember.username;
        const email = otherMember.email;
        
        const displayName = fullName || username || email || 'Unknown User';
        
        // Ensure we return a string
        return String(displayName);
      } else {
        return 'Unknown User';
      }
    }
    
    // Fallback
    return 'Unknown Conversation';
  } catch (error) {
    console.error('Error in MessagesPage getConversationDisplayName:', error);
    return 'Error';
  }
}

function groupMessagesByDate(messages) {
  return messages.reduce((acc, msg) => {
    const date = new Date(msg.createdAt || msg.timestamp || Date.now()).toLocaleDateString();
    if (!acc[date]) acc[date] = [];
    acc[date].push(msg);
    return acc;
  }, {});
}

export default function MessagesPage() {
  const { user } = useAuth();
  const chatSocket = useChatSocket();
  const [allConversations, setAllConversations] = useState([]);
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  // Track whether messages are currently being fetched. When true, the chat
  // window will display a loading spinner. Messages remain an array to avoid
  // errors in event handlers that spread or map over the messages array.
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  const [showUserModal, setShowUserModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [starred, setStarred] = useState([]);
  const [typing, setTyping] = useState({});
  const [editMsgId, setEditMsgId] = useState(null);
  const [editInput, setEditInput] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [reactions, setReactions] = useState({});
  const [replyTo, setReplyTo] = useState(null);
  const [notification, setNotification] = useState(null);
  const windowFocused = useRef(true);
  const isMobile = useMediaQuery({ maxWidth: 767 });
  const [sidebarOpen, setSidebarOpen] = useState(true); // for mobile
  const [messagesCache, setMessagesCache] = useState({});
  const [isSending, setIsSending] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const { refreshUnreadCount } = useMessageNotifications();
  // Search functionality
  const [showSearch, setShowSearch] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [currentSearchResult, setCurrentSearchResult] = useState(0);
  const [totalSearchResults, setTotalSearchResults] = useState(0);
  const [searchFilters, setSearchFilters] = useState(null);
  const [reactionInProgress, setReactionInProgress] = useState(false);

  /**
   * Move a conversation to the top of its section in the sidebar.
   * This helper updates the conversation's `lastMessage` and `lastMessageAt` fields
   * and reorders the items array for the corresponding section so that the most 
   * recently active conversation appears first.
   *
   * @param {string} convId - The ID of the conversation to move.
   * @param {object} lastMessage - The last message object with text, file, createdAt, senderName.
   * @param {string} time - ISO timestamp of when the activity occurred.
   */
  const moveConversationToTop = (convId, lastMessage, time) => {
    setAllConversations(prevSections => {
      return prevSections.map(section => {
        const idx = section.items.findIndex(c => c._id === convId);
        if (idx === -1) return section;
        const newItems = [...section.items];
        const [convItem] = newItems.splice(idx, 1);
        const updatedConv = {
          ...convItem,
          lastMessage: lastMessage,
          lastMessageAt: time,
        };
        // Prepend updated conversation
        return { ...section, items: [updatedConv, ...newItems] };
      });
    });
  };

  // Request notification permission on mount
  useEffect(() => {
    if (window.Notification && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    // Track window focus
    const onFocus = () => (windowFocused.current = true);
    const onBlur = () => (windowFocused.current = false);
    window.addEventListener('focus', onFocus);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  // Fetch conversations on mount (REST)
  useEffect(() => {
    fetchConversations();
  }, []);

  // When mounting on mobile, show sidebar first
  useEffect(() => {
    if (isMobile) {
      setSidebarOpen(true);
      setSelected(null);
    }
  }, [isMobile]);

  // Add useEffect to auto-select conversation from URL param
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const conversationId = urlParams.get('conversation');
    if (conversationId && allConversations.length > 0) {
      const allItems = allConversations.flatMap(section => section.items);
      const target = allItems.find(c => c._id === conversationId);
      if (target) {
        setSelected(target);
        if (isMobile) setSidebarOpen(false);
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, [allConversations, isMobile]);

  const fetchConversations = async () => {
    try {
      const res = await conversationAPI.getConversations();
      const conversations = res.data.conversations || res.data || [];
      
      // Sort conversations by lastMessageAt within each type (backend already sorts overall, but we maintain per-section sorting)
      const sortByLastMessage = (a, b) => {
        const dateA = new Date(a.lastMessageAt || a.createdAt);
        const dateB = new Date(b.lastMessageAt || b.createdAt);
        return dateB - dateA;
      };
      
      setAllConversations([
        { section: 'Direct Messages', icon: User, items: conversations.filter(c => c.type === 'dm').sort(sortByLastMessage) },
        { section: 'Groups', icon: Users, items: conversations.filter(c => c.type === 'group').sort(sortByLastMessage) },
        { section: 'Communities', icon: Hash, items: conversations.filter(c => c.type === 'community').sort(sortByLastMessage) },
      ]);

      // Prefetch the first few messages for a subset of conversations to improve perceived loading times.
      // We limit the number of conversations prefetched per section to avoid overwhelming the server.
      const PREFETCH_CONVERSATIONS_PER_SECTION = 3;
      const PREFETCH_MESSAGES_LIMIT = 10;
      const conversationsToPrefetch = conversations.slice(0, PREFETCH_CONVERSATIONS_PER_SECTION);
      
      // Kick off prefetch asynchronously without blocking the conversation list rendering.
      conversationsToPrefetch.forEach(conv => {
        if (!conv || !conv._id) return;
        // Only prefetch if not already cached.
        if (!messagesCache[conv._id]) {
          messageAPI.getMessages(conv._id, { limit: PREFETCH_MESSAGES_LIMIT })
            .then(res => {
              const msgs = res.data?.messages || res.data || [];
              setMessagesCache(prev => ({ ...prev, [conv._id]: msgs }));
            })
            .catch(err => {
              // Silently fail on prefetch errors to avoid interrupting user flow.
              console.warn(`Prefetch messages for conversation ${conv._id} failed:`, err);
            });
        }
      });
      
      // Auto-select first conversation if none is selected
      const first = conversations[0];
      if (first && !selected) {
        handleSelect(first);
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
    }
  };

  // Fetch messages when a conversation is selected (REST, then join room)
  useEffect(() => {
    if (selected && selected._id) {
      const convId = selected._id;
      
      if (messagesCache[convId]) {
        // Messages are in cache, use them and indicate loading has finished
        setMessages(messagesCache[convId]);
        setMessagesLoading(false);
      } else {
        // No cache; start loading and fetch messages
        setMessagesLoading(true);
        messageAPI.getMessages(convId)
          .then(res => {
            const messages = res.data.messages || [];
            setMessages(messages);
            setMessagesCache(prev => ({
              ...prev,
              [convId]: messages
            }));
          })
          .catch(error => {
            console.error('Error fetching messages:', error);
            setMessages([]);
          })
          .finally(() => {
            setMessagesLoading(false);
          });
      }
      
      // Join the conversation room for real-time updates
      chatSocket.joinConversation(convId);
      
      // Cleanup function to leave the conversation when component unmounts or conversation changes
      return () => chatSocket.leaveConversation(convId);
    } else {
      // No conversation selected, reset messages and loading state
      setMessages([]);
      setMessagesLoading(false);
    }
  }, [selected]);

  // Real-time event listeners
  useEffect(() => {
    if (!chatSocket.socket) return;
    // New message
    chatSocket.on('chat:new', msg => {
      console.log('Received new message:', msg); // Debug log
      
      // Update cache for the conversation that received the message
      setMessagesCache(prevCache => {
        const conversationMessages = prevCache[msg.conversationId] || [];
        
        // Check if message already exists in cache
        const exists = conversationMessages.some(m => m._id === msg._id);
        if (exists) return prevCache;
        
        // Remove any pending optimistic messages and add the real message
        const filtered = conversationMessages.filter(m => {
          if (!m.pending) return true;
          return !(
            m.conversationId === msg.conversationId &&
            m.senderId === msg.senderId
          );
        });
        
        return {
          ...prevCache,
          [msg.conversationId]: [...filtered, { ...msg, sending: false }]
        };
      });
      
      // Only update the displayed messages if this message belongs to the currently selected conversation
      if (selected && selected._id === msg.conversationId) {
        setMessages(prev => {
          // Remove any pending optimistic messages
          let filtered = prev.filter(m => {
            if (!m.pending) return true;
            return !(
              m.conversationId === msg.conversationId &&
              m.senderId === msg.senderId
            );
          });
          
          // Check if message already exists to prevent duplicates
          const exists = filtered.some(m => m._id === msg._id);
          if (exists) return filtered;
          
          // Add the real message
          return [...filtered, { ...msg, sending: false }];
        });
      }
      
      // Show browser notification if message is not from current user
      if (
        window.Notification &&
        Notification.permission === 'granted' &&
        msg.senderId !== user.id
      ) {
        const title = msg.senderName || 'New Message';
        const body = msg.text || (msg.file ? 'Sent a file' : 'New message');
        new Notification(title, { body });
      }
      
      // Move the corresponding conversation to the top using the latest message
      moveConversationToTop(
        msg.conversationId,
        {
          text: msg.text,
          file: msg.file,
          createdAt: msg.createdAt || new Date().toISOString(),
          senderName: msg.senderName || (msg.sender && msg.sender.fullName) || 'Unknown'
        },
        msg.createdAt || new Date().toISOString()
      );
    });

    // Edit message
    chatSocket.on('chat:edit', ({ messageId, text, conversationId }) => {
      setMessages(prev => prev.map(m => m._id === messageId ? { ...m, text, edited: true } : m));
      
      // Move conversation to top when message is edited
      if (conversationId) {
        const editedMessage = messages.find(m => m._id === messageId);
        if (editedMessage) {
          moveConversationToTop(
            conversationId,
            {
              text: text,
              file: editedMessage.file,
              createdAt: editedMessage.createdAt,
              senderName: editedMessage.senderName || (editedMessage.sender && editedMessage.sender.fullName) || 'Unknown'
            },
            new Date().toISOString()
          );
        }
      }
    });
    // Delete message
    chatSocket.on('chat:delete', ({ messageId }) => {
      setMessages(prev => prev.filter(m => m._id !== messageId));
    });
    // React to message
    chatSocket.on('chat:react', ({ messageId, emoji, userId }) => {
      setMessages(prev => prev.map(m => m._id === messageId ? { ...m, reactions: [...(m.reactions || []), { user: userId, emoji }] } : m));
      setReactions(prev => ({
        ...prev,
        [messageId]: [...(prev[messageId] || []), { user: userId, emoji }]
      }));
    });
    // Unreact
    chatSocket.on('chat:unreact', ({ messageId, emoji, userId }) => {
      setMessages(prev => prev.map(m => m._id === messageId ? { ...m, reactions: (m.reactions || []).filter(r => !(r.user === userId && r.emoji === emoji)) } : m));
      setReactions(prev => ({
        ...prev,
        [messageId]: (prev[messageId] || []).filter(r => !(r.user === userId && r.emoji === emoji))
      }));
    });
    // Typing
    chatSocket.on('chat:typing', ({ userId: typingUserId, conversationId, typing }) => {
      if (typingUserId !== user.id && conversationId) {
        setTyping(prev => ({
          ...prev,
          [conversationId]: {
            ...prev[conversationId],
            [typingUserId]: typing
          }
        }));
      }
    });

    // Conversation administration events
    chatSocket.on('conversation:memberAdded', ({ conversationId, userId, addedBy }) => {
      console.log('🔔 Member added to conversation:', { conversationId, userId, addedBy });
      if (selected && selected._id === conversationId) {
        handleConversationUpdated();
      }
      fetchConversations(); // Update sidebar
    });

    chatSocket.on('conversation:memberRemoved', ({ conversationId, userId, removedBy }) => {
      console.log('🔔 Member removed from conversation:', { conversationId, userId, removedBy });
      if (selected && selected._id === conversationId) {
        handleConversationUpdated();
      }
      fetchConversations(); // Update sidebar
    });

    chatSocket.on('conversation:adminAdded', ({ conversationId, userId, adminId }) => {
      console.log('🔔 Admin added to conversation:', { conversationId, userId, adminId });
      if (selected && selected._id === conversationId) {
        handleConversationUpdated();
      }
      fetchConversations(); // Update sidebar
    });

    chatSocket.on('conversation:adminRemoved', ({ conversationId, userId, adminId }) => {
      console.log('🔔 Admin removed from conversation:', { conversationId, userId, adminId });
      if (selected && selected._id === conversationId) {
        handleConversationUpdated();
      }
      fetchConversations(); // Update sidebar
    });

    return () => {
      chatSocket.off('chat:new');
      chatSocket.off('chat:edit');
      chatSocket.off('chat:delete');
      chatSocket.off('chat:react');
      chatSocket.off('chat:unreact');
      chatSocket.off('chat:typing');
      chatSocket.off('conversation:memberAdded');
      chatSocket.off('conversation:memberRemoved');
      chatSocket.off('conversation:adminAdded');
      chatSocket.off('conversation:adminRemoved');
    };
  }, [chatSocket.socket, selected, user.id]);

  // Mark messages as read when conversation is selected
  useEffect(() => {
    if (selected && messages.length > 0) {
      // Mark all messages as read
      messages.forEach(msg => {
        if (msg.sender !== user.id) {
          chatSocket.markAsRead(msg._id);
        }
      });
      
      // Mark conversation as read on backend
      conversationAPI.markConversationAsRead(selected._id)
        .then(() => {
          // Refresh unread count in header
          if (refreshUnreadCount) refreshUnreadCount();
          
          // Set unread to 0 for this conversation in the sidebar
          setAllConversations(prev =>
            prev.map(section => ({
              ...section,
              items: section.items.map(conv =>
                conv._id === selected._id ? { ...conv, unread: 0 } : conv
              ),
            }))
          );
        })
        .catch(error => {
          console.error('Error marking conversation as read:', error);
        });
    }
  }, [selected, messages, user.id, chatSocket, refreshUnreadCount]);

  // Memoize conversation filtering to avoid expensive recalculations on each render.
  const filteredConversations = useMemo(() => {
    return allConversations.map(section => {
      const filteredItems = section.items.filter(conv => {
        try {
          const displayName = getConversationDisplayName(conv, user?.id);
          
          const memberNames = Array.isArray(conv.members)
            ? conv.members.map(m => {
                if (typeof m === 'object' && m !== null) {
                  const name = m.fullName || m.username || m.email || '';
                  return String(name);
                }
                return '';
              }).join(' ')
            : '';
          
          const result = search
            ? displayName.toLowerCase().includes(search.toLowerCase()) || 
              memberNames.toLowerCase().includes(search.toLowerCase())
            : true;
          
          return result;
        } catch (error) {
          console.error('Error in conversation filter:', error);
          return false;
        }
      });
      
      return {
        ...section,
        items: filteredItems,
      };
    });
  }, [allConversations, search, user?.id]);

  const handleSelect = (conv) => {
    if (!conv || !conv._id) {
      return;
    }
    setSelected(conv);
    setReplyTo(null);
    setShowEmojiPicker(false);
    if (isMobile) setSidebarOpen(false);
    
    // Mark conversation as read immediately
    if (conv.unread > 0) {
      conversationAPI.markConversationAsRead(conv._id)
        .then(() => {
          // Refresh unread count in header
          if (refreshUnreadCount) refreshUnreadCount();
          
          // Set unread to 0 for this conversation in the sidebar
          setAllConversations(prev =>
            prev.map(section => ({
              ...section,
              items: section.items.map(c =>
                c._id === conv._id ? { ...c, unread: 0 } : c
              ),
            }))
          );
        })
        .catch(error => {
          console.error('Error marking conversation as read:', error);
        });
    }
  };

  // Send a new message. This version implements an "optimistic" update so the message
  // Enhanced handleSend with optimistic UI and loading states
  const handleSend = async () => {
    // Check if a conversation is selected and has an _id
    if (!selected || !selected._id) {
      return;
    }

    // Check if there's input to send
    if (!input.trim() && !uploadFile) {
      return;
    }

    // Prevent multiple sends
    if (isSending) {
      return;
    }

    setIsSending(true);
    setUploadProgress(0);

    try {
      let fileMeta = null;
      
      // Handle file upload with progress tracking
      if (uploadFile) {
        try {
          const res = await messageAPI.uploadMessageFile(uploadFile);
          fileMeta = res.data;
          setUploadProgress(100);
        } catch (uploadError) {
          console.error('File upload failed:', uploadError);
          setNotification({
            message: 'Failed to upload file. Please try again.'
          });
          setTimeout(() => setNotification(null), 3000);
          setIsSending(false);
          return;
        }
      }
      
      // Build an optimistic message object with loading state
      const tempId = `temp-${Date.now()}`;
      const tempMsg = {
        _id: tempId,
        conversationId: selected._id,
        senderId: user?.id,
        senderName: user?.fullName || user?.username || '',
        text: input.trim(),
        file: fileMeta,
        replyTo: replyTo ? replyTo._id : undefined,
        createdAt: new Date().toISOString(),
        pending: true,
        sending: true, // Mark as currently sending
      };
      
      // Add optimistic message to UI immediately
      setMessages(prev => [...prev, tempMsg]);
      
      // Update message cache for this conversation
      setMessagesCache(cache => {
        const convMsgs = cache[selected._id] || [];
        return {
          ...cache,
          [selected._id]: [...convMsgs, tempMsg],
        };
      });
      
      // Optimistically move conversation to top
      moveConversationToTop(
        selected._id,
        input.trim() || (uploadFile ? 'Sent a file' : ''),
        new Date().toISOString()
      );
      
      // Emit the actual message to the server
      chatSocket.sendMessage({
        conversationId: selected._id,
        text: input.trim(),
        file: fileMeta,
        replyTo: replyTo ? replyTo._id : undefined,
      });
      
      // Reset input fields immediately for better UX
      setInput('');
      setUploadFile(null);
      setReplyTo(null);
      setShowEmojiPicker(false);
      
      // Show success notification for file uploads
      if (uploadFile) {
        setNotification({
          message: 'File sent successfully!'
        });
        setTimeout(() => setNotification(null), 2000);
      }
      
    } catch (error) {
      console.error('Error sending message:', error);
      setNotification({
        message: 'Failed to send message. Please try again.'
      });
      setTimeout(() => setNotification(null), 3000);
      
      // Remove the optimistic message on error
      setMessages(prev => prev.filter(msg => !msg.sending));
    } finally {
      setIsSending(false);
      setUploadProgress(0);
    }
  };

  const handleEdit = (msg) => {
    setEditMsgId(msg._id || msg.id);
    setEditInput(msg.text);
  };

  const handleEditSave = async () => {
    chatSocket.editMessage({ messageId: editMsgId, text: editInput });
    setEditMsgId(null);
    setEditInput('');
  };

  const handleEditCancel = () => {
    setEditMsgId(null);
    setEditInput('');
  };

  const handleDelete = async (msgId) => {
    chatSocket.deleteMessage({ messageId: msgId });
  };

  const handleStar = (convId) => {
    setStarred(prev => prev.includes(convId) ? prev.filter(id => id !== convId) : [...prev, convId]);
    // Optionally: persist star via API
  };

  const handleDeleteConversation = async (conv) => {
    if (!conv || !conv._id) return;
    
    try {
      await conversationAPI.deleteConversation(conv._id);
      
      // Remove from conversations list
      setAllConversations(prev => prev.map(section => ({
        ...section,
        items: section.items.filter(c => c._id !== conv._id)
      })));
      
      // If this was the selected conversation, clear selection
      if (selected && selected._id === conv._id) {
        setSelected(null);
        setMessages([]);
      }
      // Refresh unread count in header
      if (refreshUnreadCount) refreshUnreadCount();
      setNotification({
        message: 'Conversation deleted successfully!'
      });
      setNotification(null);
    } catch (error) {
      console.error('Error deleting conversation:', error);
      setNotification({
        message: error.response?.data?.message || 'Failed to delete conversation'
      });
      setNotification(null);
    }
  };

  const handleConversationCreated = (newConversation) => {
    // Add to conversations list
    setAllConversations(prev => {
      const newSections = [...prev];
      const sectionIndex = newSections.findIndex(s => s.section === 
        (newConversation.type === 'dm' ? 'Direct Messages' : 
         newConversation.type === 'group' ? 'Groups' : 'Communities'));
      
      if (sectionIndex !== -1) {
        newSections[sectionIndex].items.push(newConversation);
      }
      return newSections;
    });
    
    // Select the new conversation
    handleSelect(newConversation);
    
    setNotification({
      message: 'Conversation created successfully!'
    });
    setNotification(null);
  };

  const handleConversationUpdated = async () => {
    // Refresh conversations list
    fetchConversations();
    
    // If there's a selected conversation, refetch its details to update the UI
    if (selected && selected._id) {
      try {
        const response = await conversationAPI.getConversation(selected._id);
        if (response.data && response.data.conversation) {
          setSelected(response.data.conversation);
        }
      } catch (error) {
        console.error('Failed to refetch conversation details:', error);
      }
    }
    
    setNotification({
      message: 'Conversation updated successfully!'
    });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleConversationDeleted = (conversationId) => {
    // Remove from conversations list
    setAllConversations(prev => prev.map(section => ({
      ...section,
      items: section.items.filter(c => c._id !== conversationId)
    })));
    
    // If this was the selected conversation, clear selection
    if (selected && selected._id === conversationId) {
      setSelected(null);
      setMessages([]);
    }
    // Refresh unread count in header
    if (refreshUnreadCount) refreshUnreadCount();
    setNotification({
      message: 'Conversation deleted successfully!'
    });
    setNotification(null);
  };

  const handleUserSelect = async (selectedUser) => {
    try {
      const response = await conversationAPI.createConversation({
        type: 'dm',
        memberIds: [selectedUser._id]
      });
      
      const newConversation = response.data.conversation;
      
      // Refresh conversations list
      await fetchConversations();
      
      // Select the new conversation
      handleSelect(newConversation);
      
      setNotification({
        message: response.data.message || 'Conversation created successfully!'
      });
      setNotification(null);
    } catch (error) {
      console.error('Error creating conversation:', error);
      setNotification({
        message: error.response?.data?.message || 'Failed to create conversation'
      });
      setNotification(null);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setUploadFile(file);
    }
  };

  const handleRemoveFile = () => {
    setUploadFile(null);
  };

  const handleEmojiClick = async (emoji, msgId) => {
    try {
      setReactionInProgress(true);
      
      // Use the REST API instead of socket for proper toggle logic
      const response = await messageAPI.reactMessage(msgId, emoji);
      
      // Update the local message state with the updated reactions
      const updatedMessage = response.data.message;
      setMessages(prev => prev.map(m => 
        m._id === msgId ? { ...m, reactions: updatedMessage.reactions } : m
      ));
      
      // Update the reactions state as well
      setReactions(prev => ({
        ...prev,
        [msgId]: updatedMessage.reactions
      }));
      
      // Close emoji picker after a small delay to prevent auto-scroll
      setTimeout(() => {
        setShowEmojiPicker(false);
        setReactionInProgress(false);
      }, 150);
    } catch (error) {
      console.error('Error reacting to message:', error);
      setShowEmojiPicker(false);
      setReactionInProgress(false);
    }
  };

  const handleReply = (msg) => {
    setReplyTo(msg);
  };

  const handleTyping = (isTyping) => {
    if (selected && chatSocket.sendTyping) {
      chatSocket.sendTyping({ conversationId: selected._id, typing: isTyping });
    }
  };

  // Search functionality
  const handleSearch = async (query, filters) => {
    if (!selected || !query.trim()) return;
    
    setIsSearching(true);
    setSearchFilters(filters);
    
    try {
      const response = await messageAPI.searchMessages(selected._id, {
        query: query.trim(),
        type: filters.type,
        sender: filters.sender,
        dateRange: filters.dateRange,
        limit: 50
      });
      
      const results = response.data.messages || [];
      setSearchResults(results);
      setTotalSearchResults(response.data.total || results.length);
      setCurrentSearchResult(0);
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
      setTotalSearchResults(0);
    } finally {
      setIsSearching(false);
    }
  };

  const handleClearSearch = () => {
    setSearchResults([]);
    setTotalSearchResults(0);
    setCurrentSearchResult(0);
    setSearchFilters(null);
  };

  const handleNavigateSearchResult = (direction, index) => {
    if (direction === 'goto' && typeof index === 'number') {
      setCurrentSearchResult(index);
      // Scroll to message in ChatWindow
      const messageId = searchResults[index]?._id;
      if (messageId) {
        const messageElement = document.getElementById(`message-${messageId}`);
        if (messageElement) {
          messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    } else if (direction === 'next' && currentSearchResult < totalSearchResults - 1) {
      const newIndex = currentSearchResult + 1;
      setCurrentSearchResult(newIndex);
      handleNavigateSearchResult('goto', newIndex);
    } else if (direction === 'previous' && currentSearchResult > 0) {
      const newIndex = currentSearchResult - 1;
      setCurrentSearchResult(newIndex);
      handleNavigateSearchResult('goto', newIndex);
    }
  };

  return (
    <div className="flex h-[100dvh] sm:h-[85vh] bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50 sm:rounded-2xl shadow-2xl overflow-hidden border-0 sm:border border-gray-100">
      {/* Sidebar - Full width on mobile when open */}
      {(!isMobile || sidebarOpen) && (
        <div className={`${isMobile ? 'w-full' : 'w-80 lg:w-96'} bg-white/80 backdrop-blur-sm border-r border-gray-200 flex flex-col`}>
          {/* Header - More compact */}
          <div className="p-2 md:p-4 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-purple-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1.5 md:space-x-3">
                <div className="p-1 md:p-2 rounded-lg bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-md">
                  <MessageCircle className="h-3.5 w-3.5 md:h-5 md:w-5" />
                </div>
                <div>
                  <h1 className="text-sm md:text-lg font-bold text-gray-900">Messages</h1>
                  <p className="text-xs text-gray-600 hidden sm:block">Connect with your team</p>
                </div>
              </div>
              <button 
                onClick={() => setShowCreateModal(true)} 
                className="p-1 md:p-2 rounded-lg bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:from-blue-600 hover:to-purple-600 transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105"
                title="New Conversation"
              >
                <Plus className="h-3.5 w-3.5 md:h-4 md:w-4" />
              </button>
            </div>
          </div>

          {/* Search - More compact */}
          <div className="p-1.5 md:p-3 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 md:h-3.5 md:w-3.5 text-gray-400" />
              <input
                type="text"
                placeholder="Search conversations..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-7 md:pl-9 pr-2 md:pr-3 py-1.5 md:py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white shadow-sm text-xs md:text-sm"
              />
            </div>
          </div>

          {/* Conversations List - More compact spacing */}
          <div className="flex-1 overflow-y-auto py-1">
            {(() => {
              return filteredConversations.map(section => {
                return (
                  <div key={section.section} className="mb-2 md:mb-3">
                    <div className="flex items-center px-3 md:px-4 py-1.5 md:py-2 text-gray-500 uppercase text-xs font-bold tracking-wider">
                      <section.icon className="h-3 w-3 mr-2" />
                      {section.section}
                    </div>
                    {section.items.map(conv => {
                      return (
                        <SidebarConversation
                          key={conv._id}
                          conv={conv}
                          isActive={selected && selected._id === conv._id}
                          onSelect={() => handleSelect(conv)}
                          onStar={() => handleStar(conv._id)}
                          onDelete={() => handleDeleteConversation(conv)}
                          starred={starred.includes(conv._id)}
                          getInitials={getInitials}
                          currentUserId={user?.id}
                          canDelete={
                            conv.type === 'dm' || 
                            (conv.type === 'group' && conv.admins?.includes(user?.id)) ||
                            (conv.type === 'community' && conv.admins?.includes(user?.id))
                          }
                        />
                      );
                    })}
                  </div>
                );
              });
            })()}
          </div>
        </div>
      )}

      {/* Chat Window - Full width on mobile when sidebar is closed */}
      {(!isMobile || (!sidebarOpen && selected)) && (
        <div className="flex-1 flex flex-col bg-white/60 backdrop-blur-sm min-w-0 overflow-hidden">
          {/* Mobile back button */}
          {isMobile && (
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-purple-50">
              <button
                className="p-2 rounded-full bg-blue-100 text-blue-600 shadow-md hover:bg-blue-200 transition-colors"
                onClick={() => setSidebarOpen(true)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
              </button>
              <h2 className="text-base font-bold text-gray-900">Messages</h2>
              <div className="w-9"></div> {/* Spacer for centering */}
            </div>
          )}

          {/* Chat header */}
          {selected ? (
            <div className="border-b border-gray-100 px-3 md:px-6 py-2 md:py-4 bg-gradient-to-r from-gray-50 to-blue-50">
              <div className="flex items-center justify-between">
                <div 
                  className="flex items-center space-x-2 md:space-x-4 cursor-pointer hover:bg-white/50 p-1 md:p-3 rounded-xl transition-all duration-200"
                  onClick={() => setShowDetailsModal(true)}
                >
                  <div className="relative">
                    {selected.avatar ? (
                      <img src={selected.avatar} alt={selected.name || 'Conversation'} className="h-8 w-8 md:h-12 md:w-12 rounded-full object-cover shadow-lg" />
                    ) : (
                      <div className="h-8 w-8 md:h-12 md:w-12 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm md:text-lg shadow-lg">
                        {getInitials(getConversationDisplayName(selected, user?.id))}
                      </div>
                    )}
                    {selected.status && (
                      <span className={`absolute -bottom-1 -right-1 h-3 w-3 md:h-4 md:w-4 rounded-full border-2 md:border-3 border-white ${selected.status === 'online' ? 'bg-green-500' : 'bg-gray-400'} shadow-md`}></span>
                    )}
                  </div>
                  <div className="flex flex-col min-w-0 flex-1">
                    <h2 className="text-sm md:text-lg font-bold text-gray-900 truncate">{getConversationDisplayName(selected, user?.id)}</h2>
                    {selected && (selected.type === 'group' || selected.type === 'community') && (
                      <p className="text-xs text-gray-600">
                        {selected.members?.length || 0} members
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-1 md:space-x-2">
                  <button
                    onClick={() => setShowSearch(!showSearch)}
                    className={`p-2 rounded-xl transition-all duration-200 ${
                      showSearch 
                        ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' 
                        : 'hover:bg-white/50 text-gray-500 hover:text-gray-700'
                    }`}
                    title="Search Messages"
                  >
                    <Search className="h-4 w-4 md:h-5 md:w-5" />
                  </button>
                  {selected && (
                    <button 
                      onClick={() => setShowSettingsModal(true)} 
                      className="p-2 rounded-xl hover:bg-white/50 transition-all duration-200 text-gray-500 hover:text-gray-700" 
                      title="Conversation Settings"
                    >
                      <Settings className="h-4 w-4 md:h-5 md:w-5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="border-b border-gray-100 px-3 md:px-6 py-4 md:py-8 bg-gradient-to-r from-gray-50 to-blue-50">
              <div className="text-center">
                <div className="p-2 md:p-4 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 w-10 h-10 md:w-16 md:h-16 mx-auto mb-2 md:mb-4 flex items-center justify-center">
                  <MessageCircle className="h-4 w-4 md:h-8 md:w-8 text-white" />
                </div>
                <h2 className="text-base md:text-xl font-bold text-gray-900 mb-1 md:mb-2">Welcome to Messages</h2>
                <p className="text-xs md:text-base text-gray-600">Select a conversation to start chatting</p>
              </div>
            </div>
          )}

          {/* Search Component */}
          {showSearch && selected && (
            <ChatSearch
              onSearch={handleSearch}
              onClose={() => {
                setShowSearch(false);
                handleClearSearch();
              }}
              searchResults={searchResults}
              isSearching={isSearching}
              currentResult={currentSearchResult}
              totalResults={totalSearchResults}
              onNavigateResult={handleNavigateSearchResult}
              onClearSearch={handleClearSearch}
            />
          )}

          {/* Reply context */}
          {replyTo && (
            <div className="px-4 md:px-6 py-2 bg-blue-50 border-b border-blue-100">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-xs md:text-sm text-blue-600 font-medium">Replying to {replyTo.senderName || 'message'}</p>
                  <p className="text-xs md:text-sm text-blue-500 truncate">{replyTo.text || 'File'}</p>
                </div>
                <button 
                  onClick={() => setReplyTo(null)} 
                  className="ml-2 p-1 rounded-full text-blue-400 hover:text-blue-600 hover:bg-blue-100 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* Messages */}
          {selected && (
            <ChatWindow
              loading={messagesLoading}
              messages={messages}
              currentUserId={user?.id}
              conversationType={selected.type}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onReply={handleReply}
              onEmoji={handleEmojiClick}
              reactions={reactions}
              showEmojiPicker={showEmojiPicker}
              setShowEmojiPicker={setShowEmojiPicker}
              emojiList={emojiList}
              editMsgId={editMsgId}
              editInput={editInput}
              setEditInput={setEditInput}
              handleEditSave={handleEditSave}
              handleEditCancel={handleEditCancel}
              typing={selected && typing[selected._id] ? typing[selected._id] : {}}
              messageStatus={chatSocket.messageStatus}
              onlineUsers={Array.from(chatSocket.onlineUsers.values())}
              shouldAutoScroll={!editMsgId && !replyTo && !showSearch && !showEmojiPicker && !reactionInProgress && showEmojiPicker !== 'input'}
              searchResults={searchResults}
              currentSearchResult={currentSearchResult}
              searchFilters={searchFilters}
            />
          )}

          {/* Input */}
          {selected && (
            <ChatInput
              input={input}
              setInput={setInput}
              onSend={handleSend}
              onFileChange={handleFileChange}
              uploadFile={uploadFile}
              onRemoveFile={handleRemoveFile}
              onShowEmojiPicker={() => setShowEmojiPicker('input')}
              onTyping={handleTyping}
              members={selected?.members || []}
              isSending={isSending}
              uploadProgress={uploadProgress}
            />
          )}

          {/* Notification */}
          {notification && (
            <div className="fixed top-4 md:top-6 right-4 md:right-6 z-50 bg-gradient-to-r from-blue-500 to-purple-500 text-white px-4 md:px-6 py-2 md:py-3 rounded-xl shadow-2xl animate-in slide-in-from-right-4 duration-300 max-w-xs md:max-w-md">
              <div className="flex items-center space-x-2 md:space-x-3">
                <div className="p-1 rounded-full bg-white/20">
                  <Check className="h-3 w-3 md:h-4 md:w-4" />
                </div>
                <span className="font-medium text-sm md:text-base">{notification.message}</span>
                <button 
                  onClick={() => setNotification(null)} 
                  className="ml-2 md:ml-4 text-white/80 hover:text-white transition-colors"
                >
                  <X className="h-3 w-3 md:h-4 md:w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* User Selection Modal */}
      <UserSelectionModal
        isOpen={showUserModal}
        onClose={() => setShowUserModal(false)}
        onSelectUser={handleUserSelect}
        currentUserId={user?.id}
      />

      {/* Create Conversation Modal */}
      <CreateConversationModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onConversationCreated={handleConversationCreated}
        currentUserId={user?.id}
      />

      {/* Conversation Settings Modal */}
      <ConversationSettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        conversation={selected}
        onConversationUpdated={handleConversationUpdated}
        onConversationDeleted={handleConversationDeleted}
        currentUserId={user?.id}
      />

      {/* Conversation Details Modal */}
      <ConversationDetailsModal
        isOpen={showDetailsModal}
        onClose={() => setShowDetailsModal(false)}
        conversation={selected}
        currentUserId={user?.id}
      />

      {/* Connection Status (for debugging) */}
      <ConnectionStatus />
    </div>
  );
} 