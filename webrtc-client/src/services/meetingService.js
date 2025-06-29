// src/services/meetingService.js
import api from './api'; // or wherever your axios/http instance lives

export const scheduleMeeting = data =>
  api.post('/meetings', data).then(r => r.data);

export const fetchUpcomingMeetings = () =>
  api.get('/meetings/upcoming').then(r => r.data);

export const fetchMeeting = id =>
  api.get(`/meetings/${id}`).then(r => r.data);