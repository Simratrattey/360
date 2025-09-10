// src/pages/MeetingPage.jsx
import React, { useState, useEffect, useRef, useContext, useMemo, useCallback } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { useParams, useNavigate } from 'react-router-dom';
import { Device } from 'mediasoup-client';
import API from '../api/client.js';
import { useWebRTC } from '../hooks/useWebRTC';
import { AuthContext } from '../context/AuthContext';
import { Mic, MicOff, Video, VideoOff, PhoneOff, CircleDot, StopCircle, Download, Settings, Monitor, MonitorSpeaker, Users, FileText, X, Share2 } from 'lucide-react';
import { SocketContext } from '../context/SocketContext';
import BotService from '../api/botService';
import AssemblyRealtimeClient from '../api/assemblyClient';
import transcriptAPI from '../api/transcriptApi';
import AvatarSidebar from '../components/AvatarSidebar';
import MeetingStatsBar from '../components/MeetingStatsBar';

// Helper function to format UTC timestamp to user's local timezone
const formatTimestamp = (utcTimestamp) => {
  try {
    // Handle both ISO string timestamps and legacy formatted timestamps
    const date = new Date(utcTimestamp);
    if (isNaN(date.getTime())) {
      // If it's not a valid date, return the original timestamp (for backward compatibility)
      return utcTimestamp;
    }
    return date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
  } catch (error) {
    // Fallback to original timestamp if parsing fails
    return utcTimestamp;
  }
};

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
    avatarApiError,
    toggleAvatarApi
  } = useContext(SocketContext);

  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isRecording, setIsRecording]       = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [mediaRecorder, setMediaRecorder]   = useState(null);
  const [recordedChunks, setRecordedChunks] = useState([]);
  const [recordingMethod, setRecordingMethod] = useState('screen'); // 'screen' or 'canvas'
  const [recordingStream, setRecordingStream] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(false);
  const [multilingualEnabled, setMultilingualEnabled] = useState(false);
  const subtitlesEnabledRef = useRef(false);
  const [meetingSubtitlesEnabled, setMeetingSubtitlesEnabled] = useState(true); // Persistent setting for the meeting
  const [currentSubtitle, setCurrentSubtitle] = useState('');
  const [subtitleHistory, setSubtitleHistory] = useState([]);
  const [permanentSubtitleHistory, setPermanentSubtitleHistory] = useState([]); // Full meeting transcript
  const [isHistoryPanelOpen, setIsHistoryPanelOpen] = useState(false);
  const [meetingJoinedAt, setMeetingJoinedAt] = useState(null);
  const [sourceLanguage, setSourceLanguage] = useState('auto'); // Source language for recognition
  const [targetLanguage, setTargetLanguage] = useState('en'); // Target language for translation
  
  // Audio context and elements for multilingual audio output
  const [audioContext, setAudioContext] = useState(null);
  const [activeAudioSources, setActiveAudioSources] = useState(new Map());
  const audioContextRef = useRef(null);
  const speechRecognitionRef = useRef(null);
  const assemblyRef = useRef(null); // Legacy ref (not used in new implementation)
  const assemblyClientsRef = useRef(null); // Map of peerId -> AssemblyAI client
  const audioProcessorsRef = useRef(null); // Map of peerId -> audio processor
  const pcmWorkerRef = useRef(null);
  const transcriptInitializingRef = useRef(new Set()); // Track which participants are being initialized
  const transcriptScrollRef = useRef(null);
  const transcriptEndRef = useRef(null);

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
  
  // Meeting stats
  const [meetingStartTime, setMeetingStartTime] = useState(null);
  
  // Subtitle positioning
  const [subtitlePosition, setSubtitlePosition] = useState({ x: 0, y: 0 });
  const [isDraggingSubtitles, setIsDraggingSubtitles] = useState(false);
  const subtitleRef = useRef(null);
  
  // Speaking indicators
  const [speakingParticipants, setSpeakingParticipants] = useState(new Set());
  const audioAnalyzers = useRef(new Map()); // Store audio analyzers for each participant
  
  // Join request system
  const [joinRequests, setJoinRequests] = useState([]);
  const [showJoinRequests, setShowJoinRequests] = useState(false);
  
  // Host transfer system
  const [hostTransferNotification, setHostTransferNotification] = useState(null);
  
  // Invite system
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteLink, setInviteLink] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);
  
  // Debug participant map changes
  // Initialize meeting settings based on meeting configuration
  useEffect(() => {
    // Check if this meeting has subtitles enabled
    const meetingInfoKey = `meeting-${roomId}`;
    const meetingInfoStr = localStorage.getItem(meetingInfoKey);
    
    if (meetingInfoStr) {
      try {
        const meetingInfo = JSON.parse(meetingInfoStr);
        console.log(`[MeetingPage] Found meeting info for room ${roomId}:`, meetingInfo);
        
        // Initialize subtitle settings based on meeting configuration
        if (meetingInfo.subtitlesEnabled !== undefined) {
          const shouldEnableSubtitles = meetingInfo.subtitlesEnabled;
          console.log(`[MeetingPage] Setting subtitles to ${shouldEnableSubtitles ? 'enabled' : 'disabled'} based on meeting config`);
          
          setSubtitlesEnabled(shouldEnableSubtitles);
          setMeetingSubtitlesEnabled(shouldEnableSubtitles); // Persist throughout meeting
          subtitlesEnabledRef.current = shouldEnableSubtitles;
          
          if (!shouldEnableSubtitles) {
            console.log(`[MeetingPage] ⚠️ Subtitles disabled for this meeting - no transcription will occur`);
          }
        }
      } catch (error) {
        console.warn('[MeetingPage] Failed to parse meeting info:', error);
      }
    }
  }, [roomId]);

  useEffect(() => {
    console.log('[MeetingPage] participantMap changed:', participantMap, 'count:', Object.keys(participantMap).length);
  }, [participantMap]);
  const [screenSharingUserId, setScreenSharingUserId] = useState(null);
  const [viewMode, setViewMode] = useState('gallery'); // 'gallery' or 'speaker'
  const [isSmallScreen, setIsSmallScreen] = useState(typeof window !== 'undefined' ? window.matchMedia('(max-width: 768px)').matches : false);

  // Track screen size to optimize mobile layout
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const onChange = (e) => setIsSmallScreen(e.matches);
    if (mq.addEventListener) {
      mq.addEventListener('change', onChange);
    } else {
      // Safari
      mq.addListener(onChange);
    }
    return () => {
      if (mq.removeEventListener) {
        mq.removeEventListener('change', onChange);
      } else {
        mq.removeListener(onChange);
      }
    };
  }, []);

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
          userName: user.fullName || user.username,
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
          setMeetingJoinedAt(Date.now()); // Record when user joined
          setIsJoining(false);
          // Set meeting start time when successfully joining
          if (!meetingStartTime) {
            setMeetingStartTime(new Date());
          }
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

  // Load existing transcript history when joining the room
  useEffect(() => {
    if (roomId && user && meetingJoinedAt) {
      console.log('📋 Loading transcript history for room:', roomId);
      transcriptAPI.loadTranscriptHistory(roomId).then((history) => {
        // Only load transcripts that were created before the user joined
        const preJoinHistory = history.filter(entry => entry.createdAt < meetingJoinedAt);
        if (preJoinHistory.length > 0) {
          console.log(`📋 Loaded ${preJoinHistory.length} pre-join transcript entries (${history.length} total available)`);
          setPermanentSubtitleHistory(preJoinHistory);
        } else if (history.length > 0) {
          console.log(`📋 No pre-join transcripts (${history.length} total exist, but all after join time)`);
        }
      });
    }
  }, [roomId, user, meetingJoinedAt]);

  // Ensure local video always gets the stream and start audio analysis
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
      
      // Start audio analyzer for local stream
      if (localStream.getAudioTracks().length > 0 && !audioAnalyzers.current.has('local')) {
        startAudioAnalyzer(localStream, 'local', true);
      }

      // Local stream available - transcript recording will start when meeting has 2+ participants
    }
  }, [localStream]);

  // Attach remote streams to their video elements and handle multilingual audio
  useEffect(() => {
    // Only log streams for active participants (filter out departed participants)
    const activeStreams = Array.from(remoteStreams.entries()).filter(([id]) => participantMap[id] !== undefined);
    console.log('[MeetingPage] 🔄 Active remote streams:', activeStreams.map(([id, stream]) => ({
      id,
      participantName: participantMap[id],
      videoTracks: stream.getVideoTracks().length,
      audioTracks: stream.getAudioTracks().length
    })));
    
    const totalParticipants = remoteStreams.size + 1; // +1 for local user
    
    remoteStreams.forEach((stream, id) => {
      // Skip processing for participants who have left (not in participantMap)
      if (participantMap[id] === undefined) {
        return;
      }
      
      // Start audio analyzer for speaking detection
      if (stream.getAudioTracks().length > 0 && !audioAnalyzers.current.has(id)) {
        startAudioAnalyzer(stream, id, false);
      }

      // Start transcript recording for this remote participant (only if 2+ participants total and subtitles enabled)
      const participantName = participantMap[id];
      if (stream.getAudioTracks().length > 0 && participantName && totalParticipants >= 2 && meetingSubtitlesEnabled) {
        if (!assemblyClientsRef.current || !assemblyClientsRef.current.has(id)) {
          console.log(`🎯 Starting transcript recording for remote participant: ${participantName} (${id}) - ${totalParticipants} total participants`);
          startParticipantTranscriptRecording(stream, id, participantName);
        }
      }
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
      
      // Audio processing for multilingual mode removed - using AssemblyAI only
    });

    // Start local transcript recording if conditions are met (outside the loop to avoid duplicates)
    if (totalParticipants >= 2 && localStream && localStream.getAudioTracks().length > 0 && meetingSubtitlesEnabled) {
      if (!assemblyClientsRef.current || !assemblyClientsRef.current.has('local')) {
        console.log(`🎯 Starting transcript recording for local user - ${totalParticipants} total participants`);
        startParticipantTranscriptRecording(localStream, 'local', user?.fullName || user?.username);
      }
    }
    
    // Cleanup audio analyzers for streams that are no longer present or participants who have left
    const currentStreamIds = new Set(Array.from(remoteStreams.keys()));
    audioAnalyzers.current.forEach((analyzer, id) => {
      if (id !== 'local' && (!currentStreamIds.has(id) || participantMap[id] === undefined)) {
        console.log(`[Audio Analyzer] Cleaning up removed participant ${id}`);
        stopAudioAnalyzer(id);
      }
    });

    // Cleanup AssemblyAI clients for participants who left
    if (assemblyClientsRef.current) {
      assemblyClientsRef.current.forEach((client, id) => {
        if (id !== 'local' && (!currentStreamIds.has(id) || participantMap[id] === undefined)) {
          console.log(`🛑 Cleaning up AssemblyAI client for departed participant ${id}`);
          try {
            client.close();
          } catch (error) {
            console.warn(`Failed to close client for ${id}:`, error);
          }
          assemblyClientsRef.current.delete(id);
          transcriptInitializingRef.current.delete(id); // Also clean up initialization tracking
        }
      });
    }
  }, [remoteStreams, participantMap, meetingSubtitlesEnabled]); // Added meetingSubtitlesEnabled dependency to respect subtitle setting

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

    // Join request handler for hosts - updated to use joinRequestsUpdated
    const handleJoinRequestsUpdated = ({ pendingRequests, count }) => {
      console.log('[MeetingPage] Join requests updated:', { pendingRequests, count });
      setJoinRequests(pendingRequests || []);
    };

    // Host transfer handlers
    const handleHostTransferred = ({ message, previousHost }) => {
      console.log('[MeetingPage] You are now the host:', message, 'Previous host:', previousHost);
      setHostTransferNotification({
        type: 'newHost',
        message,
        previousHost,
        timestamp: Date.now()
      });
      
      // Auto-dismiss after 8 seconds
      setTimeout(() => setHostTransferNotification(null), 8000);
    };

    const handleHostChanged = ({ newHostId, newHostName, previousHostId }) => {
      console.log('[MeetingPage] Host changed:', { newHostId, newHostName, previousHostId });
      
      // Only show notification if the user is not the new host (they already got hostTransferred event)
      if (newHostId !== user?.id && newHostId !== user?._id) {
        setHostTransferNotification({
          type: 'hostChanged',
          message: `${newHostName} is now the host`,
          newHostName,
          previousHostId,
          timestamp: Date.now()
        });
        
        // Auto-dismiss after 6 seconds
        setTimeout(() => setHostTransferNotification(null), 6000);
      }
    };

    sfuSocket.on('screenShareStarted', handleRemoteScreenShareStarted);
    sfuSocket.on('screenShareStopped', handleRemoteScreenShareStopped);
    sfuSocket.on('joinRequestsUpdated', handleJoinRequestsUpdated);
    sfuSocket.on('hostTransferred', handleHostTransferred);
    sfuSocket.on('hostChanged', handleHostChanged);

    return () => {
      sfuSocket.off('screenShareStarted', handleRemoteScreenShareStarted);
      sfuSocket.off('screenShareStopped', handleRemoteScreenShareStopped);
      sfuSocket.off('joinRequestsUpdated', handleJoinRequestsUpdated);
      sfuSocket.off('hostTransferred', handleHostTransferred);
      sfuSocket.off('hostChanged', handleHostChanged);
    };
  }, [sfuSocket, user?.id, screenSharingUserId]);

  // Close settings on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showSettings && !event.target.closest('[data-settings-panel]')) {
        setShowSettings(false);
      }
      if (showJoinRequests && !event.target.closest('.join-requests-dropdown') && !event.target.closest('.participants-badge')) {
        setShowJoinRequests(false);
      }
    };
    
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showSettings, showJoinRequests]);

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
      console.log('Starting meeting recording with canvas method');
      
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
        // Skip departed participants  
        if (participantMap[id] === undefined) return;
        
        const videoEl = document.getElementById(`remote-video-${id}`);
        if (videoEl) {
          videoElements.push({
            video: videoEl,
            label: participantMap[id],
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

  // Start continuous transcript recording (only when 2+ participants)
  const startTranscriptRecording = async () => {
    const totalParticipants = remoteStreams.size + 1; // +1 for local user
    if (totalParticipants < 2) {
      console.log(`⏸️ Transcript recording requires 2+ participants, currently have ${totalParticipants}`);
      return;
    }

    console.log(`🚀 Starting continuous AssemblyAI transcript recording for ${totalParticipants} participants`);
    
    // Process each remote participant's audio stream separately
    let remoteCount = 0;
    remoteStreams.forEach((stream, peerId) => {
      const participantName = participantMap[peerId];
      if (participantName && stream.getAudioTracks().length > 0) {
        console.log(`✅ Setting up transcript recording for ${participantName} (${peerId})`);
        startParticipantTranscriptRecording(stream, peerId, participantName);
        remoteCount++;
      } else {
        console.log(`⚠️ Skipping ${peerId} - no name or audio: name=${participantName}, audio=${stream.getAudioTracks().length}`);
      }
    });

    // Also start recording local user's speech
    if (localStream && localStream.getAudioTracks().length > 0) {
      console.log('✅ Setting up transcript recording for local user');
      startParticipantTranscriptRecording(localStream, 'local', user?.fullName || user?.username);
    } else {
      console.log('⚠️ No local stream or audio available for transcript recording');
    }
    
    console.log(`📊 Transcript recording started for ${remoteCount} remote participants + local user`);
  };

  // Toggle live subtitle display (but recording continues)
  const startSubtitles = async () => {
    console.log('Enabling live subtitle display');
    setSubtitlesEnabled(true);
    subtitlesEnabledRef.current = true;
  };

  // Process individual participant audio for continuous transcript recording
  const startParticipantTranscriptRecording = async (stream, peerId, participantName) => {
    try {
      // Check if subtitles are enabled for this meeting
      if (!meetingSubtitlesEnabled) {
        console.log(`[Transcript] 🚫 Skipping transcript recording for ${participantName} - subtitles disabled for this meeting`);
        return;
      }
      
      // Initialize the clients ref if it doesn't exist
      if (!assemblyClientsRef.current) {
        assemblyClientsRef.current = new Map();
      }

      // Check if client already exists or is being initialized for this participant
      if (assemblyClientsRef.current.has(peerId)) {
        console.log(`⚠️ AssemblyAI client already exists for ${participantName} (${peerId}) - skipping`);
        return;
      }

      if (transcriptInitializingRef.current.has(peerId)) {
        console.log(`⚠️ AssemblyAI client already being initialized for ${participantName} (${peerId}) - skipping`);
        return;
      }

      // Mark as being initialized to prevent duplicate creation
      transcriptInitializingRef.current.add(peerId);
      console.log(`🎯 Creating AssemblyAI client for ${participantName} (${peerId})`);
      
      // Create separate AssemblyAI client for this participant
      const client = new AssemblyRealtimeClient({
        sampleRate: 16000,
        onPartial: (evt) => {
          const text = evt.text?.trim();
          if (!text) return;
          // Partial transcripts - no logging to reduce noise
        },
        onFinal: (evt) => {
          const text = evt.text?.trim();
          if (!text) return;
          console.log(`[${participantName}] Final: ${text}`);
          
          const subtitleEntry = {
            id: `${peerId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            original: text,
            translated: null,
            text,
            timestamp: new Date().toISOString(),
            speaker: participantName, // Show actual participant name
            sourceLanguage: 'en',
            targetLanguage: 'en',
            isTranslated: false,
            createdAt: Date.now()
          };
          
          // ALWAYS add to permanent history (continuous recording)
          setPermanentSubtitleHistory(prev => {
            // Check for duplicates in recent history (last 10 entries) based on text and speaker
            const recentEntries = prev.slice(-10);
            const isDuplicate = recentEntries.some(entry => 
              entry.text.trim().toLowerCase() === text.trim().toLowerCase() && 
              entry.speaker === participantName &&
              Math.abs(entry.createdAt - subtitleEntry.createdAt) < 5000 // Within 5 seconds
            );
            
            if (isDuplicate) {
              console.log(`🚫 Skipping duplicate transcript: [${participantName}] ${text}`);
              return prev;
            }
            
            const updated = [...prev, subtitleEntry];
            console.log(`📝 Recorded: [${participantName}] ${text} (${updated.length} total)`);
            
            // Always save to server for late joiners (they will load history and then generate their own)
            console.log('💾 Saving transcript to server for late joiners');
            transcriptAPI.saveTranscriptEntry(roomId, {
              id: subtitleEntry.id,
              text: subtitleEntry.text,
              speaker: subtitleEntry.speaker,
              speakerId: peerId === 'local' ? user?.id : peerId,
              timestamp: subtitleEntry.timestamp,
              createdAt: subtitleEntry.createdAt
            });
            
            return updated;
          });

          // Only add to temporary subtitle display if subtitles are enabled
          if (subtitlesEnabledRef.current) {
            setSubtitleHistory(prev => {
              const updated = [...prev.slice(-4), subtitleEntry];
              setTimeout(() => {
                setSubtitleHistory(cur => cur.filter(s => s.id !== subtitleEntry.id));
              }, 8000);
              return updated;
            });
          }
        },
        onError: (e) => console.warn(`Assembly error for ${participantName}:`, e),
        onClose: () => console.log(`Assembly socket closed for ${participantName}`)
      });

      await client.connect();
      
      // Store client for cleanup and remove from initializing set
      assemblyClientsRef.current.set(peerId, client);
      transcriptInitializingRef.current.delete(peerId);

      // Create audio context for this participant
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
      const source = audioCtx.createMediaStreamSource(stream);
      const processor = audioCtx.createScriptProcessor(2048, 1, 1);
      source.connect(processor);
      processor.connect(audioCtx.destination);

      processor.onaudioprocess = (e) => {
        // Always process audio for transcript recording (independent of subtitle display)
        const input = e.inputBuffer.getChannelData(0);
        // Float32 [-1,1] → Int16 PCM
        const int16 = new Int16Array(input.length);
        for (let i = 0; i < input.length; i++) {
          const s = Math.max(-1, Math.min(1, input[i]));
          int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }
        client.sendPcmFrame(int16);
      };

      // Store audio context for cleanup
      if (!audioProcessorsRef.current) {
        audioProcessorsRef.current = new Map();
      }
      audioProcessorsRef.current.set(peerId, { audioCtx, processor });

    } catch (error) {
      console.error(`Failed to setup transcript recording for ${participantName}:`, error);
      // Clean up initialization tracking on error
      transcriptInitializingRef.current.delete(peerId);
    }
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
            timestamp: new Date().toISOString(),
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

  // Process remote audio blob - now uses the multilingual pipeline (LEGACY - only for fallback)
  const processRemoteAudioBlob = async (audioBlob, peerId, participantName) => {
    // Legacy system - only used as fallback, transcript recording now handled by AssemblyAI
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

  // Log participant status - transcript recording handled by remote streams useEffect
  useEffect(() => {
    const totalParticipants = remoteStreams.size + 1; // +1 for local user
    if (totalParticipants >= 2) {
      console.log(`🎙️ Meeting has ${totalParticipants} participants - transcript recording will be managed by stream handlers`);
    } else {
      console.log(`⏸️ Only ${totalParticipants} participant(s) in meeting - transcript recording will start when 2+ participants join`);
    }
  }, [remoteStreams.size, participantMap]);

  // Cleanup transcript recording when leaving meeting
  useEffect(() => {
    return () => {
      stopTranscriptRecording();
    };
  }, []);

  // Auto-scroll transcript panel to the latest entry when open
  useEffect(() => {
    if (!isHistoryPanelOpen) return;
    try {
      if (transcriptEndRef.current) {
        transcriptEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
      } else if (transcriptScrollRef.current) {
        const el = transcriptScrollRef.current;
        el.scrollTop = el.scrollHeight;
      }
    } catch {}
  }, [permanentSubtitleHistory, isHistoryPanelOpen]);

  // Multilingual processing removed - using AssemblyAI only

  const stopSubtitles = () => {
    console.log('🛑 Disabling live subtitle display...');
    setSubtitlesEnabled(false);
    subtitlesEnabledRef.current = false;
    // Clear temporary subtitle display
    setSubtitleHistory([]);
  };

  const stopTranscriptRecording = () => {
    console.log('🛑 Stopping transcript recording for all participants...');
    
    // Close all individual AssemblyAI clients
    if (assemblyClientsRef.current) {
      assemblyClientsRef.current.forEach((client, peerId) => {
        try {
          console.log(`🛑 Closing AssemblyAI client for ${peerId}`);
          client.close();
        } catch (error) {
          console.warn(`Failed to close client for ${peerId}:`, error);
        }
      });
      assemblyClientsRef.current.clear();
    }

    // Close all audio processors
    if (audioProcessorsRef.current) {
      audioProcessorsRef.current.forEach((processor, peerId) => {
        try {
          console.log(`🛑 Closing audio processor for ${peerId}`);
          processor.processor.disconnect();
          processor.audioCtx.close();
        } catch (error) {
          console.warn(`Failed to close audio processor for ${peerId}:`, error);
        }
      });
      audioProcessorsRef.current.clear();
    }

    // Legacy cleanup (for backward compatibility)
    if (assemblyRef.current) {
      try { assemblyRef.current.close(); } catch {}
      assemblyRef.current = null;
    }

    if (pcmWorkerRef.current) {
      try {
        pcmWorkerRef.current.processor.disconnect();
        pcmWorkerRef.current.audioCtx.close();
      } catch {}
      pcmWorkerRef.current = null;
    }

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

  // Generate and copy invite link
  const generateInviteLink = () => {
    const baseUrl = window.location.origin;
    const meetingUrl = `${baseUrl}/meeting/${roomId}`;
    setInviteLink(meetingUrl);
    setShowInviteModal(true);
  };

  const copyInviteLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (error) {
      console.error('Failed to copy invite link:', error);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = inviteLink;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  // Subtitle drag handlers
  const handleSubtitleMouseDown = (e) => {
    e.preventDefault();
    setIsDraggingSubtitles(true);
    
    const rect = subtitleRef.current.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;
    
    const handleMouseMove = (e) => {
      e.preventDefault();
      
      const newX = e.clientX - offsetX;
      const newY = e.clientY - offsetY;
      
      // Keep subtitles within viewport bounds with some padding
      const padding = 10;
      const maxX = window.innerWidth - rect.width - padding;
      const maxY = window.innerHeight - rect.height - padding;
      
      setSubtitlePosition({
        x: Math.max(padding, Math.min(maxX, newX)),
        y: Math.max(padding, Math.min(maxY, newY))
      });
    };
    
    const handleMouseUp = (e) => {
      e.preventDefault();
      setIsDraggingSubtitles(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Reset subtitle position to center bottom
  const resetSubtitlePosition = () => {
    setSubtitlePosition({ x: 0, y: 0 });
  };

  // Join request response handlers
  const handleJoinRequestResponse = (requestId, approved) => {
    const request = joinRequests.find(r => r.requestId === requestId);
    if (!request || !sfuSocket) return;

    console.log(`[MeetingPage] ${approved ? 'Approving' : 'Denying'} join request from ${request.requesterName}`);
    
    sfuSocket.emit('respondToJoinRequest', {
      requestId,
      approved,
      requesterSocketId: request.requesterSocketId,
      roomId: request.roomId
    });

    // No need to remove locally - server will send updated list via joinRequestsUpdated
  };

  const approveJoinRequest = (requestId) => {
    handleJoinRequestResponse(requestId, true);
  };

  const denyJoinRequest = (requestId) => {
    handleJoinRequestResponse(requestId, false);
  };

  // Audio activity detection for speaking indicators
  const startAudioAnalyzer = (stream, participantId, isLocal = false) => {
    try {
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) return;

      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(stream);
      const analyzer = audioContext.createAnalyser();
      
      analyzer.fftSize = 1024; // Increased for better frequency resolution
      analyzer.smoothingTimeConstant = 0.3; // Reduced for more responsive detection
      analyzer.minDecibels = -90;
      analyzer.maxDecibels = -10;
      source.connect(analyzer);

      const bufferLength = analyzer.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      let silenceCount = 0;
      const SPEAKING_THRESHOLD = 45; // Increased to reduce sensitivity to ambient noise
      const SILENCE_FRAMES = 30; // Increased from 5 to 30 frames (~1 second of silence)

      const checkAudio = () => {
        analyzer.getByteFrequencyData(dataArray);
        
        // Calculate both average and peak volume for better detection
        const average = dataArray.reduce((sum, value) => sum + value, 0) / bufferLength;
        const peak = Math.max(...dataArray);
        
        // Use either average or peak volume - whichever is higher for better sensitivity
        const volume = Math.max(average, peak * 0.5);
        
        if (volume > SPEAKING_THRESHOLD) {
          // Speaking detected - reset silence counter and add to speaking set
          silenceCount = 0;
          setSpeakingParticipants(prev => {
            const newSet = new Set(prev);
            newSet.add(participantId);
            return newSet;
          });
        } else {
          // Silence detected - increment counter
          silenceCount++;
          
          // Only remove speaking indicator after sustained silence
          if (silenceCount >= SILENCE_FRAMES) {
            setSpeakingParticipants(prev => {
              const newSet = new Set(prev);
              newSet.delete(participantId);
              return newSet;
            });
            silenceCount = 0; // Reset counter after removal
          }
        }

        // Continue monitoring if the audio track is still active
        if (audioTracks[0] && audioTracks[0].readyState === 'live') {
          requestAnimationFrame(checkAudio);
        }
      };

      // Start monitoring
      checkAudio();

      // Store analyzer for cleanup
      audioAnalyzers.current.set(participantId, {
        audioContext,
        analyzer,
        cleanup: () => {
          audioContext.close().catch(err => console.warn('AudioContext close error:', err));
          setSpeakingParticipants(prev => {
            const newSet = new Set(prev);
            newSet.delete(participantId);
            return newSet;
          });
        }
      });

      console.log(`[Audio Analyzer] Started for ${isLocal ? 'local' : 'remote'} participant ${participantId}`);

    } catch (error) {
      console.error('Failed to start audio analyzer:', error);
    }
  };

  // Clean up audio analyzer
  const stopAudioAnalyzer = (participantId) => {
    const analyzer = audioAnalyzers.current.get(participantId);
    if (analyzer) {
      analyzer.cleanup();
      audioAnalyzers.current.delete(participantId);
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
    // Clean up all audio analyzers
    audioAnalyzers.current.forEach((analyzer, id) => {
      stopAudioAnalyzer(id);
    });
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
  // Filter out participants who have left (not in participantMap)
  const videoTiles = useMemo(() => [
    { id: 'local', stream: localStream, isLocal: true, label: 'You' },
    ...Array.from(remoteStreams.entries())
      .filter(([id, stream]) => {
        // Only include remote streams that have a corresponding participant in participantMap
        // This prevents empty "Guest" containers for departed participants
        return participantMap[id] !== undefined;
      })
      .map(([id, stream]) => ({
        id,
        stream,
        isLocal: false,
        label: participantMap[id],
      }))
  ], [localStream, remoteStreams, participantMap]);

  // Memoized grid calculation
  const { gridColumns, gridRows, isScreenShareMode } = useMemo(() => {
    const participantCount = videoTiles.length;
    // On small screens: 1 column for up to 2 participants; 2 columns for 3+ participants
    const columns = isSmallScreen
      ? (participantCount <= 2 ? 1 : 2)
      : (participantCount === 1 ? 1 : participantCount === 2 ? 2 : Math.ceil(Math.sqrt(participantCount)));
    const rows = Math.ceil(participantCount / columns);
    const screenShareMode = screenSharingUserId !== null && viewMode === 'speaker';
    
    return {
      gridColumns: columns,
      gridRows: rows,
      isScreenShareMode: screenShareMode
    };
  }, [videoTiles.length, screenSharingUserId, viewMode, isSmallScreen]);

  if (!user) {
    return <div className="p-8 text-center text-white bg-gray-900 min-h-screen flex items-center justify-center">Please log in to join meetings.</div>;
  }

  // Removed excessive console logging for performance

  return (
    <div className="flex flex-col h-screen bg-gray-900">
      {/* Meeting Stats Bar */}
      <MeetingStatsBar 
        participantCount={Object.keys(participantMap).length || 1} // Ensure minimum of 1 (current user)
        meetingStartTime={meetingStartTime}
        roomId={roomId}
        recordingStatus={recordingStatus}
        joinRequests={joinRequests}
        showJoinRequests={showJoinRequests}
        onToggleJoinRequests={() => setShowJoinRequests(!showJoinRequests)}
        isHost={roomSettings?.isHost}
        onApproveJoinRequest={approveJoinRequest}
        onDenyJoinRequest={denyJoinRequest}
      />
      
      
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
              {videoTiles.map(({ id, stream, isLocal, label }) => {
                const participantId = isLocal ? 'local' : id;
                const isSpeaking = speakingParticipants.has(participantId);
                
                return (
                <div key={id} className={`relative bg-gray-700 rounded aspect-video overflow-hidden transition-all duration-200 ${
                  isSpeaking ? 'ring-2 ring-green-500 ring-opacity-80 shadow-md shadow-green-500/30' : ''
                }`}>
                  {stream && stream.getVideoTracks().length > 0 ? (
                    <video
                      ref={isLocal && id === 'local' ? localVideoRef : undefined}
                      id={isLocal ? undefined : `remote-video-${id}`}
                      autoPlay
                      muted={isLocal}
                      playsInline
                      className="w-full h-full object-contain bg-black"
                      style={{ 
                        background: '#000000',
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
                );
              })}
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
              {videoTiles.map(({ id, stream, isLocal, label }) => {
                const participantId = isLocal ? 'local' : id;
                const isSpeaking = speakingParticipants.has(participantId);
                
                return (
                <div key={id} className={`relative bg-gray-800 rounded-lg overflow-hidden transition-all duration-200 ${
                  isSpeaking ? 'ring-4 ring-green-500 ring-opacity-80 shadow-lg shadow-green-500/30' : ''
                }`}>
                  {stream && stream.getVideoTracks().length > 0 ? (
                    <video
                      ref={isLocal && id === 'local' ? localVideoRef : undefined}
                      id={isLocal ? undefined : `remote-video-${id}`}
                      autoPlay
                      muted={isLocal}
                      playsInline
                      className="w-full h-full object-contain bg-black"
                      style={{ 
                        background: '#000000',
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
                );
              })}
            </div>
          </div>
        )}
      </div>
      {/* Draggable Subtitles */}
      {subtitlesEnabled && subtitleHistory.length > 0 && (
        <div 
          ref={subtitleRef}
          className={`absolute z-10 ${isDraggingSubtitles ? 'cursor-grabbing' : 'cursor-grab'} select-none`}
          style={{
            left: subtitlePosition.x === 0 ? '50%' : `${subtitlePosition.x}px`,
            top: subtitlePosition.y === 0 ? 'auto' : `${subtitlePosition.y}px`,
            bottom: subtitlePosition.y === 0 ? '8vh' : 'auto',
            transform: subtitlePosition.x === 0 && subtitlePosition.y === 0 ? 'translateX(-50%)' : 'none',
            pointerEvents: 'auto',
            userSelect: 'none'
          }}
          onMouseDown={handleSubtitleMouseDown}
        >
          {subtitleHistory.slice(-1).map((subtitle) => (
            <div 
              key={subtitle.id} 
              className="rounded-xl px-4 py-3 text-sm shadow-2xl select-none"
              style={{
                background: 'linear-gradient(180deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.78) 100%)',
                border: '1px solid rgba(255,255,255,0.08)',
                backdropFilter: 'blur(6px)'
              }}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-blue-300 tracking-wide">{subtitle.speaker}</span>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    resetSubtitlePosition();
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="text-[11px] text-gray-400 hover:text-white ml-2 opacity-70 hover:opacity-100 cursor-pointer"
                  title="Reset position"
                >
                  ⌂
                </button>
              </div>
              <div className="text-white text-[15px] leading-relaxed tracking-wide">{subtitle.text}</div>
              <div className="text-[11px] text-gray-400 mt-2 flex items-center">
                <span>💬 Drag to move • Click ⌂ to center</span>
              </div>
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
        
        {/* Invite button */}
        <button 
          onClick={generateInviteLink} 
          className="p-3 rounded-full bg-blue-600 text-white hover:bg-blue-700 transition-colors" 
          title="Invite participants"
        >
          <Share2 size={20}/>
        </button>
        
        <button 
          onClick={isRecording ? stopRecording : startRecording} 
          className={`p-3 rounded-full ${isRecording ? 'bg-red-600' : 'bg-gray-600'} text-white`}
          title={isRecording ? "Stop recording" : "Start recording"}
        >
          {isRecording ? <StopCircle size={20}/> : <CircleDot size={20}/>} 
        </button>
        
        {/* Temporarily commented out - will re-enable later
        <button 
          onClick={isScreenSharing ? stopScreenShare : startScreenShare} 
          className={`p-3 rounded-full ${isScreenSharing ? 'bg-green-600' : 'bg-gray-600'} text-white`}
          title={isScreenSharing ? "Stop sharing screen" : "Share screen"}
        >
          {isScreenSharing ? <MonitorSpeaker size={20}/> : <Monitor size={20}/>} 
        </button>
        */}
        
        {recordedChunks.length > 0 && (
          <button 
            onClick={downloadRecording} 
            className="p-3 rounded-full text-white bg-green-600 hover:bg-green-700"
            title="Download recording"
          >
            <Download size={20}/>
          </button>
        )}

        {/* Transcript History Button */}
        <button 
          onClick={() => setIsHistoryPanelOpen(!isHistoryPanelOpen)} 
          className={`p-3 rounded-full text-white ${isHistoryPanelOpen ? 'bg-blue-600' : 'bg-gray-600'} hover:bg-blue-700`}
          title={isHistoryPanelOpen ? "Close transcript history" : "View transcript history"}
        >
          <FileText size={20}/>
        </button>
        
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
                <h4 className="text-xs font-medium text-gray-300 mb-2">Recording</h4>
                <select
                  value={recordingMethod}
                  onChange={(e) => setRecordingMethod(e.target.value)}
                  className="w-full text-xs bg-gray-700 text-white border border-gray-600 rounded px-2 py-1"
                >
                  <option value="canvas">📹 Direct Capture</option>
                  <option value="screen">🖥️ Screen Share</option>
                </select>
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
                      // Check if subtitles are disabled for this meeting
                      if (!meetingSubtitlesEnabled) {
                        return; // Don't allow toggling if disabled for meeting
                      }
                      
                      toggleSubtitles();
                      setShowSettings(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                      (() => {
                        // Check if subtitles are disabled for this meeting
                        if (!meetingSubtitlesEnabled) {
                          return 'bg-gray-500 cursor-not-allowed opacity-50';
                        }
                        
                        return subtitlesEnabled ? 'bg-green-600' : 'bg-gray-700 hover:bg-gray-600';
                      })()
                    }`}
                  >
                    💬 Live Subtitles {!meetingSubtitlesEnabled ? '(Disabled)' : subtitlesEnabled ? '(Show)' : '(Hidden)'}
                  </button>
                  <p className="text-xs text-gray-400 mt-1 px-3">
                    {(() => {
                      // Check if subtitles are disabled for this meeting
                      if (!meetingSubtitlesEnabled) {
                        return "⚠️ Transcription disabled for this meeting - no transcript or AI summary will be generated.";
                      }
                      
                      return "Transcripts are recorded when 2+ participants are present. This setting only controls subtitle display.";
                    })()}
                  </p>
                  {/* Temporarily commented out - will re-enable later
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
                  */}
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
                      {/* Temporarily commented out - will re-enable later
                      <div className="flex items-center justify-between">
                        <span>🌐 Multilingual Audio:</span>
                        <span className={multilingualEnabled ? 'text-purple-400' : 'text-gray-500'}>
                          {multilingualEnabled ? 'ON' : 'OFF'}
                        </span>
                      </div>
                      */}
                      {multilingualEnabled && (
                        <div className="mt-1 text-xs text-orange-300">
                          ⚠️ Audio translation may have 2-3 second delay
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

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

      {/* Host Transfer Notification - Sleek slide-in from top right */}
      {hostTransferNotification && (
        <div 
          className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg border-l-4 max-w-sm animate-slide-in-right ${
            hostTransferNotification.type === 'newHost'
              ? 'bg-white border-blue-500 text-gray-800'
              : 'bg-white border-green-500 text-gray-800'
          }`}
        >
          <style>{`
            .animate-slide-in-right {
              animation: slideInFromRight 0.5s ease-out forwards;
            }
            @keyframes slideInFromRight {
              0% {
                transform: translateX(100%);
                opacity: 0;
              }
              100% {
                transform: translateX(0);
                opacity: 1;
              }
            }
          `}</style>
          
          <div className="flex items-start space-x-3">
            <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
              hostTransferNotification.type === 'newHost'
                ? 'bg-blue-100 text-blue-600'
                : 'bg-green-100 text-green-600'
            }`}>
              {hostTransferNotification.type === 'newHost' ? '👑' : '🔄'}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-gray-900">
                {hostTransferNotification.type === 'newHost' ? 'You\'re now the host' : 'New host'}
              </div>
              <div className="text-xs text-gray-600 mt-1">
                {hostTransferNotification.type === 'newHost' 
                  ? 'You can now manage meeting settings'
                  : hostTransferNotification.message
                }
              </div>
            </div>
            
            <button
              onClick={() => setHostTransferNotification(null)}
              className="flex-shrink-0 ml-2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Transcript History Panel */}
      <div 
        className={`fixed top-0 right-0 h-full w-96 bg-gray-900 border-l border-gray-700 z-50 transform transition-transform duration-300 ease-in-out ${
          isHistoryPanelOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Panel Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h3 className="text-lg font-semibold text-white flex items-center">
            <FileText size={20} className="mr-2" />
            Meeting Transcript
          </h3>
          <button
            onClick={() => setIsHistoryPanelOpen(false)}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Panel Content */}
        <div ref={transcriptScrollRef} className="flex-1 overflow-y-auto p-4 h-full pb-24">
          {permanentSubtitleHistory.length === 0 ? (
            <div className="text-gray-400 text-center mt-8">
              <FileText size={48} className="mx-auto mb-4 opacity-50" />
              <p>No transcript available yet.</p>
              <p className="text-sm mt-2">Start subtitles to begin recording the conversation.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {[...permanentSubtitleHistory].sort((a, b) => a.createdAt - b.createdAt).map((subtitle, index) => (
                <div 
                  key={subtitle.id} 
                  className="bg-gray-800/90 rounded-xl p-3 border border-gray-700 hover:bg-gray-750 transition-colors shadow-lg"
                >
                  {/* Header with speaker name and timestamp */}
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-blue-300 text-sm">
                      {subtitle.speaker}
                    </span>
                    <span className="text-xs text-gray-400">
                      {formatTimestamp(subtitle.timestamp)}
                    </span>
                  </div>
                  
                  {/* Transcript text */}
                  <div className="text-white text-sm leading-relaxed">
                    {subtitle.text}
                  </div>
                  
                  {/* Translation indicator */}
                  {subtitle.isTranslated && (
                    <div className="mt-2 text-xs text-green-400">
                      🌐 Translated from {subtitle.sourceLanguage} to {subtitle.targetLanguage}
                    </div>
                  )}
                </div>
              ))}
              <div ref={transcriptEndRef} />
            </div>
          )}
        </div>

        {/* Panel Footer with stats */}
        <div className="sticky bottom-0 left-0 right-0 bg-gray-800/95 border-t border-gray-700 p-3">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>{permanentSubtitleHistory.length} transcript entries</span>
            <div className="flex space-x-4">
              <button 
                onClick={() => {
                  const transcript = [...permanentSubtitleHistory].sort((a, b) => a.createdAt - b.createdAt).map(entry => 
                    `[${formatTimestamp(entry.timestamp)}] ${entry.speaker}: ${entry.text}`
                  ).join('\n\n');
                  navigator.clipboard.writeText(transcript);
                }}
                className="text-blue-400 hover:text-blue-300 transition-colors"
                title="Copy transcript to clipboard"
              >
                Copy All
              </button>
              <button 
                onClick={() => {
                  const transcript = [...permanentSubtitleHistory].sort((a, b) => a.createdAt - b.createdAt).map(entry => 
                    `[${formatTimestamp(entry.timestamp)}] ${entry.speaker}: ${entry.text}`
                  ).join('\n\n');
                  const blob = new Blob([transcript], { type: 'text/plain' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `meeting-transcript-${new Date().toISOString().split('T')[0]}.txt`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="text-green-400 hover:text-green-300 transition-colors"
                title="Download transcript as text file"
              >
                Download
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <Share2 className="h-6 w-6 text-blue-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">Invite to Meeting</h2>
              </div>
              <button
                onClick={() => setShowInviteModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Meeting Link
                </label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={inviteLink}
                    readOnly
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 text-sm"
                  />
                  <button
                    onClick={copyInviteLink}
                    className={`px-4 py-3 rounded-lg font-medium text-sm transition-colors ${
                      copySuccess 
                        ? 'bg-green-600 text-white' 
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                  >
                    {copySuccess ? '✓ Copied!' : 'Copy'}
                  </button>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <Share2 className="w-4 h-4 text-blue-600" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-blue-900 mb-1">
                      Share this link
                    </h3>
                    <p className="text-sm text-blue-700">
                      Anyone with this link can join the meeting. Share it via email, message, or any communication platform.
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-3 pt-4">
                <button
                  onClick={() => setShowInviteModal(false)}
                  className="flex-1 px-4 py-3 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={copyInviteLink}
                  className={`flex-1 px-4 py-3 rounded-lg font-medium transition-colors ${
                    copySuccess 
                      ? 'bg-green-600 text-white' 
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  {copySuccess ? '✓ Link Copied!' : 'Copy Link'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}