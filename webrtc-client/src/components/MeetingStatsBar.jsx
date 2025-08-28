import React, { useState, useEffect } from 'react';
import { Clock, Users, CircleDot, Check, X } from 'lucide-react';

export default function MeetingStatsBar({ 
  participantCount, 
  meetingStartTime, 
  roomId, 
  recordingStatus, 
  joinRequests = [], 
  showJoinRequests, 
  onToggleJoinRequests,
  isHost,
  onApproveJoinRequest,
  onDenyJoinRequest
}) {
  const [duration, setDuration] = useState('0:00');
  
  // Debug logging for participant count
  useEffect(() => {
    console.log('[MeetingStatsBar] Participant count updated:', participantCount);
  }, [participantCount]);

  useEffect(() => {
    if (!meetingStartTime) return;

    const updateDuration = () => {
      const now = new Date();
      const start = new Date(meetingStartTime);
      const diffMs = now - start;
      
      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);
      
      let formattedDuration;
      if (hours > 0) {
        formattedDuration = `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      } else {
        formattedDuration = `${minutes}:${seconds.toString().padStart(2, '0')}`;
      }
      
      setDuration(formattedDuration);
    };

    // Update immediately
    updateDuration();
    
    // Update every second
    const interval = setInterval(updateDuration, 1000);
    
    return () => clearInterval(interval);
  }, [meetingStartTime]);

  return (
    <div className="bg-black bg-opacity-80 text-white px-4 py-2 flex items-center justify-between border-b border-gray-700 flex-shrink-0">
      {/* Meeting Duration */}
      <div className="flex items-center space-x-2 text-sm">
        <Clock size={16} className="text-green-400" />
        <span className="font-mono">{duration}</span>
      </div>
      
      {/* Meeting Title/Room ID (center) */}
      <div className="text-sm font-medium text-center flex-1">
        <span className="text-gray-300">Room:</span> <span className="text-white font-mono">{roomId || 'Unknown'}</span>
      </div>
      
      {/* Participant Count and Recording Status */}
      <div className="flex items-center space-x-4 text-sm relative">
        <div className="relative">
          <div 
            className={`participants-badge flex items-center space-x-2 ${isHost && joinRequests.length > 0 ? 'cursor-pointer hover:bg-gray-700 rounded px-2 py-1' : ''}`}
            onClick={isHost && joinRequests.length > 0 ? onToggleJoinRequests : undefined}
          >
            <Users size={16} className="text-blue-400" />
            <span>{participantCount || 0}</span>
            {/* Red badge for pending join requests */}
            {isHost && joinRequests.length > 0 && (
              <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full min-w-[20px] h-5 flex items-center justify-center px-1">
                {joinRequests.length}
              </div>
            )}
          </div>
          
          {/* Dropdown for join requests */}
          {isHost && showJoinRequests && joinRequests.length > 0 && (
            <div className="join-requests-dropdown absolute top-full right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-80">
              <div className="p-3 border-b border-gray-200">
                <h3 className="text-sm font-semibold text-gray-900">Join Requests</h3>
                <p className="text-xs text-gray-500">{joinRequests.length} pending request(s)</p>
              </div>
              <div className="max-h-64 overflow-y-auto">
                {joinRequests.map((request) => (
                  <div key={request.requestId} className="p-3 border-b border-gray-100 last:border-b-0">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{request.requesterName}</div>
                        <div className="text-xs text-gray-500">Wants to join the meeting</div>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => onApproveJoinRequest?.(request.requestId)}
                          className="flex items-center justify-center w-8 h-8 bg-green-500 hover:bg-green-600 text-white rounded-full transition-colors"
                          title="Approve"
                        >
                          <Check size={14} />
                        </button>
                        <button
                          onClick={() => onDenyJoinRequest?.(request.requestId)}
                          className="flex items-center justify-center w-8 h-8 bg-red-500 hover:bg-red-600 text-white rounded-full transition-colors"
                          title="Deny"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        
        {/* Recording Indicator */}
        {recordingStatus?.isRecording && (
          <div className="flex items-center space-x-2">
            <div className="bg-red-600 rounded-full p-1 animate-pulse">
              <CircleDot size={10} className="text-white" />
            </div>
            <span className="text-xs text-red-400 font-medium">REC</span>
          </div>
        )}
      </div>
    </div>
  );
}