// src/controllers/meetingController.js
import Meeting from '../models/meeting.js';
import { randomUUID } from 'crypto';

export const createMeeting = async (req, res, next) => {
  try {
    const {
      title,
      description,
      participants,
      startTime,
      durationMinutes,
      recurrence
    } = req.body;

    const roomId = randomUUID();
    const meeting = await Meeting.create({
      title,
      description,
      organizer: req.user.id,
      participants,
      startTime,
      durationMinutes,
      recurrence,
      roomId,
    });

    res.status(201).json(meeting);
  } catch (err) {
    next(err);
  }
};

export const getUpcomingMeetings = async (req, res, next) => {
  try {
    const now = new Date();
    const meetings = await Meeting.find({
      startTime:    { $gte: now },
      participants: req.user.id
    })
      .sort('startTime')
      .populate('organizer', 'fullName email')
      .populate('participants', 'fullName email');

    res.json(meetings);
  } catch (err) {
    next(err);
  }
};

export const getMeetingById = async (req, res, next) => {
  try {
    const meeting = await Meeting.findById(req.params.id)
      .populate('organizer',    'fullName email')
      .populate('participants', 'fullName email');

    if (!meeting) return res.status(404).end();
    res.json(meeting);
  } catch (err) {
    next(err);
  }
};