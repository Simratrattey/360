import validator from 'validator';

// Input validation and sanitization middleware
const inputValidation = {
  // Sanitize and validate search queries to prevent NoSQL injection
  sanitizeSearchQuery: (req, res, next) => {
    if (req.query.query) {
      // Escape special regex characters and MongoDB operators
      const sanitizedQuery = req.query.query
        .replace(/[\$\{\}]/g, '') // Remove MongoDB operators
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // Escape regex special characters
        .trim()
        .substring(0, 500); // Limit length to prevent DoS
      
      // Additional validation
      if (!validator.isLength(sanitizedQuery, { min: 1, max: 500 })) {
        return res.status(400).json({ 
          message: 'Search query must be between 1 and 500 characters',
          error: 'INVALID_QUERY_LENGTH'
        });
      }
      
      req.query.query = sanitizedQuery;
    }
    
    // Validate other search parameters
    if (req.query.type && !['all', 'text', 'file', 'image'].includes(req.query.type)) {
      req.query.type = 'all';
    }
    
    if (req.query.sender && req.query.sender !== 'all' && req.query.sender !== 'me') {
      // Validate sender as MongoDB ObjectId if not 'all' or 'me'
      if (!validator.isMongoId(req.query.sender)) {
        req.query.sender = 'all';
      }
    }
    
    if (req.query.dateRange && !['all', 'today', 'week', 'month'].includes(req.query.dateRange)) {
      req.query.dateRange = 'all';
    }
    
    // Validate pagination parameters
    if (req.query.limit) {
      const limit = parseInt(req.query.limit);
      req.query.limit = Math.min(Math.max(limit, 1), 100); // Between 1-100
    }
    
    if (req.query.skip) {
      const skip = parseInt(req.query.skip);
      req.query.skip = Math.max(skip, 0); // Non-negative
    }
    
    next();
  },

  // Sanitize message content
  sanitizeMessageContent: (req, res, next) => {
    if (req.body.text) {
      // Basic sanitization - remove potential XSS
      const sanitizedText = req.body.text
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
        .replace(/javascript:/gi, '') // Remove javascript: protocols
        .replace(/on\w+\s*=/gi, '') // Remove event handlers
        .trim()
        .substring(0, 10000); // Limit message length
      
      if (!validator.isLength(sanitizedText, { min: 0, max: 10000 })) {
        return res.status(400).json({ 
          message: 'Message text must be less than 10,000 characters',
          error: 'MESSAGE_TOO_LONG'
        });
      }
      
      req.body.text = sanitizedText;
    }
    
    next();
  },

  // Sanitize conversation data
  sanitizeConversationData: (req, res, next) => {
    if (req.body.name) {
      const sanitizedName = req.body.name
        .replace(/<[^>]*>/g, '') // Remove HTML tags
        .trim()
        .substring(0, 100); // Limit length
      
      if (!validator.isLength(sanitizedName, { min: 1, max: 100 })) {
        return res.status(400).json({ 
          message: 'Conversation name must be between 1 and 100 characters',
          error: 'INVALID_NAME_LENGTH'
        });
      }
      
      req.body.name = sanitizedName;
    }
    
    if (req.body.description) {
      const sanitizedDescription = req.body.description
        .replace(/<[^>]*>/g, '') // Remove HTML tags
        .trim()
        .substring(0, 500); // Limit length
      
      if (sanitizedDescription.length > 500) {
        return res.status(400).json({ 
          message: 'Description must be less than 500 characters',
          error: 'DESCRIPTION_TOO_LONG'
        });
      }
      
      req.body.description = sanitizedDescription;
    }
    
    // Validate member IDs
    if (req.body.memberIds && Array.isArray(req.body.memberIds)) {
      const validMemberIds = req.body.memberIds
        .filter(id => validator.isMongoId(id))
        .slice(0, 50); // Limit to 50 members max
      
      req.body.memberIds = validMemberIds;
    }
    
    next();
  },

  // Validate MongoDB ObjectId parameters
  validateObjectId: (paramName) => {
    return (req, res, next) => {
      const id = req.params[paramName];
      if (!validator.isMongoId(id)) {
        return res.status(400).json({ 
          message: `Invalid ${paramName} format`,
          error: 'INVALID_ID_FORMAT'
        });
      }
      next();
    };
  },

  // Sanitize emoji reactions
  sanitizeEmoji: (req, res, next) => {
    if (req.body.emoji) {
      // Define allowed emoji list that matches frontend
      const allowedEmojis = ['👍', '❤️', '😂', '😮', '😢', '😡', '👏', '🙏', '🔥', '💯', '✨', '🎉', '🤔', '😎', '🥳', '😴'];
      
      if (!allowedEmojis.includes(req.body.emoji)) {
        // If not in allowed list, use a default one
        req.body.emoji = '👍';
      }
    }
    
    next();
  }
};

export default inputValidation;