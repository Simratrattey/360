import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Play, Pause, Square, Send, X, Volume2 } from 'lucide-react';

const VoiceRecorder = ({ onSend, onCancel, className = '' }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [hasRecording, setHasRecording] = useState(false);
  const [volume, setVolume] = useState(0);
  
  const mediaRecorderRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const dataArrayRef = useRef(null);
  const animationFrameRef = useRef(null);
  const audioRef = useRef(null);
  const streamRef = useRef(null);
  const intervalRef = useRef(null);

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      // Setup audio context for volume visualization
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      
      analyserRef.current.fftSize = 256;
      const bufferLength = analyserRef.current.frequencyBinCount;
      dataArrayRef.current = new Uint8Array(bufferLength);
      
      // Start volume monitoring
      const updateVolume = () => {
        if (analyserRef.current && dataArrayRef.current) {
          analyserRef.current.getByteFrequencyData(dataArrayRef.current);
          const average = dataArrayRef.current.reduce((a, b) => a + b) / dataArrayRef.current.length;
          setVolume(Math.min(100, (average / 255) * 100));
          
          if (isRecording && !isPaused) {
            animationFrameRef.current = requestAnimationFrame(updateVolume);
          }
        }
      };
      updateVolume();
      
      // Setup MediaRecorder
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      
      const chunks = [];
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        setHasRecording(true);
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorder.start();
      setIsRecording(true);
      setDuration(0);
      
      // Start duration timer
      intervalRef.current = setInterval(() => {
        setDuration(prev => prev + 0.1);
      }, 100);
      
    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Could not access microphone. Please check permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
      
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      
      setVolume(0);
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      if (isPaused) {
        mediaRecorderRef.current.resume();
        setIsPaused(false);
        // Resume timer
        intervalRef.current = setInterval(() => {
          setDuration(prev => prev + 0.1);
        }, 100);
      } else {
        mediaRecorderRef.current.pause();
        setIsPaused(true);
        // Pause timer
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      }
    }
  };

  const playRecording = () => {
    if (audioRef.current && audioUrl) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  const handleSend = () => {
    if (audioBlob && onSend) {
      onSend({
        file: audioBlob,
        type: 'audio',
        duration: duration,
        name: `voice-message-${Date.now()}.webm`
      });
    }
  };

  const handleCancel = () => {
    if (isRecording) {
      stopRecording();
    }
    
    // Cleanup
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    
    setAudioBlob(null);
    setAudioUrl(null);
    setHasRecording(false);
    setDuration(0);
    setVolume(0);
    
    if (onCancel) {
      onCancel();
    }
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`bg-white border border-gray-200 rounded-lg p-4 shadow-lg ${className}`}>
      <div className="flex items-center space-x-4">
        {/* Recording/Playback Controls */}
        <div className="flex items-center space-x-2">
          {!hasRecording ? (
            // Recording controls
            <>
              <button
                onClick={isRecording ? stopRecording : startRecording}
                className={`p-3 rounded-full transition-all duration-200 ${
                  isRecording
                    ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse'
                    : 'bg-blue-500 hover:bg-blue-600 text-white'
                }`}
                title={isRecording ? 'Stop recording' : 'Start recording'}
              >
                {isRecording ? <Square className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              </button>
              
              {isRecording && (
                <button
                  onClick={pauseRecording}
                  className="p-2 rounded-full bg-gray-200 hover:bg-gray-300 text-gray-700 transition-colors"
                  title={isPaused ? 'Resume recording' : 'Pause recording'}
                >
                  {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                </button>
              )}
            </>
          ) : (
            // Playback controls
            <button
              onClick={playRecording}
              className="p-3 rounded-full bg-green-500 hover:bg-green-600 text-white transition-colors"
              title={isPlaying ? 'Pause playback' : 'Play recording'}
            >
              {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
            </button>
          )}
        </div>

        {/* Duration and Volume Display */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-3">
            <span className="text-sm font-mono text-gray-600">
              {formatDuration(duration)}
            </span>
            
            {/* Volume Indicator */}
            {isRecording && !isPaused && (
              <div className="flex items-center space-x-2 flex-1">
                <Volume2 className="h-4 w-4 text-gray-500" />
                <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-green-400 to-blue-500 transition-all duration-100"
                    style={{ width: `${volume}%` }}
                  />
                </div>
              </div>
            )}
            
            {/* Waveform placeholder for playback */}
            {hasRecording && (
              <div className="flex items-center space-x-1 flex-1">
                {Array.from({ length: 20 }, (_, i) => (
                  <div
                    key={i}
                    className="w-1 bg-blue-300 rounded-full transition-all duration-200"
                    style={{
                      height: `${Math.random() * 20 + 8}px`,
                      opacity: isPlaying ? 0.8 : 0.4
                    }}
                  />
                ))}
              </div>
            )}
          </div>
          
          {/* Recording status */}
          {isRecording && (
            <div className="text-xs text-gray-500 mt-1">
              {isPaused ? 'Recording paused' : 'Recording...'}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2">
          {hasRecording && (
            <button
              onClick={handleSend}
              className="p-2 rounded-full bg-blue-500 hover:bg-blue-600 text-white transition-colors"
              title="Send voice message"
            >
              <Send className="h-4 w-4" />
            </button>
          )}
          
          <button
            onClick={handleCancel}
            className="p-2 rounded-full bg-gray-200 hover:bg-gray-300 text-gray-700 transition-colors"
            title="Cancel"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Hidden audio element for playback */}
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          onEnded={() => setIsPlaying(false)}
          style={{ display: 'none' }}
        />
      )}
    </div>
  );
};

export default VoiceRecorder;