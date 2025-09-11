import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Calendar as CalendarIcon,
  Clock,
  Users,
  User,
  Video,
  Copy,
  Download,
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  FileText,
  Sparkles,
  RefreshCw
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import API from '../api/client.js';

const MeetingDetailsModal = ({ isOpen, onClose, meetingId }) => {
  const [meeting, setMeeting] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('details'); // 'details', 'summary', or 'transcript'
  const [copySuccess, setCopySuccess] = useState(false);
  const [regeneratingSummary, setRegeneratingSummary] = useState(false);

  useEffect(() => {
    if (isOpen && meetingId) {
      loadMeetingDetails();
    }
  }, [isOpen, meetingId]);

  const loadMeetingDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await API.get(`/meetings/${meetingId}/details`);
      
      if (response.data.success) {
        setMeeting(response.data.meeting);
      } else {
        setError(response.data.error || 'Failed to load meeting details');
      }
    } catch (error) {
      console.error('Error loading meeting details:', error);
      setError(error.response?.data?.error || 'Failed to load meeting details');
    } finally {
      setLoading(false);
    }
  };

  const copyTranscriptToClipboard = () => {
    if (meeting && meeting.transcript) {
      const transcriptText = meeting.transcript
        .map(entry => `[${entry.timestamp}] ${entry.speaker}: ${entry.text}`)
        .join('\n');
      
      navigator.clipboard.writeText(transcriptText).then(() => {
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
      });
    }
  };

  const downloadTranscript = () => {
    if (meeting && meeting.transcript) {
      const transcriptText = meeting.transcript
        .map(entry => `[${entry.timestamp}] ${entry.speaker}: ${entry.text}`)
        .join('\n');
      
      const blob = new Blob([transcriptText], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${meeting.title.replace(/[^a-z0-9]/gi, '_')}_transcript.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const regenerateSummary = async () => {
    try {
      setRegeneratingSummary(true);
      const response = await API.post(`/meetings/${meetingId}/regenerate-summary`);
      
      if (response.data.success) {
        // Update the meeting with the new summary
        setMeeting(prev => ({
          ...prev,
          summary: response.data.summary
        }));
        // Switch to summary tab to show the updated content
        setActiveTab('summary');
      } else {
        console.error('Failed to regenerate summary:', response.data.error);
      }
    } catch (error) {
      console.error('Error regenerating summary:', error);
    } finally {
      setRegeneratingSummary(false);
    }
  };

  const copySummaryToClipboard = () => {
    if (meeting && meeting.summary) {
      navigator.clipboard.writeText(meeting.summary).then(() => {
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
      });
    }
  };

  const downloadSummary = () => {
    if (meeting && meeting.summary) {
      const blob = new Blob([meeting.summary], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${meeting.title.replace(/[^a-z0-9]/gi, '_')}_summary.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const formatTimestamp = (timestamp) => {
    try {
      // Try to parse the timestamp in various formats
      let date;
      if (timestamp.includes('T')) {
        date = new Date(timestamp);
      } else if (timestamp.includes(':')) {
        // Assume it's a time format like "14:30:25"
        const today = new Date();
        const [hours, minutes, seconds] = timestamp.split(':');
        date = new Date(today.getFullYear(), today.getMonth(), today.getDate(), hours, minutes, seconds);
      } else {
        date = new Date(timestamp);
      }
      
      if (isNaN(date.getTime())) {
        return timestamp; // Return original if parsing fails
      }
      
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return timestamp;
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-purple-50">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Meeting Details</h2>
              <p className="text-gray-600 mt-1">View meeting information and transcript</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/50 rounded-lg transition-colors"
            >
              <X className="h-6 w-6 text-gray-500" />
            </button>
          </div>

          {/* Content */}
          <div className="flex flex-col h-[calc(90vh-120px)]">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                <span className="ml-3 text-gray-600">Loading meeting details...</span>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center h-64 text-center">
                <div>
                  <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                  <p className="text-lg font-medium text-gray-900">Error Loading Meeting</p>
                  <p className="text-gray-600 mt-2">{error}</p>
                  <button
                    onClick={loadMeetingDetails}
                    className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            ) : meeting ? (
              <>
                {/* Tab Navigation */}
                <div className="flex border-b border-gray-200">
                  <button
                    onClick={() => setActiveTab('details')}
                    className={`px-6 py-4 font-medium transition-colors ${
                      activeTab === 'details'
                        ? 'border-b-2 border-blue-500 text-blue-600'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <FileText className="h-4 w-4 inline mr-2" />
                    Details
                  </button>
                  <button
                    onClick={() => setActiveTab('summary')}
                    className={`px-6 py-4 font-medium transition-colors ${
                      activeTab === 'summary'
                        ? 'border-b-2 border-blue-500 text-blue-600'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <Sparkles className="h-4 w-4 inline mr-2" />
                    AI Summary
                    {meeting.summary && (
                      <span className="ml-1 text-xs bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full">
                        AI
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => setActiveTab('transcript')}
                    className={`px-6 py-4 font-medium transition-colors ${
                      activeTab === 'transcript'
                        ? 'border-b-2 border-blue-500 text-blue-600'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <MessageSquare className="h-4 w-4 inline mr-2" />
                    Transcript
                    {meeting.hasTranscript && (
                      <span className="ml-1 text-xs bg-green-100 text-green-600 px-2 py-0.5 rounded-full">
                        {meeting.transcript.length}
                      </span>
                    )}
                  </button>
                </div>

                {/* Tab Content */}
                <div className="flex-1 overflow-y-auto">
                  {activeTab === 'details' ? (
                    <div className="p-6 space-y-6">
                      {/* Meeting Title */}
                      <div>
                        <h3 className="text-2xl font-bold text-gray-900">{meeting.title}</h3>
                        {meeting.description && (
                          <p className="text-gray-600 mt-2">{meeting.description}</p>
                        )}
                      </div>

                      {/* Status Badges */}
                      <div className="flex flex-wrap gap-2">
                        <Badge className="bg-green-100 text-green-700 border-0">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Completed
                        </Badge>
                        {meeting.isOrganizer && (
                          <Badge className="bg-blue-100 text-blue-700 border-0">
                            <User className="h-3 w-3 mr-1" />
                            You organized this
                          </Badge>
                        )}
                        {meeting.recordingEnabled && (
                          <Badge className="bg-red-100 text-red-700 border-0">
                            <Video className="h-3 w-3 mr-1" />
                            Recorded
                          </Badge>
                        )}
                        {meeting.hasTranscript && (
                          <Badge className="bg-purple-100 text-purple-700 border-0">
                            <MessageSquare className="h-3 w-3 mr-1" />
                            Transcript Available
                          </Badge>
                        )}
                      </div>

                      {/* Meeting Info Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-100 rounded-lg">
                              <CalendarIcon className="h-5 w-5 text-blue-600" />
                            </div>
                            <div>
                              <p className="text-sm text-gray-600">Date & Time</p>
                              <p className="font-medium text-gray-900">
                                {new Date(meeting.startTime).toLocaleDateString([], {
                                  weekday: 'long',
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric'
                                })}
                              </p>
                              <p className="text-sm text-gray-600">
                                {new Date(meeting.startTime).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })} - {new Date(meeting.endTime).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-green-100 rounded-lg">
                              <Clock className="h-5 w-5 text-green-600" />
                            </div>
                            <div>
                              <p className="text-sm text-gray-600">Duration</p>
                              <p className="font-medium text-gray-900">{meeting.totalDuration}</p>
                              {meeting.userDuration && (
                                <p className="text-sm text-gray-600">You participated for {meeting.userDuration}</p>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-purple-100 rounded-lg">
                              <Users className="h-5 w-5 text-purple-600" />
                            </div>
                            <div>
                              <p className="text-sm text-gray-600">Participants</p>
                              <p className="font-medium text-gray-900">
                                {meeting.participantCount} participant{meeting.participantCount !== 1 ? 's' : ''}
                              </p>
                              <p className="text-sm text-gray-600">
                                Peak: {meeting.maxParticipants} participants
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-orange-100 rounded-lg">
                              <User className="h-5 w-5 text-orange-600" />
                            </div>
                            <div>
                              <p className="text-sm text-gray-600">Organizer</p>
                              <p className="font-medium text-gray-900">
                                {meeting.organizer.fullName || meeting.organizer.username}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : activeTab === 'summary' ? (
                    <div className="p-6">
                      {meeting.summary ? (
                        <>
                          {/* Summary Actions */}
                          <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                              <Sparkles className="h-5 w-5 text-purple-500" />
                              Meeting Summary
                            </h3>
                            <div className="flex gap-2">
                              <button
                                onClick={regenerateSummary}
                                disabled={regeneratingSummary}
                                className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                                  regeneratingSummary
                                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                    : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                                }`}
                              >
                                <RefreshCw className={`h-4 w-4 ${regeneratingSummary ? 'animate-spin' : ''}`} />
                                {regeneratingSummary ? 'Regenerating...' : 'Regenerate'}
                              </button>
                              <button
                                onClick={copySummaryToClipboard}
                                className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                                  copySuccess
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                              >
                                <Copy className="h-4 w-4" />
                                {copySuccess ? 'Copied!' : 'Copy'}
                              </button>
                              <button
                                onClick={downloadSummary}
                                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2"
                              >
                                <Download className="h-4 w-4" />
                                Download
                              </button>
                            </div>
                          </div>

                          {/* Summary Content */}
                          <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-lg p-6 max-h-96 overflow-y-auto">
                            <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap">
                              {meeting.summary}
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-64 text-center">
                          <Sparkles className="h-12 w-12 text-gray-400 mb-4" />
                          <h3 className="text-lg font-medium text-gray-900">No AI Summary Available</h3>
                          <p className="text-gray-600 mt-2 mb-4">
                            This meeting doesn't have an AI-generated summary yet. If a transcript is available, 
                            you can generate one now.
                          </p>
                          {meeting.hasTranscript && (
                            <button
                              onClick={regenerateSummary}
                              disabled={regeneratingSummary}
                              className={`px-6 py-3 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                                regeneratingSummary
                                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                  : 'bg-purple-500 text-white hover:bg-purple-600'
                              }`}
                            >
                              <Sparkles className={`h-5 w-5 ${regeneratingSummary ? 'animate-pulse' : ''}`} />
                              {regeneratingSummary ? 'Generating AI Summary...' : 'Generate AI Summary'}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-6">
                      {meeting.hasTranscript ? (
                        <>
                          {/* Transcript Actions */}
                          <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-semibold text-gray-900">
                              Meeting Transcript ({meeting.transcript.length} entries)
                            </h3>
                            <div className="flex gap-2">
                              <button
                                onClick={copyTranscriptToClipboard}
                                className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                                  copySuccess
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                              >
                                <Copy className="h-4 w-4" />
                                {copySuccess ? 'Copied!' : 'Copy'}
                              </button>
                              <button
                                onClick={downloadTranscript}
                                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2"
                              >
                                <Download className="h-4 w-4" />
                                Download
                              </button>
                            </div>
                          </div>

                          {/* Transcript Content */}
                          <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto space-y-3">
                            {meeting.transcript.map((entry, index) => (
                              <div key={entry.id || index} className="flex gap-3">
                                <div className="flex-shrink-0 text-xs text-gray-500 font-mono w-20">
                                  {formatTimestamp(entry.timestamp)}
                                </div>
                                <div className="flex-1">
                                  <span className="font-medium text-gray-900">{entry.speaker}:</span>
                                  <span className="ml-2 text-gray-700">{entry.text}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-64 text-center">
                          <MessageSquare className="h-12 w-12 text-gray-400 mb-4" />
                          <h3 className="text-lg font-medium text-gray-900">No Transcript Available</h3>
                          <p className="text-gray-600 mt-2">
                            This meeting doesn't have a transcript. Transcripts are automatically generated when
                            subtitles are enabled during the meeting.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            ) : null}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default MeetingDetailsModal;