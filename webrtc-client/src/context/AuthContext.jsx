import React, { createContext, useState, useEffect, useContext } from 'react';
import authService from '../api/authService';

export const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const validateToken = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const result = await authService.validateToken();
          if (result.success) {
            setUser(result.data.user);
          } else {
            localStorage.removeItem('token');
            setUser(null);
          }
        } catch (err) {
          console.error('Token validation error:', err);
          localStorage.removeItem('token');
          setUser(null);
        }
      }
      setLoading(false);
    };

    validateToken();
  }, []);

  async function login(email, password) {
    setError(null);
    setLoading(true);
    
    try {
      const result = await authService.login(email, password);
      
      if (result.success) {
        localStorage.setItem('token', result.data.token);
        setUser(result.data.user);
        setLoading(false);
        return { success: true };
      } else {
        setError(result.error);
        setLoading(false);
        return { success: false, error: result.error };
      }
    } catch (err) {
      console.error('Login error:', err);
      const errorMessage = err.response?.data?.message || 'Login failed. Please try again.';
      setError(errorMessage);
      setLoading(false);
      return { success: false, error: errorMessage };
    }
  }

  async function register(userData) {
    setError(null);
    setLoading(true);
    
    try {
      const result = await authService.register(userData);
      
      if (result.success) {
        localStorage.setItem('token', result.data.token);
        setUser(result.data.user);
        setLoading(false);
        return { success: true };
      } else {
        setError(result.error);
        setLoading(false);
        return { success: false, error: result.error };
      }
    } catch (err) {
      console.error('Registration error:', err);
      const errorMessage = err.response?.data?.message || 'Registration failed. Please try again.';
      setError(errorMessage);
      setLoading(false);
      return { success: false, error: errorMessage };
    }
  }

  async function googleLogin(idToken) {
    setError(null);
    setLoading(true);
    
    try {
      const result = await authService.googleAuth(idToken);
      
      if (result.success) {
        localStorage.setItem('token', result.data.token);
        setUser(result.data.user);
        setLoading(false);
        return { success: true };
      } else {
        setError(result.error);
        setLoading(false);
        return { success: false, error: result.error };
      }
    } catch (err) {
      console.error('Google login error:', err);
      const errorMessage = err.response?.data?.message || 'Google authentication failed. Please try again.';
      setError(errorMessage);
      setLoading(false);
      return { success: false, error: errorMessage };
    }
  }

  function logout() {
    localStorage.removeItem('token');
    setUser(null);
    setError(null);
    setLoading(false);
  }

  function clearError() {
    setError(null);
  }

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      error, 
      login, 
      register, 
      googleLogin, 
      logout, 
      clearError 
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}