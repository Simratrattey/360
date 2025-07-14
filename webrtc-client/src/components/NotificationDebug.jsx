import React, { useState } from 'react';
import { useChatSocket } from '../context/ChatSocketContext';
import { useNotifications } from '../context/NotificationContext';

export default function NotificationDebug() {
  const [status, setStatus] = useState('');
  const { socket } = useChatSocket();
  const { refreshNotifications } = useNotifications();

  const testNotification = () => {
    try {
      if (!('Notification' in window)) {
        setStatus('❌ Notifications not supported');
        return;
      }

      if (Notification.permission === 'granted') {
        const notification = new Notification('Test Notification', {
          body: 'This is a test notification from Comm360!',
          icon: '/favicon.ico'
        });
        setStatus('✅ Test notification sent!');
        
        notification.onclick = () => {
          window.focus();
          notification.close();
        };
        
        setTimeout(() => notification.close(), 5000);
      } else if (Notification.permission === 'denied') {
        setStatus('❌ Notifications blocked. Please enable in browser settings.');
      } else {
        Notification.requestPermission().then(permission => {
          if (permission === 'granted') {
            setStatus('✅ Permission granted! Try the test again.');
          } else {
            setStatus('❌ Permission denied');
          }
        });
      }
    } catch (error) {
      setStatus(`❌ Error: ${error.message}`);
    }
  };

  const testSocketNotification = () => {
    if (!socket) {
      setStatus('❌ Socket not connected');
      return;
    }

    // Simulate receiving a notification event from server
    const testPayload = {
      title: 'Test Socket Notification',
      body: 'This is a test notification sent via socket!',
      conversationId: 'test-conversation',
      messageId: 'test-message-' + Date.now()
    };

    // Manually trigger the notification event handler by simulating the event
    console.log('Simulating notify-message event:', testPayload);
    
    // Create a mock event and call the handler directly
    const mockEvent = {
      title: testPayload.title,
      body: testPayload.body,
      conversationId: testPayload.conversationId,
      messageId: testPayload.messageId
    };

    // Trigger the notification manually
    if (window.Notification && Notification.permission === 'granted') {
      try {
        const notification = new Notification(mockEvent.title, {
          body: mockEvent.body,
          icon: '/favicon.ico',
          tag: `message-${mockEvent.messageId}`
        });

        notification.onclick = () => {
          window.focus();
          if (mockEvent.conversationId) {
            window.location.href = `/messages?conversation=${mockEvent.conversationId}`;
          }
          notification.close();
        };

        setTimeout(() => {
          notification.close();
        }, 5000);

        setStatus('✅ Socket notification test sent! Check for browser notification.');
      } catch (error) {
        console.error('Error creating test notification:', error);
        setStatus(`❌ Error: ${error.message}`);
      }
    } else {
      setStatus('❌ Notification permission not granted');
    }
  };

  const testMeetingNotification = () => {
    if (!socket) {
      setStatus('❌ Socket not connected');
      return;
    }

    // Simulate receiving a meeting notification event from server
    const testNotification = {
      _id: 'test-notification-' + Date.now(),
      title: 'Test Meeting Invitation',
      message: 'This is a test meeting invitation notification!',
      type: 'meeting_invitation',
      sender: {
        fullName: 'Test User',
        username: 'testuser'
      },
      data: {
        meetingId: 'test-meeting-id',
        roomId: 'test-room-id',
        startTime: new Date().toISOString(),
        durationMinutes: 30
      },
      createdAt: new Date().toISOString()
    };

    console.log('Simulating notification:new event:', testNotification);
    
    // Manually trigger the notification by creating a browser notification
    if (window.Notification && Notification.permission === 'granted') {
      try {
        const notification = new Notification(testNotification.title, {
          body: testNotification.message,
          icon: '/favicon.ico'
        });
        
        notification.onclick = () => {
          window.focus();
          notification.close();
        };
        
        setTimeout(() => {
          notification.close();
        }, 5000);

        setStatus('✅ Meeting notification test sent! Check for browser notification.');
      } catch (error) {
        console.error('Error creating test meeting notification:', error);
        setStatus(`❌ Error: ${error.message}`);
      }
    } else {
      setStatus('❌ Notification permission not granted');
    }
  };

  const testRealSocketEvents = () => {
    if (!socket) {
      setStatus('❌ Socket not connected');
      return;
    }

    // Test the actual socket event handlers by simulating server events
    console.log('Testing real socket event handlers...');
    
    // Test message notification
    const messagePayload = {
      title: 'Real Message Test',
      body: 'This is a real message notification test!',
      conversationId: 'test-conversation',
      messageId: 'test-message-' + Date.now()
    };

    // Simulate the server sending a notify-message event
    socket.onevent({
      data: ['notify-message', messagePayload]
    });

    // Test meeting notification
    const meetingPayload = {
      _id: 'test-notification-' + Date.now(),
      title: 'Real Meeting Test',
      message: 'This is a real meeting notification test!',
      type: 'meeting_invitation',
      sender: {
        fullName: 'Test User',
        username: 'testuser'
      },
      data: {
        meetingId: 'test-meeting-id',
        roomId: 'test-room-id',
        startTime: new Date().toISOString(),
        durationMinutes: 30
      },
      createdAt: new Date().toISOString()
    };

    // Simulate the server sending a notification:new event
    socket.onevent({
      data: ['notification:new', meetingPayload]
    });

    setStatus('✅ Real socket events triggered! Check console and notifications.');
  };

  const testMessageNotification = () => {
    if (!socket) {
      setStatus('❌ Socket not connected');
      return;
    }

    // Test message notification specifically
    console.log('Testing message notification...');
    
    const messagePayload = {
      title: 'Test Message from User',
      body: 'This is a test message notification!',
      conversationId: 'test-conversation-' + Date.now(),
      messageId: 'test-message-' + Date.now()
    };

    // Simulate receiving a notify-message event from the server
    console.log('🔔 Simulating notify-message event:', messagePayload);
    
    // Try to trigger the event handler directly
    if (socket.onevent) {
      socket.onevent({
        data: ['notify-message', messagePayload]
      });
    } else {
      // Fallback: create notification directly
      if (window.Notification && Notification.permission === 'granted') {
        try {
          const notification = new Notification(messagePayload.title, {
            body: messagePayload.body,
            icon: '/favicon.ico',
            tag: `message-${messagePayload.messageId}`
          });

          notification.onclick = () => {
            window.focus();
            notification.close();
          };

          setTimeout(() => {
            notification.close();
          }, 5000);

          setStatus('✅ Message notification test sent! Check for browser notification.');
        } catch (error) {
          console.error('Error creating message notification:', error);
          setStatus(`❌ Error: ${error.message}`);
        }
      } else {
        setStatus('❌ Notification permission not granted');
      }
    }
  };

  const testContextConnection = () => {
    console.log('Testing notification context connection...');
    console.log('Socket available:', !!socket);
    console.log('Socket connected:', socket?.connected);
    console.log('Notification permission:', Notification.permission);
    console.log('HTTPS:', window.location.protocol === 'https:');
    
    // Test if we can access the notification context
    try {
      refreshNotifications();
      console.log('✅ Notification context is accessible');
      setStatus('✅ Context connection test passed! Check console for details.');
    } catch (error) {
      console.error('❌ Notification context error:', error);
      setStatus(`❌ Context error: ${error.message}`);
    }
  };

  const testBrowserNotificationSettings = () => {
    console.log('🔍 Testing browser notification settings...');
    
    // Check basic support
    if (!('Notification' in window)) {
      setStatus('❌ Notifications not supported in this browser');
      return;
    }
    
    console.log('✅ Notification API supported');
    console.log('🔍 Permission:', Notification.permission);
    console.log('🔍 Window focused:', document.hasFocus());
    console.log('🔍 HTTPS:', window.location.protocol === 'https:');
    console.log('🔍 User agent:', navigator.userAgent);
    
    // Test notification creation
    if (Notification.permission === 'granted') {
      try {
        console.log('🔍 Creating test notification...');
        const testNotification = new Notification('Browser Test', {
          body: 'Testing browser notification display',
          icon: '/favicon.ico',
          tag: 'browser-test',
          requireInteraction: true, // Force user interaction
          silent: false
        });
        
        testNotification.onshow = () => {
          console.log('🔍 Notification shown event fired');
          setStatus('✅ Notification shown! Check if you can see it.');
        };
        
        testNotification.onerror = (error) => {
          console.error('🔍 Notification error:', error);
          setStatus('❌ Notification error occurred');
        };
        
        testNotification.onclick = () => {
          console.log('🔍 Notification clicked');
          testNotification.close();
          setStatus('✅ Notification clicked! Browser notifications are working.');
        };
        
        // Auto-close after 10 seconds
        setTimeout(() => {
          testNotification.close();
          console.log('🔍 Test notification auto-closed');
        }, 10000);
        
        setStatus('🔍 Test notification created - check if you can see it');
        
      } catch (error) {
        console.error('🔍 Error creating test notification:', error);
        setStatus(`❌ Error: ${error.message}`);
      }
    } else {
      setStatus('❌ Notification permission not granted');
    }
  };

  const testAlternativeNotification = () => {
    console.log('🔍 Testing alternative notification methods...');
    
    // Method 1: Try with different notification options
    try {
      const notification1 = new Notification('Test 1 - Simple', {
        body: 'Simple notification test',
        silent: true
      });
      console.log('🔍 Simple notification created');
      
      setTimeout(() => notification1.close(), 3000);
    } catch (error) {
      console.error('🔍 Simple notification failed:', error);
    }
    
    // Method 2: Try with different icon
    try {
      const notification2 = new Notification('Test 2 - No Icon', {
        body: 'Notification without icon',
        silent: true
      });
      console.log('🔍 No-icon notification created');
      
      setTimeout(() => notification2.close(), 3000);
    } catch (error) {
      console.error('🔍 No-icon notification failed:', error);
    }
    
    // Method 3: Try with different tag
    try {
      const notification3 = new Notification('Test 3 - Unique Tag', {
        body: 'Notification with unique tag',
        tag: 'unique-test-' + Date.now(),
        silent: true
      });
      console.log('🔍 Unique tag notification created');
      
      setTimeout(() => notification3.close(), 3000);
    } catch (error) {
      console.error('🔍 Unique tag notification failed:', error);
    }
    
    setStatus('🔍 Created 3 different test notifications - check if any appear');
  };

  const testSystemNotification = () => {
    console.log('🔍 Testing system-level notification...');
    
    // Check if we can use the newer Notification API features
    if ('serviceWorker' in navigator) {
      console.log('🔍 Service Worker available');
    }
    
    // Try to create a notification with all possible options
    try {
      const notification = new Notification('System Test', {
        body: 'Testing system notification capabilities',
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: 'system-test',
        requireInteraction: false,
        silent: false,
        vibrate: [200, 100, 200]
      });
      
      notification.onshow = () => {
        console.log('🔍 System notification shown');
        setStatus('✅ System notification shown!');
      };
      
      notification.onerror = (error) => {
        console.error('🔍 System notification error:', error);
        setStatus('❌ System notification error');
      };
      
      notification.onclick = () => {
        console.log('🔍 System notification clicked');
        notification.close();
        setStatus('✅ System notification clicked!');
      };
      
      setTimeout(() => {
        notification.close();
        console.log('🔍 System notification closed');
      }, 5000);
      
    } catch (error) {
      console.error('🔍 System notification failed:', error);
      setStatus(`❌ System notification failed: ${error.message}`);
    }
  };

  const showInAppNotification = () => {
    console.log('🔍 Showing in-app notification...');
    
    // Create a visual notification within the app
    const notificationDiv = document.createElement('div');
    notificationDiv.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #4CAF50;
      color: white;
      padding: 15px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 10000;
      font-family: Arial, sans-serif;
      font-size: 14px;
      max-width: 300px;
      animation: slideIn 0.3s ease-out;
    `;
    
    notificationDiv.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 5px;">In-App Notification</div>
      <div>This is a test notification within the app</div>
    `;
    
    // Add CSS animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(notificationDiv);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      notificationDiv.style.animation = 'slideOut 0.3s ease-in';
      setTimeout(() => {
        document.body.removeChild(notificationDiv);
        document.head.removeChild(style);
      }, 300);
    }, 5000);
    
    setStatus('✅ In-app notification shown! You should see a green notification box.');
  };

  const checkStatus = () => {
    if (!('Notification' in window)) {
      setStatus('❌ Notifications not supported');
      return;
    }
    
    switch (Notification.permission) {
      case 'granted':
        setStatus('✅ Notifications enabled');
        break;
      case 'denied':
        setStatus('❌ Notifications blocked');
        break;
      case 'default':
        setStatus('⚠️ Permission not requested yet');
        break;
      default:
        setStatus('❓ Unknown status');
    }
  };

  return (
    <div className="p-4 bg-white rounded-lg shadow border max-w-md mx-auto">
      <h3 className="text-lg font-semibold mb-4">Notification Debug</h3>
      
      <div className="space-y-3">
        <button
          onClick={checkStatus}
          className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Check Status
        </button>
        
        <button
          onClick={testNotification}
          className="w-full px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
        >
          Send Test Notification
        </button>

        <button
          onClick={testSocketNotification}
          className="w-full px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
        >
          Test Socket Notification
        </button>

        <button
          onClick={testMeetingNotification}
          className="w-full px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600"
        >
          Test Meeting Notification
        </button>

        <button
          onClick={testRealSocketEvents}
          className="w-full px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
        >
          Test Real Socket Events
        </button>

        <button
          onClick={testMessageNotification}
          className="w-full px-4 py-2 bg-teal-500 text-white rounded hover:bg-teal-600"
        >
          Test Message Notification
        </button>

        <button
          onClick={testContextConnection}
          className="w-full px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600"
        >
          Test Context Connection
        </button>

        <button
          onClick={testBrowserNotificationSettings}
          className="w-full px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600"
        >
          Test Browser Notification Settings
        </button>

        <button
          onClick={testAlternativeNotification}
          className="w-full px-4 py-2 bg-pink-500 text-white rounded hover:bg-pink-600"
        >
          Test Alternative Notification Methods
        </button>

        <button
          onClick={testSystemNotification}
          className="w-full px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
        >
          Test System-Level Notification
        </button>

        <button
          onClick={showInAppNotification}
          className="w-full px-4 py-2 bg-blue-700 text-white rounded hover:bg-blue-800"
        >
          Show In-App Notification
        </button>
        
        {status && (
          <div className="p-3 bg-gray-100 rounded text-sm">
            {status}
          </div>
        )}
        
        <div className="text-xs text-gray-600">
          <p>Current permission: {Notification.permission || 'unknown'}</p>
          <p>HTTPS: {window.location.protocol === 'https:' ? 'Yes' : 'No'}</p>
          <p>Socket connected: {socket ? 'Yes' : 'No'}</p>
        </div>
      </div>
    </div>
  );
} 