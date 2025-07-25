// src/components/AvatarPanel.jsx
import React from 'react';

export default function AvatarPanel({
  clips,
  index,
  onPrev,
  onNext,
  transcript
}) {
  if (!clips?.length) return null;

  return (
    <div className="absolute bottom-24 right-4 w-80 bg-gray-800 p-4 rounded-lg shadow-xl z-20">
      <div className="mb-2 text-white text-sm">{transcript}</div>
      <video
        key={index}
        src={clips[index].videoUrl}
        controls
        autoPlay
        playsInline
        className="w-full rounded"
      />
      <div className="mt-2 flex justify-between">
        <button
          onClick={onPrev}
          disabled={index === 0}
          className="px-2 py-1 bg-gray-600 rounded disabled:opacity-50 text-white"
        >
          Prev
        </button>
        <button
          onClick={onNext}
          disabled={index === clips.length - 1}
          className="px-2 py-1 bg-gray-600 rounded disabled:opacity-50 text-white"
        >
          Next
        </button>
      </div>
    </div>
  );
}