// Audio format converter for Groq STT compatibility
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Convert WebM audio to WAV format using FFmpeg
 * @param {Buffer} webmBuffer - WebM audio buffer
 * @returns {Promise<Buffer>} - WAV audio buffer
 */
export async function convertWebMToWAV(webmBuffer) {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', [
      '-i', 'pipe:0',           // Input from stdin
      '-f', 'wav',              // Output format WAV
      '-acodec', 'pcm_s16le',   // PCM 16-bit little-endian
      '-ar', '16000',           // Sample rate 16kHz (good for speech)
      '-ac', '1',               // Mono channel
      'pipe:1'                  // Output to stdout
    ]);

    let outputBuffer = Buffer.alloc(0);
    let errorOutput = '';

    // Collect output data
    ffmpeg.stdout.on('data', (chunk) => {
      outputBuffer = Buffer.concat([outputBuffer, chunk]);
    });

    // Collect error output
    ffmpeg.stderr.on('data', (chunk) => {
      errorOutput += chunk.toString();
    });

    // Handle completion
    ffmpeg.on('close', (code) => {
      if (code === 0) {
        resolve(outputBuffer);
      } else {
        console.error('FFmpeg error output:', errorOutput);
        reject(new Error(`FFmpeg conversion failed with code ${code}: ${errorOutput}`));
      }
    });

    // Handle errors
    ffmpeg.on('error', (error) => {
      reject(new Error(`FFmpeg spawn error: ${error.message}`));
    });

    // Send input data
    ffmpeg.stdin.write(webmBuffer);
    ffmpeg.stdin.end();
  });
}

/**
 * Convert WebM audio to MP3 format (alternative)
 * @param {Buffer} webmBuffer - WebM audio buffer
 * @returns {Promise<Buffer>} - MP3 audio buffer
 */
export async function convertWebMToMP3(webmBuffer) {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', [
      '-i', 'pipe:0',           // Input from stdin
      '-f', 'mp3',              // Output format MP3
      '-acodec', 'libmp3lame',  // MP3 codec
      '-ar', '16000',           // Sample rate 16kHz
      '-ac', '1',               // Mono channel
      '-q:a', '2',              // High quality
      'pipe:1'                  // Output to stdout
    ]);

    let outputBuffer = Buffer.alloc(0);
    let errorOutput = '';

    ffmpeg.stdout.on('data', (chunk) => {
      outputBuffer = Buffer.concat([outputBuffer, chunk]);
    });

    ffmpeg.stderr.on('data', (chunk) => {
      errorOutput += chunk.toString();
    });

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        resolve(outputBuffer);
      } else {
        console.error('FFmpeg error output:', errorOutput);
        reject(new Error(`FFmpeg conversion failed with code ${code}: ${errorOutput}`));
      }
    });

    ffmpeg.on('error', (error) => {
      reject(new Error(`FFmpeg spawn error: ${error.message}`));
    });

    ffmpeg.stdin.write(webmBuffer);
    ffmpeg.stdin.end();
  });
}

/**
 * Check if FFmpeg is available
 * @returns {Promise<boolean>} - True if FFmpeg is available
 */
export async function checkFFmpegAvailable() {
  return new Promise((resolve) => {
    const ffmpeg = spawn('ffmpeg', ['-version']);
    
    ffmpeg.on('close', (code) => {
      resolve(code === 0);
    });
    
    ffmpeg.on('error', () => {
      resolve(false);
    });
  });
}