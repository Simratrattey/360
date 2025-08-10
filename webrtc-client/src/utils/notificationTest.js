// Utility functions to test notifications

// Function to simulate a notification
export const simulateNotification = () => {
  const testNotification = {
    title: 'Test Notification',
    body: 'This is a test notification from Comm360!',
    conversationId: 'test-conversation-id'
  };

  // Show browser notification if permission is granted
  if (window.Notification && Notification.permission === 'granted') {
    new Notification(testNotification.title, { body: testNotification.body });
  } else {
    console.warn('Notification permission not granted');
  }
};
export const testBrowserNotification = () => {
  if (!('Notification' in window)) {
    console.error('❌ Browser notifications not supported');
    return false;
  }

  if (Notification.permission === 'granted') {
    try {
      const notification = new Notification('Test Notification', {
        body: 'This is a test notification from Comm360',
        icon: '/favicon.ico',
        tag: 'test-notification'
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      setTimeout(() => {
        notification.close();
      }, 5000);

      console.log('✅ Test notification sent');
      return true;
    } catch (error) {
      console.error('❌ Error creating test notification:', error);
      return false;
    }
  } else if (Notification.permission === 'default') {
    Notification.requestPermission().then(permission => {
      if (permission === 'granted') {
        console.log('✅ Notification permission granted');
        testBrowserNotification(); // Retry after permission granted
      } else {
        console.error('❌ Notification permission denied');
      }
    });
    return false;
  } else {
    console.error('❌ Notification permission denied');
    return false;
  }
};

export const checkNotificationSupport = () => {
  const support = {
    browserSupport: 'Notification' in window,
    permission: Notification.permission,
    https: window.location.protocol === 'https:',
    serviceWorker: 'serviceWorker' in navigator
  };

  console.log('🔍 Notification Support Check:', support);
  return support;
};

export const requestNotificationPermission = async () => {
  if (!('Notification' in window)) {
    console.error('❌ Notifications not supported');
    return false;
  }

  if (Notification.permission === 'granted') {
    console.log('✅ Notification permission already granted');
    return true;
  }

  if (Notification.permission === 'denied') {
    console.error('❌ Notification permission denied. Please enable in browser settings.');
    return false;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      console.log('✅ Notification permission granted');
      return true;
    } else {
      console.error('❌ Notification permission denied');
      return false;
    }
  } catch (error) {
    console.error('❌ Error requesting notification permission:', error);
    return false;
  }
};

// Test function to simulate a notification from the server
export const simulateServerNotification = (socket) => {
  if (!socket) {
    console.error('❌ Socket not available');
    return;
  }

  const testNotification = {
    _id: 'test-' + Date.now(),
    title: 'Test Server Notification',
    message: 'This is a test notification from the server',
    type: 'system',
    sender: {
      fullName: 'Test System',
      username: 'system'
    },
    data: {},
    createdAt: new Date().toISOString(),
    read: false
  };

  console.log('🔔 Simulating server notification:', testNotification);
  
  // Manually trigger the notification event
  if (socket.emit) {
    // This won't actually send to server, just for testing client-side handling
    socket.emit('notification:new', testNotification);
  }
};

export default {
  testBrowserNotification,
  checkNotificationSupport,
  requestNotificationPermission,
  simulateServerNotification
};
