// Global error handling utilities

// Store for tracking errors
const errorStore = {
  errors: [],
  maxErrors: 20,
  listeners: []
};

// Add error to store
const addError = (error, context = {}) => {
  const errorEntry = {
    id: Date.now() + '-' + Math.random().toString(36).substr(2, 9),
    timestamp: new Date().toISOString(),
    message: error.message || 'Unknown error',
    stack: error.stack,
    context,
    type: error.name || 'Error',
    userAgent: navigator.userAgent,
    url: window.location.href
  };

  errorStore.errors.unshift(errorEntry);
  
  // Keep only the most recent errors
  if (errorStore.errors.length > errorStore.maxErrors) {
    errorStore.errors = errorStore.errors.slice(0, errorStore.maxErrors);
  }

  // Notify listeners
  errorStore.listeners.forEach(listener => {
    try {
      listener(errorEntry);
    } catch (e) {
      console.warn('Error in error listener:', e);
    }
  });

  return errorEntry;
};

// Setup global error handlers
export const setupGlobalErrorHandlers = () => {
  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    console.error('🚨 Unhandled Promise Rejection:', event.reason);
    
    const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason));
    addError(error, {
      type: 'unhandledrejection',
      promise: event.promise
    });

    // Log to console for debugging
    console.group('🚨 Unhandled Promise Rejection Details');
    console.error('Reason:', event.reason);
    console.error('Promise:', event.promise);
    console.groupEnd();

    // Send to monitoring service if available
    if (window.errorReporting) {
      window.errorReporting.captureException(error, {
        tags: { type: 'unhandledrejection' },
        extra: { reason: event.reason }
      });
    }

    // Prevent the default browser behavior
    event.preventDefault();
  });

  // Handle uncaught errors
  window.addEventListener('error', (event) => {
    console.error('🚨 Uncaught Error:', event.error || event.message);
    
    const error = event.error || new Error(event.message);
    addError(error, {
      type: 'uncaughterror',
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno
    });

    // Log to console for debugging
    console.group('🚨 Uncaught Error Details');
    console.error('Message:', event.message);
    console.error('Filename:', event.filename);
    console.error('Line:', event.lineno, 'Column:', event.colno);
    console.error('Error object:', event.error);
    console.groupEnd();

    // Send to monitoring service if available
    if (window.errorReporting) {
      window.errorReporting.captureException(error, {
        tags: { type: 'uncaughterror' },
        extra: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno
        }
      });
    }
  });

  // Handle resource loading errors
  window.addEventListener('error', (event) => {
    if (event.target !== window) {
      const element = event.target;
      const resourceType = element.tagName.toLowerCase();
      const source = element.src || element.href;

      console.error('🚨 Resource Load Error:', resourceType, source);
      
      addError(new Error(`Failed to load ${resourceType}: ${source}`), {
        type: 'resourceerror',
        resourceType,
        source,
        element: element.outerHTML.substring(0, 200) // First 200 chars
      });

      // Send to monitoring service if available
      if (window.errorReporting) {
        window.errorReporting.captureMessage(`Resource load error: ${resourceType}`, 'error', {
          tags: { type: 'resourceerror', resourceType },
          extra: { source, element: element.outerHTML.substring(0, 200) }
        });
      }
    }
  }, true); // Use capture phase for resource errors

  console.log('✅ Global error handlers initialized');
};

// Subscribe to error events
export const subscribeToErrors = (callback) => {
  errorStore.listeners.push(callback);
  
  // Return unsubscribe function
  return () => {
    const index = errorStore.listeners.indexOf(callback);
    if (index > -1) {
      errorStore.listeners.splice(index, 1);
    }
  };
};

// Get all stored errors
export const getStoredErrors = () => [...errorStore.errors];

// Clear stored errors
export const clearStoredErrors = () => {
  errorStore.errors = [];
};

// Manually report an error
export const reportError = (error, context = {}) => {
  return addError(error, context);
};

// Check for critical errors that might indicate app instability
export const checkAppHealth = () => {
  const recentErrors = errorStore.errors.filter(error => {
    const errorTime = new Date(error.timestamp);
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    return errorTime > fiveMinutesAgo;
  });

  const criticalCount = recentErrors.filter(error => 
    error.type === 'uncaughterror' || 
    error.type === 'unhandledrejection'
  ).length;

  return {
    healthy: criticalCount < 3,
    recentErrorCount: recentErrors.length,
    criticalErrorCount: criticalCount,
    recommendation: criticalCount >= 3 ? 'reload' : 'continue'
  };
};

// Development-only error utilities
export const DevErrorUtils = {
  // Trigger various types of errors for testing
  triggerSyncError: () => {
    throw new Error('Test synchronous error');
  },
  
  triggerAsyncError: () => {
    setTimeout(() => {
      throw new Error('Test asynchronous error');
    }, 100);
  },
  
  triggerPromiseRejection: () => {
    Promise.reject(new Error('Test promise rejection'));
  },
  
  triggerResourceError: () => {
    const img = document.createElement('img');
    img.src = 'https://nonexistent.example.com/image.jpg';
    document.body.appendChild(img);
    setTimeout(() => document.body.removeChild(img), 1000);
  }
};

// Initialize error reporting integration
export const initializeErrorReporting = (config = {}) => {
  // Check for Sentry or other error reporting services
  if (config.sentryDsn && window.Sentry) {
    window.Sentry.init({
      dsn: config.sentryDsn,
      environment: config.environment || 'production',
      beforeSend: (event) => {
        // Filter out known non-critical errors
        if (event.exception?.values?.[0]?.value?.includes('Non-Error promise rejection captured')) {
          return null;
        }
        return event;
      }
    });
    window.errorReporting = window.Sentry;
    console.log('✅ Sentry error reporting initialized');
  } else {
    // Fallback error reporting
    window.errorReporting = {
      captureException: (error, options = {}) => {
        console.error('📊 Error Report:', error, options);
        // Could send to custom logging endpoint
      },
      captureMessage: (message, level = 'info', options = {}) => {
        console.log(`📊 Message Report [${level}]:`, message, options);
      }
    };
    console.log('✅ Fallback error reporting initialized');
  }
};