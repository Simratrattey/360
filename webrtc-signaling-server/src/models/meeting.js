// src/models/meeting.js
import mongoose from 'mongoose';
const { Schema } = mongoose;

const RecurrenceSchema = new Schema({
  frequency: {
    type: String,
    enum: ['none','daily','weekly','biweekly','monthly'],
    default: 'none',
  },
  interval: { type: Number, default: 1 },
});

const MeetingSchema = new Schema({
  title:           { type: String, required: true },
  description:     { type: String },
  organizer:       { type: Schema.Types.ObjectId, ref: 'User', required: true },
  participants:    [{ type: Schema.Types.ObjectId, ref: 'User' }],
  startTime:       { type: Date, required: true },
  durationMinutes: { type: Number, default: 60 },
  recurrence:      { type: RecurrenceSchema, default: () => ({}) },
  roomId:          { type: String, required: true },
  createdAt:       { type: Date, default: Date.now },
});

const Meeting = mongoose.model('Meeting', MeetingSchema);
export default Meeting;