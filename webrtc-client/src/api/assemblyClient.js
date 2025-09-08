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
    const { data } = await API.post('/stt/token');
    const token = data?.token;
    if (!token) throw new Error('No AssemblyAI token');
    const url = `wss://api.assemblyai.com/v2/realtime/ws?sample_rate=${this.sampleRate}&token=${encodeURIComponent(token)}`;

    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url);
      this.ws = ws;
      ws.onopen = () => resolve();
      ws.onerror = (e) => {
        this.onError && this.onError(e);
        reject(e);
      };
      ws.onclose = () => this.onClose && this.onClose();
      ws.onmessage = (msg) => {
        try {
          const evt = JSON.parse(msg.data);
          if (evt.message_type === 'partial_transcript') {
            this.onPartial && this.onPartial(evt);
          } else if (evt.message_type === 'final_transcript') {
            this.onFinal && this.onFinal(evt);
          }
        } catch (err) {
          this.onError && this.onError(err);
        }
      };
    });
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


