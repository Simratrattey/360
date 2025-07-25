// src/components/AvatarSidebar.jsx
import React from 'react';

export default function AvatarSidebar({
  clips,
  index,
  transcript,
  askText,
  setAskText,
  onAskText,
  onStartAudio,
  onStopAudio,
  isRecording,
  onPrev,
  onNext,
  onClose
}) {
  const clipUrl = clips[index]?.videoUrl;

  return (
    <div className="fixed top-0 right-0 h-full w-80 bg-white shadow-xl z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h2 className="text-lg font-semibold">Your Avatar</h2>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
          ✕
        </button>
      </div>

      {/* Scrollable body */}
      <div className="px-4 py-3 flex-1 overflow-auto space-y-4">
        {/* Video container */}
        <div className="w-full h-40 bg-gray-200 rounded overflow-hidden">
          {clipUrl ? (
            <video
              key={clipUrl}
              src={clipUrl}
              controls
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-500">
              No video yet
            </div>
          )}
        </div>

        {/* Transcript display */}
        <div className="min-h-[4rem] p-2 bg-gray-50 border rounded">
          {transcript || <span className="text-gray-400">Transcript will appear here…</span>}
        </div>

        {/* Text‑ask */}
        <textarea
          className="w-full h-20 p-2 border rounded resize-none focus:outline-none focus:ring"
          value={askText}
          onChange={e => setAskText(e.target.value)}
          placeholder="Type your question…"
        />
        <button
          onClick={onAskText}
          disabled={!askText.trim()}
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          Ask Avatar
        </button>

        {/* Audio‑ask */}
        <div className="flex space-x-2">
          <button
            onClick={onStartAudio}
            disabled={isRecording}
            className="flex-1 bg-green-500 text-white py-2 rounded hover:bg-green-600 disabled:opacity-50"
          >
            Start Talking
          </button>
          <button
            onClick={onStopAudio}
            disabled={!isRecording}
            className="flex-1 bg-red-500 text-white py-2 rounded hover:bg-red-600 disabled:opacity-50"
          >
            Stop Talking
          </button>
        </div>
      </div>

      {/* Footer nav */}
      <div className="px-4 py-3 border-t flex justify-between">
        <button
          onClick={onPrev}
          disabled={index <= 0}
          className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
        >
          ← Prev
        </button>
        <button
          onClick={onNext}
          disabled={index >= clips.length - 1}
          className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
        >
          Next →
        </button>
      </div>
    </div>
  );
}