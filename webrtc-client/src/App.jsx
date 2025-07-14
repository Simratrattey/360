<<<<<<< HEAD
import React, { useContext } from 'react';
=======
import React, { useContext, useEffect } from 'react';
>>>>>>> main
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthContext } from './context/AuthContext.jsx';
import { Toaster } from 'react-hot-toast';
import Layout from './components/Layout.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import LandingPage from './pages/LandingPage.jsx';
import MeetingPage from './pages/MeetingPage.jsx';
import MeetingsPage from './pages/MeetingsPage.jsx';
import ContactsPage from './pages/ContactsPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import MessagesPage from './pages/MessagesPage.jsx';
import SearchResultsPage from './pages/SearchResultsPage.jsx';
import MeetingDetailsPage from './pages/MeetingDetailsPage.jsx';

export default function App() {
  const { user } = useContext(AuthContext);

<<<<<<< HEAD
=======
  // Request notification permission when app loads
  useEffect(() => {
    if ('Notification' in window) {
      console.log('Notification API available, current permission:', Notification.permission);
      
      if (Notification.permission === 'default') {
        console.log('Requesting notification permission...');
        Notification.requestPermission()
          .then(permission => {
            console.log('Notification permission result:', permission);
            if (permission === 'granted') {
              console.log('✅ Notification permission granted!');
            } else {
              console.warn('❌ Notification permission denied or not granted');
            }
          })
          .catch(error => {
            console.error('Error requesting notification permission:', error);
          });
      } else if (Notification.permission === 'granted') {
        console.log('✅ Notification permission already granted');
      } else {
        console.warn('❌ Notification permission denied by user');
      }
    } else {
      console.warn('❌ Notification API not supported in this browser');
    }
  }, []);

>>>>>>> main
  // If not logged in, show login page
  if (!user) {
    return (
      <>
        <Routes>
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
        <Toaster position="top-right" />
      </>
    );
  }

  // If logged in, show the main app with layout
  return (
    <>
      <Layout>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/meetings" element={<MeetingsPage />} />
          <Route path="/meeting/:roomId" element={<MeetingPage />} />
          <Route path="/meetings/:id" element={<MeetingDetailsPage />} />
          <Route path="/contacts" element={<ContactsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/messages" element={<MessagesPage />} />
          <Route path="/search" element={<SearchResultsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
      <Toaster position="top-right" />
    </>
  );
}