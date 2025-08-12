import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { SocketProvider } from './context/SocketContext.jsx';
import { ChatSocketProvider } from './context/ChatSocketContext.jsx';
import { NotificationProvider } from './context/NotificationContext.jsx';
import './index.css';

console.log('🚀 Main.jsx is loading - Current URL:', window.location.href);

try {
  console.log('🔗 Initializing React app...');
  const rootElement = document.getElementById('root');
  console.log('📦 Root element found:', !!rootElement);
  
  ReactDOM.createRoot(rootElement).render(
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
  console.log('✅ React app initialized successfully');
} catch (error) {
  console.error('❌ Failed to initialize React app:', error);
  document.body.innerHTML = `<div style="color: red; padding: 20px;">Failed to load app: ${error.message}</div>`;
}