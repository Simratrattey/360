// src/components/ScheduleMeetingModal.jsx
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import API from '../api/client.js';
import { scheduleMeeting } from '../api/meetings.js';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectTrigger, SelectContent, SelectItem } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { DateTimePicker } from '@/components/ui/DateTimePicker';

export default function ScheduleMeetingModal({ open, onClose }) {
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [start, setStart] = useState(new Date());
  const [duration, setDuration] = useState(60);
  const [recurrence, setRecurrence] = useState('none');
  const [contacts, setContacts] = useState([]);
  const [selected, setSelected] = useState([]);

  useEffect(() => {
    if (open) {
      API.get('/api/users')
        .then((res) => {
          console.log('Fetched users:', res.data);
          setContacts(Array.isArray(res.data.users) ? res.data.users : []);
        })
        .catch(console.error);
    }
  }, [open]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    await scheduleMeeting({
      title,
      description: desc,
      startTime: start.toISOString(),
      durationMinutes: duration,
      recurrence: recurrence === 'none' ? null : { frequency: recurrence, interval: 1 },
      participants: selected.map((u) => u._id),
    });
    // Reset form
    setTitle('');
    setDesc('');
    setStart(new Date());
    setDuration(60);
    setRecurrence('none');
    setSelected([]);
    onClose();
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent aria-describedby="schedule-desc">
        <p id="schedule-desc" className="sr-only">
          Form to schedule a new meeting.
        </p>
        <DialogHeader>
          <DialogTitle>Schedule a Meeting</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <Label htmlFor="title">Title<span className="text-red-500">*</span></Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div>
            <Label htmlFor="desc">Description</Label>
            <Textarea
              id="desc"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              rows={2}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Start Time</Label>
              <DateTimePicker value={start} onChange={setStart} />
            </div>
            <div>
              <Label htmlFor="duration">Duration (minutes)</Label>
              <Input
                id="duration"
                type="number"
                min={1}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
              />
            </div>
          </div>

          <div>
            <Label>Recurrence</Label>
            <Select value={recurrence} onValueChange={setRecurrence}>
              <SelectTrigger className="w-full" />
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="biweekly">Bi-weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Participants</Label>
            <div className="max-h-48 overflow-y-auto rounded-md border p-2 space-y-1">
              {Array.isArray(contacts) && contacts.map((u) => (
                <div key={u._id} className="flex items-center">
                  <Checkbox
                    checked={selected.some((s) => s._id === u._id)}
                    onCheckedChange={(checked) => {
                      setSelected((sel) =>
                        checked
                          ? [...sel, u]
                          : sel.filter((s) => s._id !== u._id)
                      );
                    }}
                  />
                  <span className="ml-2 text-sm text-muted-foreground">
                    {u.fullName || u.username} ({u.email})
                  </span>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter className="pt-4 space-x-2">
            <Button variant="outline" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">Schedule</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}