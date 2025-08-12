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
  const [chatSocket, setChatSocket] = useState(null);
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
  const [messages, setMessages] = useState([]);
  const [avatarOutput, setAvatarOutput] = useState(null);
  const [avatarNavigate, setAvatarNavigate] = useState(null);
  const [participantMap, setParticipantMap] = useState({});
  const [recordingStatus, setRecordingStatus] = useState({ isRecording: false, recordedBy: null });

  useEffect(() => {
    if (user) {
      const token = localStorage.getItem('token');
      if (!token) return;

      const chatRoot = import.meta.env.VITE_API_URL.replace(/\/api$/, '');
      const chatSocket = io(chatRoot, {
        auth: { token },
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });

      const sfuRoot = import.meta.env.VITE_API_URL.replace(/\/api$/, '');
      const sfuSocket = io(sfuRoot, {
        auth: { token },
        transports: ['websocket'],
      });

      chatSocket.on('connect', () => {
        console.log('[SocketContext] 🔌 chat socket connected', chatSocket.id);
      });

      sfuSocket.on('connect', () => {
        console.log('[SocketContext] 🔌 sfu socket connected', sfuSocket.id);
        setIsSFUConnected(true);
        if (currentRoom) {
          console.log('[SocketContext] 🔁 re-emit joinRoom', currentRoom);
          sfuSocket.emit('joinRoom', currentRoom);
        }
      });

      chatSocket.connect();
      sfuSocket.connect();

      chatSocket.on('disconnect', () => {
        setIsSFUConnected(false);
      });

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

      chatSocket.on('chat-message', ({ userName, message }) => {
        setMessages(prev => [...prev, { userName, message }]);
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

      setChatSocket(chatSocket);
      setSfuSocket(sfuSocket);

      return () => {
        chatSocket.disconnect();
        sfuSocket.disconnect();
      };
    }
  }, [user]);

  const joinRoom = (roomId) => {
    console.log('[SocketContext] 🎯 joinRoom called with roomId:', roomId, 'type:', typeof roomId);
    setCurrentRoom(roomId);
    if (!sfuSocket) {
      console.warn('[SocketContext] ⚠️ no socket yet, saved room only:', roomId);
      return;
    }
    if (!sfuSocket.connected) {
      console.log('[SocketContext] ⏳ socket not connected, will emit joinRoom after connect:', roomId);
      sfuSocket.once('connect', () => {
        console.log('[SocketContext] 🔌 connected, now emitting joinRoom for', roomId);
        sfuSocket.emit('joinRoom', roomId);
      });
      sfuSocket.connect();
    } else {
      console.log('[SocketContext] 🔁 socket already connected, emitting joinRoom for', roomId);
      console.log('[SocketContext] 📤 About to emit joinRoom event to server...');
      sfuSocket.emit('joinRoom', roomId);
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

  const sendMessage = (message) => {
    if (chatSocket) {
      chatSocket.emit('sendMessage', message);
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

  return (
    <SocketContext.Provider value={{
      chatSocket,
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
      sendMessage,
      sendAvatarOutput,
      sendAvatarNavigate,
      avatarOutput,
      avatarNavigate,
      participantMap,
      recordingStatus,
      notifyRecordingStarted,
      notifyRecordingStopped,
    }}>
      {children}
    </SocketContext.Provider>
  );
}