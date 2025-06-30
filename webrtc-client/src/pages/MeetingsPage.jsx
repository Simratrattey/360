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
import { Calendar } from '@/components/ui/calendar';

export default function MeetingsPage() {
  const [meetings, setMeetings] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const nav = useNavigate();

  useEffect(() => {
    fetchUpcomingMeetings().then(setMeetings);
  }, []);

  const reload = () => fetchUpcomingMeetings().then(setMeetings);

  return (
    <div className="flex flex-col md:flex-row gap-6 p-6">
      {/* Left: Calendar + Schedule */}
      <div className="w-full md:w-1/3 space-y-6">
        <div className="rounded-md border p-4 bg-white">
          <h2 className="text-lg font-semibold mb-4">Calendar</h2>
          <Calendar mode="single" selected={new Date()} onSelect={() => {}} />
        </div>
        <Button className="w-full" onClick={() => setIsModalOpen(true)}>
          Schedule Meeting
        </Button>
      </div>

      {/* Right: Upcoming Meetings */}
      <div className="w-full md:w-2/3 space-y-6">
        <h2 className="text-xl font-bold">Upcoming Meetings</h2>
        {meetings.length === 0 ? (
          <div className="text-secondary-500 text-center mt-12">
            <CalendarIcon className="w-12 h-12 mx-auto mb-4" />
            <p className="text-lg">No upcoming meetings.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                        {new Date(m.startTime).toLocaleString()} &middot; {m.durationMinutes} min
                      </p>
                      <p className="text-sm">
                        <span className="font-medium">Organizer:</span> {m.organizer.fullName}
                      </p>
                      <p className="text-sm">
                        <span className="font-medium">Participants:</span> {m.participants.map(p => p.fullName).join(', ')}
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
      </div>

      {/* Modal */}
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