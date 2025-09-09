import BotService from '../api/botService';
import API from '../api/client';

/**
 * Avatar Service for handling AI avatar conversations and responses
 */
class AvatarService {
  // Constants
  static AVATAR_USER_ID = 'avatar_system_user';
  static AVATAR_USERNAME = 'avatar';
  static AVATAR_CHANNEL_NAME = '#avatar-chat';
  
  /**
   * Process user message and generate avatar response
   * @param {string} messageText - User's message text
   * @param {string} userId - User ID who sent the message
   * @param {string} conversationId - Avatar conversation ID
   * @returns {Object} Formatted avatar response message
   */
  static async processUserMessage(messageText, userId, conversationId) {
    try {
      console.log('🤖 Avatar: Processing user message:', { messageText, userId, conversationId });
      
      // Extract mentions and keywords from user message
      const mentions = this.extractMentions(messageText);
      const keywords = this.extractKeywords(messageText);
      
      // Get user info for personalized response
      const userInfo = await this.getUserInfo(userId);
      const userName = userInfo?.fullName || userInfo?.username || 'User';
      
      // Call existing bot service to get AI response
      const botServiceResponse = await BotService.getBotReply(messageText);
      
      console.log('🤖 Avatar: Bot service response received:', botServiceResponse);
      
      // Extract the actual bot data from the service response
      let botResponse = null;
      
      if (!botServiceResponse.success) {
        console.warn('🤖 Avatar: Bot service returned error:', botServiceResponse.error);
      } else if (botServiceResponse.data) {
        // Handle the response format similar to MeetingPage
        try {
          // The data might have a 'reply' field that contains JSON
          const rawData = botServiceResponse.data;
          if (rawData.reply) {
            // Parse the JSON reply to get the actual clips data
            const parsedReply = JSON.parse(rawData.reply);
            const entries = Array.isArray(parsedReply) && Array.isArray(parsedReply[0]) ? parsedReply[0] : [];
            
            // Convert entries to clips format
            const clips = entries.map(entry => ({
              title: entry.title || 'Untitled',
              snippet: entry.snippet || 'No description available',
              videodetails: entry.videodetails || {}
            }));
            
            botResponse = { clips };
          } else {
            botResponse = rawData;
          }
        } catch (parseError) {
          console.warn('🤖 Avatar: Error parsing bot response:', parseError);
          botResponse = botServiceResponse.data;
        }
      }
      
      // Format response in the required avatar format
      const avatarResponseText = this.formatAvatarResponse(botResponse, userName, keywords);
      
      // Create avatar message object
      const avatarMessage = {
        conversationId,
        senderId: AvatarService.AVATAR_USER_ID,
        sender: {
          _id: AvatarService.AVATAR_USER_ID,
          fullName: 'Avatar',
          username: AvatarService.AVATAR_USERNAME,
          userType: 'ai_avatar',
          isSystem: true
        },
        text: avatarResponseText,
        type: 'system',
        isSystemMessage: false, // Avatar messages are not system messages
        isAvatarMessage: true, // Custom flag for avatar messages
        timestamp: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        avatarData: {
          clips: botResponse?.clips || [],
          originalQuery: messageText,
          keywords: keywords,
          mentions: mentions
        }
      };
      
      return avatarMessage;
      
    } catch (error) {
      console.error('🤖 Avatar: Error processing user message:', error);
      
      // Return error message from avatar
      const errorMessage = error.message || error.error || 'Failed to process your request';
      return this.createErrorMessage(conversationId, userId, errorMessage);
    }
  }
  
  /**
   * Format avatar response in the required format
   * @param {Object} botData - Response from bot service
   * @param {string} userName - User's display name
   * @param {Array} keywords - Extracted keywords from query
   * @returns {string} Formatted avatar response text
   */
  static formatAvatarResponse(botData, userName, keywords) {
    const keywordText = keywords.length > 0 ? keywords.join(', ') : 'your query';
    let response = `Hi @${userName}, here is something on ${keywordText}, in channel ${AvatarService.AVATAR_CHANNEL_NAME}.\n`;
    
    if (botData && botData.clips && botData.clips.length > 0) {
      botData.clips.forEach((clip, index) => {
        response += `\nTitle: ${clip.title || 'Untitled'}\n`;
        response += `Segment Text: ${clip.snippet || 'No description available'}\n`;
        response += `Video Link: ${this.constructVideoURL(clip)}\n`;
        
        // Add extra newline between clips for better readability
        if (index < botData.clips.length - 1) {
          response += '\n';
        }
      });
    } else {
      response += '\nI apologize, but I could not find relevant information for your query. Please try rephrasing your question or being more specific.';
    }
    
    return response;
  }
  
  /**
   * Construct video URL from clip data
   * @param {Object} clip - Video clip data
   * @returns {string} Complete video URL with timestamp
   */
  static constructVideoURL(clip) {
    try {
      if (!clip || !clip.title) {
        return 'Video URL not available';
      }
      
      const baseUrl = 'https://clavisds02.feeltiptop.com/360TeamCalls/downloads';
      
      // Extract date from title (format: YYYY.MM.DD-... or similar)
      const dateMatch = clip.title.match(/(\d{4})\.(\d{2})\.(\d{2})/);
      if (!dateMatch) {
        console.warn('🤖 Avatar: Could not extract date from clip title:', clip.title);
        return 'Video URL format not supported';
      }
      
      const [, year, month, day] = dateMatch;
      const videoPath = `${year}/${month}/${clip.title}/${clip.title}.mp4`;
      
      // Add timestamp fragment if available
      let url = `${baseUrl}/${videoPath}`;
      if (clip.videodetails && clip.videodetails.snippetstarttimesecs && clip.videodetails.snippetendtimesecs) {
        url += `#t=${clip.videodetails.snippetstarttimesecs},${clip.videodetails.snippetendtimesecs}`;
      }
      
      return url;
    } catch (error) {
      console.error('🤖 Avatar: Error constructing video URL:', error);
      return 'Error generating video URL';
    }
  }
  
  /**
   * Extract mentions (@username) from message text
   * @param {string} text - Message text
   * @returns {Array} Array of mentioned usernames
   */
  static extractMentions(text) {
    const mentionRegex = /@(\w[\w.]*)/g;
    const mentions = [];
    let match;
    
    while ((match = mentionRegex.exec(text)) !== null) {
      mentions.push(match[1]);
    }
    
    return mentions;
  }
  
  /**
   * Extract keywords from message text for context
   * @param {string} text - Message text
   * @returns {Array} Array of keywords
   */
  static extractKeywords(text) {
    // Remove mentions and common words
    const cleanText = text
      .replace(/@\w+/g, '') // Remove mentions
      .replace(/\b(the|and|or|but|in|on|at|to|for|of|with|by|from|up|about|into|through|during|before|after|above|below|between|among|around|over|under|is|are|was|were|be|been|being|have|has|had|do|does|did|will|would|could|should|may|might|can|what|where|when|why|how|who|which|that|this|these|those|a|an)\b/gi, '');
    
    // Extract meaningful words (3+ characters)
    const words = cleanText
      .toLowerCase()
      .match(/\b\w{3,}\b/g) || [];
    
    // Return unique keywords, max 3
    return [...new Set(words)].slice(0, 3);
  }
  
  /**
   * Get user information
   * @param {string} userId - User ID
   * @returns {Object} User information
   */
  static async getUserInfo(userId) {
    try {
      const response = await API.get(`/users/${userId}`);
      return response.data;
    } catch (error) {
      console.warn('🤖 Avatar: Could not fetch user info:', error);
      return null;
    }
  }
  
  /**
   * Create error message from avatar
   * @param {string} conversationId - Conversation ID
   * @param {string} userId - User ID
   * @param {string} errorMessage - Error message
   * @returns {Object} Error message object
   */
  static createErrorMessage(conversationId, userId, errorMessage) {
    return {
      conversationId,
      senderId: AvatarService.AVATAR_USER_ID,
      sender: {
        _id: AvatarService.AVATAR_USER_ID,
        fullName: 'Avatar',
        username: AvatarService.AVATAR_USERNAME,
        userType: 'ai_avatar',
        isSystem: true
      },
      text: `I apologize, but I encountered an error while processing your request: ${errorMessage}. Please try again or rephrase your question.`,
      type: 'system',
      isSystemMessage: false,
      isAvatarMessage: true,
      timestamp: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      avatarData: {
        isError: true,
        errorMessage: errorMessage
      }
    };
  }
  
  /**
   * Initialize avatar conversation for a user
   * @param {string} userId - User ID
   * @returns {Object} Avatar conversation object
   */
  static async initializeAvatarConversation(userId) {
    try {
      console.log('🤖 Avatar: Initializing avatar conversation for user:', userId);
      
      // Check if avatar conversation already exists
      const existingConversations = await API.get('/conversations');
      const avatarConversation = existingConversations.data.find(conv => 
        conv.conversationType === 'ai_avatar' && 
        conv.members?.some(member => member._id === userId || member === userId)
      );
      
      if (avatarConversation) {
        console.log('🤖 Avatar: Found existing avatar conversation:', avatarConversation._id);
        return avatarConversation;
      }
      
      // Create new avatar conversation
      const newConversation = {
        name: 'Avatar',
        type: 'dm',
        conversationType: 'ai_avatar',
        members: [userId],
        isPermanent: true,
        alwaysOnTop: true,
        settings: {
          aiEnabled: true,
          allowMentions: true,
          isAvatarConversation: true
        }
      };
      
      const response = await API.post('/conversations', newConversation);
      console.log('🤖 Avatar: Created new avatar conversation:', response.data._id);
      
      return response.data;
      
    } catch (error) {
      console.error('🤖 Avatar: Error initializing avatar conversation:', error);
      throw error;
    }
  }
  
  /**
   * Check if a conversation is an avatar conversation
   * @param {Object} conversation - Conversation object
   * @returns {boolean} True if avatar conversation
   */
  static isAvatarConversation(conversation) {
    return conversation?.conversationType === 'ai_avatar' || 
           conversation?.settings?.isAvatarConversation === true;
  }
  
  /**
   * Check if a message is from avatar
   * @param {Object} message - Message object
   * @returns {boolean} True if avatar message
   */
  static isAvatarMessage(message) {
    return message?.isAvatarMessage === true || 
           message?.sender?.userType === 'ai_avatar' ||
           message?.senderId === AvatarService.AVATAR_USER_ID;
  }
}

export default AvatarService;