// src/pages/MeetingDetailsPage.jsx
import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Calendar, 
  Clock, 
  Users, 
  Video, 
  MapPin, 
  User, 
  Sparkles,
  ChevronLeft,
  AlertCircle,
  CheckCircle2,
  Play,
  Edit,
  Trash2,
  Copy,
  Share2,
  Phone,
  MessageSquare
} from 'lucide-react';
import { fetchMeeting, deleteMeeting, leaveMeeting } from '../services/meetingService';
import { AuthContext } from '../context/AuthContext.jsx';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from '@/components/ui/card';

export default function MeetingDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const [meeting, setMeeting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadMeeting = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchMeeting(id);
        setMeeting(data);
      } catch (err) {
        console.error('Error fetching meeting:', err);
        setError('Failed to load meeting details');
      } finally {
        setLoading(false);
      }
    };

    loadMeeting();
  }, [id]);

  const getMeetingStatus = (meeting) => {
    if (!meeting) return null;
    
    const now = new Date();
    const startTime = new Date(meeting.startTime);
    const endTime = new Date(startTime.getTime() + meeting.durationMinutes * 60 * 1000);
    
    if (now < startTime) {
      return { status: 'upcoming', label: 'Upcoming', icon: Clock, color: 'bg-blue-100 text-blue-700 border-blue-200' };
    } else if (now >= startTime && now <= endTime) {
      return { status: 'live', label: 'Live Now', icon: Play, color: 'bg-green-100 text-green-700 border-green-200' };
    } else {
      return { status: 'completed', label: 'Completed', icon: CheckCircle2, color: 'bg-gray-100 text-gray-700 border-gray-200' };
    }
  };

  const formatMeetingTime = (startTime, durationMinutes) => {
    const start = new Date(startTime);
    const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
    return {
      start: start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      end: end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      date: start.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
      duration: `${durationMinutes} minutes`
    };
  };

  const copyMeetingLink = () => {
    const link = `${window.location.origin}/meeting/${meeting.roomId}`;
    navigator.clipboard.writeText(link);
    // You could add a toast notification here
  };

  const shareMeeting = () => {
    const link = `${window.location.origin}/meeting/${meeting.roomId}`;
    if (navigator.share) {
      navigator.share({
        title: meeting.title,
        text: `Join me for: ${meeting.title}`,
        url: link
      });
    } else {
      copyMeetingLink();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center"
        >
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-lg text-secondary-600">Loading meeting details...</p>
        </motion.div>
      </div>
    );
  }

  if (error || !meeting) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-primary-800 mb-2">Meeting Not Found</h2>
          <p className="text-secondary-600 mb-6">{error || 'The meeting you\'re looking for doesn\'t exist.'}</p>
          <Button onClick={() => navigate('/meetings')} className="btn-primary">
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back to Meetings
          </Button>
        </motion.div>
      </div>
    );
  }

  const status = getMeetingStatus(meeting);
  const isOrganizer = meeting.organizer?._id === user.id;
  const timeInfo = formatMeetingTime(meeting.startTime, meeting.durationMinutes);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Background decoration */}
      <div className="absolute inset-0 -z-10 pointer-events-none">
        <div className="absolute left-1/2 top-0 -translate-x-1/2 w-[80vw] h-[40vh] bg-gradient-to-br from-blue-400/20 via-purple-400/15 to-pink-400/10 rounded-full blur-3xl opacity-60 animate-pulse" />
        <div className="absolute right-0 bottom-0 w-64 h-64 bg-gradient-to-br from-purple-400/20 to-blue-400/10 rounded-full blur-2xl opacity-40" />
      </div>

      <div className="container mx-auto px-6 py-8 space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="glass-effect bg-white/80 shadow-2xl rounded-2xl p-8 border border-white/30"
        >
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                onClick={() => navigate('/meetings')}
                className="p-2 hover:bg-white/20 rounded-xl"
              >
                <ChevronLeft className="h-6 w-6" />
              </Button>
              <div>
                <h1 className="text-3xl md:text-4xl font-extrabold text-primary-800 flex items-center gap-3">
                  <Sparkles className="h-8 w-8 text-blue-400 animate-bounce" />
                  {meeting.title}
                </h1>
                <div className="flex items-center gap-3 mt-2">
                  <Badge className={`${status.color} border`}>
                    <status.icon className="h-4 w-4 mr-1" />
                    {status.label}
                  </Badge>
                  {meeting.location && (
                    <div className="flex items-center gap-1 text-secondary-600">
                      <MapPin className="h-4 w-4" />
                      <span className="text-sm">{meeting.location}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={shareMeeting}
                className="flex items-center gap-2"
              >
                <Share2 className="h-4 w-4" />
                Share
              </Button>
              <Button
                variant="outline"
                onClick={copyMeetingLink}
                className="flex items-center gap-2"
              >
                <Copy className="h-4 w-4" />
                Copy Link
              </Button>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="lg:col-span-2 space-y-6"
          >
            {/* Meeting Details Card */}
            <Card className="glass-effect bg-white/80 shadow-xl rounded-2xl border border-white/30">
              <CardHeader className="bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-t-2xl">
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-6 w-6" />
                  Meeting Details
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                {/* Time Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <Calendar className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm text-secondary-600">Date</p>
                        <p className="font-semibold text-primary-800">{timeInfo.date}</p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 bg-purple-100 rounded-full flex items-center justify-center">
                        <Clock className="h-5 w-5 text-purple-600" />
                      </div>
                      <div>
                        <p className="text-sm text-secondary-600">Time</p>
                        <p className="font-semibold text-primary-800">{timeInfo.start} - {timeInfo.end}</p>
                        <p className="text-sm text-secondary-600">{timeInfo.duration}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Organizer */}
                <div className="border-t border-gray-200 pt-6">
                  <h3 className="text-lg font-semibold text-primary-800 mb-4 flex items-center gap-2">
                    <User className="h-5 w-5 text-blue-500" />
                    Organizer
                  </h3>
                  <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border border-blue-100">
                    <div className="h-12 w-12 bg-gradient-to-br from-blue-400 to-purple-400 rounded-full flex items-center justify-center text-white font-bold text-lg">
                      {meeting.organizer?.fullName?.charAt(0) || meeting.organizer?.username?.charAt(0) || 'U'}
                    </div>
                    <div>
                      <p className="font-semibold text-primary-800">
                        {meeting.organizer?.fullName || meeting.organizer?.username || 'Unknown'}
                      </p>
                      <p className="text-sm text-secondary-600">{meeting.organizer?.email}</p>
                    </div>
                  </div>
                </div>

                {/* Participants */}
                <div className="border-t border-gray-200 pt-6">
                  <h3 className="text-lg font-semibold text-primary-800 mb-4 flex items-center gap-2">
                    <Users className="h-5 w-5 text-green-500" />
                    Participants ({meeting.participants?.length || 0})
                  </h3>
                  <div className="space-y-3">
                    {meeting.participants?.map((participant, index) => (
                      <motion.div
                        key={participant._id || index}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="flex items-center gap-3 p-3 bg-white/60 rounded-xl border border-white/20 hover:bg-white/80 transition-colors"
                      >
                        <div className="h-10 w-10 bg-gradient-to-br from-green-400 to-blue-400 rounded-full flex items-center justify-center text-white font-bold">
                          {participant.fullName?.charAt(0) || participant.username?.charAt(0) || 'P'}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-primary-800">
                            {participant.fullName || participant.username || 'Unknown'}
                          </p>
                          <p className="text-sm text-secondary-600">{participant.email}</p>
                        </div>
                        {participant._id === meeting.organizer?._id && (
                          <Badge className="bg-blue-100 text-blue-700 border-blue-200">
                            Organizer
                          </Badge>
                        )}
                      </motion.div>
                    ))}
                  </div>
                </div>

                {/* Description */}
                {meeting.description && (
                  <div className="border-t border-gray-200 pt-6">
                    <h3 className="text-lg font-semibold text-primary-800 mb-3">Description</h3>
                    <p className="text-secondary-700 leading-relaxed">{meeting.description}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Sidebar */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, delay: 0.4 }}
            className="space-y-6"
          >
            {/* Quick Actions */}
            <Card className="glass-effect bg-white/80 shadow-xl rounded-2xl border border-white/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Video className="h-6 w-6 text-blue-500" />
                  Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button
                  onClick={() => navigate(`/meeting/${meeting.roomId}`)}
                  className="w-full btn-primary flex items-center gap-2"
                  disabled={status.status === 'completed'}
                >
                  <Play className="h-5 w-5" />
                  {status.status === 'live' ? 'Join Meeting' : status.status === 'upcoming' ? 'Join When Ready' : 'Meeting Ended'}
                </Button>
                {isOrganizer ? (
                  <Button
                    variant="destructive"
                    onClick={async () => {
                      try {
                        await deleteMeeting(meeting._id);
                        navigate('/meetings');
                      } catch (err) {
                        console.error(err);
                      }
                    }}
                    className="w-full flex items-center gap-2"
                  >
                    <Trash2 className="h-5 w-5" />
                    Cancel Meeting
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    onClick={async () => {
                      try {
                        await leaveMeeting(meeting._id);
                        navigate('/meetings');
                      } catch (err) {
                        console.error(err);
                      }
                    }}
                    className="w-full flex items-center gap-2"
                  >
                    <User className="h-5 w-5" />
                    Leave Meeting
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => navigate(`/messages?conversation=${meeting._id}`)}
                  className="w-full flex items-center gap-2"
                >
                  <MessageSquare className="h-5 w-5" />
                  Send Message
                </Button>

                <Button
                  variant="outline"
                  onClick={() => navigate(`/meetings`)}
                  className="w-full flex items-center gap-2"
                >
                  <Calendar className="h-5 w-5" />
                  View All Meetings
                </Button>
              </CardContent>
            </Card>

            {/* Meeting Info */}
            <Card className="glass-effect bg-white/80 shadow-xl rounded-2xl border border-white/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="h-6 w-6 text-orange-500" />
                  Meeting Info
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-secondary-600">Room ID</span>
                    <code className="text-xs bg-gray-100 px-2 py-1 rounded">{meeting.roomId}</code>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-secondary-600">Meeting ID</span>
                    <code className="text-xs bg-gray-100 px-2 py-1 rounded">{meeting._id}</code>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-secondary-600">Created</span>
                    <span className="text-sm text-secondary-700">
                      {new Date(meeting.createdAt || meeting.startTime).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}