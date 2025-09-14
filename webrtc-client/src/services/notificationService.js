import api from '../api/client.js';

export const getNotifications = () =>
  api.get('/notifications').then(r => r.data.notifications || []);

export const getUnreadCount = () =>
  api.get('/notifications/unread-count').then(r => r.data.unreadCount || 0);

export const markAsRead = (notificationId) =>
  api.patch(`/notifications/${notificationId}/read`).then(r => r.data);

export const markAllAsRead = () =>
  api.patch('/notifications/mark-all-read').then(r => r.data);

export const deleteNotification = (notificationId) =>
  api.delete(`/notifications/${notificationId}`).then(r => r.data); 