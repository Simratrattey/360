import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import AvatarService from '../services/avatarService';
import API from '../api/client';

/**
 * Hook to manage avatar conversation initialization and state
 */
export const useAvatarConversation = () => {
  const { user } = useAuth();
  const [avatarConversation, setAvatarConversation] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);

  /**
   * Initialize avatar conversation for current user
   */
  const initializeAvatarConversation = async () => {
    const userId = user?._id || user?.id;
    if (!userId) {
      console.log('🤖 Hook: No user ID found, cannot initialize avatar conversation');
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      console.log('🤖 Hook: Initializing avatar conversation for user:', userId);

      // For now, create a client-side avatar conversation object
      // This doesn't require backend changes and will appear in the UI
      const avatarConversationObj = {
        _id: `avatar_conversation_${userId}`,
        name: 'Avatar',
        type: 'dm',
        conversationType: 'ai_avatar',
        members: [
          {
            _id: userId,
            fullName: user.fullName || user.username,
            username: user.username,
            email: user.email
          },
          {
            _id: 'avatar_system_user',
            fullName: 'Avatar',
            username: 'avatar',
            userType: 'ai_avatar',
            isSystem: true
          }
        ],
        lastMessage: {
          text: 'Hi! I\'m your AI Avatar assistant. Ask me anything about your projects, meetings, and videos!',
          senderId: 'avatar_system_user',
          senderName: 'Avatar',
          timestamp: new Date().toISOString()
        },
        lastMessageAt: new Date().toISOString(),
        unread: 0,
        settings: {
          isAvatarConversation: true,
          aiEnabled: true,
          allowMentions: true,
          isPermanent: true,
          alwaysOnTop: true
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      console.log('🤖 Hook: Created client-side avatar conversation:', avatarConversationObj._id);
      setAvatarConversation(avatarConversationObj);

      setIsInitialized(true);
    } catch (err) {
      console.error('🤖 Hook: Error initializing avatar conversation:', err);
      setError(err.message || 'Failed to initialize avatar conversation');
    } finally {
      setIsLoading(false);
    }
  };


  /**
   * Process avatar query
   */
  const processAvatarQuery = async (messageText) => {
    if (!avatarConversation || !user?._id) {
      throw new Error('Avatar conversation not initialized');
    }

    try {
      console.log('🤖 Hook: Processing avatar query:', messageText);
      
      // Use AvatarService to process the message
      const avatarResponse = await AvatarService.processUserMessage(
        messageText,
        user._id,
        avatarConversation._id
      );

      return avatarResponse;
    } catch (error) {
      console.error('🤖 Hook: Error processing avatar query:', error);
      throw error;
    }
  };

  /**
   * Check if conversation is the avatar conversation
   */
  const isAvatarConversation = (conversation) => {
    return conversation?._id === avatarConversation?._id ||
           AvatarService.isAvatarConversation(conversation);
  };

  /**
   * Reset avatar conversation state
   */
  const resetAvatarConversation = () => {
    setAvatarConversation(null);
    setIsInitialized(false);
    setError(null);
  };

  // Initialize on user change
  useEffect(() => {
    console.log('🤖 Hook: useEffect triggered:', { 
      userId: user?._id, 
      userIdAlt: user?.id,
      userObj: user,
      isInitialized 
    });
    
    const userId = user?._id || user?.id;
    if (userId && !isInitialized) {
      console.log('🤖 Hook: Starting avatar conversation initialization with userId:', userId);
      initializeAvatarConversation();
    }
  }, [user?._id, user?.id, isInitialized]);

  // Reset on user logout
  useEffect(() => {
    if (!user) {
      resetAvatarConversation();
    }
  }, [user]);

  return {
    avatarConversation,
    isLoading,
    error,
    isInitialized,
    processAvatarQuery,
    isAvatarConversation,
    initializeAvatarConversation,
    resetAvatarConversation
  };
};

export default useAvatarConversation;