// src/pages/MeetingsPage.jsx
import { useEffect, useState } from 'react';
import { fetchUpcomingMeetings } from '../services/meetingService';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

export default function MeetingsPage() {
  const [meetings, setMeetings] = useState([]);
  const nav = useNavigate();

  useEffect(()=>{
    fetchUpcomingMeetings().then(setMeetings);
  }, []);

  return (
    <div className="space-y-4">
      {meetings.map(m => (
        <div key={m._id} className="p-4 border rounded">
          <h3 className="text-xl">{m.title}</h3>
          <p>{new Date(m.startTime).toLocaleString()} ({m.durationMinutes} min)</p>
          <p>Organizer: {m.organizer.fullName}</p>
          <p>
            Participants: {m.participants.map(p=>p.fullName).join(', ')}
          </p>
          <Button onClick={()=>nav(`/meeting/${m.roomId}`)}>
            {new Date(m.startTime) <= new Date()
              ? 'Join'
              : 'View'}
          </Button>
        </div>
      ))}
    </div>
  );
}