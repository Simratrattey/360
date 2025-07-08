import API from './client';

class BotService {
  // Get bot reply (text or audio)
  async getBotReply(text = null, audioBlob = null) {
    try {
      let response;
      
      if (text) {
        // Text-based reply
        response = await API.post('/bot/reply', { text });
      } else if (audioBlob) {
        // Audio-based reply
        const formData = new FormData();
        formData.append('audio', audioBlob);
        response = await API.post('/bot/reply', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
      } else {
        throw new Error('Either text or audio must be provided');
      }

      return { success: true, data: response.data };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.error || 'Failed to get bot reply' 
      };
    }
  }

  // Text-to-speech conversion
  async textToSpeech(text) {
    try {
      const response = await API.post('/bot/tts', { text }, {
        responseType: 'blob',
      });
      
      return { 
        success: true, 
        data: response.data,
        contentType: response.headers['content-type']
      };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.error || 'Failed to convert text to speech' 
      };
    }
  }

  // Speech-to-text conversion
  async speechToText(audioBlob) {
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob);
      
      const response = await API.post('/bot/reply', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      return { success: true, data: response.data };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.error || 'Failed to convert speech to text' 
      };
    }
  }

  // Send text message to bot
  async sendTextMessage(text) {
    try {
      let response;
      if (text) {
        response = await API.post('/bot/reply', { text });
      } else {
        const formData = new FormData();
        formData.append('audio', audioBlob, 'audio.webm');
        response = await API.post('/bot/reply', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }
      return { success: true, data: response.data };
    } catch (error) {
      return { 
        success: false, 
        error: 'Failed to send message to bot' 
      };
    }
  }

  // Send audio message to bot
  async sendAudioMessage(audioBlob) {
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'audio.webm');
      const response = await API.post('/bot/reply', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      return { success: true, data: response.data };
    } catch (error) {
      return { 
        success: false, 
        error: 'Failed to send audio to bot' 
      };
    }
  }

  // Get TTS audio
  async getTTSAudio(text) {
    try {
      const response = await API.post('/bot/tts', { text }, {
        responseType: 'blob'
      });
      return { success: true, data: response.data };
    } catch (error) {
      return { 
        success: false, 
        error: 'Failed to get TTS audio' 
      };
    }
  }

  // Send audio message to bot (alternative method)
  async sendAudioMessageAlt(audioBlob) {
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'audio.webm');
      const response = await API.post('/bot/reply', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      return { success: true, data: response.data };
    } catch (error) {
      return { 
        success: false, 
        error: 'Failed to send audio to bot' 
      };
    }
  }
}

export default new BotService(); 