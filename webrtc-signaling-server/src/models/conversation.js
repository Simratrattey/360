import mongoose from 'mongoose';

// Schema for tracking when users last read a conversation
const readReceiptSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  conversation: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true },
  lastReadAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Compound index for efficient queries
readReceiptSchema.index({ user: 1, conversation: 1 }, { unique: true });

const conversationSchema = new mongoose.Schema({
  type: { type: String, enum: ['dm', 'group', 'community'], required: true },
  name: { type: String }, // For group/community
  description: { type: String }, // For group/community
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  admins: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  lastMessage: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

// Unique index for community names (case-insensitive)
conversationSchema.index(
  { type: 1, name: 1 },
  { unique: true, partialFilterExpression: { type: 'community' }, collation: { locale: 'en', strength: 2 } }
);

export const ReadReceipt = mongoose.model('ReadReceipt', readReceiptSchema);
export default mongoose.model('Conversation', conversationSchema); 