import express from 'express';
import {
  createMeeting,
  getUpcomingMeetings,
  getMeetingById,
  deleteMeeting,
  leaveMeeting
} from '../controllers/meetingController.js';

const router = express.Router();
router.post('/',        createMeeting);
router.get('/upcoming', getUpcomingMeetings);
router.patch('/:id/leave', leaveMeeting);
router.delete('/:id',   deleteMeeting);
router.get('/:id',      getMeetingById);

// ← add this if it isn’t there already:
export default router;