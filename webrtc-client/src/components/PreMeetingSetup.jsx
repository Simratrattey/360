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
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-50 flex items-center justify-center p-4">
      <div className="bg-white/20 backdrop-blur-2xl rounded-3xl shadow-2xl max-w-5xl w-full overflow-hidden border border-white/20">
        <div className="grid md:grid-cols-2 min-h-[650px]">
          {/* Video Preview Section */}
          <div className="bg-slate-900 relative flex items-center justify-center rounded-l-3xl">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className={`w-full h-full object-contain bg-black rounded-l-3xl ${!isVideoOn ? 'invisible' : ''}`}
            />
            {!isVideoOn && (
              <div className="absolute inset-0 w-full h-full flex items-center justify-center bg-slate-900 rounded-l-3xl">
                <div className="text-center">
                  <div className="bg-slate-700/50 backdrop-blur-sm rounded-2xl p-8 border border-slate-600/50">
                    <CameraOff size={72} className="text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-300 text-lg font-medium">Camera is off</p>
                    <p className="text-slate-400 text-sm mt-2">Click the camera button to turn it on</p>
                  </div>
                </div>
              </div>
            )}
            
            {/* Video controls overlay */}
            <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex space-x-3">
              <button
                onClick={toggleVideo}
                className={`p-4 rounded-full backdrop-blur-md border transition-all duration-200 ${
                  isVideoOn 
                    ? 'bg-white/20 border-white/30 text-white hover:bg-white/30' 
                    : 'bg-red-500/90 border-red-400/50 text-white hover:bg-red-600/90'
                } shadow-lg hover:scale-105`}
                title={isVideoOn ? "Turn off camera" : "Turn on camera"}
              >
                {isVideoOn ? <Camera size={22}/> : <CameraOff size={22}/>} 
              </button>
              
              <button
                onClick={toggleAudio}
                className={`p-4 rounded-full backdrop-blur-md border transition-all duration-200 ${
                  isAudioOn 
                    ? 'bg-white/20 border-white/30 text-white hover:bg-white/30' 
                    : 'bg-red-500/90 border-red-400/50 text-white hover:bg-red-600/90'
                } shadow-lg hover:scale-105`}
                title={isAudioOn ? "Mute microphone" : "Unmute microphone"}
              >
                {isAudioOn ? <Mic size={22}/> : <MicOff size={22}/>} 
              </button>
            </div>
          </div>

          {/* Settings Section */}
          <div className="p-10 flex flex-col justify-between bg-white/10 backdrop-blur-2xl">
            <div>
              <div className="text-center mb-10">
                <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl">
                  <Video className="w-8 h-8 text-white" />
                </div>
                <h1 className="text-3xl font-bold text-black mb-3">Ready to join?</h1>
                <p className="text-gray-700 text-lg font-medium">Set up your camera and microphone</p>
              </div>

              {error && (
                <div className="bg-red-50/80 backdrop-blur-sm border border-red-200/60 rounded-xl p-4 mb-8 shadow-sm">
                  <p className="text-red-800 text-sm font-medium">{error}</p>
                </div>
              )}

              <div className="space-y-8">
                {/* Display Name */}
                <div>
                  <label className="flex items-center space-x-2 text-sm font-semibold text-black mb-3">
                    <div className="w-5 h-5 bg-gradient-to-r from-blue-500 to-purple-600 rounded-md flex items-center justify-center shadow-md">
                      <User size={12} className="text-white" />
                    </div>
                    <span>Display Name</span>
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full px-4 py-3 border border-white/30 rounded-xl focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 bg-white/20 backdrop-blur-md shadow-lg transition-all duration-200 hover:shadow-xl text-black placeholder-gray-500 font-medium"
                    placeholder="Enter your display name"
                  />
                </div>

                {/* Camera Selection */}
                {devices.cameras.length > 1 && (
                  <div>
                    <label className="flex items-center space-x-2 text-sm font-semibold text-black mb-3">
                      <div className="w-5 h-5 bg-gradient-to-r from-blue-500 to-purple-600 rounded-md flex items-center justify-center shadow-md">
                        <Camera size={12} className="text-white" />
                      </div>
                      <span>Camera</span>
                    </label>
                    <select
                      value={selectedCamera}
                      onChange={(e) => changeCamera(e.target.value)}
                      className="w-full px-4 py-3 border border-white/30 rounded-xl focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 bg-white/20 backdrop-blur-md shadow-lg transition-all duration-200 hover:shadow-xl text-black font-medium"
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
                    <label className="flex items-center space-x-2 text-sm font-semibold text-black mb-3">
                      <div className="w-5 h-5 bg-gradient-to-r from-blue-500 to-purple-600 rounded-md flex items-center justify-center shadow-md">
                        <Mic size={12} className="text-white" />
                      </div>
                      <span>Microphone</span>
                    </label>
                    <select
                      value={selectedMicrophone}
                      onChange={(e) => changeMicrophone(e.target.value)}
                      className="w-full px-4 py-3 border border-white/30 rounded-xl focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 bg-white/20 backdrop-blur-md shadow-lg transition-all duration-200 hover:shadow-xl text-black font-medium"
                    >
                      {devices.microphones.map((microphone) => (
                        <option key={microphone.deviceId} value={microphone.deviceId}>
                          {microphone.label || `Microphone ${devices.microphones.indexOf(microphone) + 1}`}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Meeting Details */}
                <div>
                  <label className="flex items-center space-x-2 text-sm font-semibold text-black mb-3">
                    <div className="w-5 h-5 bg-gradient-to-r from-blue-500 to-purple-600 rounded-md flex items-center justify-center shadow-md">
                      <Settings size={12} className="text-white" />
                    </div>
                    <span>Meeting Details</span>
                  </label>
                  <div className="w-full px-4 py-3 border border-white/30 rounded-xl bg-white/20 backdrop-blur-md shadow-lg text-black font-medium">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-700">Room:</span>
                      <span className="font-mono text-sm">{roomId}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Join Button */}
            <div className="mt-8">
              <button
              onClick={joinMeeting}
              disabled={isLoading || !displayName.trim()}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 disabled:from-secondary-400 disabled:to-secondary-400 disabled:cursor-not-allowed text-white font-semibold py-4 px-6 rounded-2xl transition-all duration-200 flex items-center justify-center space-x-3 shadow-xl hover:shadow-2xl hover:scale-[1.02] transform"
            >
              {isLoading ? (
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
              ) : (
                <>
                  <div className="w-6 h-6 bg-white/20 rounded-lg flex items-center justify-center">
                    <Video size={16} className="text-white" />
                  </div>
                  <span className="text-lg">Join Meeting</span>
                </>
              )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}