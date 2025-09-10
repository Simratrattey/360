import { useAuth } from '../context/AuthContext';
import AvatarService from '../services/avatarService';

/**
 * Simplified hook for avatar conversation utilities (no complex initialization needed)
 */
export const useAvatarConversation = () => {
  const { user } = useAuth();
  
  // Simple avatar conversation object - no backend management needed
  const avatarConversation = user ? {
    _id: `avatar_conversation_${user._id || user.id}`,
    name: 'Avatar',
    type: 'dm',
    conversationType: 'ai_avatar',
    settings: {
      isAvatarConversation: true,
      aiEnabled: true,
      allowMentions: true,
      isPermanent: true,
      alwaysOnTop: true
    }
  } : null;

  /**
   * Check if conversation is the avatar conversation
   */
  const isAvatarConversation = (conversation) => {
    return conversation?._id === avatarConversation?._id ||
           conversation?.conversationType === 'ai_avatar' ||
           conversation?.settings?.isAvatarConversation ||
           AvatarService.isAvatarConversation(conversation);
  };

  return {
    avatarConversation,
    isAvatarConversation,
    // Legacy properties for backward compatibility (always ready now)
    isInitialized: !!user,
    isLoading: false,
    error: null
  };
};

export default useAvatarConversation;