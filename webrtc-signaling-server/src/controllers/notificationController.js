import Notification from '../models/notification.js';
import User from '../models/user.js';

export const createNotification = async (recipientId, senderId, type, title, message, data = {}) => {
  try {
    const notification = await Notification.create({
      recipient: recipientId,
      sender: senderId,
      type,
      title,
      message,
      data
    });

    await notification.populate('sender', 'fullName username avatarUrl');
    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
};

export const getUserNotifications = async (req, res, next) => {
  try {
    const notifications = await Notification.find({ recipient: req.user.id })
      .populate('sender', 'fullName username avatarUrl')
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({ notifications });
  } catch (err) {
    next(err);
  }
};

export const markNotificationAsRead = async (req, res, next) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user?.id;
    
    console.log(`[NotificationController] Marking notification as read - NotificationId: ${notificationId}, UserId: ${userId}`);
    
    if (!userId) {
      console.error('[NotificationController] No user ID found in request');
      return res.status(403).json({ message: 'User not authenticated' });
    }
    
    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, recipient: userId },
      { read: true },
      { new: true }
    ).populate('sender', 'fullName username avatarUrl');

    if (!notification) {
      console.log(`[NotificationController] Notification not found - NotificationId: ${notificationId}, UserId: ${userId}`);
      return res.status(404).json({ message: 'Notification not found' });
    }

    console.log(`[NotificationController] Successfully marked notification as read - NotificationId: ${notificationId}`);
    res.json({ notification });
  } catch (err) {
    console.error('[NotificationController] Error marking notification as read:', err);
    next(err);
  }
};

export const markAllNotificationsAsRead = async (req, res, next) => {
  try {
    await Notification.updateMany(
      { recipient: req.user.id, read: false },
      { read: true }
    );

    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    next(err);
  }
};

export const deleteNotification = async (req, res, next) => {
  try {
    const { notificationId } = req.params;
    
    const notification = await Notification.findOneAndDelete({
      _id: notificationId,
      recipient: req.user.id
    });

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    res.json({ message: 'Notification deleted' });
  } catch (err) {
    next(err);
  }
};

export const getUnreadCount = async (req, res, next) => {
  try {
    const count = await Notification.countDocuments({
      recipient: req.user.id,
      read: false
    });

    res.json({ unreadCount: count });
  } catch (err) {
    next(err);
  }
}; 