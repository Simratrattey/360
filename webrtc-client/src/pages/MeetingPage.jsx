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
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(false);
  const [multilingualEnabled, setMultilingualEnabled] = useState(false);
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
    setSubtitlesEnabled(true);
    
    // Start processing each remote stream
    remoteStreams.forEach((stream, peerId) => {
      const participantName = participantMap[peerId] || 'Guest';
      startRemoteStreamRecognition(stream, peerId, participantName);
    });
  };

  // Process individual remote stream for speech recognition
  const startRemoteStreamRecognition = async (stream, peerId, participantName) => {
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
      
      // Use MediaRecorder for more reliable audio capture
      await startMediaRecorderProcessing(audioStream, audioContext, peerId, participantName);
      
      console.log(`✅ Started audio processing for ${participantName} (${peerId})`);
      
    } catch (error) {
      console.error(`❌ Failed to start audio processing for ${participantName}:`, error);
    }
  };

  // Use MediaRecorder to capture audio chunks and process them
  const startMediaRecorderProcessing = async (audioStream, audioContext, peerId, participantName) => {
    try {
      // Create MediaRecorder to capture audio in chunks
      const mediaRecorder = new MediaRecorder(audioStream, {
        mimeType: 'audio/webm;codecs=opus',
        audioBitsPerSecond: 16000
      });
      
      let audioChunks = [];
      let silenceTimer = null;
      const CHUNK_DURATION = 2000; // Process every 2 seconds
      
      mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data);
          
          // Clear silence timer since we got audio
          if (silenceTimer) {
            clearTimeout(silenceTimer);
            silenceTimer = null;
          }
          
          // Process accumulated chunks
          if (audioChunks.length > 0) {
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm;codecs=opus' });
            console.log(`🔊 Processing ${audioBlob.size} bytes of audio from ${participantName}`);
            
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
    try {
      console.log(`Processing multilingual audio from ${participantName}`);
      
      // Step 1: Speech-to-Text using BotService
      console.log(`📤 Sending ${audioBlob.size} bytes to STT for ${participantName}`);
      
      const sttResult = await BotService.speechToText(audioBlob);
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
        const translationResult = await BotService.translateText(originalText, sourceLanguage, targetLanguage);
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
          original: originalText,
          translated: isTranslated ? translatedText : null,
          text: translatedText, // Show translated version if available
          timestamp: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
          speaker: participantName,
          sourceLanguage: sourceLanguage,
          targetLanguage: targetLanguage,
          isTranslated: isTranslated
        };
        
        setSubtitleHistory(prev => [
          ...prev.slice(-4), // Keep only last 5 entries
          subtitleEntry
        ]);
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
    if (speechRecognitionRef.current) {
      if (speechRecognitionRef.current instanceof Map) {
        // Stop all remote stream recognitions
        speechRecognitionRef.current.forEach((recognizer, peerId) => {
          try {
            if (recognizer.stop) {
              recognizer.stop();
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
    setSubtitlesEnabled(false);
    setCurrentSubtitle('');
    console.log('Subtitles stopped for all remote participants');
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
    // Stop recording if active before leaving
    if (isRecording) {
      stopRecording();
    }
    // Stop subtitles if active
    if (subtitlesEnabled) {
      stopSubtitles();
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
      {/* Subtitles Display */}
      {subtitlesEnabled && (
        <div className="fixed bottom-24 left-4 right-4 max-w-4xl mx-auto z-20">
          <div className="bg-black bg-opacity-80 text-white rounded-lg p-4 backdrop-blur-sm">
            {/* Remote subtitles notice */}
            <div className="mb-3 p-2 bg-blue-900 bg-opacity-50 rounded text-xs text-blue-200 border border-blue-600">
              <div className="flex items-center justify-between">
                <span>👥 Remote Participants ({remoteStreams.size} connected)</span>
                <div className="flex items-center space-x-2">
                  {subtitlesEnabled && (
                    <span className="bg-green-900 text-green-300 px-1 py-0.5 rounded text-xs">
                      💬 Subtitles ON
                    </span>
                  )}
                  {multilingualEnabled && (
                    <span className="bg-purple-900 text-purple-300 px-1 py-0.5 rounded text-xs">
                      🌐 Multilingual ON
                    </span>
                  )}
                </div>
              </div>
              {multilingualEnabled && targetLanguage !== 'en' && (
                <div className="mt-1 text-xs">
                  Translating to {supportedLanguages.find(l => l.code === targetLanguage)?.flag} {supportedLanguages.find(l => l.code === targetLanguage)?.name}
                </div>
              )}
            </div>
            
            {/* Recent subtitles history */}
            {subtitleHistory.slice(-3).map((subtitle, index) => (
              <div key={index} className="mb-3 text-sm opacity-70 border-l-2 border-blue-500 pl-3">
                <div className="flex items-center space-x-2">
                  <span className="text-blue-300 font-medium">{subtitle.speaker}</span>
                  <span className="text-gray-400 text-xs">{subtitle.timestamp}</span>
                  {subtitle.isTranslated && (
                    <span className="text-xs bg-purple-900 text-purple-300 px-1 py-0.5 rounded">
                      {supportedLanguages.find(l => l.code === subtitle.targetLanguage)?.flag} Translated
                    </span>
                  )}
                  {multilingualEnabled && subtitle.isTranslated && (
                    <span className="text-xs bg-green-900 text-green-300 px-1 py-0.5 rounded">
                      🔊 Audio Played
                    </span>
                  )}
                </div>
                
                {/* Show original text if translated */}
                {subtitle.isTranslated && (
                  <div className="mt-1 text-xs text-gray-400 italic">
                    Original: "{subtitle.original}"
                  </div>
                )}
                
                {/* Main subtitle text */}
                <div className="mt-1 text-white">{subtitle.text}</div>
              </div>
            ))}
            
            {/* Show when no content yet */}
            {subtitleHistory.length === 0 && (
              <div className="text-sm text-gray-400 text-center py-2">
                🎧 Waiting for remote participants to speak...
                {remoteStreams.size === 0 && (
                  <div className="mt-1 text-xs">No remote participants connected</div>
                )}
                {remoteStreams.size > 0 && (
                  <div className="mt-1 text-xs">
                    {speechRecognitionRef.current && speechRecognitionRef.current.size > 0 
                      ? `🎙️ Processing audio from ${speechRecognitionRef.current.size} participant(s)`
                      : '⚠️ Audio processing not started - check console for errors'
                    }
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

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

              {/* Features Settings */}
              <div className="mb-4">
                <h4 className="text-xs font-medium text-gray-300 mb-2">Features</h4>
                <div className="space-y-2">
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
          onClose={() => setShowAvatar(false)}
        />
      )}
    </div>
  );
}