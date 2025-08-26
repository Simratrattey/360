import React, { useContext } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthContext } from './context/AuthContext.jsx';
import { Toaster } from 'react-hot-toast';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import Layout from './components/Layout.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import LandingPage from './pages/LandingPage.jsx';
import MeetingPage from './pages/MeetingPage.jsx';
import PrivateRoute from './components/PrivateRoute';
import MeetingsPage from './pages/MeetingsPage.jsx';
import ContactsPage from './pages/ContactsPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import MessagesPage from './pages/MessagesPage.jsx';
import SearchResultsPage from './pages/SearchResultsPage.jsx';
import MeetingDetailsPage from './pages/MeetingDetailsPage.jsx';


export default function App() {
  const { user, loading } = useContext(AuthContext);
  const location = useLocation();

  // Show loading state while authentication is being checked
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  // Check if this is a meeting page (standalone)
  const isMeetingPage = location.pathname.startsWith('/meeting/');

  // If not logged in, show login page (except for meeting pages which need special handling)
  if (!user && !isMeetingPage) {
    return (
      <>
        <Routes>
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="*" element={ <Navigate to="/login" state={{ from: location }} replace /> } />
        </Routes>
        <Toaster position="top-right" />
      </>
    );
  }

  // Handle meeting pages without layout (standalone)
  if (isMeetingPage) {
    return (
      <>
        <div className="min-h-screen bg-gray-900">
          <Routes>
            <Route path="/meeting/:roomId" element={ <PrivateRoute> <MeetingPage /> </PrivateRoute> } />
            <Route path="*" element={ <Navigate to="/login" replace /> } />
          </Routes>
        </div>
        <Toaster position="top-right" />
      </>
    );
  }

  // If logged in and not a meeting page, show the main app with layout
  return (
    <>
      <Layout>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/meetings" element={<MeetingsPage />} />
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