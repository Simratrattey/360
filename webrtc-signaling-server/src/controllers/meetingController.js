// src/controllers/meetingController.js
import Meeting from '../models/meeting.js';
import RRulePkg from 'rrule';
const { RRule } = RRulePkg;
import User from '../models/user.js';
import { createNotification } from './notificationController.js';
import { randomUUID } from 'crypto';
import { dashboardCache } from '../routes/dashboard.js';

export const createMeeting = async (req, res, next) => {
  try {
    const {
      title,
      description,
      location,
      participants,
      startTime,
      durationMinutes,
      recurrence,
      visibility
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
      visibility: visibility || 'public',
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
          
          // Send dashboard refresh event to participant
          if (req.app.locals.sendDashboardRefresh) {
            req.app.locals.sendDashboardRefresh(participantId, {
              reason: 'meeting_scheduled',
              meetingId: meeting._id,
              organizerName
            });
          }
        }
      }
    } catch (notificationError) {
      console.error('Error sending notifications:', notificationError);
      // Don't fail the meeting creation if notifications fail
    }

    // Invalidate dashboard cache for the organizer and all participants
    const organizerId = req.user.id;
    dashboardCache.delete(`dashboard-stats-${organizerId}`);
    dashboardCache.delete(`recent-meetings-${organizerId}`);
    
    // Also invalidate cache for all participants so they see the updated upcoming count
    for (const participantId of participants) {
      const participantIdStr = participantId.toString();
      if (participantIdStr !== organizerId.toString()) {
        dashboardCache.delete(`dashboard-stats-${participantIdStr}`);
        dashboardCache.delete(`recent-meetings-${participantIdStr}`);
        console.log(`[Dashboard] Invalidated cache for participant ${participantIdStr}`);
      }
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
    // Skip if this is a special route like 'past', 'upcoming', etc.
    if (req.params.id === 'past' || req.params.id === 'upcoming') {
      return next(); // Pass to next route handler
    }
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
    
    // Invalidate dashboard cache for organizer and all participants before deletion
    const organizerId = m.organizer.toString();
    dashboardCache.delete(`dashboard-stats-${organizerId}`);
    dashboardCache.delete(`recent-meetings-${organizerId}`);
    
    for (const participantId of m.participants) {
      const participantIdStr = participantId.toString();
      if (participantIdStr !== organizerId) {
        dashboardCache.delete(`dashboard-stats-${participantIdStr}`);
        dashboardCache.delete(`recent-meetings-${participantIdStr}`);
        console.log(`[Dashboard] Invalidated cache for participant ${participantIdStr} (meeting deleted)`);
        
        // Send dashboard refresh event to participant
        if (req.app.locals.sendDashboardRefresh) {
          req.app.locals.sendDashboardRefresh(participantIdStr, {
            reason: 'meeting_cancelled',
            meetingTitle: m.title
          });
        }
      }
    }
    
    // Send dashboard refresh to organizer too
    if (req.app.locals.sendDashboardRefresh) {
      req.app.locals.sendDashboardRefresh(organizerId, {
        reason: 'meeting_cancelled',
        meetingTitle: m.title
      });
    }
    
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
    
    // Invalidate cache for the leaving participant
    const leavingUserId = req.user.id.toString();
    dashboardCache.delete(`dashboard-stats-${leavingUserId}`);
    dashboardCache.delete(`recent-meetings-${leavingUserId}`);
    
    // Send dashboard refresh to leaving participant
    if (req.app.locals.sendDashboardRefresh) {
      req.app.locals.sendDashboardRefresh(leavingUserId, {
        reason: 'meeting_left',
        meetingTitle: m.title
      });
    }
    
    // remove this user
    m.participants = m.participants.filter(
      pid => pid.toString() !== req.user.id
    );
    
    // if fewer than 2 remain, delete entire meeting
    if (m.participants.length < 2) {
      // Invalidate cache for remaining participants and organizer before deletion
      const organizerId = m.organizer.toString();
      dashboardCache.delete(`dashboard-stats-${organizerId}`);
      dashboardCache.delete(`recent-meetings-${organizerId}`);
      
      for (const participantId of m.participants) {
        const participantIdStr = participantId.toString();
        dashboardCache.delete(`dashboard-stats-${participantIdStr}`);
        dashboardCache.delete(`recent-meetings-${participantIdStr}`);
      }
      
      await m.deleteOne();
      return res.sendStatus(204);
    }
    
    // Invalidate cache for organizer and remaining participants
    const organizerId = m.organizer.toString();
    dashboardCache.delete(`dashboard-stats-${organizerId}`);
    dashboardCache.delete(`recent-meetings-${organizerId}`);
    
    for (const participantId of m.participants) {
      const participantIdStr = participantId.toString();
      if (participantIdStr !== organizerId && participantIdStr !== leavingUserId) {
        dashboardCache.delete(`dashboard-stats-${participantIdStr}`);
        dashboardCache.delete(`recent-meetings-${participantIdStr}`);
        
        // Send dashboard refresh to remaining participants
        if (req.app.locals.sendDashboardRefresh) {
          req.app.locals.sendDashboardRefresh(participantIdStr, {
            reason: 'meeting_participant_left',
            meetingTitle: m.title
          });
        }
      }
    }
    
    // Send dashboard refresh to organizer
    if (req.app.locals.sendDashboardRefresh && organizerId !== leavingUserId) {
      req.app.locals.sendDashboardRefresh(organizerId, {
        reason: 'meeting_participant_left',
        meetingTitle: m.title
      });
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

export const joinMeeting = async (req, res, next) => {
  try {
    const m = await Meeting.findById(req.params.id);
    if (!m) return res.status(404).end();
    if (!m.participants.includes(req.user.id)) {
      m.participants.push(req.user.id);
      
      // Invalidate cache for the new participant and organizer
      const newParticipantId = req.user.id.toString();
      const organizerId = m.organizer.toString();
      
      dashboardCache.delete(`dashboard-stats-${newParticipantId}`);
      dashboardCache.delete(`recent-meetings-${newParticipantId}`);
      dashboardCache.delete(`dashboard-stats-${organizerId}`);
      dashboardCache.delete(`recent-meetings-${organizerId}`);
      
      // Also invalidate cache for existing participants
      for (const participantId of m.participants) {
        const participantIdStr = participantId.toString();
        if (participantIdStr !== newParticipantId && participantIdStr !== organizerId) {
          dashboardCache.delete(`dashboard-stats-${participantIdStr}`);
          dashboardCache.delete(`recent-meetings-${participantIdStr}`);
          
          // Send dashboard refresh to existing participants
          if (req.app.locals.sendDashboardRefresh) {
            req.app.locals.sendDashboardRefresh(participantIdStr, {
              reason: 'meeting_participant_joined',
              meetingTitle: m.title
            });
          }
        }
      }
      
      // Send dashboard refresh to new participant and organizer
      if (req.app.locals.sendDashboardRefresh) {
        req.app.locals.sendDashboardRefresh(newParticipantId, {
          reason: 'meeting_joined',
          meetingTitle: m.title
        });
        
        if (organizerId !== newParticipantId) {
          req.app.locals.sendDashboardRefresh(organizerId, {
            reason: 'meeting_participant_joined',
            meetingTitle: m.title
          });
        }
      }
      
      await m.save();
    }
    await m.populate('participants', 'fullName email');
    res.json(m);
  } catch(err) {
    next(err);
  }
};