import { useState, useEffect, useRef, useCallback } from 'react';
import { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { SocketContext } from '../context/SocketContext';
import meetingService from '../api/meetingService';
import * as mediasoupClient from 'mediasoup-client';

export function useWebRTC() {
  const { sfuSocket, isSFUConnected, joinRoom, leaveRoom, currentRoom, participantMap } = useContext(SocketContext);
  const navigate = useNavigate();

  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState(new Map());
  const [error, setError] = useState(null);

  const localVideoRef = useRef(null);
  const remoteVideoRefs = useRef(new Map());
  const deviceRef = useRef(null);
  const sendTransportRef = useRef(null);
  const recvTransportRef = useRef(null);
  const producersRef = useRef([]);
  const consumersRef = useRef([]);
  const peerStreamsRef = useRef(new Map());

  // === Get User Media ===
  const getUserMedia = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setLocalStream(stream);
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      return stream;
    } catch (err) {
      console.error('❌ getUserMedia failed:', err);
      setError('Failed to access camera/microphone: ' + err.message);
      throw err;
    }
  }, []);

  // === Load Mediasoup Device ===
  const loadDevice = useCallback(async () => {
    const { success, data, error: capError } = await meetingService.getRtpCapabilities();
    if (!success) {
      throw new Error(capError);
    }
    const device = new mediasoupClient.Device();
    await device.load({ routerRtpCapabilities: data });
    deviceRef.current = device;
  }, []);

  // === Create Send Transport ===
  const createSendTransport = useCallback(async (roomId) => {
    const { success, data, error: transportError } = await meetingService.createTransport('send');
    if (!success) throw new Error(transportError);

    const transport = deviceRef.current.createSendTransport({
      ...data,
      iceServers: data.iceServers || []
    });

    // ─── ICE / DTLS DEBUG LOGGING ─────────────────────────────────────
    // Mediasoup-client exposes an Observer interface on every transport:
    transport.observer.on('icestatechange', (iceState) => {
      console.log(`[WebRTC][ICE] sendTransport ${transport.id} iceConnectionState →`, iceState);
    });
    transport.observer.on('selectedtuplechange', (tuple) => {
      console.log(
        `[WebRTC][ICE] sendTransport ${transport.id} selected tuple:\n` +
        `  local  ${tuple.localIp}:${tuple.localPort}\n` +
        `  remote ${tuple.remoteIp}:${tuple.remotePort}`
      );
    });
    transport.observer.on('dtlsstatechange', (dtlsState) => {
      console.log(`[WebRTC][DTLS] sendTransport ${transport.id} dtlsState →`, dtlsState);
    });
    // ─────────────────────────────────────────────────────────────────

    transport.on('connect', async ({ dtlsParameters }, callback, errback) => {
      try {
        await meetingService.connectTransport(data.id, dtlsParameters);
        callback();
      } catch (err) {
        console.error('❌ Send transport connect failed:', err);
        errback(err);
      }
    });

    transport.on('produce', async ({ kind, rtpParameters}, callback, errback) => {
      // Ensure we have a valid socket ID
      const peerId = sfuSocket?.id;
      if (!peerId) {
        console.error('❌ No socket ID available for produce');
        errback(new Error('Socket not connected'));
        return;
      }
      
      console.log('[WebRTC] 📤 Transport produce event - peerId:', peerId, 'kind:', kind);
      
      const { success, data: prodData, error: prodError } = await meetingService.produce(
        transport.id,
        kind,
        rtpParameters,
        roomId,
        peerId
      );
      if (success) {
        callback({ id: prodData.id });
      } else {
        console.error('❌ Produce error:', prodError);
        errback(prodError);
      }
    });

    transport.on('connectionstatechange', (state) => {
      console.log(`📡 Send transport state: ${state}`);
      if (state === 'failed' || state === 'closed') {
        setError('Send transport failed');
      }
    });

    sendTransportRef.current = transport;
  }, [sfuSocket]);


  // === Create Recv Transport ===
  const createRecvTransport = useCallback(async () => {
    const { success, data, error: transportError } = await meetingService.createTransport('recv');
    if (!success) throw new Error(transportError);

    console.log('[ICE] Recv transport iceServers:', data.iceServers);
    const transport = deviceRef.current.createRecvTransport({
      ...data,
      iceServers: data.iceServers || []
    });
    console.log('[ICE] Recv transport created with remote ICE candidates:', data.iceCandidates);

    transport.observer.on('icestatechange', iceState =>
      console.log(`[WebRTC][ICE] recvTransport ${transport.id} iceConnectionState →`, iceState)
    );
    transport.observer.on('selectedtuplechange', tuple =>
      console.log(`[WebRTC][ICE] recvTransport ${transport.id} selected tuple → local ${tuple.localIp}:${tuple.localPort}, remote ${tuple.remoteIp}:${tuple.remotePort}`)
    );
    transport.observer.on('dtlsstatechange', dtlsState =>
      console.log(`[WebRTC][DTLS] recvTransport ${transport.id} dtlsState →`, dtlsState)
    );

    transport.on('connect', async ({ dtlsParameters }, callback, errback) => {
      console.log('[ICE] Recv transport "connect" event fired; sending DTLS params:', dtlsParameters);
      try {
        await meetingService.connectTransport(data.id, dtlsParameters);
        callback();
      } catch (err) {
        console.error('❌ Recv transport connect failed:', err);
        errback(err);
      }
    });

    transport.on('connectionstatechange', (state) => {
      console.log(`📡 Recv transport state: ${state}`);
      console.log(`🔒 DTLS role: ${transport.dtlsRole || transport.dtlsParameters?.role}`);
      if (state === 'failed' || state === 'closed') {
        setError('Recv transport failed');
      }
    });

    // —— Periodic ICE stats logger, stops if transport is closed ——
    (function logIceStats() {
      // don't run on a closed transport
      if (transport.connectionState === 'closed') return;

      transport.getStats()
        .then(stats => {
          /* …your existing logging… */
        })
        .catch(err => {
          // ignore InvalidStateError once closed, but log others
          if (err.name !== 'InvalidStateError') {
            console.error('Failed to fetch ICE stats:', err);
          }
        })
        .finally(() => {
          if (transport.connectionState !== 'closed') {
            setTimeout(logIceStats, 5000);
          }
        });
    })();

    recvTransportRef.current = transport;
  }, []);

  // === Produce Local Tracks ===
  const produceLocalTracks = useCallback(async (stream) => {
    for (const track of stream.getTracks()) {
      // Get the current socket ID as peerId for consistent identification
      const peerId = sfuSocket?.id;
      console.log('[WebRTC] 📤 Producing track with peerId:', peerId, 'track kind:', track.kind);
      
      const producer = await sendTransportRef.current.produce({ track });
      producersRef.current.push(producer);
      console.log(`📤 Produced ${track.kind} with producer ID:`, producer.id);
      
      // Now we need to update the backend with the peerId for this producer
      // This should be done through the SFU API, but for now we'll rely on the socket ID
      // being consistent across the session
    }
  }, [localStream, sfuSocket]);

  // === Consume Producers ===
  const consumeProducers = useCallback(async (roomId) => {
    const { success, data: producers } = await meetingService.getProducers(roomId);
    if (!success) throw new Error(prodError);
    console.log('[WebRTC] 🔍 consumeProducers →', producers);

    const myIds = producersRef.current.map(p => p.id);
    for (const producer of producers.filter(p => !myIds.includes(p.id))) {
      const { success, data: consumerParams, error: consumeError } = await meetingService.consume(
        recvTransportRef.current.id,
        producer.id,
        deviceRef.current.rtpCapabilities
      );
      if (!success) {
        console.error('❌ Consume failed:', consumeError);
        continue;
      }

      const consumer = await recvTransportRef.current.consume({
        id: consumerParams.id,
        producerId: consumerParams.producerId,
        kind: consumerParams.kind,
        rtpParameters: consumerParams.rtpParameters,
      });

      consumersRef.current.push(consumer);
      await consumer.resume();

      // Use consistent peer identification - prefer peerId if available, otherwise use producerId
      const peerId = producer.peerId || producer.id;
      console.log('[WebRTC] 📺 Adding stream for peer:', peerId, 'producer:', producer.id);
      
      const merged = peerStreamsRef.current.get(peerId) || new MediaStream();
      merged.addTrack(consumer.track);
      peerStreamsRef.current.set(peerId, merged);
      setRemoteStreams(new Map(peerStreamsRef.current));
    }
  }, []);

  // — listen for newly-produced tracks in this room —
  useEffect(() => {
    sfuSocket.on('newProducer', async ({ producerId, peerId: incomingPeerId }) => {
      console.log('[WebRTC] ↪ newProducer event:', producerId, 'peerId:', incomingPeerId);
      if (producersRef.current.some(p => p.id === producerId)) {
        console.log('[WebRTC] ↪ newProducer is ours, skipping:', producerId);
        return;
      }
      try {
        const { success, data } = await meetingService.consume(
          recvTransportRef.current.id,
          producerId,
          deviceRef.current.rtpCapabilities
        );
        if (!success) {
          console.error('consume error', data);
          return;
        }
        const consumer = await recvTransportRef.current.consume(data);
        await consumer.resume();
        
        // Use consistent peer identification - prefer incomingPeerId if available, otherwise use producerId
        const key = incomingPeerId || producerId;
        console.log('[WebRTC] 📺 Adding new producer stream for peer:', key, 'producer:', producerId);
        
        const merged = peerStreamsRef.current.get(key) || new MediaStream();
        merged.addTrack(consumer.track);
        peerStreamsRef.current.set(key, merged);
        setRemoteStreams(new Map(peerStreamsRef.current));
      } catch (err) {
        console.error('Error consuming new producer', err);
      }
    });
    return () => sfuSocket.off('newProducer');
  }, [sfuSocket]);

  // — listen for peers hanging up and remove their stream —
  useEffect(() => {
    const handleHangup = (peerId) => {
      console.log('[useWebRTC] 🔔 received hangup for', peerId, 'typeof:', typeof peerId);
      console.log('[useWebRTC] 📊 Current state before hangup:');
      console.log('  - peerStreamsRef keys:', Array.from(peerStreamsRef.current.keys()));
      console.log('  - remoteStreams keys:', Array.from(remoteStreams.keys()));
      console.log('  - participantMap:', participantMap);
      
      // Try to find the stream by different possible keys
      let streamToRemove = null;
      let keyToRemove = null;
      
      // First try exact match
      if (peerStreamsRef.current.has(peerId)) {
        streamToRemove = peerStreamsRef.current.get(peerId);
        keyToRemove = peerId;
      } else {
        // Try to find by socket ID in participant map
        const matchingSocketId = Object.keys(participantMap).find(socketId => 
          socketId === peerId || socketId === peerId.toString()
        );
        if (matchingSocketId && peerStreamsRef.current.has(matchingSocketId)) {
          streamToRemove = peerStreamsRef.current.get(matchingSocketId);
          keyToRemove = matchingSocketId;
        }
      }
      
      if (streamToRemove && keyToRemove) {
        console.log('[useWebRTC] 🗑️ Removing stream for key:', keyToRemove);
        streamToRemove.getTracks().forEach(track => track.stop());
        peerStreamsRef.current.delete(keyToRemove);
        setRemoteStreams(new Map(peerStreamsRef.current));
        console.log('[useWebRTC] ✅ Stream removed successfully');
      } else {
        console.warn('[useWebRTC] ⚠️ Could not find stream to remove for peerId:', peerId);
      }
    };
    sfuSocket.on('hangup', handleHangup);
    return () => { sfuSocket.off('hangup', handleHangup); };
  }, [sfuSocket, remoteStreams, participantMap]);

  // === Join Meeting ===
  const joinMeeting = useCallback(async (roomId) => {
    setLocalStream(null);
    setRemoteStreams(new Map());
    
    // Ensure socket is connected before proceeding
    if (!sfuSocket?.connected) {
      console.log('[WebRTC] ⏳ Waiting for socket connection...');
      await new Promise((resolve) => {
        if (sfuSocket?.connected) {
          resolve();
        } else {
          sfuSocket?.once('connect', resolve);
        }
      });
    }
    
    console.log('[WebRTC] 🚀 Starting join meeting process with socket ID:', sfuSocket?.id);
    
    try {
      const stream = await getUserMedia();
      await loadDevice();
      await createSendTransport(roomId);
      await createRecvTransport();
      await produceLocalTracks(stream);
      joinRoom(roomId);
      await consumeProducers(roomId);
    } catch (err) {
      console.error('❌ Join meeting failed:', err);
      setError('Failed to join meeting: ' + err.message);
    }
  }, [getUserMedia, loadDevice, createSendTransport, createRecvTransport, produceLocalTracks, consumeProducers, joinRoom, sfuSocket]);

  // === Leave Meeting ===
  const leaveMeeting = useCallback(() => {
    localStream?.getTracks().forEach(track => track.stop());
    sendTransportRef.current?.close();
    recvTransportRef.current?.close();
    producersRef.current.forEach(p => p.close());
    consumersRef.current.forEach(c => c.close());

    producersRef.current = [];
    consumersRef.current = [];
    sendTransportRef.current = null;
    recvTransportRef.current = null;

    peerStreamsRef.current.clear();
    setLocalStream(null);
    setRemoteStreams(new Map());
    remoteVideoRefs.current.clear();
    leaveRoom();
    console.log('🚪 Cleaned up');
  }, [localStream, leaveRoom]);

  useEffect(() => {
    const handleClosed = (rid) => {
      if (rid === currentRoom) {
        leaveMeeting();
        navigate('/meetings');
      }
    };

    sfuSocket.on('roomClosed', handleClosed);
    return () => { sfuSocket.off('roomClosed', handleClosed); };
  }, [sfuSocket, currentRoom, leaveMeeting, navigate]);

  return {
    localStream,
    remoteStreams,
    error,
    localVideoRef,
    remoteVideoRefs,
    joinMeeting,
    leaveMeeting,
    addRemoteVideoRef: (peerId, ref) => remoteVideoRefs.current.set(peerId, ref),
    removeRemoteVideoRef: (peerId) => remoteVideoRefs.current.delete(peerId),
  };
}