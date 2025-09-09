import express from 'express';
import mongoose from 'mongoose';
import authMiddleware from '../middleware/auth.js';
import Meeting from '../models/meeting.js';
import User from '../models/user.js';

const router = express.Router();

// Get dashboard statistics for the authenticated user
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const now = new Date();
    const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    // Total Meetings - count all meetings where user was organizer or participant
    const totalMeetings = await Meeting.countDocuments({
      $or: [
        { organizer: userId },
        { 'participantSessions.userId': userId }
      ],
      status: 'ended' // Only count completed meetings
    });

    const lastMonthMeetings = await Meeting.countDocuments({
      $or: [
        { organizer: userId },
        { 'participantSessions.userId': userId }
      ],
      status: 'ended',
      actualStartTime: { $gte: startOfLastMonth, $lte: endOfLastMonth }
    });

    const meetingChange = lastMonthMeetings > 0 ? (((totalMeetings - lastMonthMeetings) / lastMonthMeetings) * 100).toFixed(0) : 
                         totalMeetings > 0 ? 100 : 0;

    // Active Contacts (users the current user has conversations with)
    const activeContacts = await mongoose.connection.db.collection('conversations').aggregate([
      {
        $match: {
          participants: new mongoose.Types.ObjectId(userId),
          type: { $in: ['dm', 'group'] }
        }
      },
      {
        $unwind: '$participants'
      },
      {
        $match: {
          participants: { $ne: new mongoose.Types.ObjectId(userId) }
        }
      },
      {
        $group: {
          _id: '$participants'
        }
      },
      {
        $count: 'total'
      }
    ]).toArray();

    const activeContactsCount = activeContacts[0]?.total || 0;

    // Hours this week - sum actual meeting duration from participantSessions
    const userMeetingsThisWeek = await Meeting.aggregate([
      {
        $match: {
          actualStartTime: { $gte: startOfWeek, $lte: endOfWeek },
          status: 'ended'
        }
      },
      {
        $unwind: '$participantSessions'
      },
      {
        $match: {
          'participantSessions.userId': new mongoose.Types.ObjectId(userId)
        }
      },
      {
        $group: {
          _id: null,
          totalMinutes: { $sum: '$participantSessions.durationMinutes' }
        }
      }
    ]);

    const minutesThisWeek = userMeetingsThisWeek[0]?.totalMinutes || 0;
    const hoursThisWeek = (minutesThisWeek / 60).toFixed(1);

    // Calculate last week for comparison
    const lastWeekStart = new Date(startOfWeek);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);
    const lastWeekEnd = new Date(endOfWeek);
    lastWeekEnd.setDate(lastWeekEnd.getDate() - 7);

    const userMeetingsLastWeek = await Meeting.aggregate([
      {
        $match: {
          actualStartTime: { $gte: lastWeekStart, $lte: lastWeekEnd },
          status: 'ended'
        }
      },
      {
        $unwind: '$participantSessions'
      },
      {
        $match: {
          'participantSessions.userId': new mongoose.Types.ObjectId(userId)
        }
      },
      {
        $group: {
          _id: null,
          totalMinutes: { $sum: '$participantSessions.durationMinutes' }
        }
      }
    ]);

    const minutesLastWeek = userMeetingsLastWeek[0]?.totalMinutes || 0;
    const hoursLastWeek = minutesLastWeek / 60;
    const hoursChange = hoursLastWeek > 0 ? (((hoursThisWeek - hoursLastWeek) / hoursLastWeek) * 100).toFixed(0) : 
                       hoursThisWeek > 0 ? 100 : 0;

    // Upcoming meetings - scheduled meetings in the future
    const upcomingMeetings = await Meeting.countDocuments({
      $or: [
        { organizer: userId },
        { participants: userId }
      ],
      status: 'scheduled',
      startTime: { $gte: new Date() }
    });

    const stats = [
      {
        name: 'Total Meetings',
        value: totalMeetings.toString(),
        icon: 'Video',
        change: `${meetingChange >= 0 ? '+' : ''}${meetingChange}%`,
        changeType: meetingChange >= 0 ? 'positive' : 'negative'
      },
      {
        name: 'Active Contacts',
        value: activeContactsCount.toString(),
        icon: 'Users',
        change: '+0%', // Placeholder - you'd calculate this from historical data
        changeType: 'neutral'
      },
      {
        name: 'Hours This Week',
        value: hoursThisWeek.toString(),
        icon: 'Clock',
        change: `${hoursChange >= 0 ? '+' : ''}${hoursChange}%`,
        changeType: hoursChange >= 0 ? 'positive' : 'negative'
      },
      {
        name: 'Upcoming',
        value: upcomingMeetings.toString(),
        icon: 'Calendar',
        change: '0%', // Placeholder
        changeType: 'neutral'
      }
    ];

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard statistics'
    });
  }
});

// Get recent meetings for the authenticated user
router.get('/recent-meetings', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get recent meetings where user was organizer or participant
    const recentMeetings = await Meeting.find({
      $or: [
        { organizer: userId },
        { 'participantSessions.userId': userId }
      ],
      status: 'ended' // Only show completed meetings
    })
    .sort({ actualStartTime: -1 })
    .limit(4)
    .populate('organizer', 'username fullName')
    .lean();

    const formattedMeetings = recentMeetings.map(meeting => {
      // Get unique participants count
      const uniqueParticipants = new Set(meeting.participantSessions?.map(session => session.userId.toString()) || []);
      const participantCount = uniqueParticipants.size;
      
      // Format duration
      const durationMinutes = meeting.actualDurationMinutes || 0;
      const hours = Math.floor(durationMinutes / 60);
      const minutes = durationMinutes % 60;
      const duration = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
      
      // Format date
      const meetingDate = new Date(meeting.actualStartTime);
      const now = new Date();
      const diffHours = Math.floor((now - meetingDate) / (1000 * 60 * 60));
      const diffDays = Math.floor(diffHours / 24);
      
      let dateString;
      if (diffHours < 1) {
        dateString = 'Just now';
      } else if (diffHours < 24) {
        dateString = `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
      } else if (diffDays === 1) {
        dateString = 'Yesterday';
      } else if (diffDays < 7) {
        dateString = `${diffDays} days ago`;
      } else {
        dateString = meetingDate.toLocaleDateString();
      }

      return {
        id: meeting._id,
        title: meeting.title,
        participants: participantCount,
        duration: duration,
        date: dateString,
        status: 'completed'
      };
    });

    res.json({
      success: true,
      meetings: formattedMeetings
    });
  } catch (error) {
    console.error('Error fetching recent meetings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch recent meetings'
    });
  }
});

export default router;