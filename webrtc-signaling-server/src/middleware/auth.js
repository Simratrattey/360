import jwt from 'jsonwebtoken';
import User from '../models/user.js';

export default async function authMiddleware(req, res, next) {
  // Skip authentication for OPTIONS requests (CORS preflight)
  if (req.method === 'OPTIONS') {
    return next();
  }

  try {
    // Extract token from Authorization header
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
      return res.status(401).json({ 
        message: 'Access denied. No token provided.',
        error: 'NO_TOKEN'
      });
    }

    const token = auth.split(' ')[1];
    
    // Basic token format validation
    if (!token || token.length < 10) {
      return res.status(401).json({ 
        message: 'Access denied. Invalid token format.',
        error: 'INVALID_TOKEN_FORMAT'
      });
    }

    // Verify JWT token
    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError) {
      let errorMessage = 'Invalid or expired token';
      let errorCode = 'INVALID_TOKEN';
      
      if (jwtError.name === 'TokenExpiredError') {
        errorMessage = 'Token has expired. Please login again.';
        errorCode = 'TOKEN_EXPIRED';
      } else if (jwtError.name === 'JsonWebTokenError') {
        errorMessage = 'Malformed token. Please login again.';
        errorCode = 'MALFORMED_TOKEN';
      } else if (jwtError.name === 'NotBeforeError') {
        errorMessage = 'Token not active yet.';
        errorCode = 'TOKEN_NOT_ACTIVE';
      }
      
      return res.status(401).json({ 
        message: errorMessage,
        error: errorCode
      });
    }

    // Validate payload structure
    if (!payload.id || !payload.email) {
      return res.status(401).json({ 
        message: 'Token payload is incomplete.',
        error: 'INCOMPLETE_TOKEN'
      });
    }

    // Verify user still exists and is active
    const user = await User.findById(payload.id).select('email isActive username fullName');
    if (!user) {
      return res.status(401).json({ 
        message: 'User no longer exists. Please login again.',
        error: 'USER_NOT_FOUND'
      });
    }

    // Check if user is active
    if (user.isActive === false) {
      return res.status(401).json({ 
        message: 'Account is deactivated. Please contact support.',
        error: 'ACCOUNT_DEACTIVATED'
      });
    }

    // Verify email matches (prevent token reuse with different emails)
    if (user.email !== payload.email) {
      return res.status(401).json({ 
        message: 'Token is invalid for this user.',
        error: 'EMAIL_MISMATCH'
      });
    }

    // Add user information to request object
    req.user = {
      id: user._id.toString(),
      email: user.email,
      username: user.username,
      fullName: user.fullName,
      tokenIssuedAt: payload.iat,
      tokenExpiresAt: payload.exp
    };

    next();
  } catch (error) {
    console.error('Authentication middleware error:', error);
    return res.status(500).json({ 
      message: 'Authentication service temporarily unavailable.',
      error: 'AUTH_SERVICE_ERROR'
    });
  }
};