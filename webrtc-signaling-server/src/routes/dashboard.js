import express from 'express';
import mongoose from 'mongoose';
import authMiddleware from '../middleware/auth.js';
import Meeting from '../models/meeting.js';
import User from '../models/user.js';

const router = express.Router();

// Simple in-memory cache for dashboard stats (5 minute TTL)
const dashboardCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Export cache for invalidation from other modules
export { dashboardCache };

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

    // Calculate date ranges for comparison
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    const lastWeekStart = new Date(startOfWeek);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);
    const lastWeekEnd = new Date(endOfWeek);
    lastWeekEnd.setDate(lastWeekEnd.getDate() - 7);

    // Use a single aggregation query to get multiple stats efficiently with historical data
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
          // Last month's meetings for comparison
          lastMonthMeetings: [
            { 
              $match: { 
                status: 'ended',
                actualStartTime: { $gte: lastMonthStart, $lte: lastMonthEnd }
              }
            },
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
          // Last week's upcoming meetings for comparison
          lastWeekUpcoming: [
            { 
              $match: { 
                status: 'scheduled',
                startTime: { $gte: lastWeekStart, $lte: lastWeekEnd }
              }
            },
            { $count: 'count' }
          ],
          // This week's hours
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
          ],
          // Last week's hours for comparison
          lastWeekHours: [
            {
              $match: {
                status: 'ended',
                actualStartTime: { $gte: lastWeekStart, $lte: lastWeekEnd }
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

    // Get active contacts for current and previous periods
    const contactsData = await Meeting.aggregate([
      {
        $match: {
          $or: [
            { organizer: new mongoose.Types.ObjectId(userId) },
            { 'participantSessions.userId': new mongoose.Types.ObjectId(userId) }
          ],
          status: 'ended'
        }
      },
      {
        $facet: {
          // Current period - last 30 days
          currentContacts: [
            {
              $match: {
                actualStartTime: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
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
          ],
          // Previous period - 31-60 days ago
          previousContacts: [
            {
              $match: {
                actualStartTime: { 
                  $gte: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
                  $lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
                }
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
          ]
        }
      }
    ]);

    // Extract results with defaults
    const stats = userStats[0];
    const totalMeetings = stats.totalMeetings[0]?.count || 0;
    const upcomingMeetings = stats.upcomingMeetings[0]?.count || 0;
    const minutesThisWeek = stats.weeklyHours[0]?.totalMinutes || 0;
    const hoursThisWeek = (minutesThisWeek / 60).toFixed(1);
    
    // Extract contacts data
    const contactsResult = contactsData[0];
    const currentContacts = Math.max(0, (contactsResult?.currentContacts[0]?.uniqueContacts || 1) - 1); // Subtract self
    const previousContacts = Math.max(0, (contactsResult?.previousContacts[0]?.uniqueContacts || 1) - 1); // Subtract self
    
    // Calculate historical comparison metrics
    const lastMonthMeetings = stats.lastMonthMeetings[0]?.count || 0;
    const lastWeekMinutes = stats.lastWeekHours[0]?.totalMinutes || 0;
    const lastWeekUpcoming = stats.lastWeekUpcoming[0]?.count || 0;
    
    // Calculate percentage changes
    const calculateChange = (current, previous) => {
      if (previous === 0) return current > 0 ? '+100%' : '0%';
      const change = ((current - previous) / previous) * 100;
      return change > 0 ? `+${Math.round(change)}%` : `${Math.round(change)}%`;
    };
    
    const getChangeType = (current, previous) => {
      if (current > previous) return 'positive';
      if (current < previous) return 'negative';
      return 'neutral';
    };
    
    const meetingsChange = calculateChange(totalMeetings, lastMonthMeetings);
    const hoursChange = calculateChange(minutesThisWeek, lastWeekMinutes);
    const contactsChange = calculateChange(currentContacts, previousContacts);
    const upcomingChange = calculateChange(upcomingMeetings, lastWeekUpcoming);

    const dashboardStats = [
      {
        name: 'Total Meetings',
        value: totalMeetings.toString(),
        icon: 'Video',
        change: meetingsChange,
        changeType: getChangeType(totalMeetings, lastMonthMeetings)
      },
      {
        name: 'Active Contacts',
        value: currentContacts.toString(),
        icon: 'Users',
        change: contactsChange,
        changeType: getChangeType(currentContacts, previousContacts)
      },
      {
        name: 'Hours This Week',
        value: hoursThisWeek.toString(),
        icon: 'Clock',
        change: hoursChange,
        changeType: getChangeType(minutesThisWeek, lastWeekMinutes)
      },
      {
        name: 'Upcoming',
        value: upcomingMeetings.toString(),
        icon: 'Calendar',
        change: upcomingChange,
        changeType: getChangeType(upcomingMeetings, lastWeekUpcoming)
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