import React, { useState, useEffect, useRef, useContext } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { Camera, CameraOff, Mic, MicOff, Settings, User, Video } from 'lucide-react';
import API from '../api/client';

export default function PreMeetingSetup() {
  const { roomId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  
  const videoRef = useRef();
  const [stream, setStream] = useState(null);
  const [displayName, setDisplayName] = useState(user?.fullName || user?.username || '');
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isAudioOn, setIsAudioOn] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [devices, setDevices] = useState({ cameras: [], microphones: [] });
  const [selectedCamera, setSelectedCamera] = useState('');
  const [selectedMicrophone, setSelectedMicrophone] = useState('');

  // Get URL parameters to determine meeting type
  const searchParams = new URLSearchParams(location.search);
  const meetingType = searchParams.get('type') || 'direct';

  // Initialize media devices
  useEffect(() => {
    const initializeMedia = async () => {
      try {
        // Get user media permissions
        const initialStream = await navigator.mediaDevices.getUserMedia({ 
          video: true, 
          audio: true 
        });
        
        setStream(initialStream);
        
        if (videoRef.current) {
          videoRef.current.srcObject = initialStream;
        }

        // Get available devices
        const deviceList = await navigator.mediaDevices.enumerateDevices();
        const cameras = deviceList.filter(device => device.kind === 'videoinput');
        const microphones = deviceList.filter(device => device.kind === 'audioinput');
        
        setDevices({ cameras, microphones });
        
        // Set default selected devices
        if (cameras.length > 0) {
          setSelectedCamera(cameras[0].deviceId);
        }
        if (microphones.length > 0) {
          setSelectedMicrophone(microphones[0].deviceId);
        }

      } catch (err) {
        console.error('Error accessing media devices:', err);
        setError('Unable to access camera or microphone. Please check your permissions.');
      }
    };

    initializeMedia();

    // Cleanup on unmount
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Handle camera toggle
  const toggleVideo = () => {
    if (stream) {
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        const newVideoState = !isVideoOn;
        videoTrack.enabled = newVideoState;
        setIsVideoOn(newVideoState);
        console.log('[PreMeetingSetup] Video toggled:', newVideoState);
      }
    }
  };

  // Handle microphone toggle
  const toggleAudio = () => {
    if (stream) {
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !isAudioOn;
        setIsAudioOn(!isAudioOn);
      }
    }
  };

  // Handle device changes
  const changeCamera = async (deviceId) => {
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: deviceId } },
        audio: { deviceId: selectedMicrophone ? { exact: selectedMicrophone } : true }
      });
      
      // Replace video track in existing stream
      if (stream) {
        const oldVideoTrack = stream.getVideoTracks()[0];
        if (oldVideoTrack) {
          oldVideoTrack.stop();
          stream.removeTrack(oldVideoTrack);
        }
        
        const newVideoTrack = newStream.getVideoTracks()[0];
        if (newVideoTrack) {
          stream.addTrack(newVideoTrack);
        }
      }
      
      setSelectedCamera(deviceId);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      
      // Stop the temporary stream
      newStream.getTracks().forEach(track => {
        if (track.kind === 'audio') track.stop();
      });
      
    } catch (err) {
      console.error('Error changing camera:', err);
      setError('Unable to switch camera device.');
    }
  };

  const changeMicrophone = async (deviceId) => {
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: selectedCamera ? { exact: selectedCamera } : true },
        audio: { deviceId: { exact: deviceId } }
      });
      
      // Replace audio track in existing stream
      if (stream) {
        const oldAudioTrack = stream.getAudioTracks()[0];
        if (oldAudioTrack) {
          oldAudioTrack.stop();
          stream.removeTrack(oldAudioTrack);
        }
        
        const newAudioTrack = newStream.getAudioTracks()[0];
        if (newAudioTrack) {
          stream.addTrack(newAudioTrack);
        }
      }
      
      setSelectedMicrophone(deviceId);
      
      // Stop the temporary stream
      newStream.getTracks().forEach(track => {
        if (track.kind === 'video') track.stop();
      });
      
    } catch (err) {
      console.error('Error changing microphone:', err);
      setError('Unable to switch microphone device.');
    }
  };

  // Handle joining the meeting
  const joinMeeting = async () => {
    setIsLoading(true);
    setError('');

    try {
      // Update display name if changed
      if (displayName !== user.fullName && displayName.trim()) {
        try {
          await API.put('/users/profile', { fullName: displayName.trim() });
          console.log('[PreMeetingSetup] Updated display name:', displayName.trim());
        } catch (err) {
          console.warn('[PreMeetingSetup] Failed to update display name:', err);
          // Continue anyway - the display name will be used locally
        }
      }

      // Store media preferences in localStorage for MeetingPage to use
      localStorage.setItem('preMeetingSettings', JSON.stringify({
        videoEnabled: isVideoOn,
        audioEnabled: isAudioOn,
        selectedCamera,
        selectedMicrophone,
        displayName: displayName.trim() || user.fullName || user.username
      }));

      // Navigate to the appropriate meeting flow with setup=done parameter
      const params = new URLSearchParams(location.search);
      params.set('setup', 'done');
      navigate(`/meeting/${roomId}?${params.toString()}`, { replace: true });

    } catch (err) {
      console.error('Error joining meeting:', err);
      setError('Failed to join meeting. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full overflow-hidden">
        <div className="grid md:grid-cols-2 min-h-[600px]">
          {/* Video Preview Section */}
          <div className="bg-gray-900 relative flex items-center justify-center">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className={`w-full h-full object-contain bg-black ${!isVideoOn ? 'invisible' : ''}`}
            />
            {!isVideoOn && (
              <div className="absolute inset-0 w-full h-full flex items-center justify-center bg-gray-800">
                <div className="text-center">
                  <CameraOff size={64} className="text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-400">Camera is off</p>
                </div>
              </div>
            )}
            
            {/* Video controls overlay */}
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-4">
              <button
                onClick={toggleVideo}
                className={`p-3 rounded-full transition-colors ${
                  isVideoOn 
                    ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                    : 'bg-red-600 hover:bg-red-700 text-white'
                }`}
              >
                {isVideoOn ? <Camera size={20} /> : <CameraOff size={20} />}
              </button>
              
              <button
                onClick={toggleAudio}
                className={`p-3 rounded-full transition-colors ${
                  isAudioOn 
                    ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                    : 'bg-red-600 hover:bg-red-700 text-white'
                }`}
              >
                {isAudioOn ? <Mic size={20} /> : <MicOff size={20} />}
              </button>
            </div>
          </div>

          {/* Settings Section */}
          <div className="p-8 flex flex-col justify-between">
            <div>
              <div className="text-center mb-8">
                <Video className="w-12 h-12 text-blue-600 mx-auto mb-4" />
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Ready to join?</h1>
                <p className="text-gray-600">Set up your camera and microphone</p>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-6">
                  <p className="text-red-800 text-sm">{error}</p>
                </div>
              )}

              <div className="space-y-6">
                {/* Display Name */}
                <div>
                  <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 mb-2">
                    <User size={16} />
                    <span>Display Name</span>
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter your display name"
                  />
                </div>

                {/* Camera Selection */}
                {devices.cameras.length > 1 && (
                  <div>
                    <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 mb-2">
                      <Camera size={16} />
                      <span>Camera</span>
                    </label>
                    <select
                      value={selectedCamera}
                      onChange={(e) => changeCamera(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      {devices.cameras.map((camera) => (
                        <option key={camera.deviceId} value={camera.deviceId}>
                          {camera.label || `Camera ${devices.cameras.indexOf(camera) + 1}`}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Microphone Selection */}
                {devices.microphones.length > 1 && (
                  <div>
                    <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 mb-2">
                      <Mic size={16} />
                      <span>Microphone</span>
                    </label>
                    <select
                      value={selectedMicrophone}
                      onChange={(e) => changeMicrophone(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      {devices.microphones.map((microphone) => (
                        <option key={microphone.deviceId} value={microphone.deviceId}>
                          {microphone.label || `Microphone ${devices.microphones.indexOf(microphone) + 1}`}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Meeting Info */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-medium text-gray-900 mb-2">Meeting Details</h3>
                  <p className="text-sm text-gray-600">Room: {roomId}</p>
                  <p className="text-sm text-gray-600">
                    Type: {meetingType === 'waiting' ? 'Approval Required' : 'Direct Join'}
                  </p>
                </div>
              </div>
            </div>

            {/* Join Button */}
            <button
              onClick={joinMeeting}
              disabled={isLoading || !displayName.trim()}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2"
            >
              {isLoading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : (
                <>
                  <Video size={20} />
                  <span>Join Meeting</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}