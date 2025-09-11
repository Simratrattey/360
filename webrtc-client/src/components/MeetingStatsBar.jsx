import React, { useState, useEffect } from 'react';
import { Clock, Users, CircleDot, Check, X, ChevronDown, Share2, Copy } from 'lucide-react';

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
  onDenyJoinRequest,
  participantMap = {},
  inviteLink = '',
  onCopyInviteLink
}) {
  const [duration, setDuration] = useState('0:00');
  const [showParticipantsDropdown, setShowParticipantsDropdown] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  
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

  const handleCopyInviteLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopySuccess(true);
      if (onCopyInviteLink) onCopyInviteLink();
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  };

  // Get participant list from participantMap
  const participants = Object.entries(participantMap).map(([peerId, name]) => ({
    id: peerId,
    name: name || 'Unknown'
  }));

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
            className="participants-badge flex items-center space-x-2 cursor-pointer hover:bg-gray-700 rounded px-2 py-1"
            onClick={() => {
              if (isHost && joinRequests.length > 0 && !showParticipantsDropdown) {
                onToggleJoinRequests();
              } else {
                setShowParticipantsDropdown(!showParticipantsDropdown);
              }
            }}
          >
            <Users size={16} className="text-blue-400" />
            <span>{participantCount || 0}</span>
            <ChevronDown size={14} className={`text-gray-400 transition-transform ${showParticipantsDropdown ? 'rotate-180' : ''}`} />
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

          {/* Participants Dropdown */}
          {showParticipantsDropdown && (
            <div className="participants-dropdown absolute top-full right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-80">
              {/* Header */}
              <div className="p-3 border-b border-gray-200">
                <h3 className="text-sm font-semibold text-gray-900">Participants ({participantCount})</h3>
              </div>

              {/* Participants List */}
              <div className="max-h-64 overflow-y-auto">
                {participants.map((participant, index) => (
                  <div key={participant.id || index} className="p-3 border-b border-gray-100 last:border-b-0">
                    <div className="flex items-center space-x-3">
                      <div className="h-8 w-8 bg-gradient-to-br from-blue-400 to-purple-400 rounded-full flex items-center justify-center text-white font-bold text-sm">
                        {participant.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium text-gray-900">{participant.name}</div>
                        <div className="text-xs text-gray-500">
                          {participant.id === 'local' ? 'You' : 'Participant'}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Invite Section */}
              {inviteLink && (
                <div className="p-3 border-t border-gray-200 bg-blue-50">
                  <div className="flex items-center space-x-2 mb-2">
                    <Share2 size={16} className="text-blue-600" />
                    <span className="text-sm font-semibold text-gray-900">Invite Others</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={inviteLink}
                      readOnly
                      className="flex-1 text-xs bg-white border border-gray-300 rounded px-2 py-1 text-gray-600"
                    />
                    <button
                      onClick={handleCopyInviteLink}
                      className={`px-3 py-1 text-xs rounded font-medium transition-colors ${
                        copySuccess 
                          ? 'bg-green-600 text-white' 
                          : 'bg-blue-600 hover:bg-blue-700 text-white'
                      }`}
                    >
                      {copySuccess ? (
                        <div className="flex items-center space-x-1">
                          <Check size={12} />
                          <span>Copied!</span>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-1">
                          <Copy size={12} />
                          <span>Copy</span>
                        </div>
                      )}
                    </button>
                  </div>
                  <div className="text-xs text-gray-600 mt-1">
                    Anyone with this link can join the meeting.
                  </div>
                </div>
              )}
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