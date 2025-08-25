// Real-time speech processing module
// Exports STT, TTS, and Translation functions

export { transcribeAudio } from './stt.js';
export { generateAudio, getVoices } from './tts.js';
export { 
  translateText, 
  detectLanguage, 
  getSupportedLanguages 
} from './translate.js';