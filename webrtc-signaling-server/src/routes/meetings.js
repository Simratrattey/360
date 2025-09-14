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

// Get past meetings with search functionality - MUST be before /:id route
router.get('/past', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { search, startDate, endDate, page = 1, limit = 10 } = req.query;
    
    console.log(`[Meetings] Fetching past meetings for user ${userId}`);
    
    // Build search query - more defensive approach
    const query = {
      $or: [
        { organizer: new mongoose.Types.ObjectId(userId) },
        { 'participantSessions.userId': new mongoose.Types.ObjectId(userId) }
      ],
      $and: [
        // Either has status 'ended' or has actualEndTime (meeting completed)
        {
          $or: [
            { status: 'ended' },
            { actualEndTime: { $exists: true, $ne: null } }
          ]
        }
      ]
    };
    
    // Add name search
    if (search) {
      query.title = { $regex: search, $options: 'i' };
    }
    
    // Add date range filter
    if (startDate || endDate) {
      const dateQuery = {};
      if (startDate) {
        dateQuery.$gte = new Date(startDate);
      }
      if (endDate) {
        dateQuery.$lte = new Date(endDate);
      }
      
      // Check both actualStartTime and startTime
      query.$and.push({
        $or: [
          { actualStartTime: dateQuery },
          { startTime: dateQuery }
        ]
      });
    }
    
    console.log(`[Meetings] Query:`, JSON.stringify(query, null, 2));
    
    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Get total count for pagination (excluding single-participant meetings)
    const countResult = await Meeting.aggregate([
      { $match: query },
      {
        $addFields: {
          participantCount: {
            $size: {
              $setUnion: [
                { $map: { input: '$participantSessions.userId', as: 'userId', in: '$$userId' } },
                []
              ]
            }
          }
        }
      },
      { $match: { participantCount: { $gt: 1 } } },
      { $count: 'total' }
    ]);
    const totalCount = countResult[0]?.total || 0;
    console.log(`[Meetings] Found ${totalCount} multi-participant meetings`);
    
    // Fetch meetings
    const meetings = await Meeting.find(query)
      .sort({ 
        actualStartTime: -1, 
        startTime: -1, 
        createdAt: -1 
      })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('organizer', 'username fullName avatarUrl')
      .lean();
    
    console.log(`[Meetings] Retrieved ${meetings.length} meetings for page ${page}`);
    
    // Format meetings for frontend
    const formattedMeetings = meetings.map(meeting => {
      try {
        // Get unique participants count - defensive approach
        const participantSessions = meeting.participantSessions || [];
        const uniqueParticipants = new Set(participantSessions.map(session => session.userId?.toString()).filter(Boolean));
        const participantCount = Math.max(uniqueParticipants.size, 1); // At least 1 (the organizer)
        
        // Format duration - use actualDurationMinutes or fallback to durationMinutes
        const durationMinutes = meeting.actualDurationMinutes || meeting.durationMinutes || 0;
        const hours = Math.floor(durationMinutes / 60);
        const minutes = durationMinutes % 60;
        const duration = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
        
        // Check if current user was organizer
        const isOrganizer = meeting.organizer && meeting.organizer._id.toString() === userId;
        
        // Get user's participation duration
        let userDuration = null;
        const userSession = participantSessions.find(session => 
          session.userId && session.userId.toString() === userId
        );
        if (userSession && userSession.durationMinutes) {
          const userMinutes = userSession.durationMinutes;
          const userHours = Math.floor(userMinutes / 60);
          const remainingMinutes = userMinutes % 60;
          userDuration = userHours > 0 ? `${userHours}h ${remainingMinutes}m` : `${remainingMinutes}m`;
        }
        
        // Use actualStartTime or fallback to startTime
        const startTime = meeting.actualStartTime || meeting.startTime;
        const endTime = meeting.actualEndTime || (startTime && durationMinutes ? 
          new Date(new Date(startTime).getTime() + durationMinutes * 60 * 1000) : null);
        
        return {
          id: meeting._id,
          roomId: meeting.roomId,
          title: meeting.title || 'Untitled Meeting',
          organizer: meeting.organizer || { username: 'Unknown', fullName: 'Unknown User' },
          isOrganizer,
          participantCount,
          totalDuration: duration,
          userDuration,
          startTime: startTime,
          endTime: endTime,
          visibility: meeting.visibility || 'public',
          recordingEnabled: meeting.recordingEnabled || false,
          maxParticipants: meeting.maxParticipants || participantCount
        };
      } catch (formatError) {
        console.error(`[Meetings] Error formatting meeting ${meeting._id}:`, formatError);
        // Return a minimal formatted meeting object
        return {
          id: meeting._id,
          roomId: meeting.roomId,
          title: meeting.title || 'Untitled Meeting',
          organizer: meeting.organizer || { username: 'Unknown', fullName: 'Unknown User' },
          isOrganizer: meeting.organizer && meeting.organizer._id.toString() === userId,
          participantCount: 1,
          totalDuration: '0m',
          userDuration: null,
          startTime: meeting.actualStartTime || meeting.startTime,
          endTime: meeting.actualEndTime,
          visibility: meeting.visibility || 'public',
          recordingEnabled: false,
          maxParticipants: 1
        };
      }
    })
    .filter(meeting => meeting.participantCount > 1); // Exclude single-participant meetings
    
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

// Test endpoint for Gemini AI service - MUST be before /:id route
router.get('/test-gemini', authMiddleware, async (req, res) => {
  try {
    console.log('[Test] Testing Gemini AI service...');
    
    // Import and test the service
    const { summarizeMeeting, validateGeminiConfig, testGeminiConnection } = await import('../services/geminiSummaryService.js');
    console.log('[Test] Successfully imported geminiSummaryService');
    
    // Test configuration
    const isConfigValid = validateGeminiConfig();
    console.log(`[Test] Gemini config validation: ${isConfigValid}`);
    
    if (!isConfigValid) {
      return res.json({
        success: false,
        error: 'Gemini API key not configured',
        config: isConfigValid
      });
    }
    
    // Test connection
    console.log('[Test] Testing Gemini connection...');
    const connectionTest = await testGeminiConnection();
    console.log(`[Test] Connection test result: ${connectionTest}`);
    
    // Test with sample transcript
    const sampleTranscript = [
      { speaker: 'John', text: 'Hello everyone, welcome to our meeting today.' },
      { speaker: 'Jane', text: 'Thanks John. I wanted to discuss our project progress.' },
      { speaker: 'Bob', text: 'Great! I have some updates to share about the development.' }
    ];
    
    console.log('[Test] Testing summarization with sample data...');
    const summary = await summarizeMeeting(sampleTranscript, 'Test Meeting');
    console.log(`[Test] Summary result: ${summary ? 'SUCCESS' : 'FAILED'}`);
    
    res.json({
      success: true,
      tests: {
        import: true,
        config: isConfigValid,
        connection: connectionTest,
        summarization: summary ? true : false
      },
      summary: summary || 'No summary generated',
      sampleData: sampleTranscript
    });
    
  } catch (error) {
    console.error('[Test] Error testing Gemini:', error);
    res.json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
});

router.patch('/:id/leave', leaveMeeting);
router.patch('/:id/join', authMiddleware, joinMeeting);
router.delete('/:id',   deleteMeeting);
router.get('/:id',      getMeetingById);

// Get meeting details with transcript/summary
router.get('/:id/details', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    // Find the meeting and check if user has access
    const meeting = await Meeting.findById(id)
      .populate('organizer', 'username fullName avatarUrl')
      .populate('transcript')
      .lean();
    
    if (!meeting) {
      return res.status(404).json({
        success: false,
        error: 'Meeting not found'
      });
    }
    
    // Check if user was a participant or organizer
    const hasAccess = meeting.organizer._id.toString() === userId ||
                     meeting.participantSessions?.some(session => 
                       session.userId.toString() === userId);
    
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. You were not a participant in this meeting.'
      });
    }
    
    // Format the meeting data
    const uniqueParticipants = new Set(meeting.participantSessions?.map(session => session.userId.toString()) || []);
    const participantCount = uniqueParticipants.size;
    
    const durationMinutes = meeting.actualDurationMinutes || 0;
    const hours = Math.floor(durationMinutes / 60);
    const minutes = durationMinutes % 60;
    const duration = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
    
    const isOrganizer = meeting.organizer._id.toString() === userId;
    
    // Get user's participation duration
    let userDuration = null;
    const userSession = meeting.participantSessions?.find(session => 
      session.userId.toString() === userId);
    if (userSession && userSession.durationMinutes) {
      const userMinutes = userSession.durationMinutes;
      const userHours = Math.floor(userMinutes / 60);
      const remainingMinutes = userMinutes % 60;
      userDuration = userHours > 0 ? `${userHours}h ${remainingMinutes}m` : `${remainingMinutes}m`;
    }
    
    // Format transcript entries if available
    let transcriptEntries = [];
    if (meeting.transcript && meeting.transcript.entries) {
      transcriptEntries = meeting.transcript.entries.map(entry => ({
        id: entry.id,
        text: entry.text,
        speaker: entry.speaker,
        timestamp: entry.timestamp,
        createdAt: entry.createdAt
      }));
    }
    
    const meetingDetails = {
      id: meeting._id,
      roomId: meeting.roomId,
      title: meeting.title,
      description: meeting.description,
      organizer: meeting.organizer,
      isOrganizer,
      participantCount,
      totalDuration: duration,
      userDuration,
      startTime: meeting.actualStartTime,
      endTime: meeting.actualEndTime,
      visibility: meeting.visibility,
      recordingEnabled: meeting.recordingEnabled,
      maxParticipants: meeting.maxParticipants || participantCount,
      summary: meeting.summary,
      transcript: transcriptEntries,
      hasTranscript: transcriptEntries.length > 0
    };
    
    res.json({
      success: true,
      meeting: meetingDetails
    });
    
  } catch (error) {
    console.error('Error fetching meeting details:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch meeting details'
    });
  }
});

// Regenerate AI summary for a meeting
router.post('/:id/regenerate-summary', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    // Find the meeting and check if user has access
    const meeting = await Meeting.findById(id);
    
    if (!meeting) {
      return res.status(404).json({
        success: false,
        error: 'Meeting not found'
      });
    }
    
    // Check if user was a participant or organizer
    const hasAccess = meeting.organizer.toString() === userId ||
                     meeting.participantSessions?.some(session => 
                       session.userId.toString() === userId);
    
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. You were not a participant in this meeting.'
      });
    }
    
    // Regenerate the summary
    await meeting.generateSummary();
    await meeting.save();
    
    res.json({
      success: true,
      message: 'Summary regenerated successfully',
      summary: meeting.summary
    });
    
  } catch (error) {
    console.error('Error regenerating meeting summary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to regenerate meeting summary'
    });
  }
});

// Waiting Room API Endpoints

// Get meeting info by roomId (for waiting room)
router.get('/:id/info', async (req, res) => {
  try {
    const { id: roomId } = req.params;
    
    const meeting = await Meeting.findOne({ roomId })
      .populate('organizer', 'username fullName')
      .populate('participants', 'username fullName');
    
    if (!meeting) {
      return res.status(404).json({ success: false, error: 'Meeting not found' });
    }
    
    res.json({
      success: true,
      meeting: {
        _id: meeting._id,
        title: meeting.title,
        description: meeting.description,
        startTime: meeting.startTime,
        organizer: meeting.organizer,
        participants: meeting.participants,
        roomId: meeting.roomId
      }
    });
    
  } catch (error) {
    console.error('Error fetching meeting info:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch meeting information' });
  }
});

// Request to join meeting (for waiting room)
router.post('/:id/request-join', authMiddleware, async (req, res) => {
  try {
    const { id: meetingId } = req.params;
    const userId = req.user.id;
    const { username, fullName } = req.user;

    const meeting = await Meeting.findOne({ roomId: meetingId });
    if (!meeting) {
      return res.status(404).json({ success: false, error: 'Meeting not found' });
    }

    // Check if user is already in the meeting or has pending request
    const existingRequest = meeting.pendingJoinRequests.find(
      req => req.userId.toString() === userId && req.status === 'pending'
    );
    
    if (existingRequest) {
      return res.status(400).json({ 
        success: false, 
        error: 'Join request already pending' 
      });
    }

    // Check if user is organizer or already a participant
    if (meeting.organizer.toString() === userId || 
        meeting.participants.some(p => p.toString() === userId)) {
      return res.status(400).json({ 
        success: false, 
        error: 'User is already authorized for this meeting' 
      });
    }

    // Add join request
    meeting.pendingJoinRequests.push({
      userId,
      username,
      fullName,
      requestedAt: new Date(),
      status: 'pending'
    });

    await meeting.save();

    // Emit real-time notification to host/organizer
    if (req.app.locals.sendJoinRequest) {
      req.app.locals.sendJoinRequest(meeting.organizer.toString(), {
        meetingId,
        requestId: meeting.pendingJoinRequests[meeting.pendingJoinRequests.length - 1]._id,
        user: { id: userId, username, fullName },
        meetingTitle: meeting.title
      });
    }

    res.json({
      success: true,
      message: 'Join request sent successfully',
      requestId: meeting.pendingJoinRequests[meeting.pendingJoinRequests.length - 1]._id
    });

  } catch (error) {
    console.error('Error requesting to join meeting:', error);
    res.status(500).json({ success: false, error: 'Failed to request join' });
  }
});

// Approve/Deny join request (host only)
router.post('/:id/handle-join-request', authMiddleware, async (req, res) => {
  try {
    const { id: meetingId } = req.params;
    const { requestId, action } = req.body; // action: 'approve' or 'deny'
    const hostId = req.user.id;

    const meeting = await Meeting.findOne({ roomId: meetingId });
    if (!meeting) {
      return res.status(404).json({ success: false, error: 'Meeting not found' });
    }

    // Check if user is the organizer
    if (meeting.organizer.toString() !== hostId) {
      return res.status(403).json({ success: false, error: 'Only meeting organizer can handle join requests' });
    }

    // Find the join request
    const requestIndex = meeting.pendingJoinRequests.findIndex(
      req => req._id.toString() === requestId && req.status === 'pending'
    );

    if (requestIndex === -1) {
      return res.status(404).json({ success: false, error: 'Join request not found or already handled' });
    }

    const joinRequest = meeting.pendingJoinRequests[requestIndex];
    
    if (action === 'approve') {
      // Add user to participants if not already there
      if (!meeting.participants.some(p => p.toString() === joinRequest.userId.toString())) {
        meeting.participants.push(joinRequest.userId);
      }
      joinRequest.status = 'approved';
      
      // Emit approval notification to the requesting user
      if (req.app.locals.sendJoinApproval) {
        req.app.locals.sendJoinApproval(joinRequest.userId.toString(), {
          meetingId,
          approved: true,
          meetingTitle: meeting.title
        });
      }
    } else if (action === 'deny') {
      joinRequest.status = 'denied';
      
      // Emit denial notification to the requesting user
      if (req.app.locals.sendJoinApproval) {
        req.app.locals.sendJoinApproval(joinRequest.userId.toString(), {
          meetingId,
          approved: false,
          meetingTitle: meeting.title,
          reason: req.body.reason || 'Request denied by host'
        });
      }
    } else {
      return res.status(400).json({ success: false, error: 'Invalid action' });
    }

    await meeting.save();

    // Update pending requests for host
    const pendingRequests = meeting.pendingJoinRequests
      .filter(req => req.status === 'pending')
      .map(req => ({
        requestId: req._id,
        userId: req.userId,
        username: req.username,
        fullName: req.fullName,
        requestedAt: req.requestedAt,
        status: req.status
      }));
    if (req.app.locals.sendJoinRequestsUpdate) {
      req.app.locals.sendJoinRequestsUpdate(hostId, {
        meetingId,
        pendingRequests,
        count: pendingRequests.length
      });
    }

    res.json({
      success: true,
      message: `Join request ${action}d successfully`,
      action,
      pendingCount: pendingRequests.length
    });

  } catch (error) {
    console.error('Error handling join request:', error);
    res.status(500).json({ success: false, error: 'Failed to handle join request' });
  }
});

// Get pending join requests (host only)
router.get('/:id/join-requests', authMiddleware, async (req, res) => {
  try {
    const { id: meetingId } = req.params;
    const hostId = req.user.id;

    const meeting = await Meeting.findOne({ roomId: meetingId }).populate('pendingJoinRequests.userId', 'username fullName');
    if (!meeting) {
      return res.status(404).json({ success: false, error: 'Meeting not found' });
    }

    // Check if user is the organizer
    if (meeting.organizer.toString() !== hostId) {
      return res.status(403).json({ success: false, error: 'Only meeting organizer can view join requests' });
    }

    const pendingRequests = meeting.pendingJoinRequests
      .filter(req => req.status === 'pending')
      .map(req => ({
        requestId: req._id,
        userId: req.userId,
        username: req.username,
        fullName: req.fullName,
        requestedAt: req.requestedAt,
        status: req.status
      }));

    res.json({
      success: true,
      requests: pendingRequests,
      count: pendingRequests.length
    });

  } catch (error) {
    console.error('Error fetching join requests:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch join requests' });
  }
});

export default router;