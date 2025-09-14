// Utility functions for generating meeting invite links

const BASE_URL = window.location.origin;

/**
 * Generate direct meeting link (bypasses waiting room)
 * @param {string} roomId - The meeting room ID
 * @returns {string} Direct meeting link
 */
export const generateDirectLink = (roomId) => {
  return `${BASE_URL}/meeting/${roomId}?type=direct`;
};

/**
 * Generate waiting room link (requires host approval)
 * @param {string} roomId - The meeting room ID  
 * @returns {string} Waiting room link
 */
export const generateWaitingRoomLink = (roomId) => {
  return `${BASE_URL}/meeting/${roomId}?type=waiting`;
};

/**
 * Generate both types of links for a meeting
 * @param {string} roomId - The meeting room ID
 * @returns {object} Object with both direct and waitingRoom links
 */
export const generateMeetingLinks = (roomId) => {
  return {
    direct: generateDirectLink(roomId),
    waitingRoom: generateWaitingRoomLink(roomId)
  };
};

/**
 * Determine if a URL is a waiting room link
 * @param {string} url - The URL to check
 * @returns {boolean} True if it's a waiting room link
 */
export const isWaitingRoomLink = (url) => {
  const urlObj = new URL(url);
  return urlObj.searchParams.get('type') === 'waiting';
};

/**
 * Determine if a URL is a direct meeting link
 * @param {string} url - The URL to check
 * @returns {boolean} True if it's a direct meeting link
 */
export const isDirectLink = (url) => {
  const urlObj = new URL(url);
  const type = urlObj.searchParams.get('type');
  return type === 'direct' || type === null; // null means default direct access
};

/**
 * Get the meeting room ID from a meeting URL
 * @param {string} url - The meeting URL
 * @returns {string|null} The room ID or null if invalid
 */
export const getRoomIdFromUrl = (url) => {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/');
    const meetingIndex = pathParts.indexOf('meeting');
    
    if (meetingIndex >= 0 && pathParts[meetingIndex + 1]) {
      return pathParts[meetingIndex + 1];
    }
    return null;
  } catch (error) {
    return null;
  }
};

/**
 * Copy link to clipboard with user feedback
 * @param {string} link - The link to copy
 * @param {string} type - Type of link for user feedback ('direct' or 'waiting')
 * @returns {Promise<boolean>} True if successful
 */
export const copyLinkToClipboard = async (link, type = 'meeting') => {
  try {
    await navigator.clipboard.writeText(link);
    
    // Show toast notification if available
    if (window.toast) {
      window.toast.success(`${type === 'waiting' ? 'Waiting room' : 'Direct'} link copied to clipboard!`);
    }
    
    return true;
  } catch (error) {
    console.error('Failed to copy link:', error);
    
    // Fallback for older browsers
    try {
      const textArea = document.createElement('textarea');
      textArea.value = link;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      
      if (window.toast) {
        window.toast.success(`${type === 'waiting' ? 'Waiting room' : 'Direct'} link copied to clipboard!`);
      }
      
      return true;
    } catch (fallbackError) {
      console.error('Clipboard fallback failed:', fallbackError);
      
      if (window.toast) {
        window.toast.error('Failed to copy link to clipboard');
      }
      
      return false;
    }
  }
};

const meetingLinks = {
  generateDirectLink,
  generateWaitingRoomLink,
  generateMeetingLinks,
  isWaitingRoomLink,
  isDirectLink,
  getRoomIdFromUrl,
  copyLinkToClipboard
};

export default meetingLinks;