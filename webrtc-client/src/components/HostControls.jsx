import React, { useContext } from 'react';
import { SocketContext } from '../context/SocketContext.jsx';

export default function HostControls() {
  const { roomSettings, toggleAvatarApi } = useContext(SocketContext);

  // Only show controls if user is the host
  if (!roomSettings.isHost) {
    return null;
  }

  const handleToggleAvatarApi = () => {
    toggleAvatarApi(!roomSettings.avatarApiEnabled);
  };

  return (
    <div className="absolute top-4 left-4 bg-black bg-opacity-50 p-3 rounded-lg z-30">
      <div className="text-white text-sm mb-2 font-medium">Host Controls</div>
      <div className="flex items-center space-x-3">
        <label className="flex items-center space-x-2 text-white text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={roomSettings.avatarApiEnabled}
            onChange={handleToggleAvatarApi}
            className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
          />
          <span>Enable Avatar API</span>
        </label>
      </div>
      <div className="text-xs text-gray-400 mt-1">
        {roomSettings.avatarApiEnabled 
          ? 'Participants can interact with the avatar' 
          : 'Avatar interactions are disabled'
        }
      </div>
    </div>
  );
}