import React from 'react';
import ErrorBoundary from './ErrorBoundary';
import { MessageCircle, AlertTriangle } from 'lucide-react';

// Custom fallback component for message-related errors
const MessageErrorFallback = ({ error, errorId, retry, canRetry }) => (
  <div className="flex flex-col items-center justify-center p-6 text-center bg-red-50 border border-red-200 rounded-lg">
    <div className="flex items-center space-x-2 text-red-600 mb-3">
      <AlertTriangle className="w-5 h-5" />
      <MessageCircle className="w-5 h-5" />
    </div>
    
    <h3 className="font-medium text-red-900 mb-2">Message Display Error</h3>
    <p className="text-sm text-red-700 mb-4">
      Unable to display this message due to an error.
    </p>
    
    {canRetry && (
      <button
        onClick={retry}
        className="text-sm px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
      >
        Retry
      </button>
    )}
    
    <details className="mt-3 text-xs text-red-600">
      <summary className="cursor-pointer">Error ID: {errorId?.slice(-8)}</summary>
      <p className="mt-1">{error?.message}</p>
    </details>
  </div>
);

// Message-specific error boundary
const MessageErrorBoundary = ({ children }) => (
  <ErrorBoundary
    level="component"
    fallback={MessageErrorFallback}
    showDetails={process.env.NODE_ENV === 'development'}
  >
    {children}
  </ErrorBoundary>
);

export default MessageErrorBoundary;