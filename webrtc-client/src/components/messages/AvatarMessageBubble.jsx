import React, { useState } from 'react';
import { Bot, Play, ExternalLink, Clock, FileText, Video } from 'lucide-react';
import { isAvatarMessage } from '../../api/messageService';

/**
 * Avatar Message Bubble Component
 * Renders avatar messages with special formatting for titles, segments, and video links
 */
const AvatarMessageBubble = ({ message }) => {
  const [expandedClips, setExpandedClips] = useState(new Set());

  if (!isAvatarMessage(message)) {
    return null;
  }

  // Handle welcome message with special styling
  if (message.isWelcome) {
    return (
      <div className="flex items-start space-x-3 mb-4">
        <div className="flex-shrink-0">
          <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
            <Bot className="w-5 h-5 text-white" />
          </div>
        </div>
        <div className="flex flex-col">
          <div className="flex items-center space-x-2 mb-2">
            <span className="text-sm font-bold text-blue-600">Avatar</span>
            <span className="px-2 py-0.5 text-xs font-medium bg-gradient-to-r from-blue-100 to-purple-100 text-blue-700 rounded-full">
              AI Assistant
            </span>
            <span className="text-xs text-gray-500">
              {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4 max-w-lg border border-blue-200 shadow-sm">
            <div className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">
              {message.text}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Handle typing indicator
  if (message.isTyping) {
    return (
      <div className="flex items-start space-x-3 mb-3">
        <div className="flex-shrink-0">
          <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
            <Bot className="w-4 h-4 text-white" />
          </div>
        </div>
        <div className="flex flex-col">
          <div className="flex items-center space-x-2 mb-1">
            <span className="text-sm font-medium text-blue-600">Avatar</span>
            <span className="text-xs text-gray-500">
              {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-3 max-w-md border border-blue-100">
            <div className="flex items-center space-x-2">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
              </div>
              <span className="text-sm text-blue-600 font-medium">Thinking...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const toggleClipExpansion = (index) => {
    const newExpanded = new Set(expandedClips);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedClips(newExpanded);
  };

  const parseAvatarMessage = (text) => {
    const lines = text.split('\n').filter(line => line.trim() !== '');
    const parsed = {
      greeting: '',
      clips: []
    };

    let currentClip = null;
    let greetingLines = [];
    let isInClip = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (line.startsWith('Title:')) {
        // Save previous clip if exists
        if (currentClip) {
          parsed.clips.push(currentClip);
        }
        
        // Start new clip
        currentClip = {
          title: line.replace('Title:', '').trim(),
          segmentText: '',
          videoLink: '',
          index: parsed.clips.length
        };
        isInClip = true;
      } else if (line.startsWith('Segment Text:') && currentClip) {
        currentClip.segmentText = line.replace('Segment Text:', '').trim();
      } else if (line.startsWith('Video Link:') && currentClip) {
        currentClip.videoLink = line.replace('Video Link:', '').trim();
      } else if (!isInClip) {
        greetingLines.push(line);
      }
    }

    // Add last clip
    if (currentClip) {
      parsed.clips.push(currentClip);
    }

    parsed.greeting = greetingLines.join(' ').trim();

    return parsed;
  };

  const parsedMessage = parseAvatarMessage(message.text);

  const handleVideoClick = (videoUrl) => {
    if (videoUrl && videoUrl !== 'Video URL not available' && videoUrl !== 'Error generating video URL') {
      window.open(videoUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  };

  return (
    <div className="flex items-start space-x-3 mb-4 group">
      {/* Avatar Profile */}
      <div className="flex-shrink-0 relative">
        <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center shadow-lg ring-2 ring-blue-100">
          <Bot className="w-5 h-5 text-white" />
        </div>
        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white shadow-sm">
          <div className="w-full h-full bg-green-400 rounded-full animate-pulse"></div>
        </div>
      </div>

      {/* Message Content */}
      <div className="flex-1 min-w-0">
        {/* Avatar Header */}
        <div className="flex items-center space-x-2 mb-2">
          <span className="font-bold text-gray-900">Avatar</span>
          <span className="px-2 py-0.5 text-xs font-medium bg-gradient-to-r from-blue-100 to-purple-100 text-blue-700 rounded-full">
            AI Assistant
          </span>
          <span className="text-xs text-gray-500 flex items-center">
            <Clock className="w-3 h-3 mr-1" />
            {formatTimestamp(message.timestamp || message.createdAt)}
          </span>
        </div>

        {/* Avatar Response Container */}
        <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl rounded-tl-sm p-4 border border-blue-100 shadow-sm">
          {/* Greeting Text */}
          {parsedMessage.greeting && (
            <div className="mb-4">
              <p className="text-gray-800 leading-relaxed">
                {parsedMessage.greeting.split('@').map((part, index) => {
                  if (index === 0) return part;
                  const [mention, ...rest] = part.split(' ');
                  return (
                    <span key={index}>
                      <span className="bg-gradient-to-r from-yellow-200 to-yellow-300 text-yellow-800 font-semibold px-1 py-0.5 rounded">
                        @{mention}
                      </span>
                      {rest.length > 0 && ' ' + rest.join(' ')}
                    </span>
                  );
                })}
              </p>
            </div>
          )}

          {/* Video Clips */}
          {parsedMessage.clips.length > 0 && (
            <div className="space-y-3">
              {parsedMessage.clips.map((clip, index) => {
                const isExpanded = expandedClips.has(index);
                const hasValidVideo = clip.videoLink && 
                  clip.videoLink !== 'Video URL not available' && 
                  clip.videoLink !== 'Error generating video URL' &&
                  clip.videoLink !== 'URL not available' &&
                  clip.videoLink !== 'Video URL format not supported';

                return (
                  <div 
                    key={index} 
                    className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200"
                  >
                    {/* Clip Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center space-x-2 flex-1 min-w-0">
                        <Video className="w-4 h-4 text-blue-500 flex-shrink-0" />
                        <h4 className="font-semibold text-gray-900 text-sm truncate">
                          {clip.title || 'Untitled Clip'}
                        </h4>
                      </div>
                      <button
                        onClick={() => toggleClipExpansion(index)}
                        className="ml-2 px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                      >
                        {isExpanded ? 'Less' : 'More'}
                      </button>
                    </div>

                    {/* Segment Text */}
                    <div className="mb-3">
                      <div className="flex items-center space-x-1 mb-1">
                        <FileText className="w-3 h-3 text-gray-400" />
                        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                          Segment
                        </span>
                      </div>
                      <p className={`text-sm text-gray-700 leading-relaxed ${
                        isExpanded ? '' : 'overflow-hidden'
                      }`}
                      style={!isExpanded ? {
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical'
                      } : {}}>
                        {clip.segmentText || 'No description available'}
                      </p>
                    </div>

                    {/* Video Link */}
                    <div className="flex items-center justify-between">
                      {hasValidVideo ? (
                        <button
                          onClick={() => handleVideoClick(clip.videoLink)}
                          className="flex items-center space-x-2 px-3 py-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-lg text-sm font-medium transition-all duration-200 shadow-sm hover:shadow-md transform hover:scale-[1.02]"
                        >
                          <Play className="w-4 h-4" />
                          <span>Watch Video</span>
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      ) : (
                        <div className="flex items-center space-x-2 px-3 py-2 bg-gray-100 text-gray-500 rounded-lg text-sm">
                          <Video className="w-4 h-4" />
                          <span>Video unavailable</span>
                        </div>
                      )}

                      {hasValidVideo && (
                        <div className="text-xs text-gray-400">
                          Click to open video
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* No clips fallback */}
          {parsedMessage.clips.length === 0 && !parsedMessage.greeting && (
            <div className="text-center py-4">
              <div className="text-gray-500 text-sm">
                No content available for this response
              </div>
            </div>
          )}
        </div>

        {/* Avatar Data Debug (only in development) */}
        {process.env.NODE_ENV === 'development' && message.avatarData && (
          <details className="mt-2 text-xs text-gray-400">
            <summary className="cursor-pointer hover:text-gray-600">
              Avatar Debug Data
            </summary>
            <pre className="mt-1 p-2 bg-gray-100 rounded text-xs overflow-auto max-h-20">
              {JSON.stringify(message.avatarData, null, 2)}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
};

export default AvatarMessageBubble;