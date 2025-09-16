import Conversation, { ReadReceipt } from '../models/conversation.js';
import User from '../models/user.js';
import Message from '../models/message.js';
import Notification from '../models/notification.js';
import mongoose from 'mongoose';
import { createNotification } from './notificationController.js';

// Helper function to create system messages
async function createSystemMessage(conversationId, systemMessageType, actionBy, actionOn = [], additionalData = {}) {
  try {
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) return null;

    const actionByUser = actionBy ? await User.findById(actionBy) : null;
    const actionOnUsers = actionOn.length > 0 ? await User.find({ _id: { $in: actionOn } }) : [];

    let messageText = '';
    
    switch (systemMessageType) {
      case 'conversation_created':
        if (conversation.type === 'dm') {
          // For DMs, don't create a system message as it's just two people starting a conversation
          return null;
        } else if (conversation.type === 'group') {
          if (actionByUser) {
            const memberNames = actionOnUsers.filter(u => u._id.toString() !== actionByUser._id.toString())
              .map(u => u.fullName || u.username).join(', ');
            if (memberNames) {
              messageText = `${actionByUser.fullName || actionByUser.username} created this group and added ${memberNames}`;
            } else {
              messageText = `${actionByUser.fullName || actionByUser.username} created this group`;
            }
          } else {
            messageText = `This group was created`;
          }
        } else if (conversation.type === 'community') {
          if (actionByUser) {
            messageText = `${actionByUser.fullName || actionByUser.username} created this community`;
          } else {
            messageText = `This community was created`;
          }
        }
        break;
        
      case 'member_added':
        if (actionByUser && actionOnUsers.length > 0) {
          const addedNames = actionOnUsers.map(u => u.fullName || u.username).join(', ');
          if (actionOnUsers.length === 1 && actionOnUsers[0]._id.toString() === actionByUser._id.toString()) {
            messageText = `${actionByUser.fullName || actionByUser.username} joined the ${conversation.type}`;
          } else {
            messageText = `${actionByUser.fullName || actionByUser.username} added ${addedNames}`;
          }
        }
        break;
        
      case 'member_removed':
        if (actionByUser && actionOnUsers.length > 0) {
          const removedNames = actionOnUsers.map(u => u.fullName || u.username).join(', ');
          messageText = `${actionByUser.fullName || actionByUser.username} removed ${removedNames}`;
        }
        break;
        
      case 'member_left':
        if (actionOnUsers.length > 0) {
          const leftNames = actionOnUsers.map(u => u.fullName || u.username).join(', ');
          messageText = `${leftNames} left the ${conversation.type}`;
        }
        break;
    }

    if (!messageText) return null;

    const systemMessage = new Message({
      conversation: conversationId,
      text: messageText,
      type: 'system',
      isSystemMessage: true,
      systemMessageType,
      systemMessageData: {
        actionBy,
        actionOn,
        conversationName: conversation.name,
        conversationType: conversation.type,
        additionalData
      }
    });

    await systemMessage.save();
    
    // Update conversation's lastMessage to show in sidebar
    await Conversation.findByIdAndUpdate(conversationId, {
      lastMessage: systemMessage._id,
      updatedAt: new Date()
    });
    
    return systemMessage;
  } catch (error) {
    console.error('Error creating system message:', error);
    return null;
  }
}

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

      // Create welcome system message
      const systemMessage = await createSystemMessage(
        conversation._id,
        'conversation_created',
        userId,
        allUserIds
      );

      // Emit real-time event to all users and join them to the community room
      if (req.io) {
        const conversationId = conversation._id.toString();
        const conversationData = conversation.toObject();
        
        // Get onlineUsers from middleware
        const onlineUsers = req.onlineUsers || new Map();
        
        // Join all online users to the community room
        req.io.sockets.sockets.forEach(socket => {
          if (socket.userId) {
            socket.join(conversationId);
            console.log(`[Community] User ${socket.userId} joined community room ${conversationId}`);
          }
        });
        
        // Notify all online users about the new community using socket IDs
        console.log(`[Community] Notifying ${onlineUsers.size} online users about new community ${conversationId}`);
        for (const [onlineUserId, userInfo] of onlineUsers) {
          if (userInfo.socketId) {
            req.io.to(userInfo.socketId).emit('conversation:created', {
              ...conversationData,
              type: conversationData.type,
              members: conversationData.members,
              createdBy: userId // This is the actual creator ID from function scope
            });
            console.log(`[Community] Emitted conversation:created to user ${onlineUserId} via socket ${userInfo.socketId}`);

            // Create notification for all users (except creator)
            if (onlineUserId !== userId) {
              try {
                const notification = await createNotification(
                  onlineUserId,
                  userId,
                  'community_created',
                  'New Community',
                  `${conversation.name} community was created`,
                  {
                    conversationId: conversation._id,
                    conversationType: 'community',
                    conversationName: conversation.name
                  }
                );
                
                console.log(`[Community] ✅ Created notification for user ${onlineUserId}:`, notification._id);
                
                // Send real-time notification
                req.io.to(userInfo.socketId).emit('notification:new', notification);
              } catch (error) {
                console.error(`[Community] ❌ Failed to create notification for user ${onlineUserId}:`, error);
              }
            }
          }
        }
        
        // Also broadcast to all sockets as fallback
        req.io.emit('conversation:created', {
          ...conversationData,
          type: conversationData.type,
          members: conversationData.members,
          createdBy: userId
        });

        // Emit system message immediately if it was created
        if (systemMessage) {
          // Populate the system message with sender info for proper display
          await systemMessage.populate('systemMessageData.actionBy', 'fullName username');
          
          req.io.to(conversationId).emit('message:new', {
            ...systemMessage.toObject(),
            conversation: conversationId
          });
          console.log(`[Community] ✅ Emitted welcome system message to room ${conversationId}`);

          // Also emit conversation update to refresh sidebar preview
          const updatedConversation = await Conversation.findById(conversationId)
            .populate('members', 'username fullName avatarUrl')
            .populate('lastMessage');
          
          req.io.emit('conversation:updated', {
            ...updatedConversation.toObject(),
            lastMessage: systemMessage.toObject()
          });
          console.log(`[Community] ✅ Emitted conversation update for sidebar refresh`);
        }
      }

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

    // Create welcome system message (only for groups, not DMs)
    let systemMessage = null;
    if (type !== 'dm') {
      systemMessage = await createSystemMessage(
        conversation._id,
        'conversation_created',
        userId,
        [userId, ...memberIds]
      );
    }

    // Emit real-time event to all conversation members and join them to the room
    if (req.io) {
      const conversationId = conversation._id.toString();
      const conversationData = conversation.toObject();
      
      // Get onlineUsers from middleware
      const onlineUsers = req.onlineUsers || new Map();
      console.log(`[Conversation] Total online users: ${onlineUsers.size}`);
      
      // Join all members to the conversation room and notify them
      for (const member of conversation.members) {
        const memberId = member._id.toString();
        
        // Find the member's socket and join them to the conversation room
        const memberSocket = Array.from(req.io.sockets.sockets.values()).find(socket => socket.userId === memberId);
        if (memberSocket) {
          memberSocket.join(conversationId);
          console.log(`[Conversation] User ${memberId} joined room ${conversationId}`);
        }
        
        // Notify ALL members using their socket ID for more reliable delivery
        const onlineUser = onlineUsers.get(memberId);
        console.log(`[Conversation] Processing member ${memberId}, online:`, !!onlineUser, 'socketId:', onlineUser?.socketId);
        
        if (onlineUser && onlineUser.socketId) {
          const eventData = {
            ...conversationData,
            type: conversationData.type,
            members: conversationData.members,
            createdBy: userId
          };
          req.io.to(onlineUser.socketId).emit('conversation:created', eventData);
          console.log(`[Conversation] ✅ Emitted conversation:created to user ${memberId} via socket ${onlineUser.socketId}`);
          console.log(`[Conversation] Event data:`, JSON.stringify(eventData, null, 2));
        } else {
          // Fallback to user ID targeting
          const eventData = {
            ...conversationData,
            type: conversationData.type,
            members: conversationData.members,
            createdBy: userId
          };
          req.io.to(memberId).emit('conversation:created', eventData);
          console.log(`[Conversation] ⚠️  Emitted conversation:created to user ${memberId} (fallback method)`);
        }

        // Create notification for members (except creator)
        if (memberId !== userId) {
          try {
            const notification = await createNotification(
              memberId,
              userId,
              'conversation_created',
              `New ${type}`,
              `You were added to ${conversation.name || 'a new conversation'}`,
              {
                conversationId: conversation._id,
                conversationType: type,
                conversationName: conversation.name
              }
            );
            
            console.log(`[Conversation] ✅ Created notification for user ${memberId}:`, notification._id);
            
            // Send real-time notification if user is online
            if (onlineUser && onlineUser.socketId) {
              req.io.to(onlineUser.socketId).emit('notification:new', notification);
            }
          } catch (error) {
            console.error(`[Conversation] ❌ Failed to create notification for user ${memberId}:`, error);
          }
        }
      }

      // Emit system message immediately if it was created
      if (systemMessage) {
        // Populate the system message with sender info for proper display
        await systemMessage.populate('systemMessageData.actionBy', 'fullName username');
        
        req.io.to(conversationId).emit('message:new', {
          ...systemMessage.toObject(),
          conversation: conversationId
        });
        console.log(`[Conversation] ✅ Emitted welcome system message to room ${conversationId}`);

        // Also emit conversation update to refresh sidebar preview
        const updatedConversation = await Conversation.findById(conversationId)
          .populate('members', 'username fullName avatarUrl')
          .populate('lastMessage');
        
        req.io.emit('conversation:updated', {
          ...updatedConversation.toObject(),
          lastMessage: systemMessage.toObject()
        });
        console.log(`[Conversation] ✅ Emitted conversation update for sidebar refresh`);
      }
    }

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

    const conversation = await Conversation.findById(conversationId).populate('members', 'username fullName avatarUrl');
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

    // Get added user info and adder info for notifications
    const addedUser = await User.findById(userId).select('username fullName avatarUrl');
    const adderUser = await User.findById(currentUserId).select('username fullName avatarUrl');

    // Emit socket event for real-time updates with enhanced data
    if (req.io) {
      const eventData = {
        conversationId,
        conversationName: conversation.name,
        conversationType: conversation.type,
        userId,
        addedBy: currentUserId,
        addedUser: {
          _id: addedUser._id,
          username: addedUser.username,
          fullName: addedUser.fullName,
          avatarUrl: addedUser.avatarUrl
        },
        adderUser: {
          _id: adderUser._id,
          username: adderUser.username,
          fullName: adderUser.fullName,
          avatarUrl: adderUser.avatarUrl
        }
      };

      // Emit to conversation members
      req.io.to(conversationId).emit('conversation:memberAdded', eventData);

      // Also emit to the added user specifically (in case they're not in the room yet)
      req.io.to(userId).emit('conversation:memberAdded', eventData);
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

    console.log('Remove member request:', { conversationId, userId, currentUserId });

    // Find conversation without populate first to check raw member data
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    console.log('Conversation found:', {
      id: conversation._id,
      type: conversation.type,
      memberCount: conversation.members.length,
      adminCount: conversation.admins.length,
      members: conversation.members.map(m => m.toString()),
      admins: conversation.admins.map(a => a.toString())
    });

    // Validate user permissions
    const isAdmin = conversation.admins.some(adminId => {
      const adminIdStr = adminId.toString();
      const currentUserIdStr = currentUserId.toString();
      console.log('Checking admin permission:', { adminIdStr, currentUserIdStr, match: adminIdStr === currentUserIdStr });
      return adminIdStr === currentUserIdStr;
    });

    if (conversation.type !== 'dm' && !isAdmin) {
      return res.status(403).json({ message: 'Only admins can remove members' });
    }

    // Check if user to be removed is actually a member
    const userIdStr = userId.toString();
    const isMember = conversation.members.some(memberId => {
      const memberIdStr = memberId.toString();
      console.log('Checking membership:', { memberIdStr, userIdStr, match: memberIdStr === userIdStr });
      return memberIdStr === userIdStr;
    });

    if (!isMember) {
      console.log('User not found in members array');
      return res.status(400).json({ message: 'User is not a member of this conversation' });
    }

    // Prevent removing the conversation creator if they are the only admin
    if (conversation.createdBy && conversation.createdBy.toString() === userIdStr && conversation.admins.length === 1) {
      return res.status(400).json({ message: 'Cannot remove the conversation creator when they are the only admin' });
    }

    // Get user info before removing for notifications
    const removedUser = await User.findById(userId).select('username fullName avatarUrl');
    const removerUser = await User.findById(currentUserId).select('username fullName avatarUrl');

    if (!removedUser) {
      return res.status(404).json({ message: 'User to remove not found' });
    }

    console.log('Users found:', {
      removedUser: removedUser ? removedUser.fullName : 'null',
      removerUser: removerUser ? removerUser.fullName : 'null'
    });

    // Remove user from members array using MongoDB $pull operator for atomic operation
    const memberUpdateResult = await Conversation.updateOne(
      { _id: conversationId },
      { 
        $pull: { 
          members: userId,
          admins: userId  // Also remove from admins if they were an admin
        }
      }
    );

    console.log('Update result:', memberUpdateResult);

    if (memberUpdateResult.modifiedCount === 0) {
      return res.status(500).json({ message: 'Failed to remove member from conversation' });
    }

    // Get updated conversation with populated members
    const updatedConversation = await Conversation.findById(conversationId)
      .populate('members', 'username fullName avatarUrl')
      .populate('admins', 'username fullName avatarUrl');

    console.log('Updated conversation:', {
      memberCount: updatedConversation.members.length,
      adminCount: updatedConversation.admins.length
    });

    // Create system message for member removal
    await createSystemMessage(
      conversationId,
      'member_removed',
      currentUserId,
      [userId],
      {}
    );

    // Emit socket event for real-time updates
    if (req.io) {
      const eventData = {
        conversationId,
        conversationName: conversation.name,
        conversationType: conversation.type,
        userId,
        removedBy: currentUserId,
        removedUser: {
          _id: removedUser._id,
          username: removedUser.username,
          fullName: removedUser.fullName,
          avatarUrl: removedUser.avatarUrl
        },
        removerUser: {
          _id: removerUser._id,
          username: removerUser.username,
          fullName: removerUser.fullName,
          avatarUrl: removerUser.avatarUrl
        },
        updatedMemberCount: updatedConversation.members.length
      };

      // Emit to conversation members
      req.io.to(conversationId).emit('conversation:memberRemoved', eventData);

      // Also emit to the removed user
      req.io.to(userId).emit('conversation:memberRemoved', eventData);
    }

    console.log('Member removed successfully');
    res.json({ 
      message: 'Member removed successfully', 
      conversation: updatedConversation,
      removedUser: {
        _id: removedUser._id,
        username: removedUser.username,
        fullName: removedUser.fullName
      }
    });

  } catch (err) {
    console.error('Error in removeMember:', err);
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

    // Store conversation info before deletion for real-time notifications
    const conversationName = conversation.name || 'Conversation';
    const conversationType = conversation.type;
    const conversationMembers = conversation.members.map(member => 
      typeof member === 'string' ? member : member._id.toString()
    );

    // Delete all messages in the conversation
    await Message.deleteMany({ conversation: conversationId });

    // Delete the conversation
    await conversation.deleteOne();

    // Emit real-time event to all conversation members
    if (req.io) {
      // Get onlineUsers from middleware
      const onlineUsers = req.onlineUsers || new Map();
      console.log(`[Conversation-Delete] Total online users: ${onlineUsers.size}`);
      
      // Notify all members about conversation deletion
      for (const memberId of conversationMembers) {
        const onlineUser = onlineUsers.get(memberId);
        console.log(`[Conversation-Delete] Processing member ${memberId}, online:`, !!onlineUser, 'socketId:', onlineUser?.socketId);
        
        if (onlineUser && onlineUser.socketId) {
          const eventData = {
            conversationId,
            deletedBy: userId,
            conversationName,
            conversationType
          };
          req.io.to(onlineUser.socketId).emit('conversation:deleted', eventData);
          console.log(`[Conversation-Delete] ✅ Emitted conversation:deleted to user ${memberId} via socket ${onlineUser.socketId}`);
        } else {
          // Fallback to user ID targeting
          const eventData = {
            conversationId,
            deletedBy: userId,
            conversationName,
            conversationType
          };
          req.io.to(memberId).emit('conversation:deleted', eventData);
          console.log(`[Conversation-Delete] ⚠️  Emitted conversation:deleted to user ${memberId} (fallback method)`);
        }

        // Create notification for members (except deleter)
        if (memberId !== userId) {
          try {
            const notification = await createNotification(
              memberId,
              userId,
              'conversation_deleted',
              `${conversationType} Deleted`,
              `${conversationName} was deleted`,
              {
                conversationId,
                conversationType,
                conversationName
              }
            );
            
            console.log(`[Conversation-Delete] ✅ Created notification for user ${memberId}:`, notification._id);
            
            // Send real-time notification if user is online
            if (onlineUser && onlineUser.socketId) {
              req.io.to(onlineUser.socketId).emit('notification:new', notification);
            }
          } catch (error) {
            console.error(`[Conversation-Delete] ❌ Failed to create notification for user ${memberId}:`, error);
          }
        }
      }
    }

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

    // Also mark any message notifications for this conversation as read
    await Notification.updateMany(
      { 
        recipient: userId, 
        type: 'message',
        'data.conversationId': conversationId,
        read: false 
      },
      { read: true }
    );

    res.json({ message: 'Conversation marked as read' });
  } catch (err) {
    next(err);
  }
} 