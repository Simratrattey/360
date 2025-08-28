import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import { AuthContext } from './AuthContext';

export const SocketContext = createContext();

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    console.warn('⚠️ useSocket called outside SocketProvider or before socket initialized');
    return null;
  }
  return context;
};

export function SocketProvider({ children }) {
  const { user } = useContext(AuthContext);
  const [socket, setSocket] = useState(null);
  const [sfuSocket,  setSfuSocket]  = useState(null);
  const [isSFUConnected, setIsSFUConnected] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [currentRoom, setCurrentRoom] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [availableOffers, setAvailableOffers] = useState([]);
  const [error, setError] = useState(null);
  const [offerObj, setOfferObj] = useState(null);
  const [iceCandidate, setIceCandidate] = useState(null);
  const [userHungUp, setUserHungUp] = useState(null);
  const [avatarOutput, setAvatarOutput] = useState(null);
  const [avatarNavigate, setAvatarNavigate] = useState(null);
  const [participantMap, setParticipantMap] = useState({});
  const [recordingStatus, setRecordingStatus] = useState({ isRecording: false, recordedBy: null });
  const [roomSettings, setRoomSettings] = useState({ host: null, avatarApiEnabled: true, isHost: false });
  const [avatarApiError, setAvatarApiError] = useState(null);

  useEffect(() => {
    if (user) {
      const token = localStorage.getItem('token');
      if (!token) return;

      const sfuRoot = import.meta.env.VITE_API_URL.replace(/\/api$/, '');
      const sfuSocket = io(sfuRoot, {
        auth: { token },
        transports: ['websocket'],
      });

      sfuSocket.on('connect', () => {
        console.log('[SocketContext] 🔌 sfu socket connected', sfuSocket.id);
        setIsSFUConnected(true);
        if (currentRoom) {
          console.log('[SocketContext] 🔁 re-emit joinRoom', currentRoom);
          sfuSocket.emit('joinRoom', currentRoom);
        }
      });

      sfuSocket.connect();

      sfuSocket.on('connect_error', (err) => {
        setError('SFU connection failed: ' + err.message);
        console.error('SFU socket connection error:', err);
      });

      sfuSocket.on('roomParticipants', (participants) => {
        console.log('[SocketContext] received roomParticipants:', participants);
        const map = {};
        participants.forEach(p => {
          map[p.socketId] = p.userName;
        });
        console.log('[SocketContext] 🗺️ Updated participantMap:', map);
        setParticipantMap(map);
      });

      sfuSocket.on('availableOffers', (offers) => {
        setAvailableOffers(offers);
      });

      sfuSocket.on('newOfferAwaiting', (offers) => {
        setAvailableOffers(prev => [...prev, ...offers]);
      });

      sfuSocket.on('answer', (offerObj) => {
        setOfferObj(offerObj);
      });

      sfuSocket.on('ice-candidate', (iceCandidate) => {
        console.log(`[SFU Socket ← Server] ICE candidate`, iceCandidate);
        setIceCandidate(iceCandidate);
      });

      sfuSocket.on('user-hung-up', (userName) => {
        setUserHungUp(userName);
      });


      sfuSocket.on('avatarOutput', (json) => {
        setAvatarOutput(json);
      });

      sfuSocket.on('avatarNavigate', ({ index }) => {
        setAvatarNavigate(index);
      });

      sfuSocket.on('recordingStarted', ({ recordedBy }) => {
        console.log('[SocketContext] Recording started by:', recordedBy);
        setRecordingStatus({ isRecording: true, recordedBy });
      });

      sfuSocket.on('recordingStopped', ({ recordedBy }) => {
        console.log('[SocketContext] Recording stopped by:', recordedBy);
        setRecordingStatus({ isRecording: false, recordedBy: null });
      });

      // Room settings events
      sfuSocket.on('roomSettings', (settings) => {
        console.log('[SocketContext] Room settings received:', settings);
        setRoomSettings(settings);
      });

      sfuSocket.on('roomSettingsUpdated', (settings) => {
        console.log('[SocketContext] Room settings updated:', settings);
        console.log('[SocketContext] Previous room settings:', roomSettings);
        setRoomSettings(prev => {
          const newSettings = { ...prev, ...settings };
          console.log('[SocketContext] New room settings:', newSettings);
          return newSettings;
        });
      });

      sfuSocket.on('avatarApiDisabled', ({ message }) => {
        console.log('[SocketContext] Avatar API disabled:', message);
        setAvatarApiError(message);
        // Clear error after 5 seconds
        setTimeout(() => setAvatarApiError(null), 5000);
      });

      sfuSocket.on('unauthorizedAction', ({ message }) => {
        console.log('[SocketContext] Unauthorized action:', message);
        setError(message);
      });

      setSfuSocket(sfuSocket);

      return () => {
        sfuSocket.disconnect();
      };
    }
  }, [user]);

  const joinRoom = (roomId) => {
    console.log('[SocketContext] 🎯 joinRoom called with roomId:', roomId, 'type:', typeof roomId);
    setCurrentRoom(roomId);
    
    // Check for meeting info in localStorage
    const meetingInfoKey = `meeting-${roomId}`;
    const meetingInfoStr = localStorage.getItem(meetingInfoKey);
    let meetingInfo = null;
    
    if (meetingInfoStr) {
      try {
        meetingInfo = JSON.parse(meetingInfoStr);
        console.log('[SocketContext] 📋 Found meeting info for room:', meetingInfo);
      } catch (e) {
        console.warn('[SocketContext] ⚠️ Failed to parse meeting info:', e);
      }
    }
    
    if (!sfuSocket) {
      console.warn('[SocketContext] ⚠️ no socket yet, saved room only:', roomId);
      return;
    }
    
    const emitJoinRoom = () => {
      if (meetingInfo) {
        console.log('[SocketContext] 📤 Emitting joinRoom with meeting info');
        sfuSocket.emit('joinRoom', roomId, meetingInfo);
        // Clean up localStorage after sending
        localStorage.removeItem(meetingInfoKey);
      } else {
        console.log('[SocketContext] 📤 Emitting joinRoom without meeting info');
        sfuSocket.emit('joinRoom', roomId);
      }
    };
    
    if (!sfuSocket.connected) {
      console.log('[SocketContext] ⏳ socket not connected, will emit joinRoom after connect:', roomId);
      sfuSocket.once('connect', () => {
        console.log('[SocketContext] 🔌 connected, now emitting joinRoom for', roomId);
        emitJoinRoom();
      });
      sfuSocket.connect();
    } else {
      console.log('[SocketContext] 🔁 socket already connected, emitting joinRoom for', roomId);
      emitJoinRoom();
      console.log('[SocketContext] ✅ joinRoom event emitted successfully');
    }
  };

  const leaveRoom = () => {
    if (sfuSocket && currentRoom) {
      console.log('[SocketContext] 🔔 about to emit hangup — sfuSocket.id:', sfuSocket.id, 'typeof:', typeof sfuSocket.id);
      sfuSocket.emit('hangup', sfuSocket.id, () => {
        console.log('[SocketContext] 🔔 server ACK\'d hangup');
        sfuSocket.disconnect();
        setCurrentRoom(null);
        setParticipants([]);
        setAvailableOffers([]);
      });
    }
  };

  const sendOffer = (offer) => {
    if (sfuSocket) {
      sfuSocket.emit('newOffer', offer);
    }
  };

  const sendAnswer = (offerObj, callback) => {
    if (sfuSocket) {
      sfuSocket.emit('newAnswer', offerObj, callback);
    }
  };

  const sendIceCandidate = (iceObj) => {
    if (sfuSocket) {
      console.log(`[Socket → Server] ICE candidate`, iceObj);
      sfuSocket.emit('sendIceCandidateToSignalingServer', iceObj);
    }
  };


  const sendAvatarOutput = (json) => {
    if (sfuSocket) {
      sfuSocket.emit('avatarOutput', json);
    }
  };

  const sendAvatarNavigate = (index) => {
    if (sfuSocket) {
      sfuSocket.emit('avatarNavigate', { index });
    }
  };

  const notifyRecordingStarted = () => {
    if (sfuSocket && user) {
      sfuSocket.emit('recordingStarted', { recordedBy: user.name || user.email });
    }
  };

  const notifyRecordingStopped = () => {
    if (sfuSocket && user) {
      sfuSocket.emit('recordingStopped', { recordedBy: user.name || user.email });
    }
  };

  const toggleAvatarApi = (enabled) => {
    if (sfuSocket && roomSettings.isHost) {
      console.log('[SocketContext] Toggling avatar API:', enabled);
      sfuSocket.emit('toggleAvatarApi', { enabled });
    } else {
      console.log('[SocketContext] Cannot toggle avatar API - not host or no socket:', { 
        hasSocket: !!sfuSocket, 
        isHost: roomSettings.isHost 
      });
    }
  };

  return (
    <SocketContext.Provider value={{
      sfuSocket,
      isSFUConnected,
      currentRoom,
      participants,
      availableOffers,
      error,
      joinRoom,
      leaveRoom,
      sendOffer,
      sendAnswer,
      sendIceCandidate,
      sendAvatarOutput,
      sendAvatarNavigate,
      avatarOutput,
      avatarNavigate,
      participantMap,
      recordingStatus,
      notifyRecordingStarted,
      notifyRecordingStopped,
      roomSettings,
      avatarApiError,
      toggleAvatarApi,
    }}>
      {children}
    </SocketContext.Provider>
  );
}