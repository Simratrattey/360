import fs from 'fs';
import path from 'path';

// File magic number signatures for validation
const FILE_SIGNATURES = {
  // Images
  'image/jpeg': [0xFF, 0xD8, 0xFF],
  'image/png': [0x89, 0x50, 0x4E, 0x47],
  'image/gif': [0x47, 0x49, 0x46],
  'image/webp': [0x52, 0x49, 0x46, 0x46],
  
  // Documents
  'application/pdf': [0x25, 0x50, 0x44, 0x46],
  
  // Audio
  'audio/mpeg': [0xFF, 0xFB],
  'audio/wav': [0x52, 0x49, 0x46, 0x46],
  
  // Video
  'video/mp4': [0x66, 0x74, 0x79, 0x70],
  'video/webm': [0x1A, 0x45, 0xDF, 0xA3]
};

/**
 * Validate file content matches MIME type using file signatures
 * @param {string} filePath - Path to the uploaded file
 * @param {string} mimeType - MIME type to validate against
 * @returns {Promise<boolean>} - True if file is valid
 */
export const validateFileContent = async (filePath, mimeType) => {
  try {
    const signature = FILE_SIGNATURES[mimeType];
    if (!signature) {
      // If no signature defined, assume it's safe (for text files etc.)
      return true;
    }

    // Read first few bytes of the file
    const buffer = Buffer.alloc(signature.length);
    const fd = await fs.promises.open(filePath, 'r');
    const { bytesRead } = await fd.read(buffer, 0, signature.length, 0);
    await fd.close();

    if (bytesRead < signature.length) {
      return false;
    }

    // Compare file signature
    for (let i = 0; i < signature.length; i++) {
      if (buffer[i] !== signature[i]) {
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error('File validation error:', error);
    return false;
  }
};

/**
 * Scan file for malicious content patterns
 * @param {string} filePath - Path to the uploaded file
 * @returns {Promise<boolean>} - True if file appears safe
 */
export const scanFileContent = async (filePath) => {
  try {
    const stats = await fs.promises.stat(filePath);
    
    // Skip binary files that are too large to scan
    if (stats.size > 10 * 1024 * 1024) { // 10MB limit for content scanning
      return true;
    }

    // Read file content for text files
    const ext = path.extname(filePath).toLowerCase();
    const textExtensions = ['.txt', '.csv', '.html', '.css', '.js', '.json', '.xml'];
    
    if (textExtensions.includes(ext)) {
      const content = await fs.promises.readFile(filePath, 'utf8');
      
      // Check for malicious patterns in text files
      const maliciousPatterns = [
        /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
        /javascript:/gi,
        /vbscript:/gi,
        /onload\s*=/gi,
        /onerror\s*=/gi,
        /onclick\s*=/gi,
        /eval\s*\(/gi,
        /document\.write/gi,
        /innerHTML/gi
      ];

      if (maliciousPatterns.some(pattern => pattern.test(content))) {
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error('File content scan error:', error);
    return false;
  }
};

/**
 * Middleware to validate uploaded files
 */
export const fileValidationMiddleware = async (req, res, next) => {
  if (!req.file) {
    return next();
  }

  try {
    const filePath = req.file.path;
    const mimeType = req.file.mimetype;

    // Validate file signature matches MIME type
    const isValidContent = await validateFileContent(filePath, mimeType);
    if (!isValidContent) {
      // Delete the uploaded file
      try {
        await fs.promises.unlink(filePath);
      } catch (e) {
        console.error('Error deleting invalid file:', e);
      }
      
      return res.status(400).json({
        message: 'File content does not match declared type',
        error: 'INVALID_FILE_CONTENT'
      });
    }

    // Scan file for malicious content
    const isSafeContent = await scanFileContent(filePath);
    if (!isSafeContent) {
      // Delete the uploaded file
      try {
        await fs.promises.unlink(filePath);
      } catch (e) {
        console.error('Error deleting malicious file:', e);
      }
      
      return res.status(400).json({
        message: 'File contains potentially malicious content',
        error: 'MALICIOUS_FILE_CONTENT'
      });
    }

    next();
  } catch (error) {
    console.error('File validation middleware error:', error);
    
    // Delete the uploaded file on error
    if (req.file && req.file.path) {
      try {
        await fs.promises.unlink(req.file.path);
      } catch (e) {
        console.error('Error deleting file after validation error:', e);
      }
    }
    
    return res.status(500).json({
      message: 'File validation failed',
      error: 'FILE_VALIDATION_ERROR'
    });
  }
};