// src/pages/MeetingPage.jsx
import React, { useState, useEffect, useRef, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Device } from 'mediasoup-client';
import API from '../api/client.js';
import { useWebRTC } from '../hooks/useWebRTC';
import { AuthContext } from '../context/AuthContext';
import { Mic, MicOff, Video, VideoOff, PhoneOff, CircleDot, StopCircle } from 'lucide-react';
import { SocketContext } from '../context/SocketContext';
import BotService from '../api/botService';
import AvatarSidebar from '../components/AvatarSidebar';

export default function MeetingPage() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const { joinMeeting, leaveMeeting, localStream, remoteStreams, localVideoRef } = useWebRTC();
  const { avatarOutput, avatarNavigate, sendAvatarOutput, sendAvatarNavigate } = useContext(SocketContext);
  const { participantMap } = useContext(SocketContext);

  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isRecording, setIsRecording]       = useState(false);
  const [mediaRecorder, setMediaRecorder]   = useState(null);
  const [recordedChunks, setRecordedChunks] = useState([]);

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

  const startRecording = () => {
    if (!localStream) return;
    const combined = new MediaStream();
    localStream.getTracks().forEach(t => combined.addTrack(t));
    remoteStreams.forEach(s => s.getTracks().forEach(t => combined.addTrack(t)));
    const recorder = new MediaRecorder(combined, { mimeType: 'video/webm;codecs=vp8,opus' });
    const chunks = [];
    recorder.ondataavailable = e => e.data.size && chunks.push(e.data);
    recorder.onstop = () => setRecordedChunks(chunks);
    recorder.start();
    setMediaRecorder(recorder);
    setIsRecording(true);
  };
  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
      setMediaRecorder(null);
      setIsRecording(false);
    }
  };

  const handleLeave = () => {
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
                style={{ background: '#222' }}
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
        <button onClick={toggleAudio} className="p-3 rounded-full bg-gray-600 text-white">
          {isAudioEnabled ? <Mic size={20}/> : <MicOff size={20}/>} 
        </button>
        <button onClick={toggleVideo} className="p-3 rounded-full bg-gray-600 text-white">
          {isVideoEnabled ? <Video size={20}/> : <VideoOff size={20}/>} 
        </button>
        <button onClick={isRecording ? stopRecording : startRecording} className="p-3 rounded-full bg-gray-600 text-white">
          {isRecording ? <StopCircle size={20}/> : <CircleDot size={20}/>} 
        </button>
        <button onClick={handleLeave} className="p-3 rounded-full bg-red-600 text-white">
          <PhoneOff size={20}/>
        </button>
        <button
          onClick={() => {
            console.log('🖱️ Avatar toggle clicked, was=', showAvatar);
            setShowAvatar(v => !v)}
          }
          className="p-3 rounded-full bg-blue-600 text-white"
        >
          Avatar
        </button>
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