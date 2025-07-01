import React, { useState, useEffect } from 'react';
import { User, Users, Hash, Plus, Search, MoreVertical, Settings, Star, Trash2, Send, Paperclip, Smile, MessageCircle, X, Check } from 'lucide-react';
import SidebarConversation from '../components/messages/SidebarConversation';
import ChatWindow from '../components/messages/ChatWindow';
import ChatInput from '../components/messages/ChatInput';
import CreateConversationModal from '../components/messages/CreateConversationModal';
import UserSelectionModal from '../components/messages/UserSelectionModal';
import ConversationSettingsModal from '../components/messages/ConversationSettingsModal';
import ConversationDetailsModal from '../components/messages/ConversationDetailsModal';
import * as conversationAPI from '../api/conversationService';
import * as messageAPI from '../api/messageService';
import { useAuth } from '../context/AuthContext';
import { useChatSocket } from '../context/ChatSocketContext';

// Placeholder for emoji list
const emojiList = ['👍', '❤️', '😂', '😮', '😢', '😡', '👏', '🙏', '🔥', '💯', '✨', '🎉', '🤔', '😎', '🥳', '😴'];

function getInitials(name) {
  console.log('getInitials called with:', name, 'type:', typeof name);
  
  if (!name || typeof name !== 'string') {
    console.log('getInitials returning fallback: U');
    return 'U';
  }
  
  const result = name.split(' ').map(n => n[0]).join('').toUpperCase();
  console.log('getInitials result:', result);
  return result;
}

function getConversationDisplayName(conversation, currentUserId) {
  console.log('MessagesPage getConversationDisplayName called with:', { conversation, currentUserId });
  
  try {
    if (!conversation) {
      console.log('No conversation provided, returning Unknown');
      return 'Unknown';
    }
    
    // If conversation has a name (group/community), use it
    if (conversation.name) {
      console.log('Using conversation name:', conversation.name);
      return String(conversation.name);
    }
    
    // For DMs, show the other person's name
    if (conversation.type === 'dm' && conversation.members) {
      console.log('Looking for other member in DM');
      const otherMember = conversation.members.find(m => m._id !== currentUserId);
      console.log('Other member found:', otherMember);
      console.log('Other member type:', typeof otherMember);
      
      if (otherMember && typeof otherMember === 'object') {
        console.log('Processing other member object');
        
        // Ensure we're working with a user object and extract string values
        const fullName = otherMember.fullName;
        const username = otherMember.username;
        const email = otherMember.email;
        
        console.log('Member properties:', { fullName, username, email });
        
        const displayName = fullName || username || email || 'Unknown User';
        console.log('Final display name:', displayName, 'type:', typeof displayName);
        
        // Ensure we return a string
        const result = String(displayName);
        console.log('Returning result:', result);
        return result;
      } else {
        console.log('No valid other member found, using fallback');
        return 'Unknown User';
      }
    }
    
    // Fallback
    console.log('Using fallback name: Unknown Conversation');
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

  // Fetch conversations on mount (REST)
  useEffect(() => {
    fetchConversations();
  }, []);

  const fetchConversations = async () => {
    try {
      const res = await conversationAPI.getConversations();
      console.log('Conversations API response:', res);
      const conversations = res.data.conversations || res.data || [];
      console.log('Processed conversations:', conversations);
      
      setAllConversations([
        { section: 'Direct Messages', icon: User, items: conversations.filter(c => c.type === 'dm') },
        { section: 'Groups', icon: Users, items: conversations.filter(c => c.type === 'group') },
        { section: 'Communities', icon: Hash, items: conversations.filter(c => c.type === 'community') },
      ]);
      
      // Auto-select first conversation
      const first = conversations[0];
      if (first) {
        console.log('Auto-selecting first conversation:', first);
        handleSelect(first);
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
    }
  };

  // Fetch messages when a conversation is selected (REST, then join room)
  useEffect(() => {
    if (selected && selected._id) {
      messageAPI.getMessages(selected._id).then(res => {
        setMessages(res.data.messages);
      });
      chatSocket.joinConversation(selected._id);
      return () => chatSocket.leaveConversation(selected._id);
    }
    // eslint-disable-next-line
  }, [selected]);

  // Real-time event listeners
  useEffect(() => {
    if (!chatSocket.socket) return;
    // New message
    chatSocket.on('chat:new', msg => {
      setMessages(prev => [...prev, msg]);
    });
    // Edit message
    chatSocket.on('chat:edit', ({ messageId, text }) => {
      setMessages(prev => prev.map(m => m._id === messageId ? { ...m, text, edited: true } : m));
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
    chatSocket.on('chat:typing', ({ userId: typingUserId, typing }) => {
      if (typingUserId !== user.id) {
        setTyping(prev => ({
          ...prev,
          [typingUserId]: typing
        }));
      }
    });
    return () => {
      chatSocket.off('chat:new');
      chatSocket.off('chat:edit');
      chatSocket.off('chat:delete');
      chatSocket.off('chat:react');
      chatSocket.off('chat:unreact');
      chatSocket.off('chat:typing');
    };
    // eslint-disable-next-line
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
    }
  }, [selected, messages, user.id, chatSocket]);

  // Filter conversations by search
  const filteredConversations = allConversations.map(section => {
    console.log('Processing section:', section.section);
    console.log('Section items before filter:', section.items);
    
    const filteredItems = section.items.filter(conv => {
      console.log('Filtering conversation:', conv);
      console.log('Conversation members:', conv.members);
      
      try {
        const displayName = getConversationDisplayName(conv, user?.id);
        console.log('Display name:', displayName);
        
        const memberNames = conv.members?.map(m => {
          // Ensure we're not accidentally rendering the member object
          if (typeof m === 'object' && m !== null) {
            const name = m.fullName || m.username || m.email || '';
            return String(name);
          }
          return '';
        }).join(' ') || '';
        
        console.log('Member names string:', memberNames);
        
        const result = displayName.toLowerCase().includes(search.toLowerCase()) || 
               memberNames.toLowerCase().includes(search.toLowerCase());
        
        console.log('Filter result:', result);
        return result;
      } catch (error) {
        console.error('Error in conversation filter:', error);
        return false;
      }
    });
    
    console.log('Filtered items:', filteredItems);
    
    return {
      ...section,
      items: filteredItems,
    };
  });

  const handleSelect = (conv) => {
    if (!conv || !conv._id) {
      console.error('Invalid conversation object:', conv);
      return;
    }
    setSelected(conv);
    setReplyTo(null);
    setShowEmojiPicker(false);
    // Optionally: mark as read via API
  };

  const handleSend = async () => {
    // Check if a conversation is selected and has an _id
    if (!selected || !selected._id) {
      console.error('No conversation selected or conversation has no _id');
      return;
    }

    // Check if there's input to send
    if (!input.trim() && !uploadFile) {
      return;
    }

    try {
      let fileMeta = null;
      if (uploadFile) {
        const res = await messageAPI.uploadMessageFile(uploadFile);
        fileMeta = res.data;
      }
      
      chatSocket.sendMessage({
        conversationId: selected._id,
        text: input.trim(),
        file: fileMeta,
        replyTo: replyTo ? replyTo._id : undefined,
      });
      
      setInput('');
      setUploadFile(null);
      setReplyTo(null);
      setTyping(false);
    } catch (error) {
      console.error('Error sending message:', error);
      // You could add a notification here to show the error to the user
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

  const handleConversationUpdated = () => {
    // Refresh conversations list
    fetchConversations();
    
    setNotification({
      message: 'Conversation updated successfully!'
    });
    setNotification(null);
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
    
    setNotification({
      message: 'Conversation deleted successfully!'
    });
    setNotification(null);
  };

  const handleUserSelect = async (selectedUser) => {
    try {
      console.log('Creating DM with user:', selectedUser);
      const response = await conversationAPI.createConversation({
        type: 'dm',
        memberIds: [selectedUser._id]
      });
      
      console.log('Conversation creation response:', response);
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
    chatSocket.reactMessage({ messageId: msgId, emoji });
    setShowEmojiPicker(false);
  };

  const handleReply = (msg) => {
    setReplyTo(msg);
  };

  const handleTyping = (isTyping) => {
    if (selected && chatSocket.socket) {
      chatSocket.socket.emit('chat:typing', { conversationId: selected._id, typing: isTyping });
    }
  };

  const grouped = groupMessagesByDate(messages);

  return (
    <div className="flex h-[80vh] bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50 rounded-2xl shadow-2xl overflow-hidden border border-gray-100">
      {/* Sidebar */}
      <div className="w-80 bg-white/80 backdrop-blur-sm border-r border-gray-200 flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-purple-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg">
                <MessageCircle className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Messages</h1>
                <p className="text-sm text-gray-600">Connect with your team</p>
              </div>
            </div>
            <button 
              onClick={() => setShowCreateModal(true)} 
              className="p-2 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:from-blue-600 hover:to-purple-600 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
              title="New Conversation"
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-gray-100">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white shadow-sm"
            />
          </div>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto py-2">
          {(() => {
            console.log('About to render filteredConversations:', filteredConversations);
            return filteredConversations.map(section => {
              console.log('Rendering section:', section.section);
              console.log('Section items count:', section.items.length);
              
              return (
                <div key={section.section} className="mb-6">
                  <div className="flex items-center px-6 py-3 text-gray-500 uppercase text-xs font-bold tracking-wider">
                    <section.icon className="h-4 w-4 mr-3" />
                    {section.section}
                  </div>
                  {section.items.map(conv => {
                    console.log('Rendering conversation item:', conv);
                    console.log('Conversation members:', conv?.members);
                    console.log('About to render SidebarConversation for conv:', conv._id);
                    
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

      {/* Chat Window */}
      <div className="flex-1 flex flex-col bg-white/60 backdrop-blur-sm">
        {/* Chat header */}
        {selected ? (
          <div className="border-b border-gray-100 px-6 py-4 bg-gradient-to-r from-gray-50 to-blue-50">
            <div className="flex items-center justify-between">
              <div 
                className="flex items-center space-x-4 cursor-pointer hover:bg-white/50 p-3 rounded-xl transition-all duration-200"
                onClick={() => setShowDetailsModal(true)}
              >
                <div className="relative">
                  {selected.avatar ? (
                    <img src={selected.avatar} alt={selected.name || 'Conversation'} className="h-12 w-12 rounded-full object-cover shadow-lg" />
                  ) : (
                    <div className="h-12 w-12 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-lg shadow-lg">
                      {getInitials(getConversationDisplayName(selected, user?.id))}
                    </div>
                  )}
                  {selected.status && (
                    <span className={`absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-3 border-white ${selected.status === 'online' ? 'bg-green-500' : 'bg-gray-400'} shadow-md`}></span>
                  )}
                </div>
                <div className="flex flex-col">
                  <h2 className="text-lg font-bold text-gray-900">{getConversationDisplayName(selected, user?.id)}</h2>
                  {selected && (selected.type === 'group' || selected.type === 'community') && (
                    <p className="text-sm text-gray-600">
                      {selected.members?.length || 0} members
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center space-x-2">
                {selected && (
                  <button 
                    onClick={() => setShowSettingsModal(true)} 
                    className="p-2 rounded-xl hover:bg-white/50 transition-all duration-200 text-gray-500 hover:text-gray-700" 
                    title="Conversation Settings"
                  >
                    <Settings className="h-5 w-5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="border-b border-gray-100 px-6 py-8 bg-gradient-to-r from-gray-50 to-blue-50">
            <div className="text-center">
              <div className="p-4 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <MessageCircle className="h-8 w-8 text-white" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Welcome to Messages</h2>
              <p className="text-gray-600">Select a conversation to start chatting</p>
            </div>
          </div>
        )}

        {/* Reply context */}
        {replyTo && (
          <div className="px-6 py-3 bg-gradient-to-r from-blue-50 to-purple-50 border-b border-gray-100">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-lg bg-gradient-to-r from-blue-500 to-purple-500 text-white">
                <MessageCircle className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-900">Replying to:</p>
                <p className="text-sm text-gray-600 truncate">{replyTo.text || replyTo.file?.name}</p>
              </div>
              <button 
                onClick={() => setReplyTo(null)} 
                className="p-1 rounded-full hover:bg-white/50 transition-colors text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Chat messages */}
        <ChatWindow
          grouped={grouped}
          selected={selected}
          reactions={reactions}
          showEmojiPicker={showEmojiPicker}
          setShowEmojiPicker={setShowEmojiPicker}
          emojiList={emojiList}
          editMsgId={editMsgId}
          editInput={editInput}
          setEditInput={setEditInput}
          handleEditSave={handleEditSave}
          handleEditCancel={handleEditCancel}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onReply={handleReply}
          onEmoji={handleEmojiClick}
          replyContext={replyTo}
          typing={typing}
          currentUserId={user.id}
          messageStatus={chatSocket.messageStatus}
          onlineUsers={chatSocket.onlineUsers}
        />

        {/* Chat input */}
        <ChatInput
          input={input}
          setInput={setInput}
          onSend={handleSend}
          onFileChange={handleFileChange}
          uploadFile={uploadFile}
          onRemoveFile={handleRemoveFile}
          onShowEmojiPicker={() => setShowEmojiPicker('input')}
          onTyping={handleTyping}
        />

        {/* Notification */}
        {notification && (
          <div className="fixed top-6 right-6 z-50 bg-gradient-to-r from-blue-500 to-purple-500 text-white px-6 py-3 rounded-xl shadow-2xl animate-in slide-in-from-right-4 duration-300">
            <div className="flex items-center space-x-3">
              <div className="p-1 rounded-full bg-white/20">
                <Check className="h-4 w-4" />
              </div>
              <span className="font-medium">{notification.message}</span>
              <button 
                onClick={() => setNotification(null)} 
                className="ml-4 text-white/80 hover:text-white transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
      
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
    </div>
  );
} 