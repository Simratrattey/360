import API from './client';

class TranscriptAPI {
  // Save transcript entry to server
  async saveTranscriptEntry(roomId, entry) {
    try {
      await API.post(`/transcripts/${roomId}/entry`, entry);
      console.log('📝 Saved transcript entry to server');
    } catch (error) {
      console.error('❌ Failed to save transcript to server:', error);
    }
  }

  // Load all transcript entries for a room
  async loadTranscriptHistory(roomId) {
    try {
      const response = await API.get(`/transcripts/${roomId}`);
      if (response.data.success) {
        console.log(`📋 Loaded ${response.data.transcript.length} transcript entries from server`);
        return response.data.transcript.map(entry => ({
          id: entry.id,
          original: entry.text,
          translated: null,
          text: entry.text,
          timestamp: entry.timestamp,
          speaker: entry.speaker,
          speakerId: entry.speakerId,
          sourceLanguage: 'en',
          targetLanguage: 'en',
          isTranslated: false,
          createdAt: entry.createdAt
        }));
      }
      return [];
    } catch (error) {
      console.error('❌ Failed to load transcript history:', error);
      return [];
    }
  }

  // Clear transcript for a room (optional cleanup)
  async clearTranscript(roomId) {
    try {
      await API.delete(`/transcripts/${roomId}`);
      console.log('🗑️ Cleared transcript for room');
    } catch (error) {
      console.error('❌ Failed to clear transcript:', error);
    }
  }
}

export default new TranscriptAPI();