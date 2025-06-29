// controllers/meetingController.js
const Meeting = require('../models/Meeting');
const { nanoid } = require('nanoid');  // for unique room IDs

exports.createMeeting = async (req, res, next) => {
  try {
    const { title, description, participants, startTime, durationMinutes, recurrence } = req.body;
    const roomId = nanoid(10);
    const meeting = await Meeting.create({
      title, description,
      organizer: req.user.id,
      participants,
      startTime, durationMinutes,
      recurrence,
      roomId,
    });
    res.status(201).json(meeting);
  } catch (err) {
    next(err);
  }
};

exports.getUpcomingMeetings = async (req, res, next) => {
  try {
    const now = new Date();
    const meetings = await Meeting.find({
      startTime: { $gte: now },
      participants: req.user.id,
    })
      .sort('startTime')
      .populate('organizer','fullName email')
      .populate('participants','fullName email');
    res.json(meetings);
  } catch (err) {
    next(err);
  }
};

exports.getMeetingById = async (req, res, next) => {
  try {
    const meeting = await Meeting.findById(req.params.id)
      .populate('organizer','fullName email')
      .populate('participants','fullName email');
    if (!meeting) return res.status(404).end();
    res.json(meeting);
  } catch (err) {
    next(err);
  }
};