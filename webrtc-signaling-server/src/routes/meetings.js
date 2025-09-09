import express from 'express';
import {
  createMeeting,
  getUpcomingMeetings,
  getMeetingById,
  deleteMeeting,
  leaveMeeting,
  joinMeeting
} from '../controllers/meetingController.js';
import Meeting from '../models/meeting.js';
import mongoose from 'mongoose';

import authMiddleware from '../middleware/auth.js';

const router = express.Router();
router.post('/',        createMeeting);
router.get('/upcoming', getUpcomingMeetings);
router.patch('/:id/leave', leaveMeeting);
router.patch('/:id/join', authMiddleware, joinMeeting);
router.delete('/:id',   deleteMeeting);
router.get('/:id',      getMeetingById);

// Get past meetings with search functionality
router.get('/past', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { search, startDate, endDate, page = 1, limit = 10 } = req.query;
    
    // Build search query
    const query = {
      $or: [
        { organizer: userId },
        { 'participantSessions.userId': userId }
      ],
      status: 'ended' // Only completed meetings
    };
    
    // Add name search
    if (search) {
      query.title = { $regex: search, $options: 'i' };
    }
    
    // Add date range filter
    if (startDate || endDate) {
      query.actualStartTime = {};
      if (startDate) {
        query.actualStartTime.$gte = new Date(startDate);
      }
      if (endDate) {
        query.actualStartTime.$lte = new Date(endDate);
      }
    }
    
    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Get total count for pagination
    const totalCount = await Meeting.countDocuments(query);
    
    // Fetch meetings
    const meetings = await Meeting.find(query)
      .sort({ actualStartTime: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('organizer', 'username fullName avatarUrl')
      .lean();
    
    // Format meetings for frontend
    const formattedMeetings = meetings.map(meeting => {
      // Get unique participants count
      const uniqueParticipants = new Set(meeting.participantSessions?.map(session => session.userId.toString()) || []);
      const participantCount = uniqueParticipants.size;
      
      // Format duration
      const durationMinutes = meeting.actualDurationMinutes || 0;
      const hours = Math.floor(durationMinutes / 60);
      const minutes = durationMinutes % 60;
      const duration = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
      
      // Check if current user was organizer
      const isOrganizer = meeting.organizer._id.toString() === userId;
      
      // Get user's participation duration
      let userDuration = 0;
      const userSession = meeting.participantSessions?.find(session => 
        session.userId.toString() === userId
      );
      if (userSession && userSession.durationMinutes) {
        const userMinutes = userSession.durationMinutes;
        const userHours = Math.floor(userMinutes / 60);
        const remainingMinutes = userMinutes % 60;
        userDuration = userHours > 0 ? `${userHours}h ${remainingMinutes}m` : `${remainingMinutes}m`;
      }
      
      return {
        id: meeting._id,
        roomId: meeting.roomId,
        title: meeting.title,
        organizer: meeting.organizer,
        isOrganizer,
        participantCount,
        totalDuration: duration,
        userDuration,
        startTime: meeting.actualStartTime,
        endTime: meeting.actualEndTime,
        visibility: meeting.visibility,
        recordingEnabled: meeting.recordingEnabled,
        maxParticipants: meeting.maxParticipants || participantCount
      };
    });
    
    res.json({
      success: true,
      meetings: formattedMeetings,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / parseInt(limit)),
        totalCount,
        hasNextPage: skip + formattedMeetings.length < totalCount,
        hasPrevPage: parseInt(page) > 1
      }
    });
    
  } catch (error) {
    console.error('Error fetching past meetings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch past meetings'
    });
  }
});

// ← add this if it isn’t there already:
export default router;