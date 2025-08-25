import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, Clock, AlertCircle } from 'lucide-react';
import { messageQueue } from '../services/messageQueue';

export default function NetworkStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [queueStatus, setQueueStatus] = useState({ retryQueue: 0, offlineQueue: 0 });

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Listen for queue changes
    const unsubscribe = messageQueue.addListener((event) => {
      const status = messageQueue.getQueueStatus();
      setQueueStatus({
        retryQueue: status.retryQueue,
        offlineQueue: status.offlineQueue
      });
    });

    // Initial queue status
    const status = messageQueue.getQueueStatus();
    setQueueStatus({
      retryQueue: status.retryQueue,
      offlineQueue: status.offlineQueue
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubscribe();
    };
  }, []);

  const totalPending = queueStatus.retryQueue + queueStatus.offlineQueue;

  if (isOnline && totalPending === 0) {
    return null; // Don't show anything when everything is normal
  }

  return (
    <div className={`fixed bottom-4 right-4 z-50 p-3 rounded-lg shadow-lg border flex items-center space-x-2 text-sm transition-all ${
      !isOnline 
        ? 'bg-red-50 border-red-200 text-red-800' 
        : totalPending > 0
        ? 'bg-yellow-50 border-yellow-200 text-yellow-800'
        : 'bg-green-50 border-green-200 text-green-800'
    }`}>
      {!isOnline ? (
        <>
          <WifiOff className="h-4 w-4" />
          <span>Offline - Messages will be sent when connection is restored</span>
        </>
      ) : totalPending > 0 ? (
        <>
          <Clock className="h-4 w-4 animate-pulse" />
          <span>Sending {totalPending} queued message{totalPending > 1 ? 's' : ''}...</span>
        </>
      ) : (
        <>
          <Wifi className="h-4 w-4" />
          <span>Connected</span>
        </>
      )}
    </div>
  );
}