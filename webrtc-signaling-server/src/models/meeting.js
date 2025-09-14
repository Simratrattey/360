// src/models/meeting.js
import mongoose from 'mongoose';
import { dashboardCache } from '../routes/dashboard.js';
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
  // Waiting room configuration
  waitingRoomEnabled: {
    type: Boolean,
    default: false
  },
  // Pending join requests for waiting room
  pendingJoinRequests: [{
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    username: String,
    fullName: String,
    requestedAt: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: ['pending', 'approved', 'denied'],
      default: 'pending'
    }
  }],
  
  // Meeting summary and transcript
  summary: {
    type: String,
    default: null
  },
  transcript: {
    type: Schema.Types.ObjectId,
    ref: 'Transcript',
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
MeetingSchema.methods.endMeeting = async function() {
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
    
    // Generate summary from transcript if available
    await this.generateSummary();
    
    // Invalidate dashboard cache for organizer and all participants
    const organizerId = this.organizer.toString();
    dashboardCache.delete(`dashboard-stats-${organizerId}`);
    dashboardCache.delete(`recent-meetings-${organizerId}`);
    
    // Also invalidate cache for all participants
    this.participantSessions.forEach(session => {
      const participantId = session.userId.toString();
      dashboardCache.delete(`dashboard-stats-${participantId}`);
      dashboardCache.delete(`recent-meetings-${participantId}`);
    });
  }
  return this.save();
};

// Method to generate summary from transcript
MeetingSchema.methods.generateSummary = async function() {
  try {
    const Transcript = this.constructor.db.model('Transcript');
    const transcript = await Transcript.findOne({ roomId: this.roomId });
    
    if (transcript && transcript.entries && transcript.entries.length > 0) {
      // Link the transcript to this meeting
      this.transcript = transcript._id;
      
      console.log(`[Meeting] Found transcript for meeting ${this._id} with ${transcript.entries.length} entries`);
      
      // Try to generate AI summary if Gemini is configured
      try {
        console.log(`[Meeting] Attempting to import geminiSummaryService...`);
        const { summarizeMeeting, validateGeminiConfig } = await import('../services/geminiSummaryService.js');
        console.log(`[Meeting] ✅ Successfully imported geminiSummaryService`);
        
        console.log(`[Meeting] Validating Gemini configuration...`);
        const isConfigValid = validateGeminiConfig();
        console.log(`[Meeting] Gemini config validation result: ${isConfigValid}`);
        
        if (isConfigValid) {
          console.log(`[Meeting] Starting AI summary generation for meeting: ${this.title} (${transcript.entries.length} entries)`);
          const aiSummary = await summarizeMeeting(transcript.entries, this.title);
          console.log(`[Meeting] AI summary result: ${aiSummary ? 'SUCCESS' : 'NULL/FAILED'}`);
          
          if (aiSummary && aiSummary.trim().length > 0) {
            this.summary = aiSummary;
            console.log(`[Meeting] ✅ AI summary generated successfully for meeting ${this._id} (${aiSummary.length} characters)`);
            return;
          } else {
            console.log(`[Meeting] ❌ AI summary was empty or null, falling back to transcript text`);
          }
        } else {
          console.log(`[Meeting] ❌ Gemini not properly configured, using transcript text fallback`);
        }
      } catch (aiError) {
        console.error('[Meeting] ❌ Error with AI summarization, falling back to transcript:', aiError);
        console.error('[Meeting] Error stack:', aiError.stack);
      }
      
      // Fallback: Use formatted transcript as summary
      const transcriptText = transcript.entries
        .map(entry => `[${entry.timestamp}] ${entry.speaker}: ${entry.text}`)
        .join('\n');
      
      this.summary = transcriptText;
      console.log(`[Meeting] Generated fallback summary for meeting ${this._id} with ${transcript.entries.length} transcript entries`);
    } else {
      console.log(`[Meeting] No transcript found for meeting ${this._id} (roomId: ${this.roomId})`);
    }
  } catch (error) {
    console.error('[Meeting] Error generating summary:', error);
  }
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