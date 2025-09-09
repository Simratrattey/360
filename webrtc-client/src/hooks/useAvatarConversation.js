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
    if (!user?._id) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      console.log('🤖 Hook: Initializing avatar conversation for user:', user._id);

      // Check if avatar conversation already exists
      const conversations = await API.get('/conversations');
      const existingAvatarConv = conversations.data.find(conv => 
        conv.conversationType === 'ai_avatar' || 
        conv.settings?.isAvatarConversation === true ||
        conv.name === 'Avatar'
      );

      if (existingAvatarConv) {
        console.log('🤖 Hook: Found existing avatar conversation:', existingAvatarConv._id);
        setAvatarConversation(existingAvatarConv);
      } else {
        // Create new avatar conversation
        console.log('🤖 Hook: Creating new avatar conversation');
        const newAvatarConv = await createAvatarConversation();
        setAvatarConversation(newAvatarConv);
      }

      setIsInitialized(true);
    } catch (err) {
      console.error('🤖 Hook: Error initializing avatar conversation:', err);
      setError(err.message || 'Failed to initialize avatar conversation');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Create new avatar conversation
   */
  const createAvatarConversation = async () => {
    try {
      const conversationData = {
        name: 'Avatar',
        type: 'dm',
        conversationType: 'ai_avatar',
        members: [user._id],
        settings: {
          isAvatarConversation: true,
          aiEnabled: true,
          allowMentions: true,
          isPermanent: true,
          alwaysOnTop: true
        }
      };

      const response = await API.post('/conversations', conversationData);
      console.log('🤖 Hook: Created avatar conversation:', response.data._id);
      
      return response.data;
    } catch (error) {
      console.error('🤖 Hook: Error creating avatar conversation:', error);
      throw error;
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
    if (user?._id && !isInitialized) {
      initializeAvatarConversation();
    }
  }, [user?._id, isInitialized]);

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