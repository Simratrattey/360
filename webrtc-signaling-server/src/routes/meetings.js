import express from 'express';
import {
  createMeeting,
  getUpcomingMeetings,
  getMeetingById,
  deleteMeeting,
  leaveMeeting,
  joinMeeting
} from '../controllers/meetingController.js';

import authMiddleware from '../middleware/auth.js';

const router = express.Router();
router.post('/',        createMeeting);
router.get('/upcoming', getUpcomingMeetings);
router.patch('/:id/leave', leaveMeeting);
router.patch('/:id/join', authMiddleware, joinMeeting);
router.delete('/:id',   deleteMeeting);
router.get('/:id',      getMeetingById);

// ← add this if it isn’t there already:
export default router;