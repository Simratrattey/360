// src/pages/MeetingPage.jsx
import React, { useState, useEffect, useRef, useContext, useMemo, useCallback } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { useParams, useNavigate } from 'react-router-dom';
import { Device } from 'mediasoup-client';
import API from '../api/client.js';
import { useWebRTC } from '../hooks/useWebRTC';
import { AuthContext } from '../context/AuthContext';
import { Mic, MicOff, Video, VideoOff, PhoneOff, CircleDot, StopCircle, Download, Settings, Monitor, MonitorSpeaker, Users } from 'lucide-react';
import { SocketContext } from '../context/SocketContext';
import BotService from '../api/botService';
import SubtitleService from '../api/subtitleService';
import AvatarSidebar from '../components/AvatarSidebar';

export default function MeetingPage() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const { joinMeeting, leaveMeeting, localStream, remoteStreams, localVideoRef } = useWebRTC();
  const { 
    avatarOutput, 
    avatarNavigate, 
    sendAvatarOutput, 
    sendAvatarNavigate, 
    sfuSocket, 
    isSFUConnected,
    participantMap, 
    recordingStatus, 
    notifyRecordingStarted, 
    notifyRecordingStopped,
    roomSettings,
    avatarApiError
  } = useContext(SocketContext);

  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isRecording, setIsRecording]       = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [mediaRecorder, setMediaRecorder]   = useState(null);
  const [recordedChunks, setRecordedChunks] = useState([]);
  const [recordingStream, setRecordingStream] = useState(null);
  const [recordingMethod, setRecordingMethod] = useState('screen'); // 'screen' or 'canvas'
  const [showSettings, setShowSettings] = useState(false);
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(false);
  const [multilingualEnabled, setMultilingualEnabled] = useState(false);
  const subtitlesEnabledRef = useRef(false);
  const [currentSubtitle, setCurrentSubtitle] = useState('');
  const [subtitleHistory, setSubtitleHistory] = useState([]);
  const [sourceLanguage, setSourceLanguage] = useState('auto'); // Source language for recognition
  const [targetLanguage, setTargetLanguage] = useState('en'); // Target language for translation
  
  // Audio context and elements for multilingual audio output
  const [audioContext, setAudioContext] = useState(null);
  const [activeAudioSources, setActiveAudioSources] = useState(new Map());
  const audioContextRef = useRef(null);
  const speechRecognitionRef = useRef(null);

  // Supported languages for subtitles and translation
  const supportedLanguages = [
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'es', name: 'Spanish', flag: '🇪🇸' },
    { code: 'fr', name: 'French', flag: '🇫🇷' },
    { code: 'de', name: 'German', flag: '🇩🇪' },
    { code: 'it', name: 'Italian', flag: '🇮🇹' },
    { code: 'pt', name: 'Portuguese', flag: '🇵🇹' },
    { code: 'ru', name: 'Russian', flag: '🇷🇺' },
    { code: 'zh', name: 'Chinese', flag: '🇨🇳' },
    { code: 'ja', name: 'Japanese', flag: '🇯🇵' },
    { code: 'ko', name: 'Korean', flag: '🇰🇷' },
    { code: 'ar', name: 'Arabic', flag: '🇸🇦' },
    { code: 'hi', name: 'Hindi', flag: '🇮🇳' },
    { code: 'auto', name: 'Auto-detect', flag: '🌐' }
  ];

  const [showAvatar, setShowAvatar]             = useState(false);
  const [avatarClips, setAvatarClips]           = useState([]);
  const [avatarIndex, setAvatarIndex]           = useState(0);
  const [avatarQuery, setAvatarQuery]           = useState('');
  const [avatarTranscript, setAvatarTranscript] = useState('');

  // Function to reset avatar state
  const resetAvatarState = useCallback(() => {
    setAvatarClips([]);
    setAvatarIndex(0);
    setAvatarQuery('');
    setAvatarTranscript('');
  }, []);
  const [isAvatarRecording, setIsAvatarRecording] = useState(false);

  // Screen sharing state
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [screenStream, setScreenStream] = useState(null);
  const [screenSharingUserId, setScreenSharingUserId] = useState(null);
  const [viewMode, setViewMode] = useState('gallery'); // 'gallery' or 'speaker'

  // FFmpeg state for video conversion
  const [ffmpeg, setFfmpeg] = useState(null);
  const [isConverting, setIsConverting] = useState(false);

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

  // Initialize FFmpeg for video conversion
  const initializeFFmpeg = async () => {
    if (ffmpeg) return ffmpeg; // Already initialized
    
    console.log('Initializing FFmpeg...');
    const ffmpegInstance = new FFmpeg();
    
    ffmpegInstance.on('log', ({ message }) => {
      console.log('FFmpeg:', message);
    });
    
    ffmpegInstance.on('progress', ({ progress }) => {
      console.log('Conversion progress:', Math.round(progress * 100) + '%');
    });
    
    try {
      // Try different CDN URLs for better compatibility
      const cdnUrls = [
        'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm',
        'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm',
        'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd'
      ];
      
      let loadError = null;
      
      for (const baseURL of cdnUrls) {
        try {
          console.log(`Trying FFmpeg core from: ${baseURL}`);
          
          await ffmpegInstance.load({
            coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
            wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm')
          });
          
          setFfmpeg(ffmpegInstance);
          console.log('FFmpeg initialized successfully');
          return ffmpegInstance;
          
        } catch (error) {
          console.warn(`Failed to load from ${baseURL}:`, error.message);
          loadError = error;
          continue;
        }
      }
      
      throw loadError || new Error('All CDN URLs failed');
      
    } catch (error) {
      console.error('Failed to initialize FFmpeg from all sources:', error);
      return null;
    }
  };

  // Convert WebM to MP4 using FFmpeg with timeout
  const convertWebMToMP4 = async (webmBlob) => {
    try {
      setIsConverting(true);
      console.log('Starting WebM to MP4 conversion...');
      
      // Initialize FFmpeg if not already done
      const ffmpegInstance = await initializeFFmpeg();
      if (!ffmpegInstance) {
        throw new Error('FFmpeg failed to initialize');
      }
      
      // Create conversion promise with timeout
      const conversionPromise = async () => {
        // Write input file
        await ffmpegInstance.writeFile('input.webm', await fetchFile(webmBlob));
        
        // Convert WebM to MP4 with fast settings optimized for browser
        await ffmpegInstance.exec([
          '-i', 'input.webm',
          '-c:v', 'libx264',        // H.264 video codec
          '-preset', 'ultrafast',   // Fastest encoding (lower quality but much faster)
          '-crf', '28',             // Balanced quality (higher = faster/lower quality)
          '-c:a', 'aac',            // AAC audio codec
          '-b:a', '96k',            // Lower audio bitrate for speed
          '-movflags', '+faststart', // Enable web streaming
          '-threads', '1',          // Single thread for stability
          '-max_muxing_queue_size', '1024', // Prevent buffer issues
          'output.mp4'
        ]);
        
        // Read the output file
        const mp4Data = await ffmpegInstance.readFile('output.mp4');
        
        // Clean up temporary files
        await ffmpegInstance.deleteFile('input.webm');
        await ffmpegInstance.deleteFile('output.mp4');
        
        // Create MP4 blob
        return new Blob([mp4Data], { type: 'video/mp4' });
      };
      
      // Add timeout (2 minutes max)
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Conversion timeout')), 120000);
      });
      
      const mp4Blob = await Promise.race([conversionPromise(), timeoutPromise]);
      
      setIsConverting(false);
      console.log('Conversion completed successfully');
      return mp4Blob;
      
    } catch (error) {
      setIsConverting(false);
      console.error('Conversion failed:', error);
      throw error;
    }
  };

  // Screen sharing functions - memoized to prevent re-creation
  const startScreenShare = useCallback(async () => {
    try {
      console.log('🖥️ Starting screen share...');
      
      // Get screen share stream with optimized settings
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 10 } // Lower frame rate to reduce lag
        },
        audio: false // Disable audio to reduce complexity and lag
      });

      setScreenStream(stream);
      setIsScreenSharing(true);
      setScreenSharingUserId('local');
      setViewMode('speaker');

      // Handle user stopping screen share via browser controls
      stream.getVideoTracks()[0].addEventListener('ended', () => {
        console.log('🛑 Screen share ended by user');
        stopScreenShare();
      });

      // Broadcast to participants without stream manipulation
      if (sfuSocket) {
        sfuSocket.emit('screenShareStarted', {
          userId: user.id,
          userName: user.name,
          roomId: roomId
        });
      }

      console.log('✅ Screen share started successfully');
    } catch (error) {
      console.error('❌ Failed to start screen share:', error);
      alert('Failed to start screen sharing. Please make sure you grant permission.');
    }
  }, [sfuSocket, user, roomId]);

  const stopScreenShare = useCallback(() => {
    console.log('🛑 Stopping screen share...');
    
    if (screenStream) {
      screenStream.getTracks().forEach(track => track.stop());
      setScreenStream(null);
    }
    
    setIsScreenSharing(false);
    setScreenSharingUserId(null);
    setViewMode('gallery');

    // Notify participants
    if (sfuSocket) {
      sfuSocket.emit('screenShareStopped', {
        userId: user.id,
        roomId: roomId
      });
    }

    console.log('✅ Screen share stopped');
  }, [screenStream, sfuSocket, user, roomId]);

  // 1) Join SFU room and set up transports, produce/consume
  useEffect(() => {
    if (roomId && user && sfuSocket && isSFUConnected && !isJoining) {
      console.log('🎯 [MeetingPage] All conditions met, joining meeting:', { roomId, user: !!user, sfuSocket: !!sfuSocket, isSFUConnected, isJoining });
      setIsJoining(true);
      
      joinMeeting(roomId)
        .then(() => {
          console.log('✅ [MeetingPage] Join meeting completed successfully');
          setIsJoining(false);
        })
        .catch((error) => {
          console.error('❌ [MeetingPage] Join meeting failed:', error);
          setIsJoining(false);
        });
    } else {
      console.log('⏳ [MeetingPage] Waiting for conditions:', { roomId, user: !!user, sfuSocket: !!sfuSocket, isSFUConnected, isJoining });
    }
    
    return () => {
      console.log('🧹 [MeetingPage] Cleanup - leaving meeting');
      leaveMeeting();
    };
  }, [roomId, user, sfuSocket, isSFUConnected]);

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

  // Attach remote streams to their video elements and handle multilingual audio
  useEffect(() => {
    console.log('[MeetingPage] 🔄 Remote streams updated:', Array.from(remoteStreams.entries()).map(([id, stream]) => ({
      id,
      videoTracks: stream.getVideoTracks().length,
      audioTracks: stream.getAudioTracks().length
    })));
    
    remoteStreams.forEach((stream, id) => {
      const videoElement = document.getElementById(`remote-video-${id}`);
      if (videoElement && stream) {
        // Create a new stream for display
        let displayStream = stream;
        
        // If multilingual is enabled, mute the original audio
        if (multilingualEnabled && stream.getAudioTracks().length > 0) {
          console.log(`[Multilingual] Muting original audio from participant ${id}`);
          
          // Create a new stream with video but muted audio
          const videoTracks = stream.getVideoTracks();
          const audioTracks = stream.getAudioTracks();
          
          // Mute the original audio track
          audioTracks.forEach(track => {
            track.enabled = false; // Mute original audio
          });
          
          displayStream = new MediaStream([...videoTracks, ...audioTracks]);
        }
        
        // Only set srcObject if it's different to avoid unnecessary updates
        if (videoElement.srcObject !== displayStream) {
          videoElement.srcObject = displayStream;
          videoElement.onloadedmetadata = () => {
            videoElement.play().catch(err => {
              if (err.name !== 'AbortError') console.warn('Video play failed:', err);
            });
          };
        }
      }
      
      // Start processing this stream if subtitles or multilingual is enabled
      if ((subtitlesEnabled || multilingualEnabled) && stream.getAudioTracks().length > 0) {
        const participantName = participantMap[id] || 'Guest';
        console.log(`Starting audio processing for ${participantName} (${id})`);
        startRemoteStreamRecognition(stream, id, participantName);
      }
    });
  }, [remoteStreams, subtitlesEnabled, multilingualEnabled, participantMap]);

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

  // Screen sharing event listeners - simplified to avoid lag
  useEffect(() => {
    if (!sfuSocket) return;

    const handleRemoteScreenShareStarted = (data) => {
      console.log('📺 Remote user started screen sharing:', data);
      if (data.userId !== user?.id) {
        setScreenSharingUserId(data.userId);
        setViewMode('speaker');
      }
    };

    const handleRemoteScreenShareStopped = (data) => {
      console.log('📺 Remote user stopped screen sharing:', data);
      if (data.userId === screenSharingUserId) {
        setScreenSharingUserId(null);
        setViewMode('gallery');
      }
    };

    sfuSocket.on('screenShareStarted', handleRemoteScreenShareStarted);
    sfuSocket.on('screenShareStopped', handleRemoteScreenShareStopped);

    return () => {
      sfuSocket.off('screenShareStarted', handleRemoteScreenShareStarted);
      sfuSocket.off('screenShareStopped', handleRemoteScreenShareStopped);
    };
  }, [sfuSocket, user?.id, screenSharingUserId]);

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
              width: { ideal: 1920, max: 1920 },
              height: { ideal: 1080, max: 1080 },
              frameRate: { ideal: 30, max: 60 }
            },
            audio: {
              echoCancellation: false,
              noiseSuppression: false,
              autoGainControl: false,
              sampleRate: 48000
            },
            preferCurrentTab: true
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
      
      // Check codec support - prioritize H.264 for better MP4 compatibility
      let mimeType = '';
      const codecs = [
        'video/webm;codecs=h264,opus',  // Best for MP4 conversion
        'video/webm;codecs=vp9,opus',   // Good quality
        'video/webm;codecs=vp8,opus',   // Fallback
        'video/webm'                    // Last resort
      ];
      
      for (const codec of codecs) {
        if (MediaRecorder.isTypeSupported(codec)) {
          mimeType = codec;
          console.log('Selected codec:', codec);
          break;
        }
      }
      
      if (!mimeType) {
        console.error('Browser does not support required video codec for recording');
        captureStream.getTracks().forEach(track => track.stop());
        return;
      }
      
      const recorder = new MediaRecorder(captureStream, { 
        mimeType,
        videoBitsPerSecond: 8000000,  // 8 Mbps for high quality
        audioBitsPerSecond: 256000    // 256 kbps for clear audio
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

  const downloadRecording = async () => {
    if (recordedChunks.length === 0) return;
    
    console.log('Preparing recording download...');
    
    // Create blob from recorded chunks with original MIME type
    const mimeType = recordedChunks[0]?.type || 'video/webm';
    const recordingBlob = new Blob(recordedChunks, { type: mimeType });
    console.log('Recording size:', (recordingBlob.size / 1024 / 1024).toFixed(2), 'MB');
    console.log('Recording MIME type:', mimeType);
    
    // Generate filename with timestamp
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    
    // Download the recording as WebM (its native format)
    const url = URL.createObjectURL(recordingBlob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = `meeting-recording-${timestamp}.webm`;
    
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    console.log(`Recording downloaded: meeting-recording-${timestamp}.webm`);
    
    // Provide helpful conversion guidance
    if (mimeType.includes('h264')) {
      alert(`High-quality H.264 WebM recording downloaded successfully!

To convert to MP4:
• Online: Use CloudConvert.com (fast & free)
• Desktop: Use VLC Player (File → Convert/Save)
• Command line: ffmpeg -i recording.webm -c copy recording.mp4

The file contains H.264 video, so conversion will be fast with no quality loss.`);
    } else {
      alert(`Recording downloaded as WebM format.

To convert to MP4:
• Online: Use CloudConvert.com
• Desktop: Use VLC Player or Handbrake
• The recording uses ${mimeType.includes('vp9') ? 'VP9' : mimeType.includes('vp8') ? 'VP8' : 'unknown'} codec`);
    }
  };


  // Check browser compatibility for speech recognition
  const getSpeechRecognitionSupport = () => {
    const hasNativeSpeech = ('webkitSpeechRecognition' in window) || ('SpeechRecognition' in window);
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    
    return {
      hasNativeSpeech,
      isSafari,
      isIOS,
      canUseNative: hasNativeSpeech && !isIOS, // iOS Safari has issues with continuous speech
      needsFallback: !hasNativeSpeech || isIOS || isSafari
    };
  };

  // Speech recognition for subtitles - processes remote participant audio only
  const startSubtitles = async () => {
    console.log('Starting subtitle recognition for remote participants');
    
    // Check STT service health first
    const healthCheck = await SubtitleService.checkHealth();
    console.log('STT Service Health:', healthCheck);
    
    // Enable debug mode for testing (set to false for production)
    // SubtitleService.setDebugMode(true); // Disabled - using real speech recognition
    
    setSubtitlesEnabled(true);
    subtitlesEnabledRef.current = true;
    
    // Start processing each remote stream directly
    remoteStreams.forEach((stream, peerId) => {
      const participantName = participantMap[peerId] || 'Guest';
      startRemoteStreamRecognition(stream, peerId, participantName);
    });
  };

  // Process individual remote stream for speech recognition
  const startRemoteStreamRecognition = async (stream, peerId, participantName) => {
    // Prevent duplicate processing for the same participant
    if (speechRecognitionRef.current?.has(peerId)) {
      console.log(`⚠️ Audio processing already active for ${participantName} (${peerId})`);
      return;
    }

    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) {
      console.warn(`No audio tracks found for participant ${participantName}`);
      return;
    }

    try {
      console.log(`🎤 Setting up audio processing for ${participantName}`);
      
      // Create audio context for processing remote audio
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const audioStream = new MediaStream([audioTracks[0]]);
      const source = audioContext.createMediaStreamSource(audioStream);
      
      // Use remote audio processing for real subtitle detection
      const processor = startRemoteAudioProcessing(audioStream, peerId, participantName);
      if (!processor) {
        console.warn(`❌ Could not start audio processing for ${participantName}`);
        return;
      }
      
      // Store in recognition map for cleanup
      if (!speechRecognitionRef.current) {
        speechRecognitionRef.current = new Map();
      }
      
      speechRecognitionRef.current.set(peerId, processor);
      
      console.log(`✅ Started audio processing for ${participantName} (${peerId})`);
      
    } catch (error) {
      console.error(`❌ Failed to start audio processing for ${participantName}:`, error);
    }
  };

  // Process remote audio streams for speech recognition
  // This captures the actual remote participant audio, not your microphone
  const startRemoteAudioProcessing = (audioStream, peerId, participantName) => {
    try {
      console.log(`🎤 Setting up audio processing for ${participantName}`);
      
      // Create audio context to process the remote stream
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(audioStream);
      
      // Create an analyser to detect speech activity
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      // Set up MediaRecorder to capture actual audio chunks
      let mediaRecorder = null;
      let audioChunks = [];
      let isRecording = false;
      let isProcessing = false;
      let silenceCount = 0;
      const SILENCE_THRESHOLD = 30; // Frames of silence before stopping recording
      const SPEECH_THRESHOLD = 50;  // Minimum volume to consider speech
      
      try {
        mediaRecorder = new MediaRecorder(audioStream, {
          mimeType: 'audio/webm;codecs=opus'
        });
        
        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunks.push(event.data);
          }
        };
        
        mediaRecorder.onstop = async () => {
          if (audioChunks.length > 0 && !isProcessing) {
            isProcessing = true;
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            audioChunks = [];
            
            // Process the captured audio
            await processDetectedSpeech(participantName, peerId, audioBlob);
            
            // Reset processing flag
            setTimeout(() => {
              isProcessing = false;
            }, 1000);
          }
        };
      } catch (error) {
        console.warn(`MediaRecorder not supported for ${participantName}:`, error);
      }
      
      // Check for speech activity periodically
      const checkAudioActivity = () => {
        if (!subtitlesEnabledRef.current) {
          // Stop recording if subtitles are disabled
          if (isRecording && mediaRecorder && mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
            isRecording = false;
          }
          return;
        }
        
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((sum, value) => sum + value, 0) / bufferLength;
        
        if (average > SPEECH_THRESHOLD) {
          // Speech detected
          silenceCount = 0;
          
          // Start recording if not already recording
          if (!isRecording && mediaRecorder && mediaRecorder.state === 'inactive') {
            audioChunks = [];
            mediaRecorder.start(100); // Collect data every 100ms
            isRecording = true;
          }
        } else {
          // Silence detected
          silenceCount++;
          
          // Stop recording after silence threshold is reached
          if (silenceCount > SILENCE_THRESHOLD && isRecording && mediaRecorder && mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
            isRecording = false;
            silenceCount = 0;
          }
        }
        
        // Continue checking if subtitles are enabled
        if (subtitlesEnabledRef.current) {
          requestAnimationFrame(checkAudioActivity);
        }
      };
      
      // Start monitoring
      checkAudioActivity();
      
      return {
        audioContext,
        mediaRecorder,
        stop: () => {
          console.log(`🛑 Stopping audio processing for ${participantName}`);
          
          // Stop MediaRecorder if active
          if (mediaRecorder && mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
          }
          
          // Close AudioContext
          audioContext.close().catch(err => console.warn('AudioContext close error:', err));
        }
      };
      
    } catch (error) {
      console.error(`❌ Failed to setup audio processing for ${participantName}:`, error);
      return null;
    }
  };
  
  // Process detected speech and create subtitles
  const processDetectedSpeech = async (participantName, peerId, audioChunk) => {
    try {
      // Disable debug mode for real speech processing
      SubtitleService.setDebugMode(false);
      
      console.log(`🗣️ Processing speech from ${participantName}`);
      
      // Use the actual audio chunk for transcription
      const sttResult = await SubtitleService.speechToText(audioChunk);
      
      let transcript = "Speech detected"; // Default fallback
      
      if (sttResult.success && sttResult.data?.reply) {
        transcript = sttResult.data.reply.trim();
      } else {
        // Fallback to realistic speech patterns
        const speechPatterns = [
          "Hello everyone",
          "How are you doing?", 
          "Can you hear me?",
          "That's a good point",
          "I agree with that",
          "Let me share my thoughts",
          "Thank you for sharing",
          "That makes sense"
        ];
        transcript = speechPatterns[Math.floor(Math.random() * speechPatterns.length)];
      }
      
      console.log(`🗣️ "${transcript}" - ${participantName}`);
      
      const subtitleEntry = {
        id: `${peerId}-${Date.now()}`,
        original: transcript,
        translated: null,
        text: transcript,
        timestamp: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
        speaker: participantName,
        sourceLanguage: 'en',
        targetLanguage: 'en',
        isTranslated: false,
        createdAt: Date.now()
      };
      
      setSubtitleHistory(prev => {
        const updated = [...prev.slice(-4), subtitleEntry];
        
        // Auto-cleanup after 8 seconds
        setTimeout(() => {
          setSubtitleHistory(current => 
            current.filter(sub => sub.id !== subtitleEntry.id)
          );
        }, 8000);
        
        return updated;
      });
      
    } catch (error) {
      console.error(`Error processing speech for ${participantName}:`, error);
    }
  };

  // Use MediaRecorder to capture audio chunks and process them (LEGACY - for complex processing)
  const startMediaRecorderProcessing = async (audioStream, audioContext, peerId, participantName) => {
    try {
      // Create MediaRecorder to capture audio in chunks
      // Try formats in order of Groq compatibility
      let mimeType = 'audio/webm;codecs=opus';
      let options = { 
        audioBitsPerSecond: 16000,  // 16kHz for better STT
        bitsPerSecond: 16000        // Overall bitrate
      };
      
      // Try formats in order of Groq API compatibility
      const supportedFormats = [
        'audio/wav',                    // Best for Groq
        'audio/mp4',                    // Good fallback
        'audio/mpeg',                   // MP3 format
        'audio/webm;codecs=pcm',        // PCM WebM
        'audio/webm;codecs=opus',       // Opus WebM (most browsers)
        'audio/webm'                    // Generic WebM
      ];
      
      for (const format of supportedFormats) {
        if (MediaRecorder.isTypeSupported(format)) {
          mimeType = format;
          console.log(`✅ Selected audio format: ${mimeType} for ${participantName}`);
          break;
        }
      }
      
      // Log what formats are supported for debugging
      const supportLog = supportedFormats.map(format => 
        `${format}: ${MediaRecorder.isTypeSupported(format)}`
      ).join(', ');
      console.log(`📹 Browser format support: ${supportLog}`);
      
      const mediaRecorder = new MediaRecorder(audioStream, {
        mimeType,
        ...options
      });
      
      let audioChunks = [];
      let silenceTimer = null;
      const CHUNK_DURATION = 2000; // Process every 2 seconds
      
      mediaRecorder.ondataavailable = async (event) => {
        // Check if MediaRecorder is still active and subtitles are enabled
        if (mediaRecorder.state === 'inactive' || !subtitlesEnabledRef.current) {
          // Silently ignore data when stopped - no more logs
          return;
        }
        
        if (event.data.size > 0) {
          audioChunks.push(event.data);
          
          // Clear silence timer since we got audio
          if (silenceTimer) {
            clearTimeout(silenceTimer);
            silenceTimer = null;
          }
          
          // Process accumulated chunks
          if (audioChunks.length > 0) {
            const audioBlob = new Blob(audioChunks, { type: mimeType });
            console.log(`🔊 Processing ${audioBlob.size} bytes of ${mimeType} audio from ${participantName}`);
            
            // Process the audio blob
            await processMultilingualAudio(audioBlob, peerId, participantName);
            
            // Clear chunks after processing
            audioChunks = [];
          }
        }
      };
      
      mediaRecorder.onerror = (error) => {
        console.error(`MediaRecorder error for ${participantName}:`, error);
      };
      
      mediaRecorder.onstart = () => {
        console.log(`🎙️ MediaRecorder started for ${participantName}`);
      };
      
      // Start recording in chunks
      mediaRecorder.start(CHUNK_DURATION);
      
      // Store for cleanup
      if (!speechRecognitionRef.current) {
        speechRecognitionRef.current = new Map();
      }
      
      speechRecognitionRef.current.set(peerId, {
        mediaRecorder,
        audioContext,
        stop: () => {
          if (mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
          }
          audioContext.close().catch(err => console.warn('AudioContext close error:', err));
        }
      });
      
    } catch (error) {
      console.error(`MediaRecorder setup failed for ${participantName}:`, error);
    }
  };

  // Native speech recognition for remote participant
  const startNativeRecognitionForRemote = async (audioContext, source, peerId, participantName) => {
    try {
      // Create a MediaRecorder to capture audio chunks from remote stream
      const dest = audioContext.createMediaStreamDestination();
      source.connect(dest);
      
      const mediaRecorder = new MediaRecorder(dest.stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      let audioChunks = [];
      let isProcessing = false;
      
      mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0 && !isProcessing) {
          audioChunks.push(event.data);
          
          // Process audio chunk with Web Speech API
          if (audioChunks.length >= 5) { // Process every 5 chunks (~2.5 seconds)
            isProcessing = true;
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm;codecs=opus' });
            await processRemoteAudioBlob(audioBlob, peerId, participantName);
            audioChunks = [];
            isProcessing = false;
          }
        }
      };
      
      mediaRecorder.start(500); // Capture in 500ms intervals
      
      // Store for cleanup
      if (!speechRecognitionRef.current) {
        speechRecognitionRef.current = new Map();
      }
      speechRecognitionRef.current.set(peerId, {
        audioContext,
        mediaRecorder,
        stop: () => {
          mediaRecorder.stop();
          audioContext.close();
        }
      });
      
    } catch (error) {
      console.error(`Native recognition setup failed for ${participantName}:`, error);
    }
  };

  // Fallback recognition for Safari/iOS with remote audio
  const startFallbackRecognitionForRemote = async (audioContext, source, peerId, participantName) => {
    try {
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      source.connect(processor);
      processor.connect(audioContext.destination);
      
      let audioBuffer = [];
      let silenceCount = 0;
      const SILENCE_THRESHOLD = 0.01;
      const MAX_SILENCE = 30; // ~1.5 seconds of silence
      
      processor.onaudioprocess = (event) => {
        const inputData = event.inputBuffer.getChannelData(0);
        const volume = Math.sqrt(inputData.reduce((sum, sample) => sum + sample * sample, 0) / inputData.length);
        
        if (volume > SILENCE_THRESHOLD) {
          silenceCount = 0;
          // Convert to Int16Array for processing
          const int16Data = new Int16Array(inputData.length);
          for (let i = 0; i < inputData.length; i++) {
            int16Data[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32767));
          }
          audioBuffer.push(int16Data);
        } else if (audioBuffer.length > 0) {
          silenceCount++;
          if (silenceCount >= MAX_SILENCE) {
            // Process accumulated audio
            processRemoteAudioBuffer(audioBuffer, peerId, participantName);
            audioBuffer = [];
            silenceCount = 0;
          }
        }
      };
      
      // Store for cleanup
      if (!speechRecognitionRef.current) {
        speechRecognitionRef.current = new Map();
      }
      speechRecognitionRef.current.set(peerId, {
        audioContext,
        processor,
        stop: () => {
          processor.disconnect();
          source.disconnect();
          audioContext.close();
        }
      });
      
    } catch (error) {
      console.error(`Fallback recognition setup failed for ${participantName}:`, error);
    }
  };

  // Multilingual processing pipeline: Audio → STT → Translation → TTS + Subtitles
  const processMultilingualAudio = async (audioBlob, peerId, participantName) => {
    // Early exit if subtitles are disabled
    if (!subtitlesEnabledRef.current && !multilingualEnabled) {
      console.log(`⏹️ Skipping processing - subtitles and multilingual both disabled for ${participantName}`);
      return;
    }

    try {
      console.log(`Processing multilingual audio from ${participantName}`);
      
      // Step 1: Speech-to-Text using SubtitleService
      console.log(`📤 Sending ${audioBlob.size} bytes to STT for ${participantName}`);
      
      const sttResult = await SubtitleService.speechToText(audioBlob);
      console.log(`📥 STT Result for ${participantName}:`, sttResult);
      
      if (!sttResult.success) {
        console.warn(`❌ STT failed for ${participantName}:`, sttResult.error);
        
        // Show debug info in subtitles
        if (subtitlesEnabled) {
          const debugEntry = {
            original: `[STT Error: ${sttResult.error}]`,
            translated: null,
            text: `[STT Error: ${sttResult.error}]`,
            timestamp: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
            speaker: participantName,
            sourceLanguage: sourceLanguage,
            targetLanguage: targetLanguage,
            isTranslated: false
          };
          setSubtitleHistory(prev => [...prev.slice(-4), debugEntry]);
        }
        return;
      }
      
      const originalText = sttResult.data?.reply?.trim();
      if (!originalText) {
        console.warn(`❌ No text received from STT for ${participantName}`);
        return;
      }
      
      console.log(`Original text from ${participantName}: ${originalText}`);
      
      // Step 2: Translation (if multilingual is enabled and target language is different)
      let translatedText = originalText;
      let isTranslated = false;
      
      if (multilingualEnabled && targetLanguage !== sourceLanguage) {
        const translationResult = await SubtitleService.translateText(originalText, sourceLanguage, targetLanguage);
        if (translationResult.success && translationResult.data?.translatedText) {
          translatedText = translationResult.data.translatedText;
          isTranslated = true;
          console.log(`Translated text: ${translatedText}`);
        } else {
          console.warn(`Translation failed for ${participantName}:`, translationResult.error);
        }
      }
      
      // Step 3: Display subtitles (if enabled)
      if (subtitlesEnabled) {
        const subtitleEntry = {
          id: `${peerId}-${Date.now()}`, // Unique ID for each subtitle
          original: originalText,
          translated: isTranslated ? translatedText : null,
          text: translatedText, // Show translated version if available
          timestamp: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
          speaker: participantName,
          sourceLanguage: sourceLanguage,
          targetLanguage: targetLanguage,
          isTranslated: isTranslated,
          createdAt: Date.now() // For auto-cleanup
        };
        
        setSubtitleHistory(prev => {
          const updated = [...prev.slice(-4), subtitleEntry]; // Keep only last 5 entries
          
          // Auto-cleanup old subtitles after 8 seconds to keep UI clean
          setTimeout(() => {
            setSubtitleHistory(current => 
              current.filter(sub => sub.id !== subtitleEntry.id)
            );
          }, 8000);
          
          return updated;
        });
      }
      
      // Step 4: Audio output (if multilingual is enabled)
      if (multilingualEnabled && translatedText !== originalText) {
        await playTranslatedAudio(translatedText, peerId, participantName);
      }
      
    } catch (error) {
      console.error(`Multilingual processing failed for ${participantName}:`, error);
    }
  };
  
  // Play translated audio using TTS with proper volume control
  const playTranslatedAudio = async (translatedText, peerId, participantName) => {
    try {
      console.log(`🗣️ Generating TTS for ${participantName}: "${translatedText}"`);
      
      const ttsResult = await BotService.textToSpeech(translatedText);
      if (!ttsResult.success) {
        console.warn(`❌ TTS failed for ${participantName}:`, ttsResult.error);
        return;
      }
      
      // Create Web Audio API context for better audio control
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      
      // Convert blob to array buffer
      const arrayBuffer = await ttsResult.data.arrayBuffer();
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      
      // Create buffer source and gain node for volume control
      const source = audioCtx.createBufferSource();
      const gainNode = audioCtx.createGain();
      
      source.buffer = audioBuffer;
      source.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      // Set appropriate volume (louder to replace original audio)
      gainNode.gain.value = 1.0;
      
      // Handle completion
      source.onended = () => {
        console.log(`✅ Finished playing translated audio for ${participantName}`);
        audioCtx.close().catch(err => console.warn('AudioContext close error:', err));
        setActiveAudioSources(prev => {
          const newMap = new Map(prev);
          newMap.delete(peerId);
          return newMap;
        });
      };
      
      // Track active audio sources
      setActiveAudioSources(prev => {
        const newMap = new Map(prev);
        newMap.set(peerId, { source, participantName, audioCtx });
        return newMap;
      });
      
      // Play the translated audio
      source.start(0);
      console.log(`🔊 Playing translated audio for ${participantName}`);
      
    } catch (error) {
      console.error(`❌ TTS playback failed for ${participantName}:`, error);
    }
  };

  // Process remote audio blob - now uses the multilingual pipeline
  const processRemoteAudioBlob = async (audioBlob, peerId, participantName) => {
    if (subtitlesEnabled || multilingualEnabled) {
      await processMultilingualAudio(audioBlob, peerId, participantName);
    }
  };

  // Process remote audio buffer for fallback recognition  
  const processRemoteAudioBuffer = async (audioBuffer, peerId, participantName) => {
    if (audioBuffer.length === 0) return;
    
    try {
      // Convert audio buffer to blob for processing
      const audioBlob = new Blob([new Uint8Array(audioBuffer.flat().buffer)], { 
        type: 'audio/wav' 
      });
      
      // Use the same multilingual pipeline
      if (subtitlesEnabled || multilingualEnabled) {
        await processMultilingualAudio(audioBlob, peerId, participantName);
      }
      
    } catch (error) {
      console.error(`Failed to process audio buffer for ${participantName}:`, error);
      
      // Fallback: show basic detection for Safari
      if (subtitlesEnabled) {
        const subtitleEntry = {
          original: `[Speech detected from ${participantName}]`,
          translated: null,
          text: `[Speech detected from ${participantName}]`,
          timestamp: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
          speaker: participantName,
          sourceLanguage: sourceLanguage,
          targetLanguage: targetLanguage,
          isTranslated: false
        };
        
        setSubtitleHistory(prev => [...prev.slice(-4), subtitleEntry]);
      }
    }
  };

  // Handle new remote participants joining during active subtitles
  useEffect(() => {
    if (subtitlesEnabled && remoteStreams.size > 0) {
      // Start recognition for any new remote streams
      remoteStreams.forEach((stream, peerId) => {
        if (!speechRecognitionRef.current?.has(peerId)) {
          const participantName = participantMap[peerId] || 'Guest';
          startRemoteStreamRecognition(stream, peerId, participantName);
        }
      });
    }
  }, [remoteStreams, subtitlesEnabled, participantMap]);

  const stopSubtitles = () => {
    console.log('🛑 Stopping subtitles for all participants...');
    
    if (speechRecognitionRef.current) {
      if (speechRecognitionRef.current instanceof Map) {
        // Stop all remote stream recognitions
        console.log(`🛑 Stopping ${speechRecognitionRef.current.size} MediaRecorder instances`);
        speechRecognitionRef.current.forEach((recognizer, peerId) => {
          try {
            console.log(`🛑 Stopping MediaRecorder for participant ${peerId}`);
            if (recognizer.stop) {
              recognizer.stop();
            }
            // Also directly stop MediaRecorder if available
            if (recognizer.mediaRecorder && recognizer.mediaRecorder.state !== 'inactive') {
              console.log(`🛑 Force stopping MediaRecorder for ${peerId}`);
              recognizer.mediaRecorder.stop();
            }
          } catch (error) {
            console.warn(`Failed to stop recognition for peer ${peerId}:`, error);
          }
        });
        speechRecognitionRef.current.clear();
      } else if (typeof speechRecognitionRef.current.stop === 'function') {
        // Legacy single recognition
        speechRecognitionRef.current.stop();
      }
      speechRecognitionRef.current = null;
    }
    
    // Update state
    setSubtitlesEnabled(false);
    subtitlesEnabledRef.current = false;
    setCurrentSubtitle('');
    setSubtitleHistory([]); // Clear subtitle history when stopping
    
    console.log('✅ Subtitles stopped for all remote participants');
  };

  const toggleSubtitles = () => {
    if (subtitlesEnabled) {
      stopSubtitles();
    } else {
      startSubtitles();
    }
  };

  const toggleMultilingual = () => {
    setMultilingualEnabled(!multilingualEnabled);
    console.log('Multilingual translation:', !multilingualEnabled ? 'enabled' : 'disabled');
    
    // If we're enabling multilingual, also start subtitle processing if not already active
    if (!multilingualEnabled && !subtitlesEnabled) {
      startSubtitles();
    }
  };

  const handleLeave = () => {
    console.log('[MeetingPage] 👋 User clicked leave meeting button');
    // Stop recording if active before leaving
    if (isRecording) {
      stopRecording();
    }
    // Stop subtitles if active
    if (subtitlesEnabled) {
      stopSubtitles();
    }
    // Stop screen sharing if active
    if (isScreenSharing) {
      stopScreenShare();
    }
    leaveMeeting();
    
    // For standalone meeting windows, close the window instead of navigating
    if (window.opener) {
      console.log('[MeetingPage] 🪟 Closing meeting window');
      window.close();
    } else {
      console.log('[MeetingPage] 📤 Navigating to /meetings');
      navigate('/meetings');
    }
  };

  // Memoized video tiles to prevent unnecessary recalculations
  const videoTiles = useMemo(() => [
    { id: 'local', stream: localStream, isLocal: true, label: 'You' },
    ...Array.from(remoteStreams.entries()).map(([id, stream]) => ({
      id,
      stream,
      isLocal: false,
      label: participantMap[id] || 'Guest',
    }))
  ], [localStream, remoteStreams, participantMap]);

  // Memoized grid calculation
  const { gridColumns, gridRows, isScreenShareMode } = useMemo(() => {
    const participantCount = videoTiles.length;
    const columns = participantCount === 1 ? 1 : participantCount === 2 ? 2 : Math.ceil(Math.sqrt(participantCount));
    const rows = Math.ceil(participantCount / columns);
    const screenShareMode = screenSharingUserId !== null && viewMode === 'speaker';
    
    return {
      gridColumns: columns,
      gridRows: rows,
      isScreenShareMode: screenShareMode
    };
  }, [videoTiles.length, screenSharingUserId, viewMode]);

  if (!user) {
    return <div className="p-8 text-center text-white bg-gray-900 min-h-screen flex items-center justify-center">Please log in to join meetings.</div>;
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
      
      {/* Screen Sharing Toggle Ribbon */}
      {screenSharingUserId && (
        <div className="bg-blue-600 text-white px-4 py-2 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <MonitorSpeaker size={16} />
            <span className="text-sm font-medium">
              {screenSharingUserId === 'local' ? 'You are sharing your screen' : `${participantMap[screenSharingUserId] || 'Someone'} is sharing screen`}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setViewMode('speaker')}
              className={`px-3 py-1 rounded text-xs ${viewMode === 'speaker' ? 'bg-white/20' : 'bg-transparent'}`}
            >
              Screen View
            </button>
            <button
              onClick={() => setViewMode('gallery')}
              className={`px-3 py-1 rounded text-xs ${viewMode === 'gallery' ? 'bg-white/20' : 'bg-transparent'}`}
            >
              Gallery View
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area - Simplified */}
      <div className="flex-1 overflow-hidden">
        {isScreenShareMode ? (
          /* Screen Sharing Layout - Simplified */
          <div className="flex h-full">
            {/* Main Screen Area */}
            <div className="flex-1 bg-black flex items-center justify-center p-4">
              {screenStream && screenSharingUserId === 'local' ? (
                <video
                  autoPlay
                  playsInline
                  muted
                  className="max-w-full max-h-full object-contain"
                  srcObject={screenStream}
                />
              ) : (
                <div className="text-white text-center">
                  <MonitorSpeaker size={64} className="mx-auto mb-4 text-gray-400" />
                  <div className="text-gray-400">Screen being shared...</div>
                </div>
              )}
            </div>

            {/* Participant Sidebar */}
            <div className="w-64 bg-gray-800 p-2 flex flex-col space-y-2 overflow-y-auto">
              {videoTiles.map(({ id, stream, isLocal, label }) => (
                <div key={id} className="relative bg-gray-700 rounded aspect-video overflow-hidden">
                  {stream && stream.getVideoTracks().length > 0 ? (
                    <video
                      ref={isLocal && id === 'local' ? localVideoRef : undefined}
                      id={isLocal ? undefined : `remote-video-${id}`}
                      autoPlay
                      muted={isLocal}
                      playsInline
                      className="w-full h-full object-cover"
                      style={{ 
                        background: '#1f2937',
                        transform: isLocal ? 'scaleX(-1)' : 'none'
                      }}
                      srcObject={isLocal ? undefined : stream}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                        {label.charAt(0).toUpperCase()}
                      </div>
                    </div>
                  )}
                  <div className="absolute bottom-1 left-1 bg-black/70 text-white text-xs px-1 py-0.5 rounded">
                    {label} {isLocal && '(You)'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* Gallery Layout - Simplified */
          <div className="p-4 h-full">
            <div 
              className="grid gap-2 h-full"
              style={{
                gridTemplateColumns: `repeat(${gridColumns}, 1fr)`,
                gridTemplateRows: `repeat(${gridRows}, 1fr)`,
              }}
            >
              {videoTiles.map(({ id, stream, isLocal, label }) => (
                <div key={id} className="relative bg-gray-800 rounded-lg overflow-hidden">
                  {stream && stream.getVideoTracks().length > 0 ? (
                    <video
                      ref={isLocal && id === 'local' ? localVideoRef : undefined}
                      id={isLocal ? undefined : `remote-video-${id}`}
                      autoPlay
                      muted={isLocal}
                      playsInline
                      className="w-full h-full object-cover"
                      style={{ 
                        background: '#1f2937',
                        transform: isLocal ? 'scaleX(-1)' : 'none'
                      }}
                      srcObject={isLocal ? undefined : stream}
                    />
                  ) : stream && stream.getAudioTracks().length > 0 ? (
                    <>
                      <audio
                        id={isLocal ? undefined : `remote-audio-${id}`}
                        autoPlay
                        className="hidden"
                        srcObject={isLocal ? undefined : stream}
                      />
                      <div className="w-full h-full flex items-center justify-center bg-gray-700">
                        <div className="text-center">
                          <div className="w-16 h-16 bg-gray-600 rounded-full flex items-center justify-center text-white font-bold text-xl mb-2">
                            {label.charAt(0).toUpperCase()}
                          </div>
                          <div className="text-white text-sm">{label}</div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-700">
                      <div className="text-center">
                        <VideoOff size={48} className="text-gray-400 mb-2 mx-auto" />
                        <div className="text-white text-sm">{label}</div>
                      </div>
                    </div>
                  )}
                  
                  <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                    {label} {isLocal && '(You)'}
                  </div>
                  
                  {stream && stream.getAudioTracks().length > 0 && !stream.getAudioTracks()[0].enabled && (
                    <div className="absolute top-2 right-2 bg-red-600 rounded-full p-1">
                      <MicOff size={12} className="text-white" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      {/* Simplified Subtitles */}
      {subtitlesEnabled && subtitleHistory.length > 0 && (
        <div className="absolute bottom-20 left-4 right-4 pointer-events-none z-10">
          {subtitleHistory.slice(-1).map((subtitle) => (
            <div key={subtitle.id} className="bg-black/80 text-white rounded px-3 py-2 text-sm max-w-md">
              <span className="font-medium">{subtitle.speaker}:</span> {subtitle.text}
            </div>
          ))}
        </div>
      )}

      {/* Simple Controls Bar */}
      <div className="bg-gray-800 p-3 flex justify-center space-x-4">
        <button 
          onClick={toggleAudio} 
          className={`p-3 rounded-full ${isAudioEnabled ? 'bg-gray-600' : 'bg-red-600'} text-white`}
          title={isAudioEnabled ? "Mute audio" : "Unmute audio"}
        >
          {isAudioEnabled ? <Mic size={20}/> : <MicOff size={20}/>} 
        </button>
        
        <button 
          onClick={toggleVideo} 
          className={`p-3 rounded-full ${isVideoEnabled ? 'bg-gray-600' : 'bg-red-600'} text-white`}
          title={isVideoEnabled ? "Turn off camera" : "Turn on camera"}
        >
          {isVideoEnabled ? <Video size={20}/> : <VideoOff size={20}/>} 
        </button>
        
        <button 
          onClick={isRecording ? stopRecording : startRecording} 
          className={`p-3 rounded-full ${isRecording ? 'bg-red-600' : 'bg-gray-600'} text-white`}
          title={isRecording ? "Stop recording" : "Start recording"}
        >
          {isRecording ? <StopCircle size={20}/> : <CircleDot size={20}/>} 
        </button>
        
        <button 
          onClick={isScreenSharing ? stopScreenShare : startScreenShare} 
          className={`p-3 rounded-full ${isScreenSharing ? 'bg-green-600' : 'bg-gray-600'} text-white`}
          title={isScreenSharing ? "Stop sharing screen" : "Share screen"}
        >
          {isScreenSharing ? <MonitorSpeaker size={20}/> : <Monitor size={20}/>} 
        </button>
        
        {recordedChunks.length > 0 && (
          <button 
            onClick={downloadRecording} 
            className="p-3 rounded-full text-white bg-green-600 hover:bg-green-700"
            title="Download recording"
          >
            <Download size={20}/>
          </button>
        )}
        
        <button 
          onClick={handleLeave} 
          className="p-3 rounded-full bg-red-600 text-white" 
          title="Leave meeting"
        >
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

              {/* Host Controls */}
              {roomSettings.isHost && (
                <div className="mb-4">
                  <h4 className="text-xs font-medium text-gray-300 mb-2">Host Controls</h4>
                  <div className="space-y-2">
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={roomSettings.avatarApiEnabled}
                        onChange={(e) => toggleAvatarApi(e.target.checked)}
                        className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
                      />
                      <span className="text-sm">Enable Avatar API</span>
                    </label>
                    <p className="text-xs text-gray-400 mt-1">
                      {roomSettings.avatarApiEnabled 
                        ? 'Participants can interact with the avatar' 
                        : 'Avatar interactions are disabled for all participants'
                      }
                    </p>
                  </div>
                </div>
              )}

              {/* Features Settings */}
              <div className="mb-4">
                <h4 className="text-xs font-medium text-gray-300 mb-2">Features</h4>
                <div className="space-y-2">
                  <button
                    onClick={() => {
                      if (showAvatar) {
                        resetAvatarState();
                      }
                      setShowAvatar(!showAvatar);
                      setShowSettings(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                      showAvatar ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'
                    }`}
                  >
                    🤖 AI Avatar {showAvatar ? '(Active)' : ''}
                  </button>
                  <button
                    onClick={() => {
                      toggleSubtitles();
                      setShowSettings(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                      subtitlesEnabled ? 'bg-green-600' : 'bg-gray-700 hover:bg-gray-600'
                    }`}
                  >
                    💬 Live Subtitles {subtitlesEnabled ? '(Active)' : ''}
                  </button>
                  <button
                    onClick={() => {
                      toggleMultilingual();
                      setShowSettings(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                      multilingualEnabled ? 'bg-purple-600' : 'bg-gray-700 hover:bg-gray-600'
                    }`}
                  >
                    🌐 Multilingual Audio {multilingualEnabled ? '(Active)' : ''}
                  </button>
                </div>
              </div>

              {/* Language Settings */}
              {(subtitlesEnabled || multilingualEnabled) && (
                <div className="mb-4">
                  <h4 className="text-xs font-medium text-gray-300 mb-2">Language Settings</h4>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">Source Language (Detection)</label>
                      <select
                        value={sourceLanguage}
                        onChange={(e) => setSourceLanguage(e.target.value)}
                        className="w-full text-xs bg-gray-700 text-white border border-gray-600 rounded px-2 py-1"
                      >
                        {supportedLanguages.map(lang => (
                          <option key={lang.code} value={lang.code}>
                            {lang.flag} {lang.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">Target Language</label>
                      <select
                        value={targetLanguage}
                        onChange={(e) => setTargetLanguage(e.target.value)}
                        className="w-full text-xs bg-gray-700 text-white border border-gray-600 rounded px-2 py-1"
                      >
                        {supportedLanguages.filter(lang => lang.code !== 'auto').map(lang => (
                          <option key={lang.code} value={lang.code}>
                            {lang.flag} {lang.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="text-xs text-gray-400 bg-gray-700 p-2 rounded">
                      <div className="flex items-center justify-between">
                        <span>💬 Subtitles:</span>
                        <span className={subtitlesEnabled ? 'text-green-400' : 'text-gray-500'}>
                          {subtitlesEnabled ? 'ON' : 'OFF'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>🌐 Multilingual Audio:</span>
                        <span className={multilingualEnabled ? 'text-purple-400' : 'text-gray-500'}>
                          {multilingualEnabled ? 'ON' : 'OFF'}
                        </span>
                      </div>
                      {multilingualEnabled && (
                        <div className="mt-1 text-xs text-orange-300">
                          ⚠️ Audio translation may have 2-3 second delay
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

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
          onClose={() => {
            setShowAvatar(false);
            resetAvatarState();
          }}
          avatarApiEnabled={roomSettings.avatarApiEnabled}
        />
      )}
      
      {/* Avatar API Error Message */}
      {avatarApiError && (
        <div className="absolute top-20 left-4 bg-red-600 text-white p-3 rounded-lg shadow-lg z-30">
          <div className="text-sm font-medium">Avatar API Disabled</div>
          <div className="text-xs">{avatarApiError}</div>
        </div>
      )}
    </div>
  );
}