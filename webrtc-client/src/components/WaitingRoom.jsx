import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { SocketContext } from '../context/SocketContext';
import API from '../api/client';
import { Users, Clock, CheckCircle, XCircle, Loader } from 'lucide-react';

export default function WaitingRoom() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const { sfuSocket } = useContext(SocketContext);
  
  const [meetingInfo, setMeetingInfo] = useState(null);
  const [requestStatus, setRequestStatus] = useState('idle'); // 'idle', 'sending', 'pending', 'approved', 'denied'
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load meeting information
  useEffect(() => {
    const loadMeetingInfo = async () => {
      try {
        setLoading(true);
        const response = await API.get(`/meetings/${roomId}/info`);
        if (response.data.success) {
          setMeetingInfo(response.data.meeting);
        } else {
          setError('Meeting not found');
        }
      } catch (error) {
        console.error('Error loading meeting info:', error);
        setError('Failed to load meeting information');
      } finally {
        setLoading(false);
      }
    };

    if (roomId && user) {
      loadMeetingInfo();
    }
  }, [roomId, user]);

  // Listen for join approval/denial
  useEffect(() => {
    if (!sfuSocket) return;

    const handleJoinApproval = (data) => {
      console.log('Join approval received:', data);
      if (data.meetingId === roomId) {
        if (data.approved) {
          setRequestStatus('approved');
          // Automatically redirect to meeting after 1 second
          setTimeout(() => {
            navigate(`/meeting/${roomId}?type=direct`);
          }, 1000);
        } else {
          setRequestStatus('denied');
          setError(data.reason || 'Your request to join was denied');
        }
      }
    };

    sfuSocket.on('joinApproval', handleJoinApproval);

    return () => {
      sfuSocket.off('joinApproval', handleJoinApproval);
    };
  }, [sfuSocket, roomId, navigate]);

  // Request to join meeting
  const handleRequestJoin = async () => {
    if (!user || !meetingInfo) return;

    try {
      setRequestStatus('sending');
      setError(null);

      const response = await API.post(`/meetings/${roomId}/request-join`);
      
      if (response.data.success) {
        setRequestStatus('pending');
      } else {
        setError(response.data.error || 'Failed to send join request');
        setRequestStatus('idle');
      }
    } catch (error) {
      console.error('Error requesting to join:', error);
      setError('Failed to send join request. Please try again.');
      setRequestStatus('idle');
    }
  };

  // Join directly (if user is already authorized)
  const handleJoinDirectly = () => {
    navigate(`/meeting/${roomId}?type=direct`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <Loader className="h-8 w-8 animate-spin text-indigo-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading meeting information...</p>
        </div>
      </div>
    );
  }

  if (error && !meetingInfo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full mx-4 text-center">
          <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Meeting Not Found</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 transition-colors"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full mx-4">
        {/* Meeting Info */}
        <div className="text-center mb-8">
          <div className="bg-indigo-100 rounded-full p-3 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
            <Users className="h-8 w-8 text-indigo-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {meetingInfo?.title || 'Meeting'}
          </h1>
          <p className="text-gray-600 mb-4">
            Hosted by {meetingInfo?.organizer?.fullName || meetingInfo?.organizer?.username}
          </p>
          {meetingInfo?.description && (
            <p className="text-sm text-gray-500 mb-4">{meetingInfo.description}</p>
          )}
        </div>

        {/* Request Status */}
        {requestStatus === 'idle' && (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <Clock className="h-12 w-12 text-orange-500 mx-auto mb-3" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Waiting Room</h2>
              <p className="text-gray-600 text-sm">
                This meeting requires approval from the host to join. Click below to request access.
              </p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4">
                <p className="text-red-800 text-sm">{error}</p>
              </div>
            )}

            <button
              onClick={handleRequestJoin}
              className="w-full bg-indigo-600 text-white py-3 px-4 rounded-md hover:bg-indigo-700 transition-colors font-medium"
            >
              Request to Join Meeting
            </button>

            {/* Check if user might be authorized already */}
            {user && meetingInfo && (
              (meetingInfo.organizer._id === user.id || 
               meetingInfo.participants?.some(p => p._id === user.id || p === user.id)) && (
                <button
                  onClick={handleJoinDirectly}
                  className="w-full bg-green-600 text-white py-3 px-4 rounded-md hover:bg-green-700 transition-colors font-medium"
                >
                  Join Meeting Directly
                </button>
              )
            )}
          </div>
        )}

        {requestStatus === 'sending' && (
          <div className="text-center py-8">
            <Loader className="h-12 w-12 animate-spin text-indigo-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Sending Request...</h2>
            <p className="text-gray-600 text-sm">Please wait while we send your request to the host.</p>
          </div>
        )}

        {requestStatus === 'pending' && (
          <div className="text-center py-8">
            <Clock className="h-12 w-12 text-orange-500 mx-auto mb-4 animate-pulse" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Request Sent!</h2>
            <p className="text-gray-600 text-sm">
              Your request has been sent to the meeting host. Please wait for approval.
            </p>
            <div className="mt-6 p-4 bg-orange-50 rounded-md">
              <p className="text-orange-800 text-sm font-medium">
                The host will receive a notification about your request
              </p>
            </div>
          </div>
        )}

        {requestStatus === 'approved' && (
          <div className="text-center py-8">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Request Approved!</h2>
            <p className="text-gray-600 text-sm">
              You've been approved to join the meeting. Redirecting now...
            </p>
            <div className="mt-4">
              <Loader className="h-6 w-6 animate-spin text-indigo-600 mx-auto" />
            </div>
          </div>
        )}

        {requestStatus === 'denied' && (
          <div className="text-center py-8">
            <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Request Denied</h2>
            <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
            <button
              onClick={() => navigate('/')}
              className="w-full bg-gray-600 text-white py-2 px-4 rounded-md hover:bg-gray-700 transition-colors"
            >
              Go to Dashboard
            </button>
          </div>
        )}

        {/* Meeting Details Footer */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <div className="flex justify-between text-sm text-gray-500">
            <span>Meeting ID: {roomId}</span>
            <span>{new Date(meetingInfo?.startTime).toLocaleDateString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
}