// routes/meetings.js
const express = require('express');
const { createMeeting, getUpcomingMeetings, getMeetingById } = require('../controllers/meetingController');
const auth = require('../middleware/auth');  // your JWT-check middleware
const router = express.Router();

router.use(auth);
router.post('/', createMeeting);
router.get('/upcoming', getUpcomingMeetings);
router.get('/:id', getMeetingById);

module.exports = router;