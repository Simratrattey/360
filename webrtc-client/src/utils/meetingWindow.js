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

  const meetingWindow = window.open(`/meeting/${roomId}`, '_blank', optionsString);
  
  // Focus the new window if it opened successfully
  if (meetingWindow) {
    meetingWindow.focus();
  }
  
  return meetingWindow;
};

/**
 * Generate a unique room ID
 */
export const generateRoomId = () => {
  return Date.now().toString();
};