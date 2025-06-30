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
    API.get('/api/users')
      .then(res => setContacts(res.data || []))
      .catch(console.error);
  }, []);

  if (!open) return null;
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Schedule Meeting</DialogTitle>
        </DialogHeader>

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            await scheduleMeeting({
              title,
              description: desc,
              startTime: start.toISOString(),
              durationMinutes: duration,
              recurrence: { frequency: recurrence, interval: 1 },
              participants: selected.map((u) => u._id),
            });
            onClose();
          }}
          className="space-y-4"
        >
          <div>
            <Label htmlFor="title">
              Title<span className="text-red-500">*</span>
            </Label>
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

          <div>
            <Label>
              When<span className="text-red-500">*</span>
            </Label>
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
            <div className="max-h-40 overflow-auto space-y-1">
              {contacts.map((u) => (
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
                  <span className="ml-2">
                    {u.fullName || u.username} ({u.email})
                  </span>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter className="justify-end space-x-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}