import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';

export default function PrivateRoute({ children }) {
  const { user } = useContext(AuthContext);
  const location = useLocation();
  if (!user) {
    // Save the attempted URL in state so login can return there
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return children;
}