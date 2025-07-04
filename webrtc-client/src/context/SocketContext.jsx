import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { AuthContext } from './AuthContext';

export const SocketContext = createContext();

export function SocketProvider({ children }) {
  const { user } = useContext(AuthContext);
  const [socket, setSocket] = useState(null);
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

  useEffect(() => {
    if (user) {
      const token = localStorage.getItem('token');
      if (!token) return;

      const backendRoot = import.meta.env.VITE_API_URL.replace(/\/api$/, '');
      const s = io(backendRoot, {
        auth: { token },
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });

      s.on('connect', () => {
        setIsConnected(true);
      });

      s.on('disconnect', () => {
        setIsConnected(false);
      });

      s.on('connect_error', (err) => {
        setError('Connection failed: ' + err.message);
        console.error('Socket connection error:', err);
      });

      s.on('roomParticipants', (participantsList) => {
        setParticipants(participantsList);
      });

      s.on('availableOffers', (offers) => {
        setAvailableOffers(offers);
      });

      s.on('newOfferAwaiting', (offers) => {
        setAvailableOffers(prev => [...prev, ...offers]);
      });

      s.on('answer', (offerObj) => {
        setOfferObj(offerObj);
      });

      s.on('ice-candidate', (iceCandidate) => {
        setIceCandidate(iceCandidate);
      });

      s.on('user-hung-up', (userName) => {
        setUserHungUp(userName);
      });

      s.on('chat-message', ({ userName, message }) => {
        setMessages(prev => [...prev, { userName, message }]);
      });

      s.on('avatar-output', (json) => {
        setAvatarOutput(json);
      });

      s.on('avatar-navigate', (index) => {
        setAvatarNavigate(index);
      });

      setSocket(s);

      return () => {
        s.disconnect();
      };
    }
  }, [user]);

  const joinRoom = (roomId) => {
    if (socket && roomId) {
      socket.auth = { 
        ...socket.auth, 
        roomId 
      };
      socket.connect();
      setCurrentRoom(roomId);
    }
  };

  const leaveRoom = () => {
    if (socket) {
      socket.emit('hangup');
      setCurrentRoom(null);
      setParticipants([]);
      setAvailableOffers([]);
    }
  };

  const sendOffer = (offer) => {
    if (socket) {
      socket.emit('newOffer', offer);
    }
  };

  const sendAnswer = (offerObj, callback) => {
    if (socket) {
      socket.emit('newAnswer', offerObj, callback);
    }
  };

  const sendIceCandidate = (iceObj) => {
    if (socket) {
      socket.emit('sendIceCandidateToSignalingServer', iceObj);
    }
  };

  const sendMessage = (message) => {
    if (socket) {
      socket.emit('sendMessage', message);
    }
  };

  const sendAvatarOutput = (json) => {
    if (socket) {
      socket.emit('avatarOutput', json);
    }
  };

  const sendAvatarNavigate = (index) => {
    if (socket) {
      socket.emit('avatarNavigate', { index });
    }
  };

  return (
    <SocketContext.Provider value={{
      socket,
      isConnected,
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
    }}>
      {children}
    </SocketContext.Provider>
  );
}