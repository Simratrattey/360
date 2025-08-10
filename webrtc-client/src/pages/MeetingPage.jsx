// src/pages/MeetingPage.jsx
import React, { useState, useEffect, useRef, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Device } from 'mediasoup-client';
import API from '../api/client.js';
import { useWebRTC } from '../hooks/useWebRTC';
import { AuthContext } from '../context/AuthContext';
import { Mic, MicOff, Video, VideoOff, PhoneOff, CircleDot, StopCircle, Download, Settings } from 'lucide-react';
import { SocketContext } from '../context/SocketContext';
import BotService from '../api/botService';
import AvatarSidebar from '../components/AvatarSidebar';

export default function MeetingPage() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const { joinMeeting, leaveMeeting, localStream, remoteStreams, localVideoRef } = useWebRTC();
  const { avatarOutput, avatarNavigate, sendAvatarOutput, sendAvatarNavigate } = useContext(SocketContext);
  const { participantMap, recordingStatus, notifyRecordingStarted, notifyRecordingStopped } = useContext(SocketContext);

  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isRecording, setIsRecording]       = useState(false);
  const [mediaRecorder, setMediaRecorder]   = useState(null);
  const [recordedChunks, setRecordedChunks] = useState([]);
  const [recordingStream, setRecordingStream] = useState(null);
  const [recordingMethod, setRecordingMethod] = useState('canvas'); // 'canvas' or 'screen'
  const [showSettings, setShowSettings] = useState(false);
  const audioContextRef = useRef(null);

  const [showAvatar, setShowAvatar]             = useState(false);
  const [avatarClips, setAvatarClips]           = useState([]);
  const [avatarIndex, setAvatarIndex]           = useState(0);
  const [avatarQuery, setAvatarQuery]           = useState('');
  const [avatarTranscript, setAvatarTranscript] = useState('');
  const [isAvatarRecording, setIsAvatarRecording] = useState(false);

  const handleAvatarQuery = async () => {
    if (!avatarQuery) return;
    setAvatarTranscript('Thinking…');
    try {
      console.log('▶️ Asking avatar:', avatarQuery);
      const { success, data, error } = await BotService.getBotReply(avatarQuery, null);
      console.log('◀️ BotService returned:', { success, data, error });
      if (!success) {
        setAvatarTranscript('Error: ' + error);
        return;
      }
      sendAvatarOutput(data);
      try {
        const outer = JSON.parse(data.reply);
        const entries = Array.isArray(outer) && Array.isArray(outer[0]) ? outer[0] : [];
        const clips = entries.map(e => ({
          snippet: e.snippet,
          videoUrl:
            `https://clavisds02.feeltiptop.com/360TeamCalls/downloads/` +
            e.title.slice(0,4) + '/' + e.title.slice(5,7) + '/' + e.title + '/' + e.title + '.mp4' +
            `#t=${e.videodetails.snippetstarttimesecs},${e.videodetails.snippetendtimesecs}`
        }));
        setAvatarClips(clips);
        setAvatarIndex(0);
        setAvatarTranscript(clips[0]?.snippet || '');
        setShowAvatar(true);
      } catch {
        setAvatarTranscript(data.reply);
      }
    } catch (err) {
      setAvatarTranscript('Error: ' + err.message);
    }
  };

  const handleStartAudio = () => setIsAvatarRecording(true);
  const handleStopAudio  = () => setIsAvatarRecording(false);

  // 1) Join SFU room and set up transports, produce/consume
  useEffect(() => {
    if (roomId && user) joinMeeting(roomId);
    return () => leaveMeeting();
  }, [roomId, user]);

  useEffect(() => {
    if (!localStream) {
      console.warn('No localStream: camera/mic may not be available or permission denied.');
    }
  }, [localStream]);

  useEffect(() => {
    // TODO: Define chatRef and messages or remove this effect if not needed
    // if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, []);

  // Ensure local video always gets the stream
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // Attach remote streams to their video elements
  useEffect(() => {
    console.log('[MeetingPage] 🔄 Remote streams updated:', Array.from(remoteStreams.entries()).map(([id, stream]) => ({
      id,
      videoTracks: stream.getVideoTracks().length,
      audioTracks: stream.getAudioTracks().length
    })));
    
    remoteStreams.forEach((stream, id) => {
      const videoElement = document.getElementById(`remote-video-${id}`);
      if (videoElement && stream) {
        // Only set srcObject if it's different to avoid unnecessary updates
        if (videoElement.srcObject !== stream) {
          videoElement.srcObject = stream;
          videoElement.onloadedmetadata = () => {
            videoElement.play().catch(err => {
              if (err.name !== 'AbortError') console.warn('Video play failed:', err);
            });
          };
        }
      }
    });
  }, [remoteStreams]);

  // parse incoming avatar output
  useEffect(() => {
    if (!avatarOutput) return;
    try {
      const outer = JSON.parse(avatarOutput.reply);
      const entries = Array.isArray(outer) && Array.isArray(outer[0]) ? outer[0] : [];
      const clips = entries.map(e => ({
        snippet: e.snippet,
        videoUrl:
          `https://clavisds02.feeltiptop.com/360TeamCalls/downloads/` +
          e.title.slice(0,4) + '/' + e.title.slice(5,7) + '/' + e.title + '/' + e.title + '.mp4' +
          `#t=${e.videodetails.snippetstarttimesecs},${e.videodetails.snippetendtimesecs}`
      }));
      setAvatarClips(clips);
      setAvatarIndex(0);
      setAvatarTranscript(clips[0]?.snippet || '');
      setShowAvatar(true);
    } catch {
      // fallback: show raw text
      setAvatarTranscript(avatarOutput.reply);
      setShowAvatar(true);
    }
  }, [avatarOutput]);

  // remote navigation
  useEffect(() => {
    if (avatarNavigate == null) return;
    setAvatarIndex(avatarNavigate);
    setAvatarTranscript(avatarClips[avatarNavigate]?.snippet || '');
  }, [avatarNavigate, avatarClips]);

  // Close settings on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showSettings && !event.target.closest('[data-settings-panel]')) {
        setShowSettings(false);
      }
    };
    
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showSettings]);

  const handlePrev = () => {
    const i = Math.max(0, avatarIndex - 1);
    setAvatarIndex(i);
    setAvatarTranscript(avatarClips[i]?.snippet);
    sendAvatarNavigate(i);
  };

  const handleNext = () => {
    const i = Math.min(avatarClips.length - 1, avatarIndex + 1);
    setAvatarIndex(i);
    setAvatarTranscript(avatarClips[i]?.snippet);
    sendAvatarNavigate(i);
  };

  // Toggle audio
  const toggleAudio = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
      } else {
        console.error('No audio track found');
      }
    } else {
      console.error('No localStream for audio toggle');
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
      } else {
        console.error('No video track found');
      }
    } else {
      console.error('No localStream for video toggle');
    }
  };

  const startRecording = async () => {
    try {
      console.log('Starting meeting recording with method:', recordingMethod);
      
      let captureStream;
      
      if (recordingMethod === 'canvas') {
        // Use canvas recording (no screen sharing required)
        console.log('Using canvas-based recording...');
        captureStream = await createCanvasRecording();
      } else {
        // Use screen capture method
        console.log('Using screen capture...');
        try {
          captureStream = await navigator.mediaDevices.getDisplayMedia({
            video: {
              width: { ideal: 1920 },
              height: { ideal: 1080 },
              frameRate: { ideal: 30 }
            },
            audio: false, // We'll add our mixed audio instead
            selfBrowserSurface: 'include',
            systemAudio: 'exclude'
          });
          
          console.log('Screen capture successful');
        } catch (screenError) {
          console.log('Screen capture failed, falling back to canvas:', screenError);
          captureStream = await createCanvasRecording();
        }
      }
      
      if (!captureStream) {
        console.error('No capture stream available');
        return;
      }
      
      // Create mixed audio stream from all participants
      const mixedAudioStream = await createMixedAudioStream();
      
      // If we have mixed audio, replace or add it to the capture stream
      if (mixedAudioStream) {
        // Remove existing audio tracks from capture stream
        captureStream.getAudioTracks().forEach(track => {
          captureStream.removeTrack(track);
          track.stop();
        });
        
        // Add the mixed audio track
        mixedAudioStream.getAudioTracks().forEach(track => {
          captureStream.addTrack(track);
        });
      }
      
      // Check codec support
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus') 
        ? 'video/webm;codecs=vp8,opus'
        : MediaRecorder.isTypeSupported('video/webm') 
        ? 'video/webm'
        : '';
      
      if (!mimeType) {
        console.error('Browser does not support required video codec for recording');
        captureStream.getTracks().forEach(track => track.stop());
        return;
      }
      
      const recorder = new MediaRecorder(captureStream, { 
        mimeType,
        videoBitsPerSecond: 2500000 // 2.5 Mbps for good quality
      });
      const chunks = [];
      
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunks.push(e.data);
        }
      };
      
      recorder.onstop = () => {
        console.log('Recording stopped, collected', chunks.length, 'chunks');
        setRecordedChunks(chunks);
        captureStream.getTracks().forEach(track => track.stop());
        setRecordingStream(null);
      };
      
      recorder.onerror = (e) => {
        console.error('MediaRecorder error:', e);
        setIsRecording(false);
        setMediaRecorder(null);
        captureStream.getTracks().forEach(track => track.stop());
        setRecordingStream(null);
      };
      
      // Handle user stopping screen share
      captureStream.getVideoTracks()[0]?.addEventListener('ended', () => {
        console.log('Screen sharing ended by user');
        stopRecording();
      });
      
      recorder.start(1000); // Record in 1-second intervals
      setMediaRecorder(recorder);
      setRecordingStream(captureStream);
      setIsRecording(true);
      
      // Notify all participants that recording has started
      notifyRecordingStarted();
      console.log('Screen recording started successfully');
      
    } catch (error) {
      console.error('Failed to start screen recording:', error);
      alert('Failed to start recording. Please make sure you grant screen sharing permission.');
    }
  };
  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
      setMediaRecorder(null);
      setIsRecording(false);
      
      // Notify all participants that recording has stopped
      notifyRecordingStopped();
    }
    
    // Clean up recording stream
    if (recordingStream) {
      recordingStream.getTracks().forEach(track => track.stop());
      setRecordingStream(null);
    }
    
    // Clean up audio context
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(err => 
        console.warn('Failed to close audio context:', err)
      );
      audioContextRef.current = null;
    }
  };

  // Create mixed audio stream from all participants
  const createMixedAudioStream = async () => {
    try {
      console.log('Creating mixed audio stream...');
      
      // Create audio context for mixing
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const destination = audioContext.createMediaStreamDestination();
      
      let hasSources = false;
      
      // Add local audio if available
      if (localStream) {
        const localAudioTracks = localStream.getAudioTracks();
        if (localAudioTracks.length > 0 && localAudioTracks[0].enabled) {
          const localAudioStream = new MediaStream([localAudioTracks[0]]);
          const localSource = audioContext.createMediaStreamSource(localAudioStream);
          
          // Create gain node for local audio (slightly lower to avoid echo)
          const localGain = audioContext.createGain();
          localGain.gain.value = 0.8;
          
          localSource.connect(localGain);
          localGain.connect(destination);
          hasSources = true;
          
          console.log('Added local audio to mix');
        }
      }
      
      // Add remote audio streams
      remoteStreams.forEach((stream, peerId) => {
        const audioTracks = stream.getAudioTracks();
        if (audioTracks.length > 0 && audioTracks[0].readyState === 'live') {
          try {
            const remoteAudioStream = new MediaStream([audioTracks[0]]);
            const remoteSource = audioContext.createMediaStreamSource(remoteAudioStream);
            
            // Create gain node for remote audio
            const remoteGain = audioContext.createGain();
            remoteGain.gain.value = 1.0;
            
            remoteSource.connect(remoteGain);
            remoteGain.connect(destination);
            hasSources = true;
            
            console.log(`Added remote audio from peer ${peerId} to mix`);
          } catch (err) {
            console.warn(`Failed to add remote audio from peer ${peerId}:`, err);
          }
        }
      });
      
      if (!hasSources) {
        console.warn('No audio sources available for mixing');
        audioContext.close();
        return null;
      }
      
      console.log('Mixed audio stream created successfully');
      
      // Store audio context for cleanup later
      audioContextRef.current = audioContext;
      
      return destination.stream;
      
    } catch (error) {
      console.error('Failed to create mixed audio stream:', error);
      return null;
    }
  };

  // Canvas-based recording fallback
  const createCanvasRecording = async () => {
    try {
      console.log('Creating canvas-based recording...');
      
      // Create a canvas to composite all video streams
      const canvas = document.createElement('canvas');
      canvas.width = 1920;
      canvas.height = 1080;
      const ctx = canvas.getContext('2d');
      
      // Get all video elements from the meeting grid
      const videoElements = [];
      
      // Add local video
      if (localVideoRef.current) {
        videoElements.push({
          video: localVideoRef.current,
          label: 'You',
          isLocal: true
        });
      }
      
      // Add remote videos
      remoteStreams.forEach((stream, id) => {
        const videoEl = document.getElementById(`remote-video-${id}`);
        if (videoEl) {
          videoElements.push({
            video: videoEl,
            label: participantMap[id] || 'Guest',
            isLocal: false
          });
        }
      });
      
      console.log('Found', videoElements.length, 'video elements for canvas recording');
      
      if (videoElements.length === 0) {
        throw new Error('No video elements found for recording');
      }
      
      // Calculate grid layout (same as your UI)
      const tileCount = videoElements.length;
      const columns = tileCount === 2 ? 2 : Math.ceil(Math.sqrt(tileCount));
      const rows = Math.ceil(tileCount / columns);
      
      const tileWidth = canvas.width / columns;
      const tileHeight = canvas.height / rows;
      
      // Start the drawing loop
      let animationId;
      const drawFrame = () => {
        // Clear canvas
        ctx.fillStyle = '#1F2937'; // bg-gray-800
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw each video tile
        videoElements.forEach((element, index) => {
          const col = index % columns;
          const row = Math.floor(index / columns);
          const x = col * tileWidth;
          const y = row * tileHeight;
          
          if (element.video && element.video.videoWidth > 0) {
            try {
              // Draw video with aspect ratio preservation
              const videoAspect = element.video.videoWidth / element.video.videoHeight;
              const tileAspect = tileWidth / tileHeight;
              
              let drawWidth, drawHeight, drawX, drawY;
              
              if (videoAspect > tileAspect) {
                drawHeight = tileHeight;
                drawWidth = tileHeight * videoAspect;
                drawX = x + (tileWidth - drawWidth) / 2;
                drawY = y;
              } else {
                drawWidth = tileWidth;
                drawHeight = tileWidth / videoAspect;
                drawX = x;
                drawY = y + (tileHeight - drawHeight) / 2;
              }
              
              ctx.drawImage(element.video, drawX, drawY, drawWidth, drawHeight);
              
              // Draw label
              ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
              ctx.fillRect(x + 10, y + tileHeight - 40, ctx.measureText(element.label).width + 20, 30);
              ctx.fillStyle = 'white';
              ctx.font = '16px Arial';
              ctx.fillText(element.label, x + 20, y + tileHeight - 20);
              
            } catch (drawError) {
              console.warn('Failed to draw video element:', drawError);
            }
          } else {
            // Draw placeholder for video off state
            ctx.fillStyle = '#374151'; // bg-gray-700
            ctx.fillRect(x + 10, y + 10, tileWidth - 20, tileHeight - 20);
            ctx.fillStyle = '#9CA3AF'; // text-gray-400
            ctx.font = '24px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('Camera Off', x + tileWidth / 2, y + tileHeight / 2);
            ctx.textAlign = 'left';
          }
        });
        
        animationId = requestAnimationFrame(drawFrame);
      };
      
      drawFrame();
      
      // Create stream from canvas
      const videoStream = canvas.captureStream(30); // 30 FPS
      
      // Add mixed audio to the canvas stream
      const mixedAudioStream = await createMixedAudioStream();
      if (mixedAudioStream) {
        mixedAudioStream.getAudioTracks().forEach(track => {
          videoStream.addTrack(track);
        });
      }
      
      // Stop drawing when stream ends
      const originalStop = videoStream.getTracks()[0].stop.bind(videoStream.getTracks()[0]);
      videoStream.getTracks()[0].stop = () => {
        cancelAnimationFrame(animationId);
        originalStop();
      };
      
      return videoStream;
      
    } catch (error) {
      console.error('Canvas recording failed:', error);
      return null;
    }
  };

  const downloadRecording = () => {
    if (recordedChunks.length === 0) return;
    
    const blob = new Blob(recordedChunks, { type: 'video/webm' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = `meeting-recording-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleLeave = () => {
    // Stop recording if active before leaving
    if (isRecording) {
      stopRecording();
    }
    leaveMeeting();
    navigate('/meetings');
  };

  // Combine local and remote streams for a unified grid
  const videoTiles = [
    { id: 'local', stream: localStream, isLocal: true, label: 'You' },
    ...Array.from(remoteStreams.entries()).map(([id, stream]) => ({
      id,
      stream,
      isLocal: false,
      label: participantMap[id] || 'Guest',
    }))
  ];

  // Calculate grid columns: try to make the grid as square as possible
  const tileCount = videoTiles.length;
  const columns = tileCount === 2 ? 2 : Math.ceil(Math.sqrt(tileCount));

  if (!user) {
    return <div className="p-8 text-center">Please log in to join meetings.</div>;
  }

  console.log('[MeetingPage] 🎥 Video tiles:', videoTiles.map(tile => ({
    id: tile.id,
    isLocal: tile.isLocal,
    label: tile.label,
    hasVideo: tile.stream?.getVideoTracks().length > 0,
    hasAudio: tile.stream?.getAudioTracks().length > 0
  })));

  return (
    <div className="flex flex-col h-screen bg-gray-900">
      {/* Recording notification banner */}
      {recordingStatus.isRecording && (
        <div className="bg-red-600 text-white px-4 py-2 text-center font-medium flex items-center justify-center space-x-2">
          <CircleDot size={16} className="animate-pulse" />
          <span>
            This meeting is being recorded by {recordingStatus.recordedBy}
          </span>
        </div>
      )}
      
      {/* Video Grid */}
      <div
        className="meeting-grid grid auto-rows-fr gap-4 p-4 flex-1 overflow-auto"
        style={{
          gridTemplateColumns: `repeat(${columns}, minmax(240px, 1fr))`,
          alignItems: 'start',
          justifyItems: 'stretch'
        }}
      >
        {videoTiles.map(({ id, stream, isLocal, label }) => (
          <div
            key={id}
            className="group relative bg-gray-800 rounded-2xl overflow-hidden shadow-xl hover:shadow-2xl"
            style={{ aspectRatio: '16/9' }}
          >
            {stream && stream.getVideoTracks().length > 0 ? (
              <video
                ref={isLocal ? localVideoRef : undefined}
                id={isLocal ? undefined : `remote-video-${id}`}
                autoPlay
                muted={isLocal}
                playsInline
                className="w-full h-full object-cover"
                style={{ 
                  background: '#222',
                  transform: isLocal ? 'scaleX(-1)' : 'none' // Mirror local video
                }}
                srcObject={isLocal ? undefined : stream}
                onLoadedMetadata={isLocal ? undefined : () => {
                  const video = document.getElementById(`remote-video-${id}`);
                  if (video) {
                    video.play().catch(err => {
                      if (err.name !== 'AbortError') console.warn('Video play failed:', err);
                    });
                  }
                }}
              />
            ) : stream && stream.getAudioTracks().length > 0 ? (
              <audio
                id={isLocal ? undefined : `remote-audio-${id}`}
                controls
                autoPlay
                className="w-full"
                srcObject={isLocal ? undefined : stream}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">
                <VideoOff size={48} />
              </div>
            )}
            {/* Name label */}
            <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-3 py-1 rounded shadow">
              {label}
            </div>
          </div>
        ))}
      </div>
      {/* Controls */}
      <div className="sticky bottom-0 w-full bg-gray-900 bg-opacity-75 backdrop-blur-md p-4 flex justify-center space-x-6 z-10">
        <button onClick={toggleAudio} className="p-3 rounded-full bg-gray-600 text-white" title={isAudioEnabled ? "Mute audio" : "Unmute audio"}>
          {isAudioEnabled ? <Mic size={20}/> : <MicOff size={20}/>} 
        </button>
        <button onClick={toggleVideo} className="p-3 rounded-full bg-gray-600 text-white" title={isVideoEnabled ? "Turn off camera" : "Turn on camera"}>
          {isVideoEnabled ? <Video size={20}/> : <VideoOff size={20}/>} 
        </button>
        <button 
          onClick={isRecording ? stopRecording : startRecording} 
          className="p-3 rounded-full bg-gray-600 text-white" 
          title={isRecording ? "Stop recording" : `Record meeting (${recordingMethod === 'canvas' ? 'direct capture' : 'screen share'})`}
        >
          {isRecording ? <StopCircle size={20}/> : <CircleDot size={20}/>} 
        </button>
        {recordedChunks.length > 0 && (
          <button onClick={downloadRecording} className="p-3 rounded-full bg-green-600 text-white" title="Download recording">
            <Download size={20}/>
          </button>
        )}
        <button onClick={handleLeave} className="p-3 rounded-full bg-red-600 text-white" title="Leave meeting">
          <PhoneOff size={20}/>
        </button>
        <div className="relative" data-settings-panel>
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className="p-3 rounded-full bg-gray-600 text-white" 
            title="Meeting settings"
          >
            <Settings size={20}/>
          </button>
          {showSettings && (
            <div className="absolute bottom-full mb-2 right-0 bg-gray-800 text-white rounded-lg py-3 px-4 shadow-xl border border-gray-600 z-50 min-w-64">
              <h3 className="text-sm font-semibold mb-3 text-gray-200">Meeting Settings</h3>
              
              {/* Recording Settings */}
              <div className="mb-4">
                <h4 className="text-xs font-medium text-gray-300 mb-2">Recording Method</h4>
                <div className="space-y-2">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="recordingMethod"
                      value="canvas"
                      checked={recordingMethod === 'canvas'}
                      onChange={(e) => setRecordingMethod(e.target.value)}
                      className="text-blue-600"
                    />
                    <span className="text-sm">
                      📹 Direct Capture <span className="text-green-400 text-xs">(Recommended)</span>
                    </span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="recordingMethod"
                      value="screen"
                      checked={recordingMethod === 'screen'}
                      onChange={(e) => setRecordingMethod(e.target.value)}
                      className="text-blue-600"
                    />
                    <span className="text-sm">🖥️ Screen Share</span>
                  </label>
                  <p className="text-xs text-gray-400 mt-1">
                    Direct Capture records only meeting participants without screen sharing.
                  </p>
                </div>
              </div>

              {/* Avatar Settings */}
              <div className="mb-4">
                <h4 className="text-xs font-medium text-gray-300 mb-2">Features</h4>
                <button
                  onClick={() => {
                    setShowAvatar(!showAvatar);
                    setShowSettings(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                    showAvatar ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'
                  }`}
                >
                  🤖 AI Avatar {showAvatar ? '(Active)' : ''}
                </button>
              </div>

              {/* Video Settings */}
              <div className="border-t border-gray-700 pt-3">
                <h4 className="text-xs font-medium text-gray-300 mb-2">Video</h4>
                <div className="text-xs text-gray-400">
                  ✅ Local video mirroring enabled<br/>
                  📺 Recording quality: 1920x1080 @ 30fps
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      {showAvatar && (
        <AvatarSidebar
          clips={avatarClips}
          index={avatarIndex}
          transcript={avatarTranscript}
          askText={avatarQuery}
          setAskText={setAvatarQuery}
          onAskText={handleAvatarQuery}
          onStartAudio={handleStartAudio}
          onStopAudio={handleStopAudio}
          isRecording={isAvatarRecording}
          onPrev={handlePrev}
          onNext={handleNext}
          onClose={() => setShowAvatar(false)}
        />
      )}
    </div>
  );
}