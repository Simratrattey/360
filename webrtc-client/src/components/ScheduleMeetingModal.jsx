// src/components/ScheduleMeetingModal.jsx
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import API from '../api/client.js';
import { scheduleMeeting } from '../api/meetings.js';
import ReactDatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-lg w-full p-6 relative">
        {/* close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 hover:text-gray-800"
        >
          <X className="h-5 w-5 text-gray-600" />
        </button>

        <h2 className="text-xl font-semibold mb-4">Schedule Meeting</h2>
        <form
          onSubmit={async e => {
            e.preventDefault();
            await scheduleMeeting({
              title,
              description: desc,
              startTime: start,
              durationMinutes: duration,
              recurrence: { frequency: recurrence, interval: 1 },
              participants: selected.map(u => u._id),
            });
            onClose();
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm font-medium mb-1">Title<span className="text-red-500">*</span></label>
            <input
              type="text"
              className="w-full border rounded p-2"
              value={title}
              onChange={e => setTitle(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              className="w-full border rounded p-2"
              value={desc}
              onChange={e => setDesc(e.target.value)}
              rows={2}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">When<span className="text-red-500">*</span></label>
            <ReactDatePicker
              selected={start}
              onChange={setStart}
              showTimeSelect
              dateFormat="Pp"
              className="w-full border rounded p-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Duration (minutes)</label>
            <input
              type="number"
              className="w-full border rounded p-2"
              value={duration}
              onChange={e => setDuration(Number(e.target.value))}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Recurrence</label>
            <select
              className="w-full border rounded p-2"
              value={recurrence}
              onChange={e => setRecurrence(e.target.value)}
            >
              <option value="none">None</option>
              <option value="weekly">Weekly</option>
              <option value="biweekly">Bi-weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Participants</label>
            <div className="max-h-40 overflow-auto border rounded p-2">
              {contacts.map(u => (
                <label key={u._id} className="flex items-center mb-1">
                  <input
                    type="checkbox"
                    className="mr-2"
                    checked={selected.some(s => s._id === u._id)}
                    onChange={() => {
                      setSelected(sel =>
                        sel.some(s => s._id === u._id)
                          ? sel.filter(s => s._id !== u._id)
                          : [...sel, u]
                      );
                    }}
                  />
                  <span className="text-sm">{u.fullName || u.username} ({u.email})</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary px-4 py-2"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}