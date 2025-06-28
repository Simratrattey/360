import React, { useState, useEffect, useRef, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AuthContext } from '../context/AuthContext';
import { useWebRTC } from '../hooks/useWebRTC';
import {
  Mic, MicOff, Video, VideoOff, Users, MessageCircle, Settings, PhoneOff, Share, CircleDot, StopCircle
} from 'lucide-react';

export default function MeetingPage() {
  const { roomId } = useParams();
  const hasJoinedRef = useRef(false);
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const {
    localStream,
    remoteStreams,
    isConnecting,
    error,
    participants,
    isConnected,
    localVideoRef,
    joinMeeting,
    leaveMeeting,
    addRemoteVideoRef,
    removeRemoteVideoRef,
  } = useWebRTC();

  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [recordedChunks, setRecordedChunks] = useState([]);
  const chatRef = useRef(null);

  useEffect(() => {
    if (roomId && user) {
      console.log('Calling joinMeeting for room:', roomId);
      joinMeeting(roomId);
    }
    return () => leaveMeeting();
  }, [roomId, user]);

  useEffect(() => {
    if (!localStream) {
      console.warn('No localStream: camera/mic may not be available or permission denied.');
    }
  }, [localStream]);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages]);

  // Ensure local video always gets the stream
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // Ensure remote video elements always get their streams
  useEffect(() => {
    remoteStreams.forEach((stream, peerId) => {
      const ref = document.getElementById(`remote-video-${peerId}`);
      if (ref && stream) {
        ref.srcObject = stream;
      }
    });
  }, [remoteStreams]);

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
    if (localStream) {
      const stream = new MediaStream();
      localStream.getTracks().forEach(track => stream.addTrack(track));
      remoteStreams.forEach(remoteStream => {
        remoteStream.getTracks().forEach(track => stream.addTrack(track));
      });
      const recorder = new window.MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8,opus' });
      const chunks = [];
      recorder.ondataavailable = (event) => { if (event.data.size > 0) chunks.push(event.data); };
      recorder.onstop = () => { setRecordedChunks(chunks); };
      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
      setMediaRecorder(null);
      setIsRecording(false);
    }
  };

  const sendMessage = () => {
    if (newMessage.trim()) {
      setMessages(prev => [...prev, {
        id: Date.now(),
        text: newMessage,
        sender: user?.username || 'Unknown',
        timestamp: new Date().toLocaleTimeString(),
      }]);
      setNewMessage('');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleLeaveMeeting = () => {
    leaveMeeting();
    navigate('/meetings');
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Please log in to join the meeting</h2>
          <button onClick={() => navigate('/login')} className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors">Go to Login</button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-900">
      {/* Top Bar */}
      <div className="flex items-center justify-between bg-gray-800 px-6 py-3">
        <div className="flex items-center space-x-4">
          <span className="text-white font-semibold">Room: {roomId}</span>
          <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></span>
        </div>
        <div className="flex items-center space-x-4">
          <span className="text-gray-300 text-sm">{participants.length} participants</span>
          <button onClick={() => setShowParticipants(!showParticipants)} className="p-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"><Users size={20} /></button>
          <button onClick={() => setShowChat(!showChat)} className="p-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"><MessageCircle size={20} /></button>
        </div>
      </div>
      {/* Video Grid */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
        {/* Local Video */}
        <div className="relative bg-gray-800 rounded-lg overflow-hidden">
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover"
          />
          {!localStream && error && (
            <div className="absolute inset-0 bg-gray-800 flex items-center justify-center">
              <div className="text-center">
                <VideoOff size={48} className="text-red-400 mx-auto mb-2" />
                <p className="text-red-400">{error}</p>
              </div>
            </div>
          )}
          {!localStream && !error && (
            <div className="absolute inset-0 bg-gray-800 flex items-center justify-center">
              <div className="text-center">
                <VideoOff size={48} className="text-gray-400 mx-auto mb-2" />
                <p className="text-gray-400">No Camera</p>
              </div>
            </div>
          )}
          {!isVideoEnabled && localStream && (
            <div className="absolute inset-0 bg-gray-800 flex items-center justify-center">
              <div className="text-center">
                <VideoOff size={48} className="text-gray-400 mx-auto mb-2" />
                <p className="text-gray-400">Camera Off</p>
              </div>
            </div>
          )}
          <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 px-2 py-1 rounded text-white text-sm">You ({user?.username})</div>
        </div>
        {/* Remote Videos */}
        {Array.from(remoteStreams.entries()).map(([peerId, stream]) => (
          <div key={peerId} className="relative bg-gray-800 rounded-lg overflow-hidden">
            <video
              id={`remote-video-${peerId}`}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
            <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 px-2 py-1 rounded text-white text-sm">{peerId}</div>
          </div>
        ))}
        {/* Avatar Placeholder */}
        <div className="relative bg-gray-800 rounded-lg flex items-center justify-center">
          <div className="text-center">
            <span className="text-4xl">🤖</span>
            <p className="text-gray-400">Your Avatar</p>
          </div>
        </div>
      </div>
      {/* Bottom Toolbar */}
      <div className="flex items-center justify-center space-x-4 bg-gray-800 py-4">
        <button onClick={toggleAudio} className={`p-3 rounded-full transition-colors ${isAudioEnabled ? 'bg-gray-600 hover:bg-gray-500 text-white' : 'bg-red-600 hover:bg-red-500 text-white'}`}>{isAudioEnabled ? <Mic size={20} /> : <MicOff size={20} />}</button>
        <button onClick={toggleVideo} className={`p-3 rounded-full transition-colors ${isVideoEnabled ? 'bg-gray-600 hover:bg-gray-500 text-white' : 'bg-red-600 hover:bg-red-500 text-white'}`}>{isVideoEnabled ? <Video size={20} /> : <VideoOff size={20} />}</button>
        <button onClick={isRecording ? stopRecording : startRecording} className={`p-3 rounded-full transition-colors ${isRecording ? 'bg-red-600 hover:bg-red-500 text-white' : 'bg-gray-600 hover:bg-gray-500 text-white'}`}>{isRecording ? <StopCircle size={20} /> : <CircleDot size={20} />}</button>
        <button onClick={handleLeaveMeeting} className="p-3 bg-red-600 hover:bg-red-500 text-white rounded-full transition-colors"><PhoneOff size={20} /></button>
        <button onClick={() => setShowParticipants(!showParticipants)} className="p-3 rounded-full bg-gray-600 hover:bg-gray-500 text-white"><Users size={20} /></button>
        <button onClick={() => setShowChat(!showChat)} className="p-3 rounded-full bg-gray-600 hover:bg-gray-500 text-white"><MessageCircle size={20} /></button>
        <button className="p-3 rounded-full bg-gray-600 hover:bg-gray-500 text-white"><Settings size={20} /></button>
        <button className="p-3 rounded-full bg-gray-600 hover:bg-gray-500 text-white"><Share size={20} /></button>
      </div>
      {/* Side Panels */}
      {showParticipants && (
        <div className="fixed right-0 top-0 h-full w-80 bg-gray-800 border-l border-gray-700 z-50 p-4 overflow-y-auto">
          <h3 className="text-white font-semibold mb-4">Participants ({participants.length})</h3>
          <div className="space-y-2">
            {participants.map((participant, index) => (
              <div key={index} className="flex items-center space-x-3 p-2 bg-gray-700 rounded-lg">
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-medium">{participant.charAt(0).toUpperCase()}</span>
                </div>
                <span className="text-white">{participant}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {showChat && (
        <div className="fixed right-0 top-0 h-full w-96 bg-gray-800 border-l border-gray-700 z-50 flex flex-col">
          <div className="p-4 border-b border-gray-700"><h3 className="text-white font-semibold">Chat</h3></div>
          <div className="flex-1 p-4 overflow-hidden"><div ref={chatRef} className="h-full overflow-y-auto space-y-3">{messages.map((message) => (<div key={message.id} className="flex flex-col"><div className="flex items-center space-x-2"><span className="text-blue-400 text-sm font-medium">{message.sender}</span><span className="text-gray-400 text-xs">{message.timestamp}</span></div><p className="text-white text-sm mt-1">{message.text}</p></div>))}</div></div>
          <div className="p-4 border-t border-gray-700"><div className="flex space-x-2"><input type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} onKeyPress={handleKeyPress} placeholder="Type a message..." className="flex-1 bg-gray-700 text-white px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" /><button onClick={sendMessage} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">Send</button></div></div>
        </div>
      )}
      {/* Error Modal */}
      {error && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md mx-4">
            <h3 className="text-lg font-semibold text-red-600 mb-2">Error</h3>
            <p className="text-gray-700 mb-4">{error}</p>
            <button onClick={() => window.location.reload()} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">Retry</button>
          </div>
        </motion.div>
      )}
    </div>
  );
}