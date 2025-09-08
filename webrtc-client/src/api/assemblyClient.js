import API from './client';

// Simple AssemblyAI realtime client wrapper
export class AssemblyRealtimeClient {
  constructor({ sampleRate = 16000, onPartial, onFinal, onError, onClose }) {
    this.sampleRate = sampleRate;
    this.onPartial = onPartial;
    this.onFinal = onFinal;
    this.onError = onError;
    this.onClose = onClose;
    this.ws = null;
  }

  async connect() {
    try {
      console.log('🔑 Requesting AssemblyAI token...');
      const { data } = await API.post('/stt/token');
      const token = data?.token;
      
      if (!token) {
        console.error('❌ No AssemblyAI token received:', data);
        throw new Error('No AssemblyAI token received from server');
      }
      
      console.log('✅ Token received, length:', token.length);
      const url = `wss://api.assemblyai.com/v2/realtime/ws?sample_rate=${this.sampleRate}&token=${encodeURIComponent(token)}`;
      console.log('🔗 Connecting to AssemblyAI WebSocket...');

      return new Promise((resolve, reject) => {
        const ws = new WebSocket(url);
        this.ws = ws;
        
        ws.onopen = () => {
          console.log('✅ AssemblyAI WebSocket connected successfully');
          resolve();
        };
        
        ws.onerror = (e) => {
          console.error('❌ AssemblyAI WebSocket error:', e);
          this.onError && this.onError(e);
          reject(e);
        };
        
        ws.onclose = (event) => {
          console.log('🔌 AssemblyAI WebSocket closed:', {
            code: event.code,
            reason: event.reason,
            wasClean: event.wasClean
          });
          this.onClose && this.onClose();
        };
        
        ws.onmessage = (msg) => {
          try {
            const evt = JSON.parse(msg.data);
            console.log('📨 AssemblyAI message:', evt.message_type, evt.text || '');
            
            if (evt.message_type === 'partial_transcript') {
              this.onPartial && this.onPartial(evt);
            } else if (evt.message_type === 'final_transcript') {
              this.onFinal && this.onFinal(evt);
            } else if (evt.message_type === 'error') {
              console.error('❌ AssemblyAI error message:', evt);
              this.onError && this.onError(new Error(evt.error || 'AssemblyAI error'));
            }
          } catch (err) {
            console.error('❌ Error parsing AssemblyAI message:', err, msg.data);
            this.onError && this.onError(err);
          }
        };
      });
    } catch (error) {
      console.error('❌ AssemblyAI connect error:', error);
      throw error;
    }
  }

  // Send Int16Array PCM frame (mono, sampleRate)
  sendPcmFrame(int16) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const base64 = btoa(
      String.fromCharCode(...new Uint8Array(int16.buffer))
    );
    this.ws.send(JSON.stringify({ audio_data: base64 }));
  }

  close() {
    try { this.ws && this.ws.close(); } catch {}
  }
}

export default AssemblyRealtimeClient;


