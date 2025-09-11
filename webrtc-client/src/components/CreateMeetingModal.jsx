import React, { useState } from 'react';
import { X, Video, Eye, Lock, Users } from 'lucide-react';
import { generateRoomId, openMeetingWindow } from '../utils/meetingWindow';

const VISIBILITY_OPTIONS = [
  {
    id: 'public',
    label: 'Public Meeting',
    description: 'Visible in active rooms, anyone can join',
    icon: Eye,
    color: 'text-green-600 bg-green-50'
  },
  {
    id: 'approval',
    label: 'Approval Required',
    description: 'Visible in active rooms, host approval needed',
    icon: Users,
    color: 'text-blue-600 bg-blue-50'
  },
  {
    id: 'private',
    label: 'Private Meeting',
    description: 'Hidden from active rooms, invite only',
    icon: Lock,
    color: 'text-purple-600 bg-purple-50'
  }
];

export default function CreateMeetingModal({ isOpen, onClose, onMeetingCreated }) {
  const [meetingName, setMeetingName] = useState('');
  const [visibility, setVisibility] = useState('public');
  const [isCreating, setIsCreating] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!meetingName.trim()) return;

    setIsCreating(true);
    try {
      const roomId = generateRoomId();
      
      // Store meeting info in localStorage for the meeting page to pass via socket
      const meetingInfo = {
        roomId,
        name: meetingName.trim(),
        visibility,
        createdAt: new Date().toISOString()
      };
      
      localStorage.setItem(`meeting-${roomId}`, JSON.stringify(meetingInfo));
      console.log('[CreateMeeting] Stored meeting info locally:', meetingInfo);
      
      // Open meeting window
      openMeetingWindow(roomId);
      
      // Reset form and close modal
      setMeetingName('');
      setVisibility('public');
      onClose();
      
      // Notify parent to reload active rooms
      if (onMeetingCreated) {
        onMeetingCreated();
      }
    } catch (error) {
      console.error('Error creating meeting:', error);
      alert('Failed to create meeting. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    setMeetingName('');
    setVisibility('public');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Video className="h-6 w-6 text-blue-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Start New Meeting</h2>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Meeting Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Meeting Name
            </label>
            <input
              type="text"
              value={meetingName}
              onChange={(e) => setMeetingName(e.target.value)}
              placeholder="Enter meeting name..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
              required
              autoFocus
            />
          </div>

          {/* Visibility Options */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Meeting Visibility
            </label>
            <div className="space-y-3">
              {VISIBILITY_OPTIONS.map((option) => {
                const Icon = option.icon;
                return (
                  <label
                    key={option.id}
                    className={`flex items-start space-x-3 p-4 border-2 rounded-lg cursor-pointer transition-all hover:bg-gray-50 ${
                      visibility === option.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200'
                    }`}
                  >
                    <input
                      type="radio"
                      name="visibility"
                      value={option.id}
                      checked={visibility === option.id}
                      onChange={(e) => setVisibility(e.target.value)}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <div className={`p-2 rounded-lg ${option.color}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <span className="font-medium text-gray-900">{option.label}</span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{option.description}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>


          {/* Action Buttons */}
          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-4 py-3 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!meetingName.trim() || isCreating}
              className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center justify-center space-x-2"
            >
              {isCreating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Creating...</span>
                </>
              ) : (
                <>
                  <Video className="h-4 w-4" />
                  <span>Start Meeting</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}