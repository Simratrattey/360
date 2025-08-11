import Message from '../models/message.js';
import Conversation from '../models/conversation.js';

// List messages in a conversation
export async function listMessages(req, res, next) {
  try {
    const { conversationId } = req.params;
    // Support pagination via ?limit=50&skip=0 query parameters. Default limit=50, skip=0.
    const { limit = 50, skip = 0 } = req.query;
    const messages = await Message.find({ conversation: conversationId })
      .populate('sender', 'username fullName avatarUrl')
      .populate('replyTo', 'text file')
      .sort({ createdAt: 1 })
      .skip(parseInt(skip))
      .limit(parseInt(limit))
      // Use lean() to reduce overhead and return plain objects
      .lean();
    res.json({ messages });
  } catch (err) {
    next(err);
  }
}

// Send a new message
export async function sendMessage(req, res, next) {
  try {
    const { conversationId } = req.params;
    const { text, file, replyTo } = req.body;
    const userId = req.user.id;
    const message = new Message({
      conversation: conversationId,
      sender: userId,
      text,
      file,
      replyTo,
    });
    await message.save();
    
    // Populate sender information before sending response
    await message.populate('sender', 'username fullName avatarUrl');
    
    // Update lastMessage in conversation
    await Conversation.findByIdAndUpdate(conversationId, { lastMessage: message._id });
    res.status(201).json({ message });
  } catch (err) {
    next(err);
  }
}

// Edit a message
export async function editMessage(req, res, next) {
  try {
    const { messageId } = req.params;
    const { text } = req.body;
    const userId = req.user.id;
    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ message: 'Message not found' });
    if (message.sender.toString() !== userId) return res.status(403).json({ message: 'Not allowed' });
    message.text = text;
    message.edited = true;
    await message.save();
    
    // Populate sender information before sending response
    await message.populate('sender', 'username fullName avatarUrl');
    
    res.json({ message });
  } catch (err) {
    next(err);
  }
}

// Delete a message
export async function deleteMessage(req, res, next) {
  try {
    const { messageId } = req.params;
    const userId = req.user.id;
    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ message: 'Message not found' });
    if (message.sender.toString() !== userId) return res.status(403).json({ message: 'Not allowed' });
    await message.deleteOne();
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

// React to a message
export async function reactMessage(req, res, next) {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body;
    const userId = req.user.id;
    const message = await Message.findByIdAndUpdate(
      messageId,
      { $addToSet: { reactions: { user: userId, emoji } } },
      { new: true }
    );
    res.json({ message });
  } catch (err) {
    next(err);
  }
}

// Remove a reaction
export async function removeReaction(req, res, next) {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body;
    const userId = req.user.id;
    const message = await Message.findByIdAndUpdate(
      messageId,
      { $pull: { reactions: { user: userId, emoji } } },
      { new: true }
    );
    res.json({ message });
  } catch (err) {
    next(err);
  }
} 