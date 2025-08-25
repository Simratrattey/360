import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
      retryCount: 0
    };
  }

  static getDerivedStateFromError(error) {
    // Generate unique error ID for tracking
    const errorId = Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    return {
      hasError: true,
      errorId
    };
  }

  componentDidCatch(error, errorInfo) {
    // Log error details for debugging
    const errorDetails = {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      errorId: this.state.errorId,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      props: this.props.fallbackProps || {}
    };

    console.error('🚨 Error Boundary Caught:', errorDetails);

    // Send error to monitoring service if available
    if (window.errorReporting) {
      window.errorReporting.captureException(error, {
        tags: {
          component: 'ErrorBoundary',
          errorId: this.state.errorId
        },
        extra: errorDetails
      });
    }

    // Store error information in state
    this.setState({
      error,
      errorInfo,
      hasError: true
    });

    // Store error in session storage for debugging
    try {
      const storedErrors = JSON.parse(sessionStorage.getItem('app_errors') || '[]');
      storedErrors.push(errorDetails);
      // Keep only last 5 errors
      if (storedErrors.length > 5) {
        storedErrors.shift();
      }
      sessionStorage.setItem('app_errors', JSON.stringify(storedErrors));
    } catch (e) {
      console.warn('Failed to store error in session storage:', e);
    }
  }

  handleRetry = () => {
    const newRetryCount = this.state.retryCount + 1;
    
    // Prevent infinite retry loops
    if (newRetryCount > 3) {
      console.warn('Maximum retry attempts reached. Redirecting to home.');
      window.location.href = '/';
      return;
    }

    console.log(`🔄 Retrying component render (attempt ${newRetryCount}/3)`);
    
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
      retryCount: newRetryCount
    });
  };

  handleGoHome = () => {
    // Clear error state and navigate home
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
      retryCount: 0
    });
    
    // Use history API if available, fallback to location
    if (window.history && window.history.pushState) {
      window.history.pushState({}, '', '/');
      // Trigger a route change if using React Router
      window.dispatchEvent(new PopStateEvent('popstate'));
    } else {
      window.location.href = '/';
    }
  };

  handleReload = () => {
    console.log('🔄 Reloading application');
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const { error, errorId, retryCount } = this.state;
      const { fallback: CustomFallback, showDetails = true, level = 'component' } = this.props;

      // Use custom fallback if provided
      if (CustomFallback) {
        return (
          <CustomFallback
            error={error}
            errorId={errorId}
            retry={this.handleRetry}
            goHome={this.handleGoHome}
            reload={this.handleReload}
            canRetry={retryCount < 3}
          />
        );
      }

      // Default error UI based on level
      const isAppLevel = level === 'app';
      const isPageLevel = level === 'page';

      return (
        <div className={`
          flex flex-col items-center justify-center p-8 text-center
          ${isAppLevel ? 'min-h-screen bg-gray-50' : 'min-h-[400px] bg-gray-100 rounded-lg'}
        `}>
          <div className="max-w-md mx-auto">
            <AlertTriangle 
              className={`mx-auto mb-4 text-red-500 ${isAppLevel ? 'w-16 h-16' : 'w-12 h-12'}`} 
            />
            
            <h2 className={`font-bold text-gray-900 mb-2 ${isAppLevel ? 'text-2xl' : 'text-xl'}`}>
              {isAppLevel ? 'Application Error' : 'Something went wrong'}
            </h2>
            
            <p className="text-gray-600 mb-6">
              {isAppLevel 
                ? 'The application encountered an unexpected error. We apologize for the inconvenience.'
                : 'This component encountered an error and cannot be displayed right now.'
              }
            </p>

            {showDetails && error && (
              <details className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg text-left">
                <summary className="cursor-pointer text-sm font-medium text-gray-700 mb-2">
                  Error Details (ID: {errorId?.slice(-8)})
                </summary>
                <div className="text-xs text-gray-600 space-y-2">
                  <div>
                    <strong>Message:</strong>
                    <pre className="mt-1 whitespace-pre-wrap break-words">{error.message}</pre>
                  </div>
                  <div>
                    <strong>Stack Trace:</strong>
                    <pre className="mt-1 text-xs whitespace-pre-wrap break-all max-h-32 overflow-auto">
                      {error.stack}
                    </pre>
                  </div>
                </div>
              </details>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              {retryCount < 3 && (
                <button
                  onClick={this.handleRetry}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Try Again
                </button>
              )}
              
              {!isAppLevel && (
                <button
                  onClick={this.handleGoHome}
                  className="inline-flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  <Home className="w-4 h-4 mr-2" />
                  Go Home
                </button>
              )}
              
              <button
                onClick={this.handleReload}
                className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Reload App
              </button>
            </div>

            {retryCount >= 3 && (
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  <strong>Multiple retries failed.</strong> Please reload the page or contact support if the problem persists.
                </p>
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Higher-order component for wrapping components with error boundaries
export const withErrorBoundary = (WrappedComponent, options = {}) => {
  const WithErrorBoundaryComponent = (props) => (
    <ErrorBoundary {...options} fallbackProps={props}>
      <WrappedComponent {...props} />
    </ErrorBoundary>
  );

  WithErrorBoundaryComponent.displayName = 
    `withErrorBoundary(${WrappedComponent.displayName || WrappedComponent.name || 'Component'})`;

  return WithErrorBoundaryComponent;
};

// Hook for handling async errors in functional components
export const useErrorHandler = () => {
  const [error, setError] = React.useState(null);

  const resetError = React.useCallback(() => {
    setError(null);
  }, []);

  const handleError = React.useCallback((error) => {
    console.error('useErrorHandler caught:', error);
    setError(error);
  }, []);

  // Throw error to trigger error boundary
  React.useEffect(() => {
    if (error) {
      throw error;
    }
  }, [error]);

  return { handleError, resetError };
};

export default ErrorBoundary;