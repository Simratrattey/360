import express from 'express';
import mongoose from 'mongoose';
import authMiddleware from '../middleware/auth.js';
// You'll need to import your models - adjust paths as needed
// import Meeting from '../models/meeting.js'; // If you have a meeting model
// import User from '../models/user.js'; // Already imported in server.js

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

    // For now, we'll use placeholder logic since we don't have a meetings collection
    // You can replace this with actual meeting queries when you have the meeting model

    // Total Meetings (placeholder - you'll need to implement based on your meeting storage)
    const totalMeetings = 0; // await Meeting.countDocuments({ participants: userId });
    const lastMonthMeetings = 0; // await Meeting.countDocuments({ participants: userId, createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth } });
    const meetingChange = lastMonthMeetings > 0 ? (((totalMeetings - lastMonthMeetings) / lastMonthMeetings) * 100).toFixed(0) : 0;

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

    // Hours this week (placeholder - you'll need meeting duration data)
    const hoursThisWeek = 0; // Calculate from meeting durations
    const hoursLastWeek = 0; // Calculate from last week's meetings
    const hoursChange = hoursLastWeek > 0 ? (((hoursThisWeek - hoursLastWeek) / hoursLastWeek) * 100).toFixed(0) : 0;

    // Upcoming meetings (placeholder - you'll need scheduled meetings)
    const upcomingMeetings = 0; // await Meeting.countDocuments({ participants: userId, scheduledFor: { $gte: new Date() } });

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
    
    // Placeholder recent meetings - replace with actual meeting queries
    // This would typically query your meetings collection
    const recentMeetings = [
      // await Meeting.find({ participants: userId })
      //   .sort({ createdAt: -1 })
      //   .limit(4)
      //   .populate('participants', 'username fullName')
    ];

    // For now, return empty array since we don't have meeting data
    // You can implement this once you have meeting records
    const formattedMeetings = [];

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