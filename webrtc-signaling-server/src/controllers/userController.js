import User from '../models/user.js';

// Get all users (for conversation creation)
export async function getAllUsers(req, res, next) {
  try {
    const users = await User.find({}, 'username fullName email avatarUrl')
      .sort({ fullName: 1, username: 1 });
    
    res.json({ users });
  } catch (err) {
    next(err);
  }
}

// Get all users
export async function getUsers(req, res, next) {
  try {
    const users = await User.find({}, 'username fullName avatarUrl email');
    res.json({ users });
  } catch (err) {
    next(err);
  }
}

// Get online users
export async function getOnlineUsers(req, res, next) {
  try {
    // This will be populated by the socket server
    // For now, return empty array - will be implemented with socket integration
    res.json({ onlineUsers: [] });
  } catch (err) {
    next(err);
  }
}

// Get user by ID
export async function getUserById(req, res, next) {
  try {
    const user = await User.findById(req.params.id, 'username fullName avatarUrl email');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({ user });
  } catch (err) {
    next(err);
  }
}

// Get current user's settings
export async function getUserSettings(req, res, next) {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({
      profile: {
        fullName: user.fullName,
        username: user.username,
        email: user.email,
        bio: user.bio,
        avatarUrl: user.avatarUrl
      },
      notifications: user.notifications,
      privacy: user.privacy,
      appearance: user.appearance,
      media: user.media
    });
  } catch (err) {
    next(err);
  }
}

// Update current user's settings
export async function updateUserSettings(req, res, next) {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    // Update fields if present in request body
    if (req.body.profile) {
      user.fullName = req.body.profile.fullName ?? user.fullName;
      user.username = req.body.profile.username ?? user.username;
      user.email = req.body.profile.email ?? user.email;
      user.bio = req.body.profile.bio ?? user.bio;
      user.avatarUrl = req.body.profile.avatarUrl ?? user.avatarUrl;
    }
    if (req.body.notifications) {
      user.notifications = { ...user.notifications, ...req.body.notifications };
    }
    if (req.body.privacy) {
      user.privacy = { ...user.privacy, ...req.body.privacy };
    }
    if (req.body.appearance) {
      user.appearance = { ...user.appearance, ...req.body.appearance };
    }
    if (req.body.media) {
      user.media = { ...user.media, ...req.body.media };
    }
    await user.save();
    res.json({ message: 'Settings updated successfully' });
  } catch (err) {
    next(err);
  }
} 