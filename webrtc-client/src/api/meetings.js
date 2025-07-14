// src/api/meetings.js
import API from './client.js';

export const scheduleMeeting = meetingData =>
  API.post('/meetings', meetingData).then(res => res.data);

export const fetchUpcomingMeetings = () =>
  API.get('/meetings/upcoming').then(res => res.data);

export const getMeeting = id =>
  API.get(`/meetings/${id}`).then(res => res.data);