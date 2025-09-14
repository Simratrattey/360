import SFU from './sfuClient';

class MeetingService {
  // === Existing Methods ===

  async getIceServers() {
    try {
      const response = await SFU.get('/ice');
      return { success: true, data: response.data };
    } catch (error) {
      return { 
        success: false, 
        error: 'Failed to get ICE servers' 
      };
    }
  }

  async getActiveRooms() {
    try {
      const response = await SFU.get('/rooms');
      return { success: true, data: response.data };
    } catch (error) {
      return { 
        success: false, 
        error: 'Failed to get active rooms' 
      };
    }
  }

  async uploadRecording(videoBlob, metadata) {
    try {
      const formData = new FormData();
      formData.append('video', videoBlob, 'recording.webm');
      formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));

      const response = await SFU.post('/recordings', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return { success: true, data: response.data };
    } catch (error) {
      return { 
        success: false, 
        error: 'Failed to upload recording' 
      };
    }
  }

  async getRecordings() {
    try {
      const response = await SFU.get('/recordings');
      return { success: true, data: response.data };
    } catch (error) {
      return { 
        success: false, 
        error: 'Failed to get recordings' 
      };
    }
  }

  async getRoomRecordings(roomId) {
    try {
      const response = await SFU.get(`/recordings/${roomId}`);
      return { success: true, data: response.data };
    } catch (error) {
      return { 
        success: false, 
        error: 'Failed to get room recordings' 
      };
    }
  }

  getRecordingFileUrl(sessionId, filename) {
    return `${import.meta.env.VITE_API_URL}/recordings/files/${sessionId}/${filename}`;
  }

  // === 🔥 SFU METHODS ===

  // Get Mediasoup router RTP Capabilities
  async getRtpCapabilities() {
    try {
      const response = await SFU.get('/sfu/rtpCapabilities');
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to get RTP Capabilities'
      };
    }
  }

  // Create a WebRTC Transport (send or receive)
  async createTransport(direction) {
    try {
      const response = await SFU.post('/sfu/transports', { direction });
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to create transport'
      };
    }
  }

  // Connect transport (DTLS)
  async connectTransport(transportId, dtlsParameters) {
    try {
      await SFU.post(`/sfu/transports/${transportId}/connect`, { dtlsParameters });
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to connect transport'
      };
    }
  }

  // Produce a media track
  async produce(transportId, kind, rtpParameters, roomId, peerId) {
    try {
      const response = await SFU.post('/sfu/produce', {
        transportId,
        kind,
        rtpParameters,
        roomId,
        peerId
      });
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to produce track'
      };
    }
  }

  // Consume a remote producer
  async consume(transportId, producerId, rtpCapabilities) {
    try {
      const response = await SFU.post('/sfu/consume', {
        transportId,
        producerId,
        rtpCapabilities
      });
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to consume producer'
      };
    }
  }

  // Get all active producers (excluding own producers)
  async getProducers(roomId, excludePeerId) {
    try {
      const params = {};
      if (typeof roomId === 'string') params.roomId = roomId;
      else if (roomId && roomId.roomId) params.roomId = roomId.roomId;

      // Add peerId to exclude own producers
      if (excludePeerId) params.peerId = excludePeerId;

      const response = await SFU.get('/sfu/producers', { params });
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: 'Failed to get producers' };
    }
  }

  // Pause a producer (official mediasoup pattern)
  async pauseProducer(producerId) {
    try {
      await SFU.post('/sfu/producers/pause', { producerId });
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to pause producer'
      };
    }
  }

  // Resume a producer (official mediasoup pattern)
  async resumeProducer(producerId) {
    try {
      await SFU.post('/sfu/producers/resume', { producerId });
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to resume producer'
      };
    }
  }

  // Close a producer (official mediasoup pattern)
  async closeProducer(producerId) {
    try {
      await SFU.post('/sfu/producers/close', { producerId });
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to close producer'
      };
    }
  }
}

export default new MeetingService();