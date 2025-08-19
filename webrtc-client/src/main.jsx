import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { SocketProvider } from './context/SocketContext.jsx';
import { ChatSocketProvider } from './context/ChatSocketContext.jsx';
import { NotificationProvider } from './context/NotificationContext.jsx';
import { setupGlobalErrorHandlers, initializeErrorReporting } from './utils/errorHandler.js';
import './index.css';

// Initialize global error handling
setupGlobalErrorHandlers();

// Initialize error reporting (configure as needed)
initializeErrorReporting({
  environment: import.meta.env.MODE,
  sentryDsn: import.meta.env.VITE_SENTRY_DSN // Optional: Add Sentry DSN to .env
});

// Performance monitoring for development
if (import.meta.env.DEV) {
  console.log('🚀 Development mode - Error tracking enabled');
  
  // Add development helpers to window for debugging
  window.DevErrorUtils = (await import('./utils/errorHandler.js')).DevErrorUtils;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
    <AuthProvider>
      <SocketProvider>
        <ChatSocketProvider>
          <NotificationProvider>
            <BrowserRouter
              future={{
                v7_startTransition: true,
                v7_relativeSplatPath: true
              }}
            >
              <App />
            </BrowserRouter>
          </NotificationProvider>
        </ChatSocketProvider>
      </SocketProvider>
    </AuthProvider>
  </GoogleOAuthProvider>
);