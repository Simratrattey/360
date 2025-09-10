// src/components/ScheduleMeetingModal.jsx
import { useEffect, useState } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Calendar, 
  Clock, 
  Users, 
  MapPin, 
  FileText, 
  CheckCircle2,
  AlertCircle,
  Loader2,
  Plus,
  Search,
  User,
  Video,
  Eye,
  Lock
} from 'lucide-react';
import API from '../api/client.js';
import { scheduleMeeting } from '../services/meetingService';
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
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

const VISIBILITY_OPTIONS = [
  {
    id: 'public',
    label: 'Public Meeting',
    description: 'Visible in active rooms, anyone can join',
    icon: Eye,
    color: 'text-green-600 bg-green-50'
  },
  {
    id: 'approval',
    label: 'Approval Required',
    description: 'Visible in active rooms, host approval needed',
    icon: Users,
    color: 'text-blue-600 bg-blue-50'
  },
  {
    id: 'private',
    label: 'Private Meeting',
    description: 'Hidden from active rooms, invite only',
    icon: Lock,
    color: 'text-purple-600 bg-purple-50'
  }
];

export default function ScheduleMeetingModal({ open, onClose, onMeetingScheduled }) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    startTime: new Date(),
    durationMinutes: 60,
    location: '',
    recurrence: 'none',
    visibility: 'public'
  });
  
  const [contacts, setContacts] = useState([]);
  const [selectedParticipants, setSelectedParticipants] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Duration options
  const durationOptions = [
    { value: 15, label: '15 minutes' },
    { value: 30, label: '30 minutes' },
    { value: 45, label: '45 minutes' },
    { value: 60, label: '1 hour' },
    { value: 90, label: '1.5 hours' },
    { value: 120, label: '2 hours' },
    { value: 180, label: '3 hours' },
    { value: 240, label: '4 hours' }
  ];

  // Recurrence options
  const recurrenceOptions = [
    { value: 'none', label: 'No recurrence' },
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'biweekly', label: 'Bi-weekly' },
    { value: 'monthly', label: 'Monthly' }
  ];

  // Filter contacts based on search
  const filteredContacts = contacts.filter(contact => 
    contact.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    contact.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    contact.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    if (open) {
      loadContacts();
      resetForm();
    }
  }, [open]);

  const loadContacts = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await API.get('/users');
      const users = Array.isArray(response.data.users) ? response.data.users : [];
      setContacts(users);
    } catch (err) {
      console.error('Error loading contacts:', err);
      setError('Failed to load contacts. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      startTime: new Date(),
      durationMinutes: 60,
      location: '',
      recurrence: 'none',
      visibility: 'public'
    });
    setSelectedParticipants([]);
    setSearchQuery('');
    setError('');
    setSuccess(false);
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    setError(''); // Clear error when user makes changes
  };

  const handleParticipantToggle = (participant) => {
    setSelectedParticipants(prev => {
      const isSelected = prev.some(p => p._id === participant._id);
      if (isSelected) {
        return prev.filter(p => p._id !== participant._id);
      } else {
        return [...prev, participant];
      }
    });
  };

  const handleSubmit = async () => {
    // Validation
    if (!formData.title.trim()) {
      setError('Meeting title is required');
      return;
    }

    if (formData.startTime < new Date()) {
      setError('Start time cannot be in the past');
      return;
    }

    try {
      setSubmitting(true);
      setError('');

      const meetingData = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        startTime: formData.startTime.toISOString(),
        durationMinutes: formData.durationMinutes,
        location: formData.location.trim(),
        recurrence: formData.recurrence === 'none' ? null : { 
          frequency: formData.recurrence, 
          interval: 1 
        },
        participants: selectedParticipants.map(p => p._id),
        visibility: formData.visibility
      };

      await scheduleMeeting(meetingData);
      
      setSuccess(true);
      
      // Call the callback to refresh meetings list
      if (onMeetingScheduled) {
        onMeetingScheduled();
      }
      
      setTimeout(() => {
        onClose();
        resetForm();
      }, 1500);
      
    } catch (err) {
      console.error('Error scheduling meeting:', err);
      setError(err.response?.data?.message || 'Failed to schedule meeting. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!submitting) {
      onClose();
      resetForm();
    }
  };

  const handleOpenChange = (open) => {
    if (!open && !submitting) {
      handleClose();
    }
  };

  const formatDateTime = (date) => {
    return date.toLocaleString([], {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Video className="h-6 w-6 text-blue-500" />
            Schedule New Meeting
          </DialogTitle>
        </DialogHeader>

        <AnimatePresence>
          {success ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex flex-col items-center justify-center py-12 text-center"
            >
              <CheckCircle2 className="h-16 w-16 text-green-500 mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Meeting Scheduled Successfully!
              </h3>
              <p className="text-gray-600">
                Your meeting has been scheduled and participants will be notified.
              </p>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Error Message */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700"
                >
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm">{error}</span>
                </motion.div>
              )}

              {/* Meeting Details Section */}
              <Card className="border-0 shadow-sm bg-gray-50/50">
                <CardContent className="p-6 space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <FileText className="h-5 w-5 text-blue-500" />
                    Meeting Details
                  </h3>
                  
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="title" className="text-sm font-medium text-gray-700">
                        Meeting Title <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="title"
                        value={formData.title}
                        onChange={(e) => handleInputChange('title', e.target.value)}
                        placeholder="Enter meeting title"
                        className="mt-1"
                        required
                      />
                    </div>

                    <div>
                      <Label htmlFor="description" className="text-sm font-medium text-gray-700">
                        Description
                      </Label>
                      <Textarea
                        id="description"
                        value={formData.description}
                        onChange={(e) => handleInputChange('description', e.target.value)}
                        placeholder="Add meeting description (optional)"
                        rows={3}
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <Label htmlFor="location" className="text-sm font-medium text-gray-700">
                        Location
                      </Label>
                      <Input
                        id="location"
                        value={formData.location}
                        onChange={(e) => handleInputChange('location', e.target.value)}
                        placeholder="Meeting room, Zoom link, or address"
                        className="mt-1"
                      />
                    </div>

                    {/* Visibility Options */}
                    <div>
                      <Label className="text-sm font-medium text-gray-700 mb-3 block">
                        Meeting Visibility
                      </Label>
                      <div className="grid grid-cols-1 gap-3">
                        {VISIBILITY_OPTIONS.map((option) => {
                          const IconComponent = option.icon;
                          return (
                            <div
                              key={option.id}
                              onClick={() => handleInputChange('visibility', option.id)}
                              className={`
                                relative flex items-start p-4 border-2 rounded-lg cursor-pointer transition-all
                                ${formData.visibility === option.id 
                                  ? 'border-blue-500 bg-blue-50' 
                                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                }
                              `}
                            >
                              <div className={`flex-shrink-0 p-2 rounded-lg ${option.color}`}>
                                <IconComponent className="h-5 w-5" />
                              </div>
                              <div className="ml-3 flex-1">
                                <div className="flex items-center">
                                  <label className="text-sm font-medium text-gray-900 cursor-pointer">
                                    {option.label}
                                  </label>
                                  {formData.visibility === option.id && (
                                    <div className="ml-auto">
                                      <CheckCircle2 className="h-5 w-5 text-blue-500" />
                                    </div>
                                  )}
                                </div>
                                <p className="text-sm text-gray-600 mt-1">
                                  {option.description}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Date & Time Section */}
              <Card className="border-0 shadow-sm bg-gray-50/50">
                <CardContent className="p-6 space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-green-500" />
                    Date & Time
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-gray-700">
                        Start Date & Time
                      </Label>
                      <div className="mt-1">
                        <DatePicker
                          selected={formData.startTime}
                          onChange={date => handleInputChange('startTime', date)}
                          showTimeSelect
                          timeFormat="hh:mm aa"
                          timeIntervals={15}
                          dateFormat="MMMM d, yyyy h:mm aa"
                          className="w-full p-3 bg-white border border-gray-300 rounded-lg text-sm"
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {formatDateTime(formData.startTime)}
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="duration" className="text-sm font-medium text-gray-700">
                        Duration
                      </Label>
                      <Select 
                        value={formData.durationMinutes.toString()} 
                        onValueChange={(value) => handleInputChange('durationMinutes', parseInt(value))}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {durationOptions.map(option => (
                            <SelectItem key={option.value} value={option.value.toString()}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="recurrence" className="text-sm font-medium text-gray-700">
                      Recurrence
                    </Label>
                    <Select 
                      value={formData.recurrence} 
                      onValueChange={(value) => handleInputChange('recurrence', value)}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {recurrenceOptions.map(option => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              {/* Participants Section */}
              <Card className="border-0 shadow-sm bg-gray-50/50">
                <CardContent className="p-6 space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <Users className="h-5 w-5 text-purple-500" />
                    Participants
                  </h3>
                  
                  <div className="space-y-3">
                    {/* Search */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        placeholder="Search participants..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                      />
                    </div>

                    {/* Selected Participants */}
                    {selectedParticipants.length > 0 && (
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-gray-700">
                          Selected ({selectedParticipants.length})
                        </Label>
                        <div className="flex flex-wrap gap-2">
                          {selectedParticipants.map(participant => (
                            <Badge 
                              key={participant._id}
                              variant="secondary"
                              className="flex items-center gap-1"
                            >
                              <User className="h-3 w-3" />
                              {participant.fullName || participant.username}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleParticipantToggle(participant);
                                }}
                                className="ml-1 hover:text-red-500"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Participants List */}
                    <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg bg-white">
                      {loading ? (
                        <div className="flex items-center justify-center p-4">
                          <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                          <span className="ml-2 text-sm text-gray-500">Loading contacts...</span>
                        </div>
                      ) : filteredContacts.length === 0 ? (
                        <div className="p-4 text-center text-gray-500">
                          {searchQuery ? 'No contacts found' : 'No contacts available'}
                        </div>
                      ) : (
                        <div className="space-y-1 p-2">
                          {filteredContacts.map(contact => {
                            const isSelected = selectedParticipants.some(p => p._id === contact._id);
                            return (
                              <div
                                key={contact._id}
                                className={`flex items-center p-2 rounded-lg transition-colors ${
                                  isSelected 
                                    ? 'bg-blue-50 border border-blue-200' 
                                    : 'hover:bg-gray-50'
                                }`}
                              >
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={() => handleParticipantToggle(contact)}
                                  className="mr-3"
                                />
                                <div 
                                  className="flex-1 min-w-0 cursor-pointer"
                                  onClick={() => handleParticipantToggle(contact)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                      e.preventDefault();
                                      handleParticipantToggle(contact);
                                    }
                                  }}
                                  tabIndex={0}
                                  role="button"
                                  aria-label={`Select ${contact.fullName || contact.username}`}
                                >
                                  <p className="text-sm font-medium text-gray-900 truncate">
                                    {contact.fullName || contact.username}
                                  </p>
                                  <p className="text-xs text-gray-500 truncate">
                                    {contact.email}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Form Actions */}
              <DialogFooter className="pt-4 space-x-3">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={handleClose}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button 
                  type="button" 
                  onClick={handleSubmit}
                  disabled={submitting || !formData.title.trim()}
                  className="min-w-[120px]"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Scheduling...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Schedule Meeting
                    </>
                  )}
                </Button>
              </DialogFooter>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}