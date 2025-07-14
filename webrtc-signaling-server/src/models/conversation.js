import mongoose from 'mongoose';

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

export default mongoose.model('Conversation', conversationSchema); 