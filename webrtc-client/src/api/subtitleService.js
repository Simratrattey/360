import API from './client';

class SubtitleService {
  constructor() {
    // Set to true for testing without API keys, false for production
    this.debugMode = false;
  }

  // Speech-to-text conversion for subtitles using your own STT endpoint
  async speechToText(audioBlob, language = 'auto', translate = false) {
    // Use debug mode if enabled
    if (this.debugMode) {
      console.log('🐛 SubtitleService: Using debug mode');
      return this.speechToTextDebug(audioBlob, language, translate);
    }

    try {
      const formData = new FormData();
      formData.append('audio', audioBlob);
      formData.append('language', language);
      formData.append('translate', translate.toString());
      
      console.log(`📡 SubtitleService: Calling /api/stt with ${audioBlob.size} bytes`);
      
      const response = await API.post('/stt', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      console.log('✅ SubtitleService: STT response received:', response.data);

      return { 
        success: true, 
        data: { 
          reply: response.data.transcription,
          transcription: response.data.transcription,
          language: response.data.language,
          translate: response.data.translate
        }
      };
    } catch (error) {
      console.error('❌ Subtitle STT Error:', error.response?.data || error.message);
      return { 
        success: false, 
        error: error.response?.data?.error || error.response?.data?.details || 'Failed to convert speech to text' 
      };
    }
  }

  // Enable/disable debug mode
  setDebugMode(enabled) {
    this.debugMode = enabled;
    console.log(`🐛 SubtitleService debug mode: ${enabled ? 'ENABLED' : 'DISABLED'}`);
  }

  // Check STT service health
  async checkHealth() {
    try {
      const response = await API.get('/stt-health');
      console.log('🏥 STT Health Check:', response.data);
      return response.data;
    } catch (error) {
      console.error('🏥 STT Health Check Failed:', error);
      return { status: 'error', error: error.message };
    }
  }

  // Debug version for testing without API keys
  async speechToTextDebug(audioBlob, language = 'auto', translate = false) {
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob);
      formData.append('language', language);
      formData.append('translate', translate.toString());
      
      const response = await API.post('/stt-debug', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      return { 
        success: true, 
        data: { 
          reply: response.data.transcription,
          transcription: response.data.transcription,
          language: response.data.language,
          translate: response.data.translate,
          debug: true
        }
      };
    } catch (error) {
      console.error('Subtitle STT Debug Error:', error.response?.data || error.message);
      return { 
        success: false, 
        error: error.response?.data?.error || error.response?.data?.details || 'Failed to convert speech to text' 
      };
    }
  }

  // Translate text using your translation endpoint
  async translateText(text, sourceLanguage = 'auto', targetLanguage = 'en') {
    try {
      const response = await API.post('/translate', {
        text,
        sourceLanguage,
        targetLanguage
      });
      
      return { 
        success: true, 
        data: response.data 
      };
    } catch (error) {
      console.error('Subtitle Translation Error:', error.response?.data || error.message);
      return { 
        success: false, 
        error: error.response?.data?.error || 'Translation failed' 
      };
    }
  }

  // Text-to-speech for multilingual audio replacement
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
      console.error('Subtitle TTS Error:', error.response?.data || error.message);
      return { 
        success: false, 
        error: error.response?.data?.error || 'Failed to convert text to speech' 
      };
    }
  }
}

export default new SubtitleService();