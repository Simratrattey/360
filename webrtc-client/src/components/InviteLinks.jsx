import React, { useState } from 'react';
import { Copy, Check, Share2, Users, UserCheck, Clock } from 'lucide-react';
import { generateMeetingLinks, copyLinkToClipboard } from '../utils/meetingLinks';

export default function InviteLinks({ roomId, meetingTitle, isHost = false }) {
  const [copiedLink, setCopiedLink] = useState(null);
  const [showLinks, setShowLinks] = useState(false);

  const links = generateMeetingLinks(roomId);

  const handleCopyLink = async (linkType) => {
    const link = linkType === 'direct' ? links.direct : links.waitingRoom;
    const success = await copyLinkToClipboard(link, linkType);
    
    if (success) {
      setCopiedLink(linkType);
      setTimeout(() => setCopiedLink(null), 2000);
    }
  };

  const handleShare = async (linkType) => {
    const link = linkType === 'direct' ? links.direct : links.waitingRoom;
    const title = `Join ${meetingTitle || 'Meeting'}`;
    const text = linkType === 'direct' 
      ? `You're invited to join "${meetingTitle || 'Meeting'}" directly.`
      : `You're invited to join "${meetingTitle || 'Meeting'}". Please wait for host approval.`;

    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text,
          url: link
        });
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error('Error sharing:', error);
        }
      }
    } else {
      // Fallback to copying link
      handleCopyLink(linkType);
    }
  };

  if (!isHost) {
    return null; // Only hosts can see invite links
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowLinks(!showLinks)}
        className="flex items-center gap-2 px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        title="Share Meeting Links"
      >
        <Share2 className="h-4 w-4" />
        <span className="text-sm font-medium">Invite</span>
      </button>

      {showLinks && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40"
            onClick={() => setShowLinks(false)}
          />
          
          {/* Links Panel */}
          <div className="absolute top-full right-0 mt-2 w-96 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
            <div className="p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Share2 className="h-5 w-5" />
                Invite to Meeting
              </h3>

              {/* Direct Link */}
              <div className="mb-4 p-3 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-center gap-2 mb-2">
                  <UserCheck className="h-4 w-4 text-green-600" />
                  <h4 className="font-medium text-green-900">Direct Access Link</h4>
                </div>
                <p className="text-sm text-green-700 mb-3">
                  Invited participants join the meeting immediately without waiting for approval.
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={links.direct}
                    readOnly
                    className="flex-1 px-3 py-2 text-sm bg-white border border-green-300 rounded-md font-mono"
                  />
                  <button
                    onClick={() => handleCopyLink('direct')}
                    className="flex items-center gap-1 px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                    title="Copy direct link"
                  >
                    {copiedLink === 'direct' ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                    <span className="text-sm">
                      {copiedLink === 'direct' ? 'Copied!' : 'Copy'}
                    </span>
                  </button>
                  <button
                    onClick={() => handleShare('direct')}
                    className="p-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                    title="Share direct link"
                  >
                    <Share2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Waiting Room Link */}
              <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="h-4 w-4 text-orange-600" />
                  <h4 className="font-medium text-orange-900">Waiting Room Link</h4>
                </div>
                <p className="text-sm text-orange-700 mb-3">
                  Participants must request approval and wait for host permission before joining.
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={links.waitingRoom}
                    readOnly
                    className="flex-1 px-3 py-2 text-sm bg-white border border-orange-300 rounded-md font-mono"
                  />
                  <button
                    onClick={() => handleCopyLink('waitingRoom')}
                    className="flex items-center gap-1 px-3 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 transition-colors"
                    title="Copy waiting room link"
                  >
                    {copiedLink === 'waitingRoom' ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                    <span className="text-sm">
                      {copiedLink === 'waitingRoom' ? 'Copied!' : 'Copy'}
                    </span>
                  </button>
                  <button
                    onClick={() => handleShare('waitingRoom')}
                    className="p-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 transition-colors"
                    title="Share waiting room link"
                  >
                    <Share2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-gray-200">
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Users className="h-3 w-3" />
                  <span>Meeting ID: {roomId}</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}