// Message Queue Service for handling offline messages and retries
class MessageQueueService {
  constructor() {
    this.retryQueue = [];
    this.offlineQueue = [];
    this.maxRetries = 3;
    this.baseRetryDelay = 1000; // 1 second
    this.isOnline = navigator.onLine;
    this.isProcessing = false;
    this.listeners = [];
    
    // Load persisted queues from localStorage
    this.loadPersistedQueues();
    
    // Listen for network changes
    this.setupNetworkListeners();
  }

  // Load queues from localStorage
  loadPersistedQueues() {
    try {
      const persistedRetryQueue = localStorage.getItem('messageRetryQueue');
      const persistedOfflineQueue = localStorage.getItem('messageOfflineQueue');
      
      if (persistedRetryQueue) {
        this.retryQueue = JSON.parse(persistedRetryQueue);
      }
      
      if (persistedOfflineQueue) {
        this.offlineQueue = JSON.parse(persistedOfflineQueue);
      }
      
    } catch (error) {
      console.error('Error loading persisted queues:', error);
      this.retryQueue = [];
      this.offlineQueue = [];
    }
  }

  // Persist queues to localStorage
  persistQueues() {
    try {
      localStorage.setItem('messageRetryQueue', JSON.stringify(this.retryQueue));
      localStorage.setItem('messageOfflineQueue', JSON.stringify(this.offlineQueue));
    } catch (error) {
      console.error('Error persisting queues:', error);
    }
  }

  // Setup network event listeners
  setupNetworkListeners() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.notifyListeners({ type: 'network', online: true });
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.notifyListeners({ type: 'network', online: false });
    });
  }

  // Add listener for queue events
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
        console.error('Error in queue listener:', error);
      }
    });
  }

  // Add message to retry queue
  addToRetryQueue(messageData, attempt = 0) {
    const queueItem = {
      ...messageData,
      attempt,
      addedAt: Date.now(),
      nextRetry: Date.now() + (this.baseRetryDelay * Math.pow(2, attempt))
    };

    this.retryQueue.push(queueItem);
    this.persistQueues();
    

    this.notifyListeners({
      type: 'messageQueued',
      message: queueItem,
      queue: 'retry'
    });

    // Process queue after a short delay
    setTimeout(() => this.processQueues(), 100);
  }

  // Add message to offline queue
  addToOfflineQueue(messageData) {
    const queueItem = {
      ...messageData,
      addedAt: Date.now()
    };

    this.offlineQueue.push(queueItem);
    this.persistQueues();
    

    this.notifyListeners({
      type: 'messageQueued',
      message: queueItem,
      queue: 'offline'
    });
  }

  // Remove message from queues
  removeFromQueues(tempId) {
    const initialRetryLength = this.retryQueue.length;
    const initialOfflineLength = this.offlineQueue.length;


    this.retryQueue = this.retryQueue.filter(item => item.tempId !== tempId);
    this.offlineQueue = this.offlineQueue.filter(item => item.tempId !== tempId);

    if (this.retryQueue.length !== initialRetryLength || this.offlineQueue.length !== initialOfflineLength) {
      this.persistQueues();
      
      this.notifyListeners({
        type: 'messageRemoved',
        tempId
      });
    }
  }

  // Process all queues
  async processQueues() {
    if (this.isProcessing || !this.isOnline) {
      return;
    }

    // Check if socket is connected before processing
    if (this.isSocketConnected && !this.isSocketConnected()) {
      return;
    }

    this.isProcessing = true;

    try {
      // Process offline queue first
      await this.processOfflineQueue();
      
      // Then process retry queue
      await this.processRetryQueue();
    } catch (error) {
      console.error('Error processing queues:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  // Process offline queue
  async processOfflineQueue() {
    if (this.offlineQueue.length === 0) return;

    const toProcess = [...this.offlineQueue];
    this.offlineQueue = [];
    this.persistQueues();

    for (const item of toProcess) {
      try {
        const response = await this.sendMessage(item);
        // Success - remove from any other queues
        this.removeFromQueues(item.tempId);
      } catch (error) {
        console.error('Failed to send offline message:', error);
        // Move to retry queue if send fails
        this.addToRetryQueue(item);
      }
    }
  }

  // Process retry queue
  async processRetryQueue() {
    if (this.retryQueue.length === 0) return;

    const now = Date.now();
    const readyToRetry = this.retryQueue.filter(item => item.nextRetry <= now);

    if (readyToRetry.length === 0) {
      // Schedule next check
      const nextRetry = Math.min(...this.retryQueue.map(item => item.nextRetry));
      const delay = Math.max(1000, nextRetry - now);
      setTimeout(() => this.processQueues(), delay);
      return;
    }

    for (const item of readyToRetry) {
      // Remove from queue temporarily
      this.retryQueue = this.retryQueue.filter(q => q.tempId !== item.tempId);

      try {
        const response = await this.sendMessage(item);
        // Success - don't add back to queue, and ensure it's removed from all queues
        this.removeFromQueues(item.tempId);
        this.notifyListeners({
          type: 'messageRetrySuccess',
          tempId: item.tempId
        });
      } catch (error) {
        console.error('Retry failed for message:', item.tempId, error);
        
        if (item.attempt < this.maxRetries - 1) {
          // Add back with incremented attempt
          this.addToRetryQueue(item, item.attempt + 1);
        } else {
          // Max retries reached - notify failure
          console.error('Max retries reached for message:', item.tempId);
          this.notifyListeners({
            type: 'messageRetryFailed',
            tempId: item.tempId,
            error: 'Max retries exceeded'
          });
        }
      }
    }

    this.persistQueues();
  }

  // Send message (to be implemented by caller)
  async sendMessage(messageData) {
    // This will be overridden by the calling code
    throw new Error('sendMessage method not implemented');
  }

  // Set message sender function
  setMessageSender(senderFunction) {
    this.sendMessage = senderFunction;
  }

  // Set socket connection checker
  setSocketChecker(checkerFunction) {
    this.isSocketConnected = checkerFunction;
  }

  // Get queue status
  getQueueStatus() {
    return {
      retryQueue: this.retryQueue.length,
      offlineQueue: this.offlineQueue.length,
      isOnline: this.isOnline,
      isProcessing: this.isProcessing
    };
  }

  // Get all queued messages for a conversation
  getQueuedMessages(conversationId) {
    return [
      ...this.retryQueue.filter(item => item.conversationId === conversationId),
      ...this.offlineQueue.filter(item => item.conversationId === conversationId)
    ];
  }

  // Clear all queues (for testing/debugging)
  clearQueues() {
    this.retryQueue = [];
    this.offlineQueue = [];
    this.persistQueues();
  }
}

// Create singleton instance
export const messageQueue = new MessageQueueService();
export default MessageQueueService;