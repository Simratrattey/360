// Notification cache utilities
export const getStorageKeys = (userId) => ({
  NOTIFICATIONS: `notifications_cache_${userId}`,
  UNREAD_COUNT: `unread_count_cache_${userId}`
});

export const getCachedNotifications = (userId) => {
  if (!userId) return null;
  
  try {
    const keys = getStorageKeys(userId);
    const cached = localStorage.getItem(keys.NOTIFICATIONS);
    return cached ? JSON.parse(cached) : null;
  } catch (err) {
    console.error('Error reading cached notifications:', err);
    return null;
  }
};

export const getCachedUnreadCount = (userId) => {
  if (!userId) return 0;
  
  try {
    const keys = getStorageKeys(userId);
    const cached = localStorage.getItem(keys.UNREAD_COUNT);
    return cached ? parseInt(cached, 10) : 0;
  } catch (err) {
    console.error('Error reading cached unread count:', err);
    return 0;
  }
};

export const clearNotificationCache = (userId) => {
  if (!userId) return;
  
  const keys = getStorageKeys(userId);
  localStorage.removeItem(keys.NOTIFICATIONS);
  localStorage.removeItem(keys.UNREAD_COUNT);
};

export const clearAllNotificationCaches = () => {
  Object.keys(localStorage).forEach(key => {
    if (key.startsWith('notifications_cache_') || key.startsWith('unread_count_cache_')) {
      localStorage.removeItem(key);
    }
  });
};

// Debug function to view all notification caches
export const debugNotificationCaches = () => {
  const caches = {};
  Object.keys(localStorage).forEach(key => {
    if (key.startsWith('notifications_cache_') || key.startsWith('unread_count_cache_')) {
      try {
        caches[key] = localStorage.getItem(key);
        if (key.startsWith('notifications_cache_')) {
          caches[key] = JSON.parse(caches[key]);
        }
      } catch (err) {
        caches[key] = `Error parsing: ${err.message}`;
      }
    }
  });
  
  console.table(caches);
  return caches;
};