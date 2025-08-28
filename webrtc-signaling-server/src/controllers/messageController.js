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
      .populate('reactions.user', 'username fullName')
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

// React to a message (toggle reaction - users can only have one reaction per message)
export async function reactMessage(req, res, next) {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body;
    const userId = req.user.id;
    
    // Find the message first
    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }
    
    // Check if user already has a reaction on this message
    const existingReactionIndex = message.reactions.findIndex(r => r.user.toString() === userId);
    
    if (existingReactionIndex !== -1) {
      const existingReaction = message.reactions[existingReactionIndex];
      
      if (existingReaction.emoji === emoji) {
        // Same emoji - remove the reaction (toggle off)
        message.reactions.splice(existingReactionIndex, 1);
      } else {
        // Different emoji - replace the reaction
        message.reactions[existingReactionIndex] = { user: userId, emoji };
      }
    } else {
      // No existing reaction - add new one
      message.reactions.push({ user: userId, emoji });
    }
    
    const updatedMessage = await message.save();
    await updatedMessage.populate('sender', 'username fullName avatarUrl');
    await updatedMessage.populate('reactions.user', 'username fullName');
    
    res.json({ message: updatedMessage });
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
    )
    .populate('sender', 'username fullName avatarUrl')
    .populate('reactions.user', 'username fullName');
    
    res.json({ message });
  } catch (err) {
    next(err);
  }
}

// Search messages in a conversation with secure MongoDB queries
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

    // Build secure search filter - using $text index for full-text search when available
    let searchFilter = {
      conversation: conversationId,
      $or: []
    };

    // Secure text search using escaped regex (query already sanitized by middleware)
    const escapedQuery = query.trim();
    
    if (type === 'all' || type === 'text') {
      searchFilter.$or.push({
        text: { 
          $regex: new RegExp(escapedQuery, 'i'), // Use RegExp constructor for safety
          $options: 'i'
        }
      });
    }

    // Secure file name search
    if (type === 'all' || type === 'file' || type === 'image') {
      searchFilter.$or.push({
        'file.name': { 
          $regex: new RegExp(escapedQuery, 'i'),
          $options: 'i'
        }
      });
    }

    // If no search criteria, return empty
    if (searchFilter.$or.length === 0) {
      return res.json({ messages: [], total: 0 });
    }

    // Secure sender filter with proper validation
    if (sender === 'me') {
      searchFilter.sender = userId;
    } else if (sender !== 'all' && sender !== 'me') {
      // sender is already validated as ObjectId by middleware
      searchFilter.sender = sender;
    }

    // Date range filter with safe date construction
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
      
      if (startDate && !isNaN(startDate.getTime())) {
        searchFilter.createdAt = { $gte: startDate };
      }
    }

    // Secure type-specific filters
    if (type === 'file') {
      searchFilter.file = { $exists: true };
      searchFilter['file.type'] = { $not: /^image\// };
    } else if (type === 'image') {
      searchFilter.file = { $exists: true };
      searchFilter['file.type'] = /^image\//;
    }

    // Remove debug logging for production
    // console.log('Search filter:', JSON.stringify(searchFilter, null, 2));

    // Get total count with timeout protection
    const total = await Promise.race([
      Message.countDocuments(searchFilter),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Search timeout')), 10000)
      )
    ]);

    // Get messages with pagination and timeout protection
    const messages = await Promise.race([
      Message.find(searchFilter)
        .populate('sender', 'username fullName avatarUrl')
        .populate('replyTo', 'text file')
        .populate('reactions.user', 'username fullName')
        .sort({ createdAt: -1 })
        .skip(parseInt(skip))
        .limit(parseInt(limit))
        .lean(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Search timeout')), 10000)
      )
    ]);

    // Add search relevance score with safe text processing
    const scoredMessages = messages.map(msg => {
      let score = 0;
      const searchTerm = escapedQuery.toLowerCase();
      
      if (msg.text && typeof msg.text === 'string') {
        const text = msg.text.toLowerCase();
        // Exact phrase match gets highest score
        if (text.includes(searchTerm)) {
          score += 100;
        }
        // Word matches
        const words = searchTerm.split(' ').filter(word => word.length > 0);
        words.forEach(word => {
          if (text.includes(word)) {
            score += 10;
          }
        });
      }
      
      if (msg.file && msg.file.name && typeof msg.file.name === 'string') {
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
      query: escapedQuery,
      filters: { type, sender, dateRange }
    });
  } catch (err) {
    if (err.message === 'Search timeout') {
      return res.status(408).json({ 
        message: 'Search request timed out. Please try a more specific query.',
        error: 'SEARCH_TIMEOUT'
      });
    }
    
    console.error('Search error:', err);
    next(err);
  }
} 