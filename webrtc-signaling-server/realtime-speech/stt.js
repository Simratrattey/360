// Speech-to-Text using Groq API (converted from Python)
import axios from 'axios';
import FormData from 'form-data';
import { convertWebMToWAV, checkFFmpegAvailable } from './audioConverter.js';

export async function transcribeAudio(audioBuffer, options = {}) {
  const {
    prompt = '',
    language = 'auto',
    translate = false
  } = options;

  try {
    let processedAudioBuffer = audioBuffer;
    let filename = 'audio.webm';
    let contentType = 'audio/webm';

    // Try multiple approaches for audio format compatibility
    try {
      // First, try FFmpeg conversion if available
      const ffmpegAvailable = await checkFFmpegAvailable();
      if (ffmpegAvailable) {
        console.log('Converting WebM to WAV using FFmpeg...');
        processedAudioBuffer = await convertWebMToWAV(audioBuffer);
        filename = 'audio.wav';
        contentType = 'audio/wav';
        console.log(`FFmpeg converted audio: ${audioBuffer.length} bytes → ${processedAudioBuffer.length} bytes`);
      } else {
        console.log('FFmpeg not available, trying alternative formats...');
        
        // Try sending as different formats based on audio signature
        const signature = audioBuffer.toString('hex', 0, 8);
        console.log('Audio signature:', signature);
        
        // WebM signature: 1a45dfa3
        if (signature.includes('1a45dfa3')) {
          // Try sending as audio/webm
          filename = 'audio.webm';
          contentType = 'audio/webm';
          console.log('Detected WebM format, sending as-is');
        }
        // WAV signature: 52494646...57415645
        else if (signature.includes('52494646')) {
          filename = 'audio.wav';
          contentType = 'audio/wav';
          console.log('Detected WAV format');
        }
        // MP3 signature: 494433 or fffb
        else if (signature.includes('494433') || signature.includes('fffb')) {
          filename = 'audio.mp3';
          contentType = 'audio/mpeg';
          console.log('Detected MP3 format');
        }
        // OGG signature: 4f676753
        else if (signature.includes('4f676753')) {
          filename = 'audio.ogg';
          contentType = 'audio/ogg';
          console.log('Detected OGG format');
        }
        else {
          // Default fallback - try as MP3 since Groq supports it
          filename = 'audio.mp3';
          contentType = 'audio/mpeg';
          console.log('Unknown format, trying as MP3');
        }
      }
    } catch (conversionError) {
      console.warn('Audio processing failed, using original format:', conversionError.message);
      // Continue with original audio
    }

    const formData = new FormData();
    formData.append('file', processedAudioBuffer, {
      filename,
      contentType
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