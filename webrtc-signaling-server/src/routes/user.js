import express from 'express';
import * as ctrl from '../controllers/userController.js';
import authMiddleware from '../middleware/auth.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = express.Router();

router.use(authMiddleware);

const avatarUpload = multer({
  dest: path.join(process.cwd(), 'uploads', 'avatars'),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  }
});

// Settings endpoints (must come before /:id)
router.get('/settings', ctrl.getUserSettings);
router.put('/settings', ctrl.updateUserSettings);

// Avatar upload endpoint (must come before /:id)
router.post('/avatar', avatarUpload.single('avatar'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    // Fetch the user as a Mongoose document
    const user = await ctrl.User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    // Move/rename file to use user ID as filename
    const ext = path.extname(req.file.originalname).toLowerCase();
    const newFilename = `${user.id}${ext}`;
    const newPath = path.join(req.file.destination, newFilename);
    fs.renameSync(req.file.path, newPath);
    // Update user's avatarUrl
    user.avatarUrl = `/api/files/avatars/${newFilename}`;
    await user.save();
    res.json({ avatarUrl: user.avatarUrl });
  } catch (err) {
    next(err);
  }
});

// Get all users (for conversation creation)
router.get('/', ctrl.getUsers);

// Get user by ID
router.get('/:id', ctrl.getUserById);

router.get('/online', ctrl.getOnlineUsers);

export default router; 