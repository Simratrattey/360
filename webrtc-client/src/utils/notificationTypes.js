// Notification types and their configurations
export const NOTIFICATION_TYPES = {
  MESSAGE: 'message',
  MEETING_INVITE: 'meeting_invite',
  SYSTEM_ALERT: 'system_alert',
  TASK_ASSIGNMENT: 'task_assignment',
  MENTION: 'mention',
  CONVERSATION_CREATED: 'conversation_created',
  COMMUNITY_CREATED: 'community_created',
  CONVERSATION_DELETED: 'conversation_deleted'
};

export const NOTIFICATION_ICONS = {
  [NOTIFICATION_TYPES.MESSAGE]: '💬',
  [NOTIFICATION_TYPES.MEETING_INVITE]: '📅',
  [NOTIFICATION_TYPES.SYSTEM_ALERT]: '⚠️',
  [NOTIFICATION_TYPES.TASK_ASSIGNMENT]: '✅',
  [NOTIFICATION_TYPES.MENTION]: '@',
  [NOTIFICATION_TYPES.CONVERSATION_CREATED]: '🎉',
  [NOTIFICATION_TYPES.COMMUNITY_CREATED]: '🌍',
  [NOTIFICATION_TYPES.CONVERSATION_DELETED]: '🗑️',
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
    },
    [NOTIFICATION_TYPES.CONVERSATION_CREATED]: {
      title: 'New Conversation',
      icon: NOTIFICATION_ICONS[NOTIFICATION_TYPES.CONVERSATION_CREATED],
      priority: 'normal',
      requiresAck: false
    },
    [NOTIFICATION_TYPES.COMMUNITY_CREATED]: {
      title: 'New Community',
      icon: NOTIFICATION_ICONS[NOTIFICATION_TYPES.COMMUNITY_CREATED],
      priority: 'normal',
      requiresAck: false
    },
    [NOTIFICATION_TYPES.CONVERSATION_DELETED]: {
      title: 'Conversation Deleted',
      icon: NOTIFICATION_ICONS[NOTIFICATION_TYPES.CONVERSATION_DELETED],
      priority: 'normal',
      requiresAck: false
    }
  };

  return configs[type] || {
    title: 'New Notification',
    icon: NOTIFICATION_ICONS.default,
    priority: 'normal',
    requiresAck: false
  };
};

export const shouldShowNotification = (notification, currentConversationId = null, isOnMessagesPage = false) => {
  // Don't show message notifications for currently selected conversation
  if (notification.type === NOTIFICATION_TYPES.MESSAGE) {
    // If user is on messages page and this is the current conversation, don't show
    if (isOnMessagesPage && currentConversationId === notification.data?.conversationId) {
      return false;
    }
    
    // Fallback: check URL parameter method (for backwards compatibility)
    if (window.location.pathname.startsWith('/messages') &&
        new URLSearchParams(window.location.search).get('conversation') === notification.data?.conversationId) {
      return false;
    }
  }
  
  // Always show conversation creation/deletion notifications (they're important)
  if ([
    NOTIFICATION_TYPES.CONVERSATION_CREATED, 
    NOTIFICATION_TYPES.COMMUNITY_CREATED,
    NOTIFICATION_TYPES.CONVERSATION_DELETED
  ].includes(notification.type)) {
    return true;
  }
  
  return true;
};
