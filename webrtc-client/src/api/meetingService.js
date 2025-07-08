import API from './client';

class MeetingService {
  // Get ICE servers configuration
  async getIceServers() {
    try {
      const response = await API.get('/ice');
      return { success: true, data: response.data };
    } catch (error) {
      return { 
        success: false, 
        error: 'Failed to get ICE servers' 
      };
    }
  }

  // Get active rooms
  async getActiveRooms() {
    try {
      const response = await API.get('/rooms');
      return { success: true, data: response.data };
    } catch (error) {
      return { 
        success: false, 
        error: 'Failed to get active rooms' 
      };
    }
  }

  // Upload recording
  async uploadRecording(videoBlob, metadata) {
    try {
      const formData = new FormData();
      formData.append('video', videoBlob, 'recording.webm');
      formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));

      const response = await API.post('/recordings', formData, {
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

  // Get recordings list
  async getRecordings() {
    try {
      const response = await API.get('/recordings');
      return { success: true, data: response.data };
    } catch (error) {
      return { 
        success: false, 
        error: 'Failed to get recordings' 
      };
    }
  }

  // Get recordings for specific room
  async getRoomRecordings(roomId) {
    try {
      const response = await API.get(`/recordings/${roomId}`);
      return { success: true, data: response.data };
    } catch (error) {
      return { 
        success: false, 
        error: 'Failed to get room recordings' 
      };
    }
  }

  // Get recording file URL
  getRecordingFileUrl(sessionId, filename) {
    return `${import.meta.env.VITE_API_URL}/recordings/files/${sessionId}/${filename}`;
  }
}

export default new MeetingService(); 