import API from './client';

class AuthService {
  // Register a new user
  async register(userData) {
    try {
      const response = await API.post('/auth/register', userData);
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Registration API error:', error);
      const errorMessage = error.response?.data?.message || 
                          error.response?.data?.error || 
                          error.message || 
                          'Registration failed';
      return { 
        success: false, 
        error: errorMessage 
      };
    }
  }

  // Login user
  async login(email, password) {
    try {
      const response = await API.post('/auth/login', { email, password });
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Login API error:', error);
      const errorMessage = error.response?.data?.message || 
                          error.response?.data?.error || 
                          error.message || 
                          'Login failed';
      return { 
        success: false, 
        error: errorMessage 
      };
    }
  }

  
  // Google OAuth login
  async googleAuth(idToken) {
    try {
      const response = await API.post('/auth/google', { idToken });
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Google auth API error:', error);
      const errorMessage = error.response?.data?.message || 
                          error.response?.data?.error || 
                          error.message || 
                          'Google authentication failed';
      return { 
        success: false, 
        error: errorMessage 
      };
    }
  }

  // Get current user profile
  async getCurrentUser() {
    try {
      const response = await API.get('/auth/me');
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Get current user API error:', error);
      const errorMessage = error.response?.data?.message || 
                          error.response?.data?.error || 
                          error.message || 
                          'Failed to get user profile';
      return { 
        success: false, 
        error: errorMessage 
      };
    }
  }

  // Validate token
  async validateToken() {
    try {
      const response = await API.get('/auth/me');
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Token validation API error:', error);
      return { success: false, error: 'Invalid token' };
    }
  }
}

export default new AuthService(); 