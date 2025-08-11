// Speech-to-Text using Groq API (converted from Python)
import axios from 'axios';
import FormData from 'form-data';

export async function transcribeAudio(audioBuffer, options = {}) {
  const {
    prompt = '',
    language = 'auto',
    translate = false
  } = options;

  try {
    const formData = new FormData();
    formData.append('file', audioBuffer, {
      filename: 'audio.wav',
      contentType: 'audio/wav'
    });
    
    // Select model based on translate flag (matching Python logic)
    const model = translate ? 'whisper-large-v3' : 'whisper-large-v3-turbo';
    formData.append('model', model);
    formData.append('response_format', 'text');
    formData.append('temperature', '0.0');
    
    if (language !== 'auto') {
      formData.append('language', language);
    }
    
    if (prompt) {
      formData.append('prompt', prompt);
    }

    // Choose endpoint based on translate flag
    const endpoint = translate 
      ? 'https://api.groq.com/openai/v1/audio/translations'
      : 'https://api.groq.com/openai/v1/audio/transcriptions';

    const response = await axios.post(
      endpoint,
      formData,
      {
        headers: {
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
          ...formData.getHeaders()
        },
        timeout: 30000
      }
    );

    // Handle response (Groq returns plain text with response_format: 'text')
    if (typeof response.data === 'string') {
      return response.data.trim();
    } else if (response.data && response.data.text) {
      return response.data.text.trim();
    } else {
      throw new Error('No transcription text received');
    }

  } catch (error) {
    console.error('Groq STT Error:', error.response?.data || error.message);
    throw new Error(`Speech-to-text failed: ${error.message}`);
  }
}