import React, { useContext } from 'react';
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

export default function App() {
  const { user } = useContext(AuthContext);

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