// Message Status Service for tracking delivery and read status
export const MESSAGE_STATUS = {
  SENDING: 'sending',
  SENT: 'sent',
  DELIVERED: 'delivered',
  READ: 'read',
  FAILED: 'failed'
};

class MessageStatusService {
  constructor() {
    this.messageStatuses = new Map(); // tempId -> status
    this.deliveryTracking = new Map(); // messageId -> delivery info
    this.readTracking = new Map(); // messageId -> read info
    this.listeners = [];
    
    // Load from localStorage
    this.loadPersistedStatus();
  }

  // Load persisted status from localStorage
  loadPersistedStatus() {
    try {
      const persistedStatuses = localStorage.getItem('messageStatuses');
      const persistedDelivery = localStorage.getItem('messageDelivery');
      const persistedRead = localStorage.getItem('messageRead');
      
      if (persistedStatuses) {
        const statuses = JSON.parse(persistedStatuses);
        this.messageStatuses = new Map(Object.entries(statuses));
      }
      
      if (persistedDelivery) {
        const delivery = JSON.parse(persistedDelivery);
        this.deliveryTracking = new Map(Object.entries(delivery));
      }
      
      if (persistedRead) {
        const read = JSON.parse(persistedRead);
        this.readTracking = new Map(Object.entries(read));
      }
      
      console.log('📊 Message status loaded:', {
        statuses: this.messageStatuses.size,
        delivery: this.deliveryTracking.size,
        read: this.readTracking.size
      });
    } catch (error) {
      console.error('Error loading message status:', error);
    }
  }

  // Persist status to localStorage
  persistStatus() {
    try {
      const statusesObj = Object.fromEntries(this.messageStatuses);
      const deliveryObj = Object.fromEntries(this.deliveryTracking);
      const readObj = Object.fromEntries(this.readTracking);
      
      localStorage.setItem('messageStatuses', JSON.stringify(statusesObj));
      localStorage.setItem('messageDelivery', JSON.stringify(deliveryObj));
      localStorage.setItem('messageRead', JSON.stringify(readObj));
    } catch (error) {
      console.error('Error persisting message status:', error);
    }
  }

  // Add listener for status changes
  addListener(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  // Notify all listeners
  notifyListeners(event) {
    this.listeners.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        console.error('Error in status listener:', error);
      }
    });
  }

  // Set message status by tempId (for optimistic messages)
  setMessageStatus(tempId, status, additionalData = {}) {
    const previousStatus = this.messageStatuses.get(tempId);
    this.messageStatuses.set(tempId, status);
    this.persistStatus();
    
    console.log('📊 Status updated:', { tempId, previousStatus, newStatus: status });
    
    this.notifyListeners({
      type: 'statusChanged',
      tempId,
      previousStatus,
      newStatus: status,
      ...additionalData
    });
  }

  // Get message status
  getMessageStatus(tempId) {
    return this.messageStatuses.get(tempId) || MESSAGE_STATUS.SENDING;
  }

  // Update status when message gets real ID from server
  updateMessageMapping(tempId, realMessageId) {
    const status = this.messageStatuses.get(tempId);
    if (status) {
      // Keep the tempId mapping but also track by real ID
      this.messageStatuses.set(realMessageId, status);
      this.persistStatus();
      
      console.log('📊 Message ID mapping updated:', { tempId, realMessageId, status });
    }
  }

  // Mark message as sent (server acknowledged)
  markAsSent(tempId, messageId) {
    this.setMessageStatus(tempId, MESSAGE_STATUS.SENT, { messageId });
    if (messageId && messageId !== tempId) {
      this.updateMessageMapping(tempId, messageId);
    }
  }

  // Mark message as delivered
  markAsDelivered(messageId, deliveredTo = []) {
    const deliveryInfo = {
      deliveredTo,
      deliveredAt: Date.now()
    };
    
    this.deliveryTracking.set(messageId, deliveryInfo);
    
    // Update status if we have the mapping
    const tempId = this.findTempIdByMessageId(messageId);
    if (tempId) {
      this.setMessageStatus(tempId, MESSAGE_STATUS.DELIVERED, { deliveredTo });
    }
    
    this.persistStatus();
    
    console.log('📊 Message delivered:', { messageId, deliveredTo });
    
    this.notifyListeners({
      type: 'delivered',
      messageId,
      deliveredTo
    });
  }

  // Mark message as read
  markAsRead(messageId, readBy = []) {
    const readInfo = {
      readBy,
      readAt: Date.now()
    };
    
    this.readTracking.set(messageId, readInfo);
    
    // Update status if we have the mapping
    const tempId = this.findTempIdByMessageId(messageId);
    if (tempId) {
      this.setMessageStatus(tempId, MESSAGE_STATUS.READ, { readBy });
    }
    
    this.persistStatus();
    
    console.log('📊 Message read:', { messageId, readBy });
    
    this.notifyListeners({
      type: 'read',
      messageId,
      readBy
    });
  }

  // Mark message as failed
  markAsFailed(tempId, error) {
    this.setMessageStatus(tempId, MESSAGE_STATUS.FAILED, { error });
  }

  // Find tempId by messageId (reverse lookup)
  findTempIdByMessageId(messageId) {
    for (const [key, value] of this.messageStatuses.entries()) {
      if (key === messageId) {
        return key;
      }
    }
    // Look for tempId that maps to this messageId
    return Array.from(this.messageStatuses.keys()).find(tempId => {
      return this.messageStatuses.get(messageId) !== undefined;
    });
  }

  // Get delivery info
  getDeliveryInfo(messageId) {
    return this.deliveryTracking.get(messageId);
  }

  // Get read info
  getReadInfo(messageId) {
    return this.readTracking.get(messageId);
  }

  // Get comprehensive status for UI
  getMessageStatusInfo(tempId, messageId) {
    const status = this.getMessageStatus(tempId);
    const deliveryInfo = messageId ? this.getDeliveryInfo(messageId) : null;
    const readInfo = messageId ? this.getReadInfo(messageId) : null;
    
    return {
      status,
      deliveryInfo,
      readInfo,
      isDelivered: status === MESSAGE_STATUS.DELIVERED || status === MESSAGE_STATUS.READ,
      isRead: status === MESSAGE_STATUS.READ,
      isFailed: status === MESSAGE_STATUS.FAILED,
      isSending: status === MESSAGE_STATUS.SENDING
    };
  }

  // Clean old status data (older than 7 days)
  cleanup() {
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    
    for (const [messageId, deliveryInfo] of this.deliveryTracking.entries()) {
      if (deliveryInfo.deliveredAt < sevenDaysAgo) {
        this.deliveryTracking.delete(messageId);
      }
    }
    
    for (const [messageId, readInfo] of this.readTracking.entries()) {
      if (readInfo.readAt < sevenDaysAgo) {
        this.readTracking.delete(messageId);
      }
    }
    
    this.persistStatus();
    console.log('🧹 Message status cleanup completed');
  }

  // Get status icon for UI
  getStatusIcon(tempId, messageId) {
    const info = this.getMessageStatusInfo(tempId, messageId);
    
    switch (info.status) {
      case MESSAGE_STATUS.SENDING:
        return '⏳';
      case MESSAGE_STATUS.SENT:
        return '✓';
      case MESSAGE_STATUS.DELIVERED:
        return '✓✓';
      case MESSAGE_STATUS.READ:
        return '💙';
      case MESSAGE_STATUS.FAILED:
        return '❌';
      default:
        return '⏳';
    }
  }

  // Get status description for UI
  getStatusDescription(tempId, messageId) {
    const info = this.getMessageStatusInfo(tempId, messageId);
    
    switch (info.status) {
      case MESSAGE_STATUS.SENDING:
        return 'Sending...';
      case MESSAGE_STATUS.SENT:
        return 'Sent';
      case MESSAGE_STATUS.DELIVERED:
        return 'Delivered';
      case MESSAGE_STATUS.READ:
        return 'Read';
      case MESSAGE_STATUS.FAILED:
        return 'Failed to send';
      default:
        return 'Sending...';
    }
  }
}

// Create singleton instance
export const messageStatus = new MessageStatusService();
export default MessageStatusService;