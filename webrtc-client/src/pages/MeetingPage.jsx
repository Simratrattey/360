// src/pages/MeetingPage.jsx
import React, { useState, useEffect, useRef, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Device } from 'mediasoup-client';
import API from '../api/client.js';
import { AuthContext } from '../context/AuthContext';
import { Mic, MicOff, Video, VideoOff, PhoneOff, CircleDot, StopCircle } from 'lucide-react';

export default function MeetingPage() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  // SFU state
  const [device, setDevice]               = useState(null);
  const [sendTransport, setSendTransport] = useState(null);
  const [recvTransport, setRecvTransport] = useState(null);
  const [localStream, setLocalStream]     = useState(null);
  const [remoteStreams, setRemoteStreams] = useState(new Map());
  const localVideoRef = useRef();

  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isRecording, setIsRecording]       = useState(false);
  const [mediaRecorder, setMediaRecorder]   = useState(null);
  const [recordedChunks, setRecordedChunks] = useState([]);

  // 1) Join SFU room and set up transports, produce/consume
  useEffect(() => {
    if (roomId && user) {
      console.log('Calling joinMeeting for room:', roomId);
      joinMeeting(roomId);
    }
    return () => leaveMeeting();
    if (!roomId || !user) return;

    (async () => {
      // a) Load RTP Capabilities
      const { data: rtpCaps } = await API.get('/sfu/rtpCapabilities');
      const d = new Device();
      await d.load({ routerRtpCapabilities: rtpCaps });
      setDevice(d);

      // b) Create Send Transport
      const { data: sendInfo } = await API.post('/sfu/transports', {
        direction: 'send',
        peerId: user.id
      });
      const sendT = d.createSendTransport(sendInfo);
      sendT.on('connect', ({ dtlsParameters }, cb, eb) => {
        API.post(`/sfu/transports/${sendT.id}/connect`, { dtlsParameters })
           .then(cb).catch(eb);
      });
      sendT.on('produce', async ({ kind, rtpParameters }, cb, eb) => {
        const { data } = await API.post('/sfu/produce', {
          transportId: sendT.id,
          kind,
          rtpParameters,
          peerId: user.id
        });
        cb({ id: data.id });
      });
      setSendTransport(sendT);

      // c) Create Recv Transport
      const { data: recvInfo } = await API.post('/sfu/transports', {
        direction: 'recv',
        peerId: user.id
      });
      const recvT = d.createRecvTransport(recvInfo);
      recvT.on('connect', ({ dtlsParameters }, cb, eb) => {
        API.post(`/sfu/transports/${recvT.id}/connect`, { dtlsParameters })
           .then(cb).catch(eb);
      });
      setRecvTransport(recvT);

      // d) Publish Local Media
      const local = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      setLocalStream(local);
      local.getTracks().forEach(track => sendT.produce({ track }));

      // e) Consume Existing Producers
      const { data: { producers } } = await API.get('/sfu/producers');
      for (const prodId of producers) {
        const { data: cinfo } = await API.post('/sfu/consume', {
          transportId: recvT.id,
          producerId: prodId,
          rtpCapabilities: d.rtpCapabilities
        });
        const consumer = await recvT.consume(cinfo);
        const stream = new MediaStream([consumer.track]);
        setRemoteStreams(m => new Map(m).set(prodId, stream));
      }
    })();
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

  // Attach remote streams to their video elements
  useEffect(() => {
    remoteStreams.forEach((stream, id) => {
      const vid = document.getElementById(`remote-video-${id}`);
      if (vid) vid.srcObject = stream;
    });
  }, [remoteStreams]);

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
    // TODO: close transports/producers/consumers
    navigate('/meetings');
  };

  if (!user) {
    return <div className="p-8 text-center">Please log in to join meetings.</div>;
  }

  return (
    <div className="flex flex-col h-screen bg-gray-900">
      {/* Video Grid */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
        {/* Local */}
        <div className="relative bg-gray-800 rounded-lg overflow-hidden">
          <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
          {!isVideoEnabled && <div className="absolute inset-0 flex items-center justify-center bg-gray-800"><VideoOff size={48} className="text-white" /></div>}
        </div>
        {/* Remotes */}
        {Array.from(remoteStreams.entries()).map(([id]) => (
          <div key={id} className="relative bg-gray-800 rounded-lg overflow-hidden">
            <video id={`remote-video-${id}`} autoPlay playsInline className="w-full h-full object-cover" />
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center space-x-4 bg-gray-800 p-4">
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
      </div>
    </div>
  );
}