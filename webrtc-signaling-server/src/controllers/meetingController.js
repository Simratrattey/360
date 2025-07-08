// src/controllers/meetingController.js
import Meeting from '../models/meeting.js';
import { createNotification } from './notificationController.js';
import { randomUUID } from 'crypto';

export const createMeeting = async (req, res, next) => {
  try {
    const {
      title,
      description,
      location,
      participants,
      startTime,
      durationMinutes,
      recurrence
    } = req.body;

    // Validation
    if (!title || !title.trim()) {
      return res.status(400).json({ message: 'Meeting title is required' });
    }

    if (!startTime) {
      return res.status(400).json({ message: 'Start time is required' });
    }

    const startDate = new Date(startTime);
    if (startDate < new Date()) {
      return res.status(400).json({ message: 'Start time cannot be in the past' });
    }

    if (!durationMinutes || durationMinutes < 1) {
      return res.status(400).json({ message: 'Duration must be at least 1 minute' });
    }

    const roomId = randomUUID();
    const meeting = await Meeting.create({
      title: title.trim(),
      description: description?.trim() || '',
      location: location?.trim() || '',
      organizer: req.user.id,
      participants: participants || [],
      startTime: startDate,
      durationMinutes,
      recurrence,
      roomId,
    });

    // Populate organizer and participants for response
    await meeting.populate('organizer', 'fullName email');
    await meeting.populate('participants', 'fullName email');

    // Send notifications to all participants
    try {
      const organizer = await User.findById(req.user.id).select('fullName username');
      const organizerName = organizer.fullName || organizer.username;
      
      for (const participantId of participants) {
        if (participantId.toString() !== req.user.id.toString()) {
          const notification = await createNotification(
            participantId,
            req.user.id,
            'meeting_invitation',
            `Meeting Invitation: ${title}`,
            `${organizerName} has invited you to a meeting: "${title}"`,
            {
              meetingId: meeting._id,
              roomId: meeting.roomId,
              startTime: meeting.startTime,
              durationMinutes: meeting.durationMinutes,
              location: meeting.location
            }
          );

          // Send real-time notification if user is online
          if (req.app.locals.sendNotification) {
            req.app.locals.sendNotification(participantId, notification);
          }
        }
      }
    } catch (notificationError) {
      console.error('Error sending notifications:', notificationError);
      // Don't fail the meeting creation if notifications fail
    }

    res.status(201).json(meeting);
  } catch (err) {
    console.error('Error creating meeting:', err);
    next(err);
  }
};

export const getUpcomingMeetings = async (req, res, next) => {
  try {
    const now = new Date();
    const meetings = await Meeting.find({
      startTime: { $gte: now },
      $or: [
        { participants: req.user.id },
        { organizer: req.user.id }
      ]
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