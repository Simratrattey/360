/**
 * Utility function to open meeting in a new optimized window
 * @param {string} roomId - The meeting room ID
 * @param {Object} options - Optional window configuration
 */
export const openMeetingWindow = (roomId, options = {}) => {
  const defaultOptions = {
    width: 1200,
    height: 800,
    toolbar: 'no',
    menubar: 'no',
    scrollbars: 'no',
    resizable: 'yes',
    location: 'no',
    status: 'no',
    left: Math.max(0, (screen.width - 1200) / 2),
    top: Math.max(0, (screen.height - 800) / 2)
  };

  const windowOptions = { ...defaultOptions, ...options };
  const optionsString = Object.entries(windowOptions)
    .map(([key, value]) => `${key}=${value}`)
    .join(',');

  // Get current origin to ensure same domain
  const currentOrigin = window.location.origin;
  const meetingUrl = `${currentOrigin}/meeting/${roomId}`;
  
  console.log(`🪟 Opening meeting window: ${meetingUrl}`);
  
  const meetingWindow = window.open(meetingUrl, `meeting_${roomId}`, optionsString);
  
  // Focus the new window if it opened successfully
  if (meetingWindow) {
    meetingWindow.focus();
    console.log(`✅ Meeting window opened successfully for room: ${roomId}`);
  } else {
    console.error(`❌ Failed to open meeting window for room: ${roomId} - popup may be blocked`);
    // Fallback: navigate in current tab if popup is blocked
    alert('Popup blocked! Please allow popups for this site or click OK to open in current tab.');
    window.location.href = meetingUrl;
  }
  
  return meetingWindow;
};

/**
 * Generate a unique room ID
 */
export const generateRoomId = () => {
  return Date.now().toString();
};