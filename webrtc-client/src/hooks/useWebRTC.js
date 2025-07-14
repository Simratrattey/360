import { useState, useEffect, useRef, useCallback } from 'react';
import { useContext } from 'react';
import { SocketContext } from '../context/SocketContext';
import meetingService from '../api/meetingService';

export function useWebRTC() {
  const {
    socket,
    isConnected,
    currentRoom,
    participants,
    availableOffers,
    joinRoom,
    leaveRoom,
    sendOffer,
    sendAnswer,
    sendIceCandidate,
  } = useContext(SocketContext);

  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState(new Map());
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState(null);
  const [iceServers, setIceServers] = useState([]);

  const peerConnections = useRef(new Map());
  const localVideoRef = useRef(null);
  const remoteVideoRefs = useRef(new Map());

  // Initialize ICE servers
  useEffect(() => {
    const fetchIceServers = async () => {
      const result = await meetingService.getIceServers();
      if (result.success) {
        setIceServers(result.data.iceServers);
      } else {
        setError('Failed to get ICE servers');
      }
    };
    fetchIceServers();
  }, []);

  // Get user media
  const getUserMedia = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      setLocalStream(stream);
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      
      return stream;
    } catch (err) {
      setError('Failed to access camera/microphone: ' + err.message);
      throw err;
    }
  }, []);

  // Create peer connection
  const createPeerConnection = useCallback((peerId) => {
    const pc = new RTCPeerConnection({
      iceServers,
      iceCandidatePoolSize: 10,
    });

    // Add local stream tracks
    if (localStream) {
      localStream.getTracks().forEach(track => {
        pc.addTrack(track, localStream);
      });
    }

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendIceCandidate({
          didIOffer: true,
          iceUserName: peerId,
          iceCandidate: event.candidate,
        });
      }
    };

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') {
        setError('Peer connection failed');
      }
    };

    // Handle remote stream
    pc.ontrack = (event) => {
      const stream = event.streams[0];
      setRemoteStreams(prev => new Map(prev.set(peerId, stream)));
      
      // Set remote video source
      const videoElement = remoteVideoRefs.current.get(peerId);
      if (videoElement) {
        videoElement.srcObject = stream;
      }
    };

    peerConnections.current.set(peerId, pc);
    return pc;
  }, [localStream, iceServers, sendIceCandidate]);

  // Handle incoming offers
  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleNewOffer = async (offerObj) => {
      try {
        const pc = createPeerConnection(offerObj.offererUserName);
        
        await pc.setRemoteDescription(new RTCSessionDescription(offerObj.offer));
        
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        
        sendAnswer(offerObj, (iceCandidates) => {
          // Add any ICE candidates that were collected
          iceCandidates.forEach(candidate => {
            pc.addIceCandidate(new RTCIceCandidate(candidate));
          });
        });
      } catch (err) {
        setError('Failed to handle offer: ' + err.message);
      }
    };

    socket.on('newOfferAwaiting', (offers) => {
      offers.forEach(handleNewOffer);
    });

    return () => {
      socket.off('newOfferAwaiting');
    };
  }, [socket, isConnected, createPeerConnection, sendAnswer]);

  // Handle incoming answers
  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleAnswerResponse = async (offerObj) => {
      try {
        const pc = peerConnections.current.get(offerObj.offererUserName);
        if (pc) {
          await pc.setRemoteDescription(new RTCSessionDescription(offerObj.answer));
        }
      } catch (err) {
        setError('Failed to handle answer: ' + err.message);
      }
    };

    socket.on('answerResponse', handleAnswerResponse);

    return () => {
      socket.off('answerResponse');
    };
  }, [socket, isConnected]);

  // Handle ICE candidates from server
  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleIceCandidate = async (iceCandidate) => {
      try {
        // Find the appropriate peer connection
        for (const [peerId, pc] of peerConnections.current) {
          if (pc.remoteDescription) {
            await pc.addIceCandidate(new RTCIceCandidate(iceCandidate));
            break;
          }
        }
      } catch (err) {
        console.error('Failed to add ICE candidate:', err);
      }
    };

    socket.on('receivedIceCandidateFromServer', handleIceCandidate);

    return () => {
      socket.off('receivedIceCandidateFromServer');
    };
  }, [socket, isConnected]);

  // Create and send offer
  const createOffer = useCallback(async (peerId) => {
    try {
      setIsConnecting(true);
      const pc = createPeerConnection(peerId);
      
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      sendOffer(offer);
      setIsConnecting(false);
    } catch (err) {
      setError('Failed to create offer: ' + err.message);
      setIsConnecting(false);
    }
  }, [createPeerConnection, sendOffer]);

  // Join room and start WebRTC
  const joinMeeting = useCallback(async (roomId) => {
    try {
      setError(null);
      
      // Get user media first
      await getUserMedia();
      
      // Join the room
      joinRoom(roomId);
      
    } catch (err) {
      setError('Failed to join meeting: ' + err.message);
    }
  }, [getUserMedia, joinRoom]);

  // Leave meeting and cleanup
  const leaveMeeting = useCallback(() => {
    // Stop local stream
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }

    // Close peer connections
    peerConnections.current.forEach(pc => {
      pc.close();
    });
    peerConnections.current.clear();

    // Clear remote streams
    setRemoteStreams(new Map());

    // Leave room
    leaveRoom();

    setError(null);
    setIsConnecting(false);
  }, [localStream, leaveRoom]);

  // Add remote video ref
  const addRemoteVideoRef = useCallback((peerId, ref) => {
    remoteVideoRefs.current.set(peerId, ref);
  }, []);

  // Remove remote video ref
  const removeRemoteVideoRef = useCallback((peerId) => {
    remoteVideoRefs.current.delete(peerId);
  }, []);

  return {
    // State
    localStream,
    remoteStreams,
    isConnecting,
    error,
    iceServers,
    participants,
    availableOffers,
    isConnected,
    currentRoom,

    // Refs
    localVideoRef,
    remoteVideoRefs,

    // Methods
    getUserMedia,
    joinMeeting,
    leaveMeeting,
    createOffer,
    addRemoteVideoRef,
    removeRemoteVideoRef,
  };
} 