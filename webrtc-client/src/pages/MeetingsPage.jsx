import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { openMeetingWindow, generateRoomId } from '../utils/meetingWindow';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  Users, 
  Plus, 
  Video, 
  MapPin, 
  Sparkles,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Play,
  Eye,
  Search,
  History,
  Filter,
  ChevronLeft,
  ChevronDown,
  User
} from 'lucide-react';
import ScheduleMeetingModal from '../components/ScheduleMeetingModal.jsx';
import CreateMeetingModal from '../components/CreateMeetingModal.jsx';
import MeetingDetailsModal from '../components/MeetingDetailsModal.jsx';
import { fetchUpcomingMeetings } from '../services/meetingService';
import API from '../api/client.js';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';

export default function MeetingsPage() {
  const [meetings, setMeetings] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  
  // Past meetings state
  const [activeTab, setActiveTab] = useState('upcoming'); // 'upcoming' or 'past'
  const [pastMeetings, setPastMeetings] = useState([]);
  const [pastMeetingsLoading, setPastMeetingsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({});
  
  // Meeting details modal state
  const [selectedMeetingId, setSelectedMeetingId] = useState(null);
  const [isMeetingModalOpen, setIsMeetingModalOpen] = useState(false);

  // Memoize meetings by date for calendar
  const meetingsByDate = useMemo(() => {
    const map = new Map();
    meetings.forEach(meeting => {
      const date = new Date(meeting.startTime).toDateString();
      if (!map.has(date)) {
        map.set(date, []);
      }
      map.get(date).push(meeting);
    });
    return map;
  }, [meetings]);

  // Get meetings for selected date
  const selectedDateMeetings = useMemo(() => {
    const dateKey = selectedDate.toDateString();
    return meetingsByDate.get(dateKey) || [];
  }, [selectedDate, meetingsByDate]);

  // Get today's meetings
  const todaysMeetings = useMemo(() => {
    const today = new Date().toDateString();
    return meetingsByDate.get(today) || [];
  }, [meetingsByDate]);

  // Get upcoming meetings (next 7 days)
  const upcomingMeetings = useMemo(() => {
    const now = new Date();
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    return meetings.filter(meeting => {
      const meetingDate = new Date(meeting.startTime);
      return meetingDate >= now && meetingDate <= nextWeek;
    }).slice(0, 5); // Show only next 5
  }, [meetings]);

  const startNow = () => {
    setIsCreateModalOpen(true);
  };


  useEffect(() => {
    const loadMeetings = async () => {
      try {
        setLoading(true);
        const data = await fetchUpcomingMeetings();
        setMeetings(data.meetings || data || []);
      } catch (error) {
        console.error('Error fetching meetings:', error);
        setMeetings([]);
      } finally {
        setLoading(false);
      }
    };
    loadMeetings();
  }, []);
  
  useEffect(() => {
    if (activeTab === 'past') {
      loadPastMeetings();
    }
  }, [activeTab]);

  const reload = async () => {
    try {
      const data = await fetchUpcomingMeetings();
      setMeetings(data.meetings || data || []);
    } catch (error) {
      console.error('Error reloading meetings:', error);
    }
  };
  
  const loadPastMeetings = async (page = 1) => {
    try {
      setPastMeetingsLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '10'
      });
      
      if (searchQuery) params.append('search', searchQuery);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      
      const response = await API.get(`/meetings/past?${params}`);
      
      if (response.data.success) {
        setPastMeetings(response.data.meetings);
        setPagination(response.data.pagination);
        setCurrentPage(page);
      }
    } catch (error) {
      console.error('Error loading past meetings:', error);
      setPastMeetings([]);
    } finally {
      setPastMeetingsLoading(false);
    }
  };
  
  const handleSearch = () => {
    setCurrentPage(1);
    loadPastMeetings(1);
  };
  
  const clearFilters = () => {
    setSearchQuery('');
    setStartDate('');
    setEndDate('');
    setCurrentPage(1);
    loadPastMeetings(1);
  };
  
  const openMeetingDetails = (meetingId) => {
    setSelectedMeetingId(meetingId);
    setIsMeetingModalOpen(true);
  };
  
  const closeMeetingDetails = () => {
    setSelectedMeetingId(null);
    setIsMeetingModalOpen(false);
  };

  const getMeetingStatus = (meeting) => {
    const now = new Date();
    const startTime = new Date(meeting.startTime);
    const endTime = new Date(startTime.getTime() + meeting.durationMinutes * 60 * 1000);
    
    if (now < startTime) {
      return { status: 'upcoming', label: 'Upcoming', icon: Clock, color: 'bg-blue-100 text-blue-700' };
    } else if (now >= startTime && now <= endTime) {
      return { status: 'live', label: 'Live Now', icon: Play, color: 'bg-green-100 text-green-700' };
    } else {
      return { status: 'completed', label: 'Completed', icon: CheckCircle2, color: 'bg-gray-100 text-gray-700' };
    }
  };

  const formatMeetingTime = (startTime, durationMinutes) => {
    const start = new Date(startTime);
    const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
    return {
      start: start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      end: end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      date: start.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
    };
  };

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Background decoration */}
      <div className="absolute inset-0 -z-10 pointer-events-none">
        <div className="absolute left-1/2 top-0 -translate-x-1/2 w-[80vw] h-[40vh] bg-gradient-to-br from-blue-400/20 via-purple-400/15 to-pink-400/10 rounded-full blur-3xl opacity-60 animate-pulse" />
        <div className="absolute right-0 bottom-0 w-64 h-64 bg-gradient-to-br from-purple-400/20 to-blue-400/10 rounded-full blur-2xl opacity-40" />
      </div>

      <div className="container mx-auto px-6 py-8 space-y-8">
        {/* Header Section */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ duration: 0.7 }}
          className="glass-effect card bg-white/80 shadow-2xl rounded-2xl p-6 md:p-8 border border-white/30"
        >
          <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 md:gap-6 w-full">
            <div>
              <h1 className="text-3xl md:text-4xl font-extrabold text-primary-800 flex items-center gap-3">
                <Sparkles className="h-8 w-8 text-blue-400 animate-bounce" />
                Meetings
              </h1>
              <p className="text-secondary-700 mt-2 text-lg">
                Manage your meetings and schedule new ones
              </p>
              
              {/* Tab Navigation */}
              <div className="flex gap-4 mt-4">
                <button
                  onClick={() => setActiveTab('upcoming')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    activeTab === 'upcoming'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <CalendarIcon className="h-4 w-4 inline mr-2" />
                  Upcoming
                </button>
                <button
                  onClick={() => setActiveTab('past')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    activeTab === 'past'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <History className="h-4 w-4 inline mr-2" />
                  Past Meetings
                </button>
              </div>
            </div>
            <div className="w-full xl:w-auto xl:ml-auto grid grid-cols-1 xl:grid-cols-3 gap-3">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsModalOpen(true)}
                className="btn-primary inline-flex items-center justify-center gap-2 w-full px-5 sm:px-6 py-3 text-base md:text-lg rounded-xl shadow-lg"
              >
                <Plus className="h-5 w-5" />
                <span>Schedule Meeting</span>
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={startNow}
                className="btn-outline inline-flex items-center justify-center gap-2 w-full px-5 sm:px-6 py-3 text-base md:text-lg rounded-xl shadow-lg border-2"
              >
                <Video className="h-5 w-5" />
                <span>Start Now</span>
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  const joinId = prompt('Enter meeting ID to join');
                  if (joinId) openMeetingWindow(joinId);
                }}
                className="btn-outline inline-flex items-center justify-center gap-2 w-full px-5 sm:px-6 py-3 text-base md:text-lg rounded-xl shadow-lg border-2"
              >
                <Eye className="h-5 w-5" />
                <span>Join Meeting</span>
              </motion.button>


            </div>
          </div>
        </motion.div>


        {activeTab === 'upcoming' ? (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          {/* Left Column - Calendar */}
          <motion.div 
            initial={{ opacity: 0, x: -30 }} 
            animate={{ opacity: 1, x: 0 }} 
            transition={{ duration: 0.7, delay: 0.2 }}
            className="xl:col-span-1 space-y-6"
          >
                         {/* Calendar Card */}
             <Card className="glass-effect bg-white/80 shadow-xl rounded-2xl border border-white/30 overflow-hidden">
               <CardHeader className="bg-gradient-to-r from-blue-500 to-purple-500 text-white">
                 <CardTitle className="flex items-center gap-2">
                   <CalendarIcon className="h-6 w-6" />
                   Calendar
                 </CardTitle>
               </CardHeader>
               <CardContent className="p-6">
                 <Calendar
                   mode="single"
                   selected={selectedDate}
                   onSelect={setSelectedDate}
                   className="rounded-md border-0 mx-auto w-full max-w-[360px]"
                 />
                 {/* Meeting indicators */}
                 {meetingsByDate.size > 0 && (
                   <div className="mt-4 pt-4 border-t border-gray-200">
                     <p className="text-sm text-gray-600 mb-2">Meeting indicators:</p>
                     <div className="flex flex-wrap gap-2">
                       {Array.from(meetingsByDate.keys()).slice(0, 5).map((dateKey) => {
                         const date = new Date(dateKey);
                         const count = meetingsByDate.get(dateKey).length;
                         return (
                           <div key={dateKey} className="flex items-center gap-1 text-xs">
                             <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                             <span className="text-gray-500">
                               {date.toLocaleDateString([], { month: 'short', day: 'numeric' })} ({count})
                             </span>
                           </div>
                         );
                       })}
                     </div>
                   </div>
                 )}
               </CardContent>
             </Card>

            {/* Today's Meetings Summary */}
            {todaysMeetings.length > 0 && (
              <Card className="glass-effect bg-white/80 shadow-xl rounded-2xl border border-white/30">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Clock className="h-5 w-5 text-blue-500" />
                    Today's Meetings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {todaysMeetings.slice(0, 3).map((meeting, index) => {
                    const status = getMeetingStatus(meeting);
                    const time = formatMeetingTime(meeting.startTime, meeting.durationMinutes);
                    return (
                      <motion.div
                        key={meeting._id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="flex items-center gap-3 p-3 bg-white/60 rounded-lg border border-white/20 hover:bg-white/80 transition-colors cursor-pointer"
                        onClick={() => {
                          const { status } = getMeetingStatus(meeting);
                          if (status === 'live') {
                            openMeetingWindow(meeting.roomId);
                          } else {
                            navigate(`/meetings/${meeting._id}`);
                          }
                        }}
                      >
                        <div className={`p-2 rounded-full ${status.color}`}>
                          <status.icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-gray-900 truncate">
                            {meeting.title}
                          </p>
                          <p className="text-xs text-gray-500">
                            {time.start} - {time.end}
                          </p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-gray-400" />
                      </motion.div>
                    );
                  })}
                  {todaysMeetings.length > 3 && (
                    <p className="text-sm text-gray-500 text-center">
                      +{todaysMeetings.length - 3} more meetings today
                    </p>
                  )}
                </CardContent>
              </Card>
            )}
          </motion.div>

          {/* Right Column - Meetings List */}
          <motion.div 
            initial={{ opacity: 0, x: 30 }} 
            animate={{ opacity: 1, x: 0 }} 
            transition={{ duration: 0.7, delay: 0.4 }}
            className="xl:col-span-2 space-y-6"
          >
            {/* Selected Date Meetings */}
            <Card className="glass-effect bg-white/80 shadow-xl rounded-2xl border border-white/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <CalendarIcon className="h-6 w-6 text-blue-500" />
                  {selectedDate.toDateString() === new Date().toDateString() 
                    ? "Today's Meetings" 
                    : `Meetings on ${selectedDate.toLocaleDateString([], { 
                        weekday: 'long', 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}`
                  }
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center h-32">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                  </div>
                ) : selectedDateMeetings.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-48 text-center text-muted-foreground">
                    <CalendarIcon className="w-16 h-16 mb-4 text-gray-300" />
                    <p className="text-lg font-medium text-gray-500">No meetings scheduled</p>
                    <p className="text-sm text-gray-400 mt-1">
                      {selectedDate.toDateString() === new Date().toDateString() 
                        ? "You're all caught up for today!" 
                        : "No meetings planned for this date."
                      }
                    </p>
                    <Button 
                      onClick={() => setIsModalOpen(true)}
                      className="mt-4 btn-primary"
                    >
                      Schedule a Meeting
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <AnimatePresence>
                      {selectedDateMeetings.map((meeting, index) => {
                        const status = getMeetingStatus(meeting);
                        const time = formatMeetingTime(meeting.startTime, meeting.durationMinutes);
                        return (
                          <motion.div
                            key={meeting._id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ delay: index * 0.1 }}
                            className="group"
                          >
                            <Card className="h-full flex flex-col hover:shadow-xl transition-all duration-300 hover:scale-[1.02] border border-white/30 bg-white/60 hover:bg-white/80">
                              <CardHeader className="pb-3">
                                <div className="flex items-start justify-between">
                                  <CardTitle className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                                    {meeting.title}
                                  </CardTitle>
                                  <Badge className={`${status.color} border-0`}>
                                    <status.icon className="h-3 w-3 mr-1" />
                                    {status.label}
                                  </Badge>
                                </div>
                              </CardHeader>

                              <CardContent className="flex-grow space-y-3">
                                <div className="flex items-center gap-2 text-sm text-gray-600">
                                  <Clock className="h-4 w-4 text-blue-500" />
                                  <span>{time.start} - {time.end}</span>
                                  <span className="text-gray-400">•</span>
                                  <span>{meeting.durationMinutes} min</span>
                                </div>
                                
                                <div className="flex items-center gap-2 text-sm text-gray-600">
                                  <Users className="h-4 w-4 text-green-500" />
                                  <span className="font-medium">Organizer:</span>
                                  <span>{meeting.organizer?.fullName || meeting.organizer?.username || 'Unknown'}</span>
                                </div>

                                {meeting.participants && meeting.participants.length > 0 && (
                                  <div className="flex items-center gap-2 text-sm text-gray-600">
                                    <Users className="h-4 w-4 text-purple-500" />
                                    <span className="font-medium">Participants:</span>
                                    <span>{meeting.participants.length} people</span>
                                  </div>
                                )}

                                {meeting.location && (
                                  <div className="flex items-center gap-2 text-sm text-gray-600">
                                    <MapPin className="h-4 w-4 text-red-500" />
                                    <span>{meeting.location}</span>
                                  </div>
                                )}
                              </CardContent>

                              <CardFooter className="pt-0">
                                <Button
                                  variant={status.status === 'live' ? 'default' : 'outline'}
                                  className={`w-full ${
                                    status.status === 'live' 
                                      ? 'bg-green-600 hover:bg-green-700 text-white' 
                                      : 'hover:bg-blue-50 hover:text-blue-600'
                                  }`}
                                  onClick={() =>
                                    navigate(
                                      status.status === 'live'
                                      ? `/meeting/${meeting.roomId}`      // join live room
                                      : `/meetings/${meeting._id}`       // view details page
                                    )
                                  }
                                >
                                  {status.status === 'live' ? (
                                    <>
                                      <Play className="h-4 w-4 mr-2" />
                                      Join Now
                                    </>
                                  ) : (
                                    <>
                                      <Eye className="h-4 w-4 mr-2" />
                                      View Details
                                    </>
                                  )}
                                </Button>
                              </CardFooter>
                            </Card>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Upcoming Meetings */}
            {upcomingMeetings.length > 0 && (
              <Card className="glass-effect bg-white/80 shadow-xl rounded-2xl border border-white/30">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <Clock className="h-6 w-6 text-green-500" />
                    Upcoming This Week
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {upcomingMeetings.map((meeting, index) => {
                      const time = formatMeetingTime(meeting.startTime, meeting.durationMinutes);
                      return (
                        <motion.div
                          key={meeting._id}
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.1 }}
                          className="flex items-center gap-4 p-4 bg-white/60 rounded-xl border border-white/20 hover:bg-white/80 transition-all duration-200 hover:scale-[1.01] cursor-pointer"
                          onClick={() => navigate(`/meetings/${meeting._id}`)}
                          
                        >
                          <div className="p-3 bg-blue-100 rounded-full">
                            <CalendarIcon className="h-5 w-5 text-blue-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-gray-900 truncate">
                              {meeting.title}
                            </h3>
                            <p className="text-sm text-gray-600">
                              {time.date} • {time.start} - {time.end} • {meeting.durationMinutes} min
                            </p>
                            <p className="text-xs text-gray-500">
                              {meeting.organizer?.fullName || meeting.organizer?.username || 'Unknown'} • {meeting.participants?.length || 0} participants
                            </p>
                          </div>
                          <ChevronRight className="h-5 w-5 text-gray-400" />
                        </motion.div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </motion.div>
          </div>
        ) : (
          /* Past Meetings Section */
          <div className="space-y-6">
            {/* Search and Filter Controls */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }} 
              animate={{ opacity: 1, y: 0 }} 
              transition={{ duration: 0.5 }}
              className="glass-effect bg-white/80 shadow-xl rounded-2xl p-6 border border-white/30"
            >
              <h2 className="text-xl font-bold text-primary-800 mb-4 flex items-center gap-2">
                <Search className="h-5 w-5" />
                Search Past Meetings
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4 items-end">
                <div className="md:col-span-2 min-w-0">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Search by name
                  </label>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Meeting name..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  />
                </div>
                
                <div className="min-w-0">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                
                <div className="min-w-0">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                
                <div className="md:col-span-4 xl:col-span-1 flex flex-col justify-end">
                  <div className="flex flex-wrap items-center gap-2 md:justify-end">
                    <button
                      onClick={handleSearch}
                      className="btn-primary px-3 py-2 text-sm rounded-lg flex items-center gap-2 md:px-3 md:py-2"
                    >
                      <Search className="h-4 w-4" />
                      Search
                    </button>
                    <button
                      onClick={clearFilters}
                      className="btn-outline px-3 py-2 text-sm rounded-lg flex items-center gap-2 md:px-3 md:py-2"
                    >
                      <Filter className="h-4 w-4" />
                      Clear
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
            
            {/* Past Meetings List */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }} 
              animate={{ opacity: 1, y: 0 }} 
              transition={{ duration: 0.5, delay: 0.2 }}
              className="glass-effect bg-white/80 shadow-xl rounded-2xl border border-white/30"
            >
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-bold text-primary-800 flex items-center gap-2">
                  <History className="h-5 w-5" />
                  Past Meetings
                  {pagination.totalCount > 0 && (
                    <span className="text-sm font-normal text-gray-500">
                      ({pagination.totalCount} total)
                    </span>
                  )}
                </h2>
              </div>
              
              <div className="p-6">
                {pastMeetingsLoading ? (
                  <div className="flex items-center justify-center h-32">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                  </div>
                ) : pastMeetings.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-48 text-center">
                    <History className="w-16 h-16 mb-4 text-gray-300" />
                    <p className="text-lg font-medium text-gray-500">No past meetings found</p>
                    <p className="text-sm text-gray-400 mt-1">
                      {searchQuery || startDate || endDate 
                        ? "Try adjusting your search filters" 
                        : "You haven't attended any meetings yet"}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {pastMeetings.map((meeting, index) => (
                      <motion.div
                        key={meeting.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="bg-white/60 rounded-xl border border-white/20 p-6 hover:bg-white/80 transition-all duration-200 hover:scale-[1.01] hover:shadow-lg cursor-pointer"
                        onClick={() => openMeetingDetails(meeting.id)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-3">
                              <h3 className="text-lg font-semibold text-gray-900">
                                {meeting.title}
                              </h3>
                              {meeting.isOrganizer && (
                                <Badge className="bg-blue-100 text-blue-700 border-0">
                                  <User className="h-3 w-3 mr-1" />
                                  Organizer
                                </Badge>
                              )}
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm text-gray-600">
                              <div className="flex items-center gap-2">
                                <CalendarIcon className="h-4 w-4 text-blue-500" />
                                <span>
                                  {new Date(meeting.startTime).toLocaleDateString([], {
                                    weekday: 'short',
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric'
                                  })}
                                </span>
                              </div>
                              
                              <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4 text-green-500" />
                                <span>
                                  {new Date(meeting.startTime).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })} ({meeting.totalDuration})
                                </span>
                              </div>
                              
                              <div className="flex items-center gap-2">
                                <Users className="h-4 w-4 text-purple-500" />
                                <span>{meeting.participantCount} participant{meeting.participantCount !== 1 ? 's' : ''}</span>
                              </div>
                              
                              {meeting.userDuration && (
                                <div className="flex items-center gap-2">
                                  <User className="h-4 w-4 text-orange-500" />
                                  <span>You: {meeting.userDuration}</span>
                                </div>
                              )}
                            </div>
                            
                            {meeting.organizer && (
                              <div className="mt-3 flex items-center gap-2 text-sm text-gray-600">
                                <span className="font-medium">Organized by:</span>
                                <span>{meeting.organizer.fullName || meeting.organizer.username}</span>
                              </div>
                            )}
                          </div>
                          
                          <div className="ml-4 flex flex-col gap-2">
                            <Badge className="bg-green-100 text-green-700 border-0">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Completed
                            </Badge>
                            {meeting.recordingEnabled && (
                              <Badge className="bg-red-100 text-red-700 border-0">
                                <Video className="h-3 w-3 mr-1" />
                                Recorded
                              </Badge>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
                
                {/* Pagination */}
                {pagination.totalPages > 1 && (
                  <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-200">
                    <div className="text-sm text-gray-600">
                      Showing page {pagination.currentPage} of {pagination.totalPages}
                    </div>
                    
                    <div className="flex gap-2">
                      <button
                        onClick={() => loadPastMeetings(currentPage - 1)}
                        disabled={!pagination.hasPrevPage}
                        className="px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                      </button>
                      
                      <span className="px-4 py-2 text-sm text-gray-600">
                        Page {pagination.currentPage} of {pagination.totalPages}
                      </span>
                      
                      <button
                        onClick={() => loadPastMeetings(currentPage + 1)}
                        disabled={!pagination.hasNextPage}
                        className="px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                      >
                        Next
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </div>

      {/* Meeting Details Modal */}
      <MeetingDetailsModal
        isOpen={isMeetingModalOpen}
        onClose={closeMeetingDetails}
        meetingId={selectedMeetingId}
      />

      {/* Schedule Meeting Modal */}
      <ScheduleMeetingModal
        open={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          reload();
        }}
        onMeetingScheduled={() => {
          reload();
        }}
      />

      {/* Create Meeting Modal */}
      <CreateMeetingModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onMeetingCreated={reload}
      />
    </div>
  );
}