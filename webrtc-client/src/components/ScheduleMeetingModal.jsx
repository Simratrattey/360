// src/components/ScheduleMeetingModal.jsx
import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { scheduleMeeting } from '../services/meetingService';
import { fetchContacts } from '../api/userService.js';
import ReactDatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

export default function ScheduleMeetingModal({ onClose }) {
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [start, setStart] = useState(new Date());
  const [duration, setDuration] = useState(60);
  const [recurrence, setRecurrence] = useState({ frequency: 'none', interval: 1 });
  const [contacts, setContacts] = useState([]);
  const [selected, setSelected] = useState([]);

  useEffect(()=>{
    fetchContacts().then(setContacts);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    await scheduleMeeting({
      title, description: desc,
      startTime: start,
      durationMinutes: duration,
      recurrence,
      participants: selected.map(c=>c._id),
    });
    onClose();
  };

  return (
    <Dialog open onOpenChange={val=>!val && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Schedule Meeting</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input placeholder="Title" value={title} onChange={e=>setTitle(e.target.value)} required />
          <Input placeholder="Description" value={desc} onChange={e=>setDesc(e.target.value)} />
          <div>
            <label>When:</label>
            <ReactDatePicker
              selected={start}
              onChange={date=>setStart(date)}
              showTimeSelect
              dateFormat="Pp"
            />
          </div>
          <div>
            <label>Duration (mins):</label>
            <Input type="number" value={duration} onChange={e=>setDuration(+e.target.value)} />
          </div>
          <div>
            <label>Recurrence:</label>
            <select
              value={recurrence.frequency}
              onChange={e=>setRecurrence(fr=>({...fr, frequency: e.target.value}))}
            >
              <option value="none">None</option>
              <option value="weekly">Weekly</option>
              <option value="biweekly">Bi-weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
          <div>
            <label>Participants:</label>
            <div className="max-h-40 overflow-auto border p-2">
              {contacts.map(c=>(
                <label key={c._id} className="block">
                  <input
                    type="checkbox"
                    checked={selected.some(s=>s._id===c._id)}
                    onChange={()=> {
                      setSelected(sel =>
                        sel.some(s=>s._id===c._id)
                          ? sel.filter(s=>s._id!==c._id)
                          : [...sel, c]
                      );
                    }}
                  />
                  {c.fullName} ({c.email})
                </label>
              ))}
            </div>
          </div>
          <div className="flex justify-end space-x-2">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit">Save</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}