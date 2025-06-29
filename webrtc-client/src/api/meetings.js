// src/api/meetings.js
import API from './client.js';

export const scheduleMeeting = meetingData =>
  API.post('/api/meetings', meetingData).then(res => res.data);

export const fetchUpcomingMeetings = () =>
  API.get('/api/meetings/upcoming').then(res => res.data);

export const getMeeting = id =>
  API.get(`/api/meetings/${id}`).then(res => res.data);