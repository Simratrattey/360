import express from 'express';
import mongoose from 'mongoose';
import authMiddleware from '../middleware/auth.js';
import Meeting from '../models/meeting.js';
import User from '../models/user.js';

const router = express.Router();

// Simple in-memory cache for dashboard stats (5 minute TTL)
const dashboardCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Get dashboard statistics for the authenticated user (optimized)
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const cacheKey = `dashboard-stats-${userId}`;
    
    // Check cache first
    const cached = dashboardCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log(`[Dashboard] Serving cached stats for user ${userId}`);
      return res.json({ success: true, stats: cached.data });
    }

    console.log(`[Dashboard] Computing fresh stats for user ${userId}`);
    
    const now = new Date();
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    // Use a single aggregation query to get multiple stats efficiently
    const userStats = await Meeting.aggregate([
      {
        $match: {
          $or: [
            { organizer: new mongoose.Types.ObjectId(userId) },
            { 'participantSessions.userId': new mongoose.Types.ObjectId(userId) }
          ]
        }
      },
      {
        $facet: {
          // Total completed meetings
          totalMeetings: [
            { $match: { status: 'ended' } },
            { $count: 'count' }
          ],
          // Upcoming meetings
          upcomingMeetings: [
            { 
              $match: { 
                status: 'scheduled',
                startTime: { $gte: now }
              }
            },
            { $count: 'count' }
          ],
          // Weekly hours calculation
          weeklyHours: [
            {
              $match: {
                status: 'ended',
                actualStartTime: { $gte: startOfWeek, $lte: endOfWeek }
              }
            },
            { $unwind: '$participantSessions' },
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
          ]
        }
      }
    ]);

    // Quick approximation for active contacts - just count unique organizers/participants from recent meetings
    const recentContacts = await Meeting.aggregate([
      {
        $match: {
          $or: [
            { organizer: new mongoose.Types.ObjectId(userId) },
            { 'participantSessions.userId': new mongoose.Types.ObjectId(userId) }
          ],
          status: 'ended',
          actualStartTime: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Last 30 days
        }
      },
      {
        $group: {
          _id: null,
          organizers: { $addToSet: '$organizer' },
          participants: { $addToSet: '$participantSessions.userId' }
        }
      },
      {
        $project: {
          uniqueContacts: {
            $size: {
              $setUnion: ['$organizers', { $reduce: { input: '$participants', initialValue: [], in: { $setUnion: ['$$value', '$$this'] } } }]
            }
          }
        }
      }
    ]);

    // Extract results with defaults
    const stats = userStats[0];
    const totalMeetings = stats.totalMeetings[0]?.count || 0;
    const upcomingMeetings = stats.upcomingMeetings[0]?.count || 0;
    const minutesThisWeek = stats.weeklyHours[0]?.totalMinutes || 0;
    const hoursThisWeek = (minutesThisWeek / 60).toFixed(1);
    const activeContactsCount = Math.max(0, (recentContacts[0]?.uniqueContacts || 1) - 1); // Subtract self

    const dashboardStats = [
      {
        name: 'Total Meetings',
        value: totalMeetings.toString(),
        icon: 'Video',
        change: '+0%', // Simplified - no historical comparison for performance
        changeType: 'neutral'
      },
      {
        name: 'Active Contacts',
        value: activeContactsCount.toString(),
        icon: 'Users',
        change: '+0%',
        changeType: 'neutral'
      },
      {
        name: 'Hours This Week',
        value: hoursThisWeek.toString(),
        icon: 'Clock',
        change: '+0%', // Simplified for performance
        changeType: 'neutral'
      },
      {
        name: 'Upcoming',
        value: upcomingMeetings.toString(),
        icon: 'Calendar',
        change: '0%',
        changeType: 'neutral'
      }
    ];

    // Cache the results
    dashboardCache.set(cacheKey, {
      data: dashboardStats,
      timestamp: Date.now()
    });

    res.json({
      success: true,
      stats: dashboardStats
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard statistics'
    });
  }
});

// Get recent meetings for the authenticated user (optimized)
router.get('/recent-meetings', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const cacheKey = `recent-meetings-${userId}`;
    
    // Check cache first (shorter TTL for recent meetings)
    const cached = dashboardCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL / 2) { // 2.5 minute cache
      console.log(`[Dashboard] Serving cached recent meetings for user ${userId}`);
      return res.json({ success: true, meetings: cached.data });
    }

    console.log(`[Dashboard] Computing fresh recent meetings for user ${userId}`);
    
    // Optimized query - get only essential fields and use lean()
    const recentMeetings = await Meeting.find({
      $or: [
        { organizer: userId },
        { 'participantSessions.userId': userId }
      ],
      status: 'ended' // Only show completed meetings
    }, {
      // Select only needed fields for performance
      title: 1,
      actualStartTime: 1,
      actualDurationMinutes: 1,
      participantSessions: 1,
      organizer: 1
    })
    .sort({ actualStartTime: -1 })
    .limit(4)
    .populate('organizer', 'username fullName')
    .lean();

    const formattedMeetings = recentMeetings.map(meeting => {
      // Get unique participants count efficiently
      const participantCount = new Set(meeting.participantSessions?.map(session => session.userId.toString()) || []).size;
      
      // Format duration
      const durationMinutes = meeting.actualDurationMinutes || 0;
      const hours = Math.floor(durationMinutes / 60);
      const minutes = durationMinutes % 60;
      const duration = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
      
      // Format date efficiently
      const meetingDate = new Date(meeting.actualStartTime);
      const diffHours = Math.floor((Date.now() - meetingDate.getTime()) / (1000 * 60 * 60));
      const diffDays = Math.floor(diffHours / 24);
      
      let dateString;
      if (diffHours < 1) {
        dateString = 'Just now';
      } else if (diffHours < 24) {
        dateString = `${diffHours}h ago`;
      } else if (diffDays === 1) {
        dateString = 'Yesterday';
      } else if (diffDays < 7) {
        dateString = `${diffDays}d ago`;
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

    // Cache the results
    dashboardCache.set(cacheKey, {
      data: formattedMeetings,
      timestamp: Date.now()
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