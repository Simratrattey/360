import express from 'express';
import {
  createMeeting,
  getUpcomingMeetings,
  getMeetingById
} from '../controllers/meetingController.js';

const router = express.Router();
router.post('/',        createMeeting);
router.get('/upcoming', getUpcomingMeetings);
router.get('/:id',      getMeetingById);

// ← add this if it isn’t there already:
export default router;