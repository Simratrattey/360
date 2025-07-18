// src/controllers/meetingController.js
import Meeting from '../models/meeting.js';
import RRulePkg from 'rrule';
const { RRule } = RRulePkg;
import User from '../models/user.js';
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
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const docs = await Meeting.find({
      $or: [
        { participants: req.user.id },
        { organizer:    req.user.id }
      ]
    })
      .lean()
      .populate('organizer',    'fullName email')
      .populate('participants', 'fullName email');

    const occurrences = [];
    for (const m of docs) {
      const start = new Date(m.startTime);
      if (!m.recurrence?.frequency) {
        // non-recurring: include if in the next week
        if (start >= now && start <= nextWeek) {
          occurrences.push(m);
        }
      } else {
        const rule = new RRule({
          freq:     RRule[m.recurrence.frequency.toUpperCase()],
          interval: m.recurrence.interval,
          dtstart:  start,
          until:    nextWeek
        });
        const dates = rule.between(now, nextWeek, true);
        for (const dt of dates) {
          occurrences.push({ 
            ...m, 
            startTime: dt 
          });
        }
      }
    }

    occurrences.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
    res.json(occurrences);

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

// DELETE /api/meetings/:id  — Organizer cancels entire meeting
export const deleteMeeting = async (req, res, next) => {
  try {
    const m = await Meeting.findById(req.params.id);
    if (!m) return res.status(404).json({ message: 'Meeting not found' });
    if (m.organizer.toString() !== req.user.id)
      return res.status(403).json({ message: 'Not authorized' });
    await m.deleteOne();
    return res.sendStatus(204);
  } catch (err) {
    next(err);
  }
};

// PATCH /api/meetings/:id/leave  — Participant leaves meeting
export const leaveMeeting = async (req, res, next) => {
  try {
    const m = await Meeting.findById(req.params.id);
    if (!m) return res.status(404).json({ message: 'Meeting not found' });
    // remove this user
    m.participants = m.participants.filter(
      pid => pid.toString() !== req.user.id
    );
    // if fewer than 2 remain, delete entire meeting
    if (m.participants.length < 2) {
      await m.deleteOne();
      return res.sendStatus(204);
    }
    await m.save();
    // re-populate for response
    await m.populate('organizer', 'fullName email');
    await m.populate('participants', 'fullName email');
    return res.json(m);
  } catch (err) {
    next(err);
  }
};