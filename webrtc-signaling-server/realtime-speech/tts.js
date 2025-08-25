// Text-to-Speech using ElevenLabs API (converted from Python)
import axios from 'axios';

export async function generateAudio(text, options = {}) {
  const {
    voiceId = null, // Use environment variable or default
    model = 'eleven_flash_v2_5', // Updated to match Python version
    stability = 0.5,
    similarityBoost = 0.7, // Updated to match Python version
    style = 0.0,
    useSpeakerBoost = true
  } = options;

  try {
    if (!text || text.trim().length === 0) {
      throw new Error('Text is required for TTS generation');
    }

    // Use provided voiceId or fall back to environment variable
    const selectedVoiceId = voiceId || process.env.TTS_VOICE_ID || process.env.DEFAULT_VOICE_ID;
    
    if (!selectedVoiceId) {
      throw new Error('TTS_VOICE_ID not set in environment variables');
    }

    // Use streaming endpoint like Python version
    const response = await axios.post(
      `https://api.elevenlabs.io/v1/text-to-speech/${selectedVoiceId}/stream`,
      {
        text: text.trim(),
        model_id: model,
        voice_settings: {
          stability,
          similarity_boost: similarityBoost,
          style,
          use_speaker_boost: useSpeakerBoost
        }
      },
      {
        headers: {
          'xi-api-key': process.env.ELEVENLABS_API_KEY,
          'Content-Type': 'application/json'
        },
        responseType: 'arraybuffer',
        timeout: 10000 // Match Python timeout
      }
    );

    return response;

  } catch (error) {
    console.error('ElevenLabs TTS Error:', error.response?.data || error.message);
    throw new Error(`Text-to-speech failed: ${error.message}`);
  }
}

// Get available voices
export async function getVoices() {
  try {
    const response = await axios.get(
      'https://api.elevenlabs.io/v1/voices',
      {
        headers: {
          'xi-api-key': process.env.ELEVENLABS_API_KEY
        }
      }
    );

    return response.data.voices;
  } catch (error) {
    console.error('ElevenLabs Voices Error:', error.response?.data || error.message);
    throw new Error(`Failed to get voices: ${error.message}`);
  }
}