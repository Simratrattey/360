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
      console.log('[WebRTC] 📹 Requesting camera/microphone access...');
      
      // Check for pre-meeting settings
      const preMeetingSettings = localStorage.getItem('preMeetingSettings');
      let constraints = { video: true, audio: true };
      
      if (preMeetingSettings) {
        try {
          const settings = JSON.parse(preMeetingSettings);
          console.log('[WebRTC] 🔧 Using pre-meeting settings:', settings);
          
          // Apply device constraints if specified
          if (settings.selectedCamera) {
            constraints.video = { deviceId: { exact: settings.selectedCamera } };
          }
          if (settings.selectedMicrophone) {
            constraints.audio = { deviceId: { exact: settings.selectedMicrophone } };
          }
          
          // Get stream with specified devices
          const stream = await navigator.mediaDevices.getUserMedia(constraints);
          
          // Apply pre-meeting enabled/disabled state
          const videoTrack = stream.getVideoTracks()[0];
          const audioTrack = stream.getAudioTracks()[0];
          
          if (videoTrack) {
            videoTrack.enabled = settings.videoEnabled !== false; // Default to true if not specified
          }
          if (audioTrack) {
            audioTrack.enabled = settings.audioEnabled !== false; // Default to true if not specified
          }
          
          console.log('[WebRTC] ✅ Got media stream with pre-meeting settings:', {
            video: videoTrack?.enabled,
            audio: audioTrack?.enabled,
            tracks: stream.getTracks().map(t => t.kind)
          });
          
          setLocalStream(stream);
          if (localVideoRef.current) localVideoRef.current.srcObject = stream;
          
          // Note: Don't clear pre-meeting settings here - SocketContext needs them for display name
          // They will be cleared after room join
          
          return stream;
        } catch (settingsError) {
          console.warn('[WebRTC] Failed to apply pre-meeting settings, falling back to default:', settingsError);
          // Fall through to default behavior
        }
      }
      
      // Default behavior (no pre-meeting settings or failed to apply them)
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('[WebRTC] ✅ Got media stream:', stream.getTracks().map(t => t.kind));
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
      // Ensure we have a valid socket ID with retry mechanism
      let peerId = sfuSocket?.id;
      if (!peerId) {
        console.warn('⚠️ No socket ID available for produce, waiting...');
        // Wait briefly for socket to be ready
        await new Promise(resolve => setTimeout(resolve, 100));
        peerId = sfuSocket?.id;
        if (!peerId) {
          console.error('❌ No socket ID available for produce after retry');
          errback(new Error('Socket not connected'));
          return;
        }
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
    if (!sfuSocket?.id) {
      console.error('[WebRTC] ❌ Cannot produce tracks without socket ID');
      throw new Error('Socket not ready');
    }
    
    for (const track of stream.getTracks()) {
      const peerId = sfuSocket.id;
      console.log('[WebRTC] 📤 Producing track with peerId:', peerId, 'track kind:', track.kind);
      
      const producer = await sendTransportRef.current.produce({ track });
      producersRef.current.push(producer);
      console.log(`📤 Produced ${track.kind} with producer ID:`, producer.id, 'peerId:', peerId);
    }
  }, [localStream, sfuSocket]);

  // === Consume Producers ===
  const consumeProducers = useCallback(async (roomId) => {
    const myPeerId = sfuSocket?.id;
    if (!myPeerId) {
      console.error('[WebRTC] ❌ No peerId available for getProducers');
      return;
    }
    
    const { success, data: producers, error } = await meetingService.getProducers(roomId, myPeerId);
    if (!success) throw new Error(error || 'Failed to get producers');
    console.log('[WebRTC] 🔍 consumeProducers → (excluding peerId:', myPeerId, ') →', producers);

    const myIds = producersRef.current.map(p => p.id);
    console.log('[WebRTC] 🔍 My producer IDs:', myIds);
    
    const otherProducers = producers.filter(p => !myIds.includes(p.id));
    console.log('[WebRTC] 🔍 Other producers to consume:', otherProducers);
    
    if (otherProducers.length === 0) {
      console.log('[WebRTC] ℹ️ No other producers to consume');
      return;
    }
    
    for (const producer of otherProducers) {
      console.log('[WebRTC] 🔄 Attempting to consume producer:', producer.id, 'kind:', producer.kind, 'peerId:', producer.peerId);
      
      const { success, data: consumerParams, error: consumeError } = await meetingService.consume(
        recvTransportRef.current.id,
        producer.id,
        deviceRef.current.rtpCapabilities
      );
      if (!success) {
        console.error('❌ Consume failed for producer', producer.id, ':', consumeError);
        continue;
      }

      console.log('[WebRTC] ✅ Consumer params received:', consumerParams);
      
      const consumer = await recvTransportRef.current.consume({
        id: consumerParams.id,
        producerId: consumerParams.producerId,
        kind: consumerParams.kind,
        rtpParameters: consumerParams.rtpParameters,
      });
      
      console.log('[WebRTC] ✅ Consumer created:', consumer.id, 'kind:', consumer.kind);

      consumersRef.current.push(consumer);
      await consumer.resume();

      // Use consistent peer identification - always use peerId if available
      const peerId = producer.peerId;
      if (!peerId) {
        console.error('[WebRTC] ❌ No peerId for producer:', producer.id, 'skipping stream assignment');
        continue;
      }
      console.log('[WebRTC] 📺 Adding stream for peer:', peerId, 'producer:', producer.id);
      
      const merged = peerStreamsRef.current.get(peerId) || new MediaStream();
      merged.addTrack(consumer.track);
      peerStreamsRef.current.set(peerId, merged);
      setRemoteStreams(new Map(peerStreamsRef.current));
    }
  }, [sfuSocket]);

  // — listen for newly-produced tracks in this room —
  useEffect(() => {
    console.log('[WebRTC] 🔧 Setting up newProducer event listener, sfuSocket:', !!sfuSocket, 'connected:', sfuSocket?.connected);
    
    // Early return if no socket available
    if (!sfuSocket) {
      console.log('[WebRTC] ⚠️ No sfuSocket available, skipping newProducer setup');
      return;
    }
    
    const handleNewProducer = async ({ producerId, peerId: incomingPeerId }) => {
      const myPeerId = sfuSocket?.id;
      console.log('[WebRTC] ↪ newProducer event:', producerId, 'peerId:', incomingPeerId, 'myPeerId:', myPeerId);
      
      if (producersRef.current.some(p => p.id === producerId)) {
        console.log('[WebRTC] ↪ newProducer is ours (by producer ID), skipping:', producerId);
        return;
      }
      
      if (incomingPeerId === myPeerId) {
        console.log('[WebRTC] ↪ newProducer is ours (by peer ID), skipping:', producerId, 'peerId:', incomingPeerId);
        return;
      }
      
      if (!recvTransportRef.current) {
        console.error('[WebRTC] ❌ No receive transport available for newProducer');
        return;
      }
      
      if (!deviceRef.current) {
        console.error('[WebRTC] ❌ No device available for newProducer');
        return;
      }
      
      console.log('[WebRTC] 🔄 Processing newProducer:', producerId);
      
      try {
        const { success, data } = await meetingService.consume(
          recvTransportRef.current.id,
          producerId,
          deviceRef.current.rtpCapabilities
        );
        if (!success) {
          console.error('[WebRTC] ❌ consume error for newProducer', producerId, ':', data);
          return;
        }
        
        console.log('[WebRTC] ✅ Consumer params for newProducer:', data);
        const consumer = await recvTransportRef.current.consume(data);
        await consumer.resume();
        console.log('[WebRTC] ✅ Consumer resumed for newProducer:', consumer.id);
        
        // Use consistent peer identification - always use incomingPeerId if available
        if (!incomingPeerId) {
          console.error('[WebRTC] ❌ No peerId for new producer:', producerId, 'skipping stream assignment');
          return;
        }
        console.log('[WebRTC] 📺 Adding new producer stream for peer:', incomingPeerId, 'producer:', producerId);
        
        const merged = peerStreamsRef.current.get(incomingPeerId) || new MediaStream();
        merged.addTrack(consumer.track);
        peerStreamsRef.current.set(incomingPeerId, merged);
        setRemoteStreams(new Map(peerStreamsRef.current));
      } catch (err) {
        console.error('[WebRTC] ❌ Error consuming new producer', producerId, ':', err);
      }
    };
    
    // Debug: Log ALL events on this socket
    const originalOn = sfuSocket.on.bind(sfuSocket);
    const debugOn = (event, handler) => {
      if (event === 'newProducer') {
        console.log('[WebRTC] 🔧 Registering newProducer event handler');
      }
      return originalOn(event, (data) => {
        if (event === 'newProducer') {
          console.log('[WebRTC] 📥 Raw newProducer event received:', data);
        }
        return handler(data);
      });
    };
    
    debugOn('newProducer', handleNewProducer);
    return () => sfuSocket.off('newProducer', handleNewProducer);
  }, [sfuSocket]);

  // — listen for peers hanging up and remove their stream —
  useEffect(() => {
    if (!sfuSocket) {
      console.log('[WebRTC] ⚠️ No sfuSocket available, skipping hangup setup');
      return;
    }
    
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
    
    // Double-check socket ID is available
    if (!sfuSocket?.id) {
      console.error('[WebRTC] ❌ No socket ID available after connection');
      setError('Socket connection failed - no ID assigned');
      return;
    }
    
    console.log('[WebRTC] 🚀 Starting join meeting process with socket ID:', sfuSocket.id);
    
    try {
      console.log('[WebRTC] 📹 Step 1: Getting user media...');
      const stream = await getUserMedia();
      console.log('[WebRTC] 🔧 Step 2: Loading device...');
      await loadDevice();
      console.log('[WebRTC] 📤 Step 3: Creating send transport...');
      await createSendTransport(roomId);
      console.log('[WebRTC] 📥 Step 4: Creating receive transport...');
      await createRecvTransport();
      
      // Join the room first to establish participant presence
      console.log('[WebRTC] 🚪 Joining room:', roomId);
      joinRoom(roomId);
      
      // Small delay to ensure room join is processed
      console.log('[WebRTC] ⏳ Waiting for room join to process...');
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Produce local tracks after room join
      await produceLocalTracks(stream);
      
      // Small delay before consuming to let producers propagate
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Then consume existing producers in the room
      try {
        await consumeProducers(roomId);
      } catch (err) {
        console.error('[WebRTC] ❌ Failed to consume producers:', err);
        // Continue anyway, newProducer events will handle new ones
      }
    } catch (err) {
      console.error('❌ Join meeting failed:', err);
      setError('Failed to join meeting: ' + err.message);
    }
  }, [getUserMedia, loadDevice, createSendTransport, createRecvTransport, produceLocalTracks, consumeProducers, joinRoom, sfuSocket]);

  // === Toggle Video (Official Mediasoup Demo Pattern) ===
  const toggleVideo = useCallback(async () => {
    // Find the video producer
    const videoProducer = producersRef.current.find(p => p.track && p.track.kind === 'video');
    const hasVideoProducer = videoProducer && !videoProducer.closed;

    if (!hasVideoProducer) {
      // Enable video (following official demo pattern)
      console.log('[WebRTC] 🔄 enableWebcam() - Creating new video producer...');

      try {
        // Check for pre-meeting camera selection
        const preMeetingSettings = localStorage.getItem('preMeetingSettings');
        let videoConstraints = true;
        if (preMeetingSettings) {
          try {
            const settings = JSON.parse(preMeetingSettings);
            if (settings.selectedCamera) {
              videoConstraints = { deviceId: { exact: settings.selectedCamera } };
            }
          } catch (e) {
            console.warn('[WebRTC] Failed to parse pre-meeting settings for camera:', e);
          }
        }

        // Get new camera stream
        const stream = await navigator.mediaDevices.getUserMedia({
          video: videoConstraints,
          audio: false
        });
        const videoTrack = stream.getVideoTracks()[0];

        console.log('[WebRTC] 📹 Got new camera stream, track readyState:', videoTrack.readyState);

        if (!sendTransportRef.current) {
          throw new Error('No send transport available');
        }

        // Create new producer (official pattern)
        const newProducer = await sendTransportRef.current.produce({ track: videoTrack });
        producersRef.current.push(newProducer);

        // Add to local stream and update video element IMMEDIATELY
        if (localStream) {
          // Remove old video track if exists
          const oldVideoTrack = localStream.getVideoTracks()[0];
          if (oldVideoTrack) {
            console.log('[WebRTC] 🗑️ Removing old video track');
            localStream.removeTrack(oldVideoTrack);
            oldVideoTrack.stop();
          }

          // Add new video track
          localStream.addTrack(videoTrack);
          console.log('[WebRTC] ➕ Added new video track to localStream');

          // Force update video element with fresh stream
          if (localVideoRef.current) {
            console.log('[WebRTC] 📺 Updating video element with new stream');
            localVideoRef.current.srcObject = null; // Clear first
            localVideoRef.current.srcObject = localStream;

            // Force video to play
            localVideoRef.current.play().catch(e => {
              console.warn('[WebRTC] Video play failed (may be normal):', e);
            });
          }
        } else {
          console.warn('[WebRTC] ⚠️ No localStream available, creating new one');
          setLocalStream(stream);
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
            localVideoRef.current.play().catch(e => {
              console.warn('[WebRTC] Video play failed (may be normal):', e);
            });
          }
        }

        console.log('[WebRTC] ✅ Video enabled with new producer:', newProducer.id);
        return { success: true, enabled: true };
      } catch (error) {
        console.error('[WebRTC] ❌ enableWebcam() | failed:', error);
        return {
          success: false,
          enabled: false,
          error: `Error enabling webcam: ${error}`
        };
      }
    } else {
      // Disable video (following official demo pattern)
      console.log('[WebRTC] 🔴 disableWebcam() - Closing video producer...');

      try {
        // Step 1: Stop camera track IMMEDIATELY to turn off green light
        if (localStream) {
          const videoTrack = localStream.getVideoTracks()[0];
          if (videoTrack) {
            console.log('[WebRTC] 🔴 Stopping camera track immediately - green light should turn OFF');
            videoTrack.stop();
            localStream.removeTrack(videoTrack);
          }

          // Update video element immediately
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = localStream;
          }
        }

        // Step 2: Close the producer locally (official pattern)
        videoProducer.close();

        // Step 3: Remove from producers array
        producersRef.current = producersRef.current.filter(p => p.id !== videoProducer.id);

        // Step 4: Notify server (official pattern)
        const { success, error: serverError } = await meetingService.closeProducer(videoProducer.id);

        if (!success) {
          console.error('[WebRTC] ❌ disableWebcam() | server-side close failed:', serverError);
          // Don't rollback here - local camera is already stopped which is what user expects
          console.warn('[WebRTC] ⚠️ Server sync failed but camera hardware stopped successfully');
        }

        console.log('[WebRTC] ✅ Video disabled - Producer closed, camera hardware stopped');
        return { success: true, enabled: false };
      } catch (error) {
        console.error('[WebRTC] ❌ disableWebcam() | failed:', error);
        return {
          success: false,
          enabled: true,
          error: `Error disabling webcam: ${error}`
        };
      }
    }
  }, [localStream, localVideoRef]);

  // === Toggle Audio (Official Mediasoup Demo Pattern) ===
  const toggleAudio = useCallback(async () => {
    // Find the audio producer
    const audioProducer = producersRef.current.find(p => p.track && p.track.kind === 'audio');
    if (!audioProducer) {
      console.error('[WebRTC] No audio producer found');
      return { success: false, enabled: false };
    }

    const currentlyEnabled = !audioProducer.paused;

    if (currentlyEnabled) {
      // Mute audio (following official demo pattern)
      console.log('[WebRTC] 🔇 muteMic() - Pausing producer...');

      // Step 1: Pause locally first (official pattern)
      audioProducer.pause();

      try {
        // Step 2: Notify server (official pattern)
        const { success, error: serverError } = await meetingService.pauseProducer(audioProducer.id);

        if (!success) {
          console.error('[WebRTC] ❌ muteMic() | server-side pause failed:', serverError);

          // Rollback local state on server error
          audioProducer.resume();

          return {
            success: false,
            enabled: true,
            error: `Error pausing server-side mic Producer: ${serverError}`
          };
        }

        console.log('[WebRTC] ✅ Audio muted (producer paused, mic indicator stays on)');
        return { success: true, enabled: false };
      } catch (error) {
        console.error('[WebRTC] ❌ muteMic() | failed:', error);

        // Rollback local state on error
        audioProducer.resume();

        return {
          success: false,
          enabled: true,
          error: `Error pausing server-side mic Producer: ${error}`
        };
      }
    } else {
      // Unmute audio (following official demo pattern)
      console.log('[WebRTC] 🔊 unmuteMic() - Resuming producer...');

      // Step 1: Resume locally first (official pattern)
      audioProducer.resume();

      try {
        // Step 2: Notify server (official pattern)
        const { success, error: serverError } = await meetingService.resumeProducer(audioProducer.id);

        if (!success) {
          console.error('[WebRTC] ❌ unmuteMic() | server-side resume failed:', serverError);

          // Rollback local state on server error
          audioProducer.pause();

          return {
            success: false,
            enabled: false,
            error: `Error resuming server-side mic Producer: ${serverError}`
          };
        }

        console.log('[WebRTC] ✅ Audio unmuted (producer resumed)');
        return { success: true, enabled: true };
      } catch (error) {
        console.error('[WebRTC] ❌ unmuteMic() | failed:', error);

        // Rollback local state on error
        audioProducer.pause();

        return {
          success: false,
          enabled: false,
          error: `Error resuming server-side mic Producer: ${error}`
        };
      }
    }
  }, []);

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
    if (!sfuSocket) {
      console.log('[WebRTC] ⚠️ No sfuSocket available, skipping roomClosed setup');
      return;
    }
    
    const handleClosed = (rid) => {
      console.log('[WebRTC] 🚪 Room closed event received:', rid, 'currentRoom:', currentRoom, 'match:', rid === currentRoom);
      if (rid === currentRoom) {
        console.log('[WebRTC] ⚠️ ROOM CLOSED - This indicates a server-side issue');
        console.log('[WebRTC] 💡 Possible causes: room doesn\'t exist, invalid room ID, or server error');
        
        // Temporarily disable automatic closing to debug the issue
        console.log('[WebRTC] 🔍 DEBUG MODE: Not closing window automatically - check server logs');
        
        // Uncomment these lines after debugging:
        // leaveMeeting();
        // if (window.opener) {
        //   console.log('[WebRTC] 🪟 Room closed - closing meeting window');
        //   window.close();
        // } else {
        //   console.log('[WebRTC] 📤 Room closed - navigating to /meetings');
        //   navigate('/meetings');
        // }
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
    toggleVideo,
    toggleAudio,
    addRemoteVideoRef: (peerId, ref) => remoteVideoRefs.current.set(peerId, ref),
    removeRemoteVideoRef: (peerId) => remoteVideoRefs.current.delete(peerId),
  };
}