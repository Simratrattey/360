import API from './client';

class AuthService {
  // Register a new user
  async register(userData) {
    try {
      const response = await API.post('/auth/register', userData);
      return { success: true, data: response.data };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.message || 'Registration failed' 
      };
    }
  }

  // Login user
  async login(email, password) {
    try {
      const response = await API.post('/auth/login', { email, password });
      return { success: true, data: response.data };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.message || 'Login failed' 
      };
    }
  }

  
  // Google OAuth login
  async googleAuth(idToken) {
    try {
      const response = await API.post('/auth/google', { idToken });
      return { success: true, data: response.data };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.message || 'Google authentication failed' 
      };
    }
  }

  // Get current user profile
  async getCurrentUser() {
    try {
      const response = await API.get('/auth/me');
      return { success: true, data: response.data };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.message || 'Failed to get user profile' 
      };
    }
  }

  // Validate token
  async validateToken() {
    try {
      const response = await API.get('/auth/me');
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: 'Invalid token' };
    }
  }
}

export default new AuthService(); 