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

// Search messages in a conversation
export async function searchMessages(req, res, next) {
  try {
    const { conversationId } = req.params;
    const { 
      query, 
      type = 'all',
      sender = 'all', 
      dateRange = 'all',
      limit = 20,
      skip = 0
    } = req.query;
    
    const userId = req.user.id;

    if (!query || query.trim().length === 0) {
      return res.json({ messages: [], total: 0 });
    }

    // Build search filter
    let searchFilter = {
      conversation: conversationId,
      $or: []
    };

    // Text search - case insensitive regex
    if (type === 'all' || type === 'text') {
      searchFilter.$or.push({
        text: { $regex: query.trim(), $options: 'i' }
      });
    }

    // File name search
    if (type === 'all' || type === 'file' || type === 'image') {
      searchFilter.$or.push({
        'file.name': { $regex: query.trim(), $options: 'i' }
      });
    }

    // If no search criteria, return empty
    if (searchFilter.$or.length === 0) {
      return res.json({ messages: [], total: 0 });
    }

    // Sender filter
    if (sender === 'me') {
      searchFilter.sender = userId;
    } else if (sender !== 'all' && sender !== 'me') {
      searchFilter.sender = sender; // Specific user ID
    }

    // Date range filter
    if (dateRange !== 'all') {
      const now = new Date();
      let startDate;
      
      switch (dateRange) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        default:
          startDate = null;
      }
      
      if (startDate) {
        searchFilter.createdAt = { $gte: startDate };
      }
    }

    // Additional type-specific filters
    if (type === 'file') {
      searchFilter.file = { $exists: true };
      searchFilter['file.type'] = { $not: /^image\// }; // Non-image files
    } else if (type === 'image') {
      searchFilter.file = { $exists: true };
      searchFilter['file.type'] = /^image\//; // Image files only
    }

    console.log('Search filter:', JSON.stringify(searchFilter, null, 2));

    // Get total count
    const total = await Message.countDocuments(searchFilter);

    // Get messages with pagination
    const messages = await Message.find(searchFilter)
      .populate('sender', 'username fullName avatarUrl')
      .populate('replyTo', 'text file')
      .sort({ createdAt: -1 }) // Most recent first
      .skip(parseInt(skip))
      .limit(parseInt(limit))
      .lean();

    // Add search relevance score (simple text match scoring)
    const scoredMessages = messages.map(msg => {
      let score = 0;
      const searchTerm = query.trim().toLowerCase();
      
      if (msg.text) {
        const text = msg.text.toLowerCase();
        // Exact phrase match gets highest score
        if (text.includes(searchTerm)) {
          score += 100;
        }
        // Word matches
        const words = searchTerm.split(' ');
        words.forEach(word => {
          if (text.includes(word)) {
            score += 10;
          }
        });
      }
      
      if (msg.file && msg.file.name) {
        const fileName = msg.file.name.toLowerCase();
        if (fileName.includes(searchTerm)) {
          score += 50;
        }
      }
      
      return { ...msg, searchScore: score };
    });

    // Sort by relevance score (highest first), then by date
    scoredMessages.sort((a, b) => {
      if (a.searchScore !== b.searchScore) {
        return b.searchScore - a.searchScore;
      }
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    res.json({ 
      messages: scoredMessages,
      total,
      query: query.trim(),
      filters: { type, sender, dateRange }
    });
  } catch (err) {
    console.error('Search error:', err);
    next(err);
  }
} 