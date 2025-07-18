// stt.js
import fs from 'fs';
import os from 'os';
import path from 'path';
import Groq from 'groq-sdk';
import dotenv from 'dotenv';

dotenv.config();
const GROQ_API_KEY = process.env.GROQ_API_KEY;

// Only initialize Groq if API key is provided
let client = null;
if (GROQ_API_KEY) {
  client = new Groq({ apiKey: GROQ_API_KEY });
}

/**
 * Transcribes (or translates) an audio buffer via Groq Whisper.
 * @param {Buffer} audioBuffer  Raw 16-bit PCM audio data (WAV-compatible).
 * @param {Object} opts
 * @param {number} opts.sampleRate  Sampling rate, e.g. 16000
 * @param {string} opts.prompt      Optional prompt to guide Whisper
 * @param {string} opts.language    ISO code or 'auto'
 * @param {boolean} opts.translate  If true, do translation
 * @returns {Promise<string>}  The trimmed transcript
 */
export async function transcribeAudio(
  audioBuffer,
  {
    sampleRate = 16000,
    prompt     = '',
    language   = 'auto',
    translate  = false
  } = {}
) {
  if (!client) {
    throw new Error('GROQ_API_KEY not set - speech-to-text functionality unavailable');
  }

  // 1) dump to temp WAV file
  const tmpPath = path.join(os.tmpdir(), `groq-${Date.now()}.wav`);
  // If your audioBuffer is already a .wav file, you can skip the header
  await fs.promises.writeFile(tmpPath, audioBuffer);

  // 2) pick the right model
  const modelName = translate
    ? 'whisper-large-v3'
    : 'whisper-large-v3-turbo';

  // 3) call the Groq API
  let result;
  const fileStream = fs.createReadStream(tmpPath);
  if (translate) {
    result = await client.audio.translations.create({
      file: fileStream,
      model: modelName,
      prompt,
      response_format: 'text',
      temperature: 0.0
    });
  } else {
    // Build the options object without a null field
    const opts = {
      file: fileStream,
      model: modelName,
      prompt,
      response_format: 'text',
      temperature: 0.0
    };
    // Only include language if user requested a specific one
    if (!translate && language !== 'auto') {
      opts.language = language;
    }

    result = await client.audio.transcriptions.create(opts);
  }

  // 4) clean up
  await fs.promises.unlink(tmpPath);

  // 5) extract the text
  if (typeof result === 'string') return result.trim();
  return (result.text || '').trim();
}