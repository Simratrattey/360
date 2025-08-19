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
  const { user } = useContext(AuthContext);
  const location = useLocation();

  return (
    <ErrorBoundary level="app" showDetails={process.env.NODE_ENV === 'development'}>
      {/* If not logged in, show login page */}
      {!user ? (
        <>
          <Routes>
            <Route path="/register" element={
              <ErrorBoundary level="page">
                <RegisterPage />
              </ErrorBoundary>
            } />
            <Route path="/login" element={
              <ErrorBoundary level="page">
                <LoginPage />
              </ErrorBoundary>
            } />
            <Route path="*" element={ <Navigate to="/login" state={{ from: location }} replace /> } />
          </Routes>
          <Toaster position="top-right" />
        </>
      ) : (
        /* If logged in, show the main app with layout */
        <>
          <ErrorBoundary level="page">
            <Layout>
              <Routes>
                <Route path="/" element={
                  <ErrorBoundary level="page">
                    <DashboardPage />
                  </ErrorBoundary>
                } />
                <Route path="/meetings" element={
                  <ErrorBoundary level="page">
                    <MeetingsPage />
                  </ErrorBoundary>
                } />
                <Route path="/meeting/:roomId" element={ 
                  <PrivateRoute> 
                    <ErrorBoundary level="page">
                      <MeetingPage />
                    </ErrorBoundary>
                  </PrivateRoute> 
                } />
                <Route path="/meetings/:id" element={
                  <ErrorBoundary level="page">
                    <MeetingDetailsPage />
                  </ErrorBoundary>
                } />
                <Route path="/contacts" element={
                  <ErrorBoundary level="page">
                    <ContactsPage />
                  </ErrorBoundary>
                } />
                <Route path="/settings" element={
                  <ErrorBoundary level="page">
                    <SettingsPage />
                  </ErrorBoundary>
                } />
                <Route path="/messages" element={
                  <ErrorBoundary level="page">
                    <MessagesPage />
                  </ErrorBoundary>
                } />
                <Route path="/search" element={
                  <ErrorBoundary level="page">
                    <SearchResultsPage />
                  </ErrorBoundary>
                } />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Layout>
          </ErrorBoundary>
          <Toaster position="top-right" />
        </>
      )}
    </ErrorBoundary>
  );
}