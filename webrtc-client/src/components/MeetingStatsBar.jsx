import React, { useState, useEffect } from 'react';
import { Clock, Users, CircleDot } from 'lucide-react';

export default function MeetingStatsBar({ participantCount, meetingStartTime, roomId, recordingStatus }) {
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
      <div className="flex items-center space-x-4 text-sm">
        <div className="flex items-center space-x-2">
          <Users size={16} className="text-blue-400" />
          <span>{participantCount || 0}</span>
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