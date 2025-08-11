// Notification types and their configurations
export const NOTIFICATION_TYPES = {
  MESSAGE: 'message',
  MEETING_INVITE: 'meeting_invite',
  SYSTEM_ALERT: 'system_alert',
  TASK_ASSIGNMENT: 'task_assignment',
  MENTION: 'mention'
};

export const NOTIFICATION_ICONS = {
  [NOTIFICATION_TYPES.MESSAGE]: '💬',
  [NOTIFICATION_TYPES.MEETING_INVITE]: '📅',
  [NOTIFICATION_TYPES.SYSTEM_ALERT]: '⚠️',
  [NOTIFICATION_TYPES.TASK_ASSIGNMENT]: '✅',
  [NOTIFICATION_TYPES.MENTION]: '@',
  default: '🔔'
};

export const getNotificationConfig = (type) => {
  const configs = {
    [NOTIFICATION_TYPES.MESSAGE]: {
      title: 'New Message',
      icon: NOTIFICATION_ICONS[NOTIFICATION_TYPES.MESSAGE],
      priority: 'high',
      requiresAck: true
    },
    [NOTIFICATION_TYPES.MEETING_INVITE]: {
      title: 'Meeting Invitation',
      icon: NOTIFICATION_ICONS[NOTIFICATION_TYPES.MEETING_INVITE],
      priority: 'high',
      requiresAck: true
    },
    [NOTIFICATION_TYPES.SYSTEM_ALERT]: {
      title: 'System Alert',
      icon: NOTIFICATION_ICONS[NOTIFICATION_TYPES.SYSTEM_ALERT],
      priority: 'max',
      requiresAck: false
    },
    [NOTIFICATION_TYPES.TASK_ASSIGNMENT]: {
      title: 'Task Assigned',
      icon: NOTIFICATION_ICONS[NOTIFICATION_TYPES.TASK_ASSIGNMENT],
      priority: 'normal',
      requiresAck: true
    },
    [NOTIFICATION_TYPES.MENTION]: {
      title: 'You were mentioned',
      icon: NOTIFICATION_ICONS[NOTIFICATION_TYPES.MENTION],
      priority: 'high',
      requiresAck: true
    }
  };

  return configs[type] || {
    title: 'New Notification',
    icon: NOTIFICATION_ICONS.default,
    priority: 'normal',
    requiresAck: false
  };
};

export const shouldShowNotification = (notification) => {
  // Don't show if user is on the conversation page for message notifications
  if (notification.type === NOTIFICATION_TYPES.MESSAGE && 
      window.location.pathname.startsWith('/messages') &&
      new URLSearchParams(window.location.search).get('conversation') === notification.data?.conversationId) {
    return false;
  }
  return true;
};
