import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

const userSchema = new mongoose.Schema({
  email:      { type: String, required: true, unique: true },
  username:   { type: String, required: true, unique: true },
  fullName:   { type: String },
  avatarUrl:  { type: String },
  passwordHash: { type: String },         // only for local auth
  googleId:   { type: String },           // only for Google OAuth

  // Settings fields
  bio:        { type: String },
  notifications: {
    emailNotifications:   { type: Boolean, default: true },
    pushNotifications:    { type: Boolean, default: true },
    meetingReminders:     { type: Boolean, default: true },
    soundAlerts:          { type: Boolean, default: true }
  },
  privacy: {
    showOnlineStatus:     { type: Boolean, default: true },
    allowScreenSharing:   { type: Boolean, default: true },
    recordMeetings:       { type: Boolean, default: false }
  },
  appearance: {
    theme:                { type: String, default: 'light' },
    compactMode:          { type: Boolean, default: false },
    showAnimations:       { type: Boolean, default: true }
  },
  media: {
    defaultCamera:        { type: String, default: 'default' },
    defaultMicrophone:    { type: String, default: 'default' },
    videoQuality:         { type: String, default: '720p' },
    audioQuality:         { type: String, default: 'high' }
  }
}, { timestamps: true });

// hash password on set
userSchema.virtual('password')
  .set(function(pw) {
    this.passwordHash = bcrypt.hashSync(pw, 10);
  });

// compare plain text to hash
userSchema.methods.verifyPassword = function(pw) {
  return bcrypt.compareSync(pw, this.passwordHash);
};

export default mongoose.model('User', userSchema);