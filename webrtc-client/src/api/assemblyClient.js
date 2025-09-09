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
      const url = `wss://streaming.assemblyai.com/v3/ws?sample_rate=${this.sampleRate}&token=${token}`;
      console.log('🔗 Connecting to AssemblyAI WebSocket with token...');

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
            
            if (evt.type === 'Begin') {
              console.log('🎬 AssemblyAI session started:', evt.id);
            } else if (evt.type === 'Turn') {
              if (evt.end_of_turn) {
                // Final transcript - only log if there's actual text
                if (evt.transcript?.trim()) {
                  console.log('📨 AssemblyAI Final:', evt.transcript);
                }
                this.onFinal && this.onFinal({ text: evt.transcript });
              } else {
                // Partial transcript - don't log to reduce noise
                this.onPartial && this.onPartial({ text: evt.transcript });
              }
            } else if (evt.type === 'Termination') {
              console.log('🏁 AssemblyAI session terminated');
            } else if (evt.type === 'Error') {
              console.error('❌ AssemblyAI error:', evt);
              this.onError && this.onError(new Error(evt.error || 'AssemblyAI error'));
            } else {
              console.log('🤔 Unknown AssemblyAI message type:', evt.type, evt);
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
    
    // Send raw binary data directly (not base64)
    this.ws.send(int16.buffer);
    
    // Removed repetitive audio frame logging - too verbose
  }

  close() {
    try { this.ws && this.ws.close(); } catch {}
  }
}

export default AssemblyRealtimeClient;


