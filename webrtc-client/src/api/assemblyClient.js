import { StreamingTranscriber } from 'assemblyai';
import API from './client';

// Official AssemblyAI realtime client using their JavaScript SDK
export class AssemblyRealtimeClient {
  constructor({ 
    sampleRate = 16000, 
    onPartial, 
    onFinal, 
    onError, 
    onClose,
    speakerDiarization = false,
    endOfTurnSilence = 700 // ms
  }) {
    this.sampleRate = sampleRate;
    this.onPartial = onPartial;
    this.onFinal = onFinal;
    this.onError = onError;
    this.onClose = onClose;
    this.speakerDiarization = speakerDiarization;
    this.endOfTurnSilence = endOfTurnSilence;
    this.transcriber = null;
    this.isConnected = false;
    this.sessionId = null;
  }

  async connect() {
    try {
      console.log('🔑 Requesting AssemblyAI token (1 hour expiry)...');
      const { data } = await API.post('/stt/token', { expires_in_seconds: 3600 });
      const token = data?.token;
      
      if (!token) {
        console.error('❌ No AssemblyAI token received:', data);
        throw new Error('No AssemblyAI token received from server');
      }
      
      console.log('✅ Token received, setting up official AssemblyAI SDK transcriber');
      
      // Create official AssemblyAI StreamingTranscriber instance
      this.transcriber = new StreamingTranscriber({
        token,
        sampleRate: this.sampleRate,
        ...(this.speakerDiarization && { speaker_labels: true }),
        ...(this.endOfTurnSilence !== 700 && { end_utterance_silence_threshold: this.endOfTurnSilence })
      });

      // Set up event handlers following official SDK pattern
      this.transcriber.on('open', ({ id, expires_at }) => {
        this.sessionId = id;
        this.isConnected = true;
        console.log('🎬 Official AssemblyAI session started:', { id, expires_at });
      });

      this.transcriber.on('turn', (evt) => {
        const { text, is_final, speaker } = evt;
        
        if (is_final) {
          // Final transcript - only log if there's actual text
          if (text?.trim()) {
            const speakerInfo = speaker ? ` (Speaker ${speaker})` : '';
            console.log(`📨 AssemblyAI Final${speakerInfo}:`, text);
          }
          this.onFinal && this.onFinal({ 
            text, 
            speaker,
            confidence: evt.confidence 
          });
        } else {
          // Partial transcript - don't log to reduce noise
          this.onPartial && this.onPartial({ 
            text, 
            speaker,
            confidence: evt.confidence 
          });
        }
      });

      this.transcriber.on('close', (code, reason) => {
        console.log('🔌 AssemblyAI session closed:', { code, reason, sessionId: this.sessionId });
        this.isConnected = false;
        this.onClose && this.onClose({ code, reason });
      });

      this.transcriber.on('error', (error) => {
        console.error('❌ AssemblyAI error:', error);
        this.onError && this.onError(error);
      });

      // Connect using official SDK
      console.log('🔗 Connecting with official AssemblyAI SDK...');
      await this.transcriber.connect();
      console.log('✅ Official AssemblyAI SDK connected successfully');
      
    } catch (error) {
      console.error('❌ AssemblyAI connect error:', error);
      throw error;
    }
  }

  // Send Int16Array PCM frame (mono, sampleRate) using official SDK
  sendPcmFrame(int16) {
    if (!this.transcriber || !this.isConnected) return;
    
    try {
      // Use official SDK's send method for audio data
      this.transcriber.sendAudio(int16);
    } catch (error) {
      console.warn('Error sending audio to AssemblyAI:', error);
    }
  }

  async close() {
    try { 
      if (this.transcriber && this.isConnected) {
        console.log(`🔌 Closing official AssemblyAI session ${this.sessionId}`);
        await this.transcriber.close();
      }
      this.isConnected = false;
      this.sessionId = null;
    } catch (error) {
      console.warn('Error closing AssemblyAI client:', error);
    }
  }
}

export default AssemblyRealtimeClient;


