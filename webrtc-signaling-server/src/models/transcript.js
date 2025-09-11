import mongoose from 'mongoose';

const transcriptEntrySchema = new mongoose.Schema({
  id: {
    type: String,
    required: true
  },
  text: {
    type: String,
    required: true
  },
  speaker: {
    type: String,
    required: true
  },
  speakerId: {
    type: String,
    required: true
  },
  timestamp: {
    type: String,
    required: true
  },
  createdAt: {
    type: Number,
    required: true
  }
});

const transcriptSchema = new mongoose.Schema({
  roomId: {
    type: String,
    required: true,
    index: true
  },
  entries: [transcriptEntrySchema],
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
});

// Update lastUpdated when entries are modified
transcriptSchema.pre('save', function(next) {
  this.lastUpdated = new Date();
  next();
});

export default mongoose.model('Transcript', transcriptSchema);