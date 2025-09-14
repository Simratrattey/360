import mongoose from 'mongoose';

const reactionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  emoji: { type: String },
}, { _id: false });

const fileSchema = new mongoose.Schema({
  url: String,
  name: String,
  type: String,
  size: Number,
  category: { type: String, enum: ['image', 'video', 'audio', 'document', 'archive', 'code', 'other'], default: 'other' },
  filename: String, // Store the actual filename for potential deletion
}, { _id: false });

const messageSchema = new mongoose.Schema({
  conversation: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  text: { type: String },
  file: fileSchema,
  reactions: [reactionSchema],
  replyTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
  edited: { type: Boolean, default: false },
  // Track which users have received and read this message
  deliveredTo: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  // System message fields
  type: { type: String, enum: ['regular', 'system'], default: 'regular' },
  isSystemMessage: { type: Boolean, default: false },
  systemMessageType: { 
    type: String, 
    enum: ['conversation_created', 'member_added', 'member_removed', 'member_left', 'conversation_deleted'],
    required: function() { return this.type === 'system'; }
  },
  systemMessageData: {
    actionBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Who performed the action
    actionOn: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // Users affected by the action
    conversationName: String,
    conversationType: String,
    additionalData: mongoose.Schema.Types.Mixed
  }
}, { timestamps: true });

// Create a compound index on conversation and createdAt to accelerate queries and sorting
messageSchema.index({ conversation: 1, createdAt: 1 });

export default mongoose.model('Message', messageSchema); 