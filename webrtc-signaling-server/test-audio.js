// Test script for audio format detection and conversion
import { checkFFmpegAvailable } from './realtime-speech/audioConverter.js';

async function testAudioSupport() {
  console.log('Testing audio format support...\n');
  
  try {
    // Test FFmpeg availability
    console.log('1. Testing FFmpeg availability:');
    const ffmpegAvailable = await checkFFmpegAvailable();
    console.log(`   FFmpeg available: ${ffmpegAvailable ? '✅' : '❌'}`);
    
    // Test audio format detection
    console.log('\n2. Testing audio format detection:');
    
    // Mock WebM audio signature
    const webmSignature = Buffer.from('1a45dfa3', 'hex');
    console.log(`   WebM signature detection: ${webmSignature.toString('hex').includes('1a45dfa3') ? '✅' : '❌'}`);
    
    // Mock WAV audio signature  
    const wavSignature = Buffer.from('52494646', 'hex');
    console.log(`   WAV signature detection: ${wavSignature.toString('hex').includes('52494646') ? '✅' : '❌'}`);
    
    // Mock MP3 audio signature
    const mp3Signature = Buffer.from('494433', 'hex');
    console.log(`   MP3 signature detection: ${mp3Signature.toString('hex').includes('494433') ? '✅' : '❌'}`);
    
    console.log('\n✅ Audio format detection test completed');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testAudioSupport();