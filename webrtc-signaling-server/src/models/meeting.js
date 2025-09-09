// src/models/meeting.js
import mongoose from 'mongoose';
const { Schema } = mongoose;

const RecurrenceSchema = new Schema({
  frequency: {
    type: String,
    enum: ['daily','weekly','biweekly','monthly'],
    default: null,
  },
  interval: { type: Number, default: 1 },
});

// For tracking individual participant sessions within a meeting
const ParticipantSessionSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  username: {
    type: String,
    required: true
  },
  joinedAt: {
    type: Date,
    required: true
  },
  leftAt: {
    type: Date,
    default: null
  },
  durationMinutes: {
    type: Number,
    default: 0
  }
});

const MeetingSchema = new Schema({
  title:           { type: String, required: true },
  description:     { type: String },
  location:        { type: String },
  organizer:       { type: Schema.Types.ObjectId, ref: 'User', required: true },
  participants:    [{ type: Schema.Types.ObjectId, ref: 'User' }],
  startTime:       { type: Date, required: true },
  durationMinutes: { type: Number, default: 60 },
  recurrence:      { type: RecurrenceSchema, default: () => ({}) },
  roomId:          { type: String, required: true },
  createdAt:       { type: Date, default: Date.now },
  
  // New fields for tracking actual meeting sessions
  type: {
    type: String,
    enum: ['scheduled', 'instant'],
    default: 'scheduled'
  },
  status: {
    type: String,
    enum: ['scheduled', 'active', 'ended', 'cancelled'],
    default: 'scheduled'
  },
  visibility: {
    type: String,
    enum: ['public', 'private', 'approval'],
    default: 'public'
  },
  actualStartTime: {
    type: Date,
    default: null
  },
  actualEndTime: {
    type: Date,
    default: null
  },
  actualDurationMinutes: {
    type: Number,
    default: 0
  },
  maxParticipants: {
    type: Number,
    default: 0
  },
  participantSessions: [ParticipantSessionSchema],
  recordingEnabled: {
    type: Boolean,
    default: false
  },
  recordedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  metadata: {
    avatarApiEnabled: {
      type: Boolean,
      default: true
    },
    hostTransfers: [{
      fromUserId: { type: Schema.Types.ObjectId, ref: 'User' },
      toUserId: { type: Schema.Types.ObjectId, ref: 'User' },
      transferredAt: { type: Date, default: Date.now }
    }]
  }
});

// Indexes for efficient queries
MeetingSchema.index({ organizer: 1, createdAt: -1 });
MeetingSchema.index({ 'participants': 1, startTime: -1 });
MeetingSchema.index({ 'participantSessions.userId': 1, actualStartTime: -1 });
MeetingSchema.index({ status: 1, actualStartTime: -1 });
MeetingSchema.index({ roomId: 1 });
MeetingSchema.index({ type: 1, status: 1 });

// Method to start an actual meeting session
MeetingSchema.methods.startMeeting = function() {
  if (this.status === 'scheduled' || this.status === 'active') {
    this.status = 'active';
    this.actualStartTime = new Date();
  }
  return this.save();
};

// Method to end the meeting
MeetingSchema.methods.endMeeting = function() {
  if (this.status === 'active') {
    this.status = 'ended';
    this.actualEndTime = new Date();
    this.actualDurationMinutes = Math.ceil((this.actualEndTime - this.actualStartTime) / 1000 / 60);
    
    // End all active participant sessions
    this.participantSessions.forEach(session => {
      if (!session.leftAt) {
        session.leftAt = this.actualEndTime;
        session.durationMinutes = Math.ceil((session.leftAt - session.joinedAt) / 1000 / 60);
      }
    });
  }
  return this.save();
};

// Method to add a participant session
MeetingSchema.methods.addParticipant = function(userId, username) {
  const existingActiveSession = this.participantSessions.find(session => 
    session.userId.toString() === userId.toString() && !session.leftAt
  );
  
  if (!existingActiveSession) {
    this.participantSessions.push({
      userId,
      username,
      joinedAt: new Date()
    });
    
    // Update max participants count
    const currentActiveParticipants = this.participantSessions.filter(session => !session.leftAt).length;
    if (currentActiveParticipants > this.maxParticipants) {
      this.maxParticipants = currentActiveParticipants;
    }
  }
  
  return this.save();
};

// Method to remove a participant session
MeetingSchema.methods.removeParticipant = function(userId) {
  const activeSession = this.participantSessions.find(session => 
    session.userId.toString() === userId.toString() && !session.leftAt
  );
  
  if (activeSession) {
    activeSession.leftAt = new Date();
    activeSession.durationMinutes = Math.ceil((activeSession.leftAt - activeSession.joinedAt) / 1000 / 60);
  }
  
  return this.save();
};

// Virtual for current active participants count
MeetingSchema.virtual('activeParticipantsCount').get(function() {
  return this.participantSessions.filter(session => !session.leftAt).length;
});

// Virtual for total unique participants count
MeetingSchema.virtual('totalParticipantsCount').get(function() {
  const uniqueUserIds = new Set(this.participantSessions.map(session => session.userId.toString()));
  return uniqueUserIds.size;
});

const Meeting = mongoose.model('Meeting', MeetingSchema);
export default Meeting;