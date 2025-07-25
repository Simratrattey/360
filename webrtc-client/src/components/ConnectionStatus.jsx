import React from 'react';
import { useChatSocket } from '../context/ChatSocketContext';

export default function ConnectionStatus() {
  const { connected, onlineUsers } = useChatSocket();

  return (
    <div className="fixed bottom-4 right-4 bg-white rounded-lg shadow-lg border p-3 text-sm z-50">
      <div className="flex items-center space-x-2">
        <div className={`w-3 h-3 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`}></div>
        <span className="font-medium">
          {connected ? 'Connected' : 'Disconnected'}
        </span>
      </div>
      <div className="text-gray-600 mt-1">
        Online users: {onlineUsers.size}
      </div>
      {!connected && (
        <div className="text-red-500 text-xs mt-1">
          Reconnecting...
        </div>
      )}
    </div>
  );
} 