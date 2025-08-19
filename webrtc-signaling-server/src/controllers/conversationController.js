import Conversation, { ReadReceipt } from '../models/conversation.js';
import User from '../models/user.js';
import Message from '../models/message.js';
import mongoose from 'mongoose';

// List all conversations for the current user
export async function listConversations(req, res, next) {
  try {
    const userId = req.user.id;

    // Get user's conversations (DMs and groups they're members of)
    const userConversations = await Conversation.find({
      members: userId
    }).populate('members', 'username fullName avatarUrl');

    // Get all communities (communities are public)
    const communities = await Conversation.find({
      type: 'community'
    }).populate('members', 'username fullName avatarUrl');

    // Combine user conversations with communities
    const allConversations = [...userConversations, ...communities];

    // Calculate unread counts and get latest message for each conversation
    const conversationsWithUnread = await Promise.all(
      allConversations.map(async (conversation) => {
        // Get user's last read time for this conversation
        const readReceipt = await ReadReceipt.findOne({
          user: userId,
          conversation: conversation._id
        });

        const lastReadAt = readReceipt ? readReceipt.lastReadAt : new Date(0); // If no read receipt, consider epoch as last read

        // Count messages in this conversation that are newer than last read time
        // and not sent by the current user
        const unreadCount = await Message.countDocuments({
          conversation: conversation._id,
          sender: { $ne: userId },
          createdAt: { $gt: lastReadAt }
        });

        // Get the latest message in this conversation
        const latestMessage = await Message.findOne({
          conversation: conversation._id
        })
        .sort({ createdAt: -1 })
        .select('text file createdAt sender')
        .populate('sender', 'username fullName')
        .lean();

        return {
          ...conversation.toObject(),
          unread: unreadCount,
          lastMessage: latestMessage ? {
            text: latestMessage.text,
            file: latestMessage.file,
            createdAt: latestMessage.createdAt,
            senderName: latestMessage.sender?.fullName || latestMessage.sender?.username
          } : null,
          lastMessageAt: latestMessage ? latestMessage.createdAt : conversation.createdAt
        };
      })
    );

    // Sort conversations by lastMessageAt (most recent first)
    conversationsWithUnread.sort((a, b) => {
      const dateA = new Date(a.lastMessageAt || a.createdAt);
      const dateB = new Date(b.lastMessageAt || b.createdAt);
      return dateB - dateA;
    });

    res.json({ conversations: conversationsWithUnread });
  } catch (err) {
    next(err);
  }
}

// Create a new conversation
export async function createConversation(req, res, next) {
  try {
    const { type, memberIds = [], name, description } = req.body;
    const userId = req.user.id;

    // Validate conversation type
    if (!['dm', 'group', 'community'].includes(type)) {
      return res.status(400).json({ message: 'Invalid conversation type' });
    }

    // For DMs, check if conversation already exists
    if (type === 'dm') {
      if (!memberIds || memberIds.length !== 1) {
        return res.status(400).json({ message: 'Direct messages must have exactly one other member' });
      }

      // Check if DM already exists between these users
      const existingDM = await Conversation.findOne({
        type: 'dm',
        members: { $all: [userId, memberIds[0]] }
      });

      if (existingDM) {
        return res.status(200).json({ 
          message: 'Direct message conversation already exists',
          conversation: existingDM 
        });
      }
    }

    // For groups, require name and members, and check for duplicates
    if (type === 'group') {
      if (!name || !name.trim()) {
        return res.status(400).json({ message: 'Group name is required' });
      }
      if (!memberIds || memberIds.length === 0) {
        return res.status(400).json({ message: 'Group must have at least one member' });
      }

      // Check for duplicate group name
      const existingGroup = await Conversation.findOne({
        type: 'group',
        name: name.trim()
      });

      if (existingGroup) {
        return res.status(400).json({ message: 'A group with this name already exists' });
      }
    }

    // For communities, require name and add all users, and check for duplicates
    if (type === 'community') {
      if (!name || !name.trim()) {
        return res.status(400).json({ message: 'Community name is required' });
      }
      const trimmedName = name.trim();
      // Check for duplicate community name (case-insensitive)
      const existingCommunity = await Conversation.findOne({
        type: 'community',
        name: { $regex: `^${trimmedName}$`, $options: 'i' }
      });
      if (existingCommunity) {
        return res.status(400).json({ message: 'A community with this name already exists' });
      }
      
      // Get all users for community
      const User = mongoose.model('User');
      const allUsers = await User.find({}, '_id');
      const allUserIds = allUsers.map(user => user._id);
      
      // Create conversation with all users
      const conversation = new Conversation({
        type,
        name: name.trim(),
        description: description?.trim(),
        members: allUserIds, // All users are members
        admins: [userId], // Creator is admin
        createdBy: userId,
      });

      await conversation.save();

      // Populate members for response
      await conversation.populate('members', 'username fullName avatarUrl');

      res.status(201).json({ 
        message: 'Community created successfully',
        conversation 
      });
      return;
    }

    // Create conversation for DMs and groups
    const conversation = new Conversation({
      type,
      name: name?.trim(),
      description: description?.trim(),
      members: [userId, ...memberIds],
      admins: [userId], // Creator is admin
      createdBy: userId,
    });

    await conversation.save();

    // Populate members for response
    await conversation.populate('members', 'username fullName avatarUrl');

    res.status(201).json({ 
      message: 'Conversation created successfully',
      conversation 
    });
  } catch (err) {
    next(err);
  }
}

// Get a specific conversation
export async function getConversation(req, res, next) {
  try {
    const { conversationId } = req.params;
    const conversation = await Conversation.findById(conversationId)
      .populate('members', 'username fullName avatarUrl');
    
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }
    
    res.json({ conversation });
  } catch (err) {
    next(err);
  }
}

// Add a member to a conversation
export async function addMember(req, res, next) {
  try {
    const { conversationId } = req.params;
    const { userId } = req.body;
    const currentUserId = req.user.id;

    // Validate request body
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    // Check if user is admin (for groups/communities) or member (for DMs)
    if (conversation.type !== 'dm' && !conversation.admins.some(adminId => adminId.toString() === currentUserId)) {
      return res.status(403).json({ message: 'Only admins can add members' });
    }

    if (conversation.members.some(memberId => memberId.toString() === userId)) {
      return res.status(400).json({ message: 'User is already a member' });
    }

    conversation.members.push(userId);
    await conversation.save();

    // Emit socket event for real-time updates
    if (req.io) {
      req.io.to(conversationId).emit('conversation:memberAdded', {
        conversationId,
        userId,
        addedBy: currentUserId
      });
    }

    res.json({ message: 'Member added successfully', conversation });
  } catch (err) {
    next(err);
  }
}

// Remove a member from a conversation
export async function removeMember(req, res, next) {
  try {
    const { conversationId, userId } = req.params;
    const currentUserId = req.user.id;

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    // Check if user is admin (for groups/communities) or member (for DMs)
    if (conversation.type !== 'dm' && !conversation.admins.some(adminId => adminId.toString() === currentUserId)) {
      return res.status(403).json({ message: 'Only admins can remove members' });
    }

    if (!conversation.members.some(memberId => memberId.toString() === userId)) {
      return res.status(400).json({ message: 'User is not a member' });
    }

    conversation.members = conversation.members.filter(id => id.toString() !== userId);
    // Also remove from admins if they were an admin
    conversation.admins = conversation.admins.filter(id => id.toString() !== userId);
    await conversation.save();

    // Populate members for response
    await conversation.populate('members', 'username fullName avatarUrl');

    // Emit socket event for real-time updates
    if (req.io) {
      req.io.to(conversationId).emit('conversation:memberRemoved', {
        conversationId,
        userId,
        removedBy: currentUserId
      });
    }

    res.json({ message: 'Member removed successfully', conversation });
  } catch (err) {
    next(err);
  }
}

// Delete a conversation
export async function deleteConversation(req, res, next) {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    // Check permissions
    if (conversation.type === 'dm') {
      // For DMs, any member can delete
      if (!conversation.members.includes(userId)) {
        return res.status(403).json({ message: 'Not authorized to delete this conversation' });
      }
    } else {
      // For groups and communities, only admins can delete
      if (!conversation.admins.includes(userId)) {
        return res.status(403).json({ message: 'Only admins can delete groups and communities' });
      }
    }

    // Delete all messages in the conversation
    await Message.deleteMany({ conversation: conversationId });

    // Delete the conversation
    await conversation.deleteOne();

    res.json({ message: 'Conversation deleted successfully' });
  } catch (err) {
    next(err);
  }
}

// Update a conversation
export async function updateConversation(req, res, next) {
  try {
    const { conversationId } = req.params;
    const { name, description } = req.body;
    const userId = req.user.id;

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    // Check permissions
    if (conversation.type === 'dm') {
      // For DMs, any member can update
      if (!conversation.members.includes(userId)) {
        return res.status(403).json({ message: 'Not authorized to update this conversation' });
      }
    } else {
      // For groups and communities, only admins can update
      if (!conversation.admins.includes(userId)) {
        return res.status(403).json({ message: 'Only admins can update conversation' });
      }
    }

    if (name !== undefined) {
      const trimmedName = name.trim();
      // Check for duplicate names for groups and communities
      if (conversation.type === 'group' || conversation.type === 'community') {
        const existingConversation = await Conversation.findOne({
          _id: { $ne: conversationId }, // Exclude current conversation
          type: conversation.type,
          name: { $regex: `^${trimmedName}$`, $options: 'i' }
        });
        if (existingConversation) {
          return res.status(400).json({ 
            message: `A ${conversation.type} with this name already exists` 
          });
        }
      }
      conversation.name = trimmedName;
    }

    if (description !== undefined) {
      conversation.description = description.trim();
    }

    await conversation.save();
    
    // Populate members for response
    await conversation.populate('members', 'username fullName avatarUrl');

    res.json({ 
      message: 'Conversation updated successfully',
      conversation 
    });
  } catch (err) {
    next(err);
  }
}

// Add an admin to a conversation
export async function addAdmin(req, res, next) {
  try {
    const { conversationId } = req.params;
    const { userId: newAdminId } = req.body;
    const currentUserId = req.user.id;

    // Validate request body
    if (!newAdminId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    // Check if user is owner or admin
    if (conversation.createdBy.toString() !== currentUserId && !conversation.admins.some(adminId => adminId.toString() === currentUserId)) {
      return res.status(403).json({ message: 'Only owners and admins can add admins' });
    }

    // Check if user is a member
    if (!conversation.members.some(memberId => memberId.toString() === newAdminId)) {
      return res.status(400).json({ message: 'User must be a member to become admin' });
    }

    // Check if user is already an admin
    if (conversation.admins.some(adminId => adminId.toString() === newAdminId)) {
      return res.status(400).json({ message: 'User is already an admin' });
    }

    conversation.admins.push(newAdminId);
    await conversation.save();

    // Populate members for response
    await conversation.populate('members', 'username fullName avatarUrl');

    // Emit socket event for real-time updates
    if (req.io) {
      req.io.to(conversationId).emit('conversation:adminAdded', {
        conversationId,
        userId: newAdminId,
        adminId: currentUserId
      });
    }

    res.json({ 
      message: 'Admin added successfully',
      conversation 
    });
  } catch (err) {
    next(err);
  }
}

// Remove an admin from a conversation
export async function removeAdmin(req, res, next) {
  try {
    const { conversationId, userId } = req.params;
    const currentUserId = req.user.id;

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    // Check if user is owner or admin
    if (conversation.createdBy.toString() !== currentUserId && !conversation.admins.some(adminId => adminId.toString() === currentUserId)) {
      return res.status(403).json({ message: 'Only owners and admins can remove admins' });
    }

    // Check if user is an admin
    if (!conversation.admins.some(adminId => adminId.toString() === userId)) {
      return res.status(400).json({ message: 'User is not an admin' });
    }

    // Cannot remove the owner from admin
    if (userId === conversation.createdBy.toString()) {
      return res.status(400).json({ message: 'Cannot remove the owner from admin' });
    }

    conversation.admins = conversation.admins.filter(id => id.toString() !== userId);
    await conversation.save();

    // Populate members for response
    await conversation.populate('members', 'username fullName avatarUrl');

    // Emit socket event for real-time updates
    if (req.io) {
      req.io.to(conversationId).emit('conversation:adminRemoved', {
        conversationId,
        userId,
        adminId: currentUserId
      });
    }

    res.json({ message: 'Admin removed successfully', conversation });
  } catch (err) {
    next(err);
  }
}

// Mark conversation as read
export async function markConversationAsRead(req, res, next) {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;

    // Check if conversation exists and user is a member
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    // Check if user is a member of the conversation
    if (!conversation.members.includes(userId) && conversation.type !== 'community') {
      return res.status(403).json({ message: 'Not authorized to access this conversation' });
    }

    // Update or create read receipt
    await ReadReceipt.findOneAndUpdate(
      { user: userId, conversation: conversationId },
      { lastReadAt: new Date() },
      { upsert: true, new: true }
    );

    res.json({ message: 'Conversation marked as read' });
  } catch (err) {
    next(err);
  }
} 