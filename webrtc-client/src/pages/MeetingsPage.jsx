// src/pages/MeetingsPage.jsx
import { useEffect, useState } from 'react';
import { fetchUpcomingMeetings } from '../services/meetingService';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import ScheduleMeetingModal from '@/components/ScheduleMeetingModal';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Calendar as CalendarIcon } from 'lucide-react';

export default function MeetingsPage() {
  const [meetings, setMeetings] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const nav = useNavigate();

  useEffect(() => {
    fetchUpcomingMeetings().then(setMeetings);
  }, []);

  const reload = () => fetchUpcomingMeetings().then(setMeetings);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between px-4">
        <h1 className="text-2xl font-bold text-secondary-900">Meetings</h1>
        <Button onClick={() => setIsModalOpen(true)}>Schedule</Button>
      </div>
      {/* Empty state or grid */}
      {meetings.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-[60vh] space-y-4 text-center text-secondary-500">
          <CalendarIcon className="w-16 h-16 text-secondary-300" />
          <p className="text-lg">No upcoming meetings found.</p>
          <Button variant="outline" onClick={() => setIsModalOpen(true)}>
            Schedule your first meeting
          </Button>
        </div>
            ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 px-4">
          {meetings.map((m) => {
            const isLive = new Date(m.startTime) <= new Date();
            return (
              <motion.div
                key={m._id}
                className="hover:scale-[1.02] transition-transform"
                whileHover={{ scale: 1.02 }}
              >
                <Card className="h-full flex flex-col">
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <CalendarIcon className="w-5 h-5 text-primary-600" />
                      <span>{m.title}</span>
                    </CardTitle>
                  </CardHeader>

                  <CardContent className="flex-grow space-y-2">
                    <p className="text-sm text-secondary-500">
                      {new Date(m.startTime).toLocaleString()} &middot;{' '}
                      {m.durationMinutes} min
                    </p>
                    <p className="text-sm">
                      <span className="font-medium">Organizer:</span>{' '}
                      {m.organizer.fullName}
                    </p>
                    <p className="text-sm">
                      <span className="font-medium">Participants:</span>{' '}
                      {m.participants.map((p) => p.fullName).join(', ')}
                    </p>
                  </CardContent>

                  <CardFooter className="pt-0">
                    <Button
                      variant={isLive ? 'default' : 'outline'}
                      className="w-full"
                      onClick={() => nav(`/meeting/${m.roomId}`)}
                    >
                      {isLive ? 'Join Now' : 'View Details'}
                    </Button>
                  </CardFooter>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Schedule Modal */}
      <ScheduleMeetingModal
        open={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          reload();
        }}
      />
    </div>
  );
}