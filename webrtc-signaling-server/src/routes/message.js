import express from 'express';
import * as ctrl from '../controllers/messageController.js';
import authMiddleware from '../middleware/auth.js';
import inputValidation from '../middleware/inputValidation.js';
import { fileValidationMiddleware } from '../middleware/fileValidation.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
const router = express.Router();

router.use(authMiddleware);

// File upload setup
const uploadDir = path.join(process.cwd(), 'uploads', 'messages');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// File size limit: 50MB
const MAX_FILE_SIZE = 50 * 1024 * 1024;

// Allowed file types (extend as needed)
const ALLOWED_FILE_TYPES = [
  // Images
  'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  // Documents
  'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain', 'text/csv', 'text/html', 'text/css', 'text/javascript',
  // Archives
  'application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed',
  'application/gzip', 'application/x-tar',
  // Audio
  'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4', 'audio/aac', 'audio/webm',
  // Video
  'video/mp4', 'video/webm', 'video/ogg', 'video/avi', 'video/mov', 'video/wmv',
  // Code files
  'application/json', 'application/xml', 'text/xml',
  // Other common types
  'application/octet-stream' // For unknown file types
];

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    // Sanitize filename to prevent security issues
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + '-' + sanitizedName);
  }
});

// Enhanced secure file filter function
const fileFilter = (req, file, cb) => {
  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return cb(new Error(`File size too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB`), false);
  }

  // Check file type against whitelist (more restrictive)
  const allowedTypes = [
    // Images
    'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
    // Documents
    'application/pdf', 
    'application/msword', 
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel', 
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain', 'text/csv',
    // Audio/Video
    'audio/mpeg', 'audio/wav', 'audio/mp4',
    'video/mp4', 'video/webm'
  ];

  if (!allowedTypes.includes(file.mimetype)) {
    return cb(new Error(`File type not allowed: ${file.mimetype}`), false);
  }

  // Validate filename - prevent path traversal and malicious names
  const filename = file.originalname;
  if (!filename || filename.length > 255) {
    return cb(new Error('Invalid filename'), false);
  }

  // Check for suspicious patterns in filename
  const suspiciousPatterns = [
    /\.\./,           // Path traversal
    /[<>:"|?*]/,      // Invalid Windows characters
    /^\.+$/,          // Hidden files
    /\.(exe|bat|cmd|scr|vbs|js|jar|com|pif)$/i, // Executable extensions
    /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i    // Windows reserved names
  ];

  if (suspiciousPatterns.some(pattern => pattern.test(filename))) {
    return cb(new Error('Invalid filename format'), false);
  }

  cb(null, true);
};

const upload = multer({ 
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE
  }
});

// File upload endpoint with enhanced security validation
router.post('/upload', upload.single('file'), fileValidationMiddleware, (req, res) => {
  if (!req.file) {
    return res.status(400).json({ 
      message: 'No file uploaded',
      error: 'FILE_MISSING'
    });
  }
  
  try {
    // Create proper file URL using environment variable or default local server
    const baseUrl = process.env.NODE_ENV === 'production' 
      ? (process.env.BACKEND_URL || 'https://webrtc-signaling-server.onrender.com')
      : 'http://localhost:8181';
    
    const fileUrl = `${baseUrl}/uploads/messages/${req.file.filename}`;
    
    // Determine file category for better UI handling
    let fileCategory = 'other';
    if (req.file.mimetype.startsWith('image/')) {
      fileCategory = 'image';
    } else if (req.file.mimetype.startsWith('video/')) {
      fileCategory = 'video';
    } else if (req.file.mimetype.startsWith('audio/')) {
      fileCategory = 'audio';
    } else if (req.file.mimetype.startsWith('application/pdf') || 
               req.file.mimetype.includes('document') || 
               req.file.mimetype.includes('spreadsheet') || 
               req.file.mimetype.includes('presentation')) {
      fileCategory = 'document';
    } else if (req.file.mimetype.includes('zip') || 
               req.file.mimetype.includes('rar') || 
               req.file.mimetype.includes('compressed') || 
               req.file.mimetype.includes('tar')) {
      fileCategory = 'archive';
    } else if (req.file.mimetype.startsWith('text/') || 
               req.file.mimetype.includes('json') || 
               req.file.mimetype.includes('xml') || 
               req.file.mimetype.includes('javascript')) {
      fileCategory = 'code';
    }
    
    res.json({ 
      url: fileUrl, 
      name: req.file.originalname, 
      type: req.file.mimetype,
      size: req.file.size,
      category: fileCategory,
      filename: req.file.filename // Store the actual filename for potential deletion
    });
  } catch (error) {
    console.error('File upload error:', error);
    res.status(500).json({ 
      message: 'Error processing file upload',
      error: 'UPLOAD_ERROR'
    });
  }
});

// Error handling middleware for multer
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ 
        message: `File size too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
        error: 'FILE_TOO_LARGE'
      });
    }
    return res.status(400).json({ 
      message: 'File upload error',
      error: 'UPLOAD_ERROR'
    });
  }
  
  if (error.message) {
    return res.status(400).json({ 
      message: error.message,
      error: 'VALIDATION_ERROR'
    });
  }
  
  next(error);
});

// List messages in a conversation
router.get('/conversation/:conversationId', inputValidation.validateObjectId('conversationId'), ctrl.listMessages);
// Search messages in a conversation
router.get('/conversation/:conversationId/search', 
  inputValidation.validateObjectId('conversationId'),
  inputValidation.sanitizeSearchQuery, 
  ctrl.searchMessages
);
// Send a new message
router.post('/conversation/:conversationId', 
  inputValidation.validateObjectId('conversationId'),
  inputValidation.sanitizeMessageContent,
  ctrl.sendMessage
);
// Edit a message
router.put('/:messageId', 
  inputValidation.validateObjectId('messageId'),
  inputValidation.sanitizeMessageContent,
  ctrl.editMessage
);
// Delete a message
router.delete('/:messageId', inputValidation.validateObjectId('messageId'), ctrl.deleteMessage);
// React to a message
router.post('/:messageId/react', 
  inputValidation.validateObjectId('messageId'),
  inputValidation.sanitizeEmoji,
  ctrl.reactMessage
);
// Remove a reaction
router.post('/:messageId/unreact', 
  inputValidation.validateObjectId('messageId'),
  inputValidation.sanitizeEmoji,
  ctrl.removeReaction
);

export default router; 