import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import User from '../models/user.js';

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// helper to sign a JWT
function signToken(user) {
  return jwt.sign(
    { id: user._id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export async function register(req, res, next) {
  try {
    const { email, username, fullName, password } = req.body;
    // create user and hash pw via virtual
    const user = new User({ email, username, fullName });
    user.password = password;
    await user.save();
    const token = signToken(user);
    res.json({ token, user: { id: user._id, email, username, fullName, avatarUrl: user.avatarUrl } });
  } catch (err) {
    next(err);
  }
};

export async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !user.verifyPassword(password)) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    const token = signToken(user);
    res.json({ token, user: { id: user._id, email, username: user.username, fullName: user.fullName } });
  } catch (err) {
    next(err);
  }
};

export async function googleAuth(req, res, next) {
  try {
    const { idToken } = req.body;
    let ticket;
    try {
      ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID
      });
    } catch (err) {
      console.error('❌ Google verifyIdToken error:', err);
      return res.status(400).json({ message: 'Google authentication failed', details: err.toString() });
    }

    const payload = ticket.getPayload();
    // 1) Try to find a user already linked to this Google ID
    let user = await User.findOne({ googleId: payload.sub });

    // 2) If none, try to find an existing account by email
    if (!user) {
      user = await User.findOne({ email: payload.email });
      if (user) {
        // Link existing account to Google
        user.googleId  = payload.sub;
        user.avatarUrl = payload.picture;
        await user.save();
      }
    }

    // 3) If still no user, create a brand-new one
    if (!user) {
      user.googleId   = payload.sub;
      user.avatarUrl  = payload.picture;
    } else {
      user = new User({
        email:      payload.email,
        fullName:   payload.name,
        username:   payload.email.split('@')[0],
        googleId:   payload.sub,
        avatarUrl:  payload.picture,
      });
      await user.save();
    }
    const token = signToken(user);
    res.json({ token, user: { id: user._id, email: user.email, fullName: user.fullName, avatarUrl: user.avatarUrl } });
  } catch (err) {
    next(err);
  }
};

// optional: get current user
export async function me(req, res) {
  const u = await User.findById(req.user.id).select('email username fullName avatarUrl');
  return res.json({
    user: {
      id: u._id.toString(),
      email: u.email,
      username: u.username,
      fullName: u.fullName,
      avatarUrl: u.avatarUrl
    }
  });
};