import React, { useState, useContext, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Settings, 
  User, 
  Bell, 
  Shield, 
  Monitor, 
  Palette,
  Save,
  Camera,
  Mic,
  Volume2,
  Moon,
  Sun,
  Smartphone
} from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import { uploadAvatar, updateSettings, getUserSettings } from '../api/userService';

const settingsSections = [
  {
    id: 'profile',
    title: 'Profile Settings',
    icon: User,
    description: 'Manage your personal information'
  },
  {
    id: 'notifications',
    title: 'Notifications',
    icon: Bell,
    description: 'Configure notifications'
  },
  {
    id: 'privacy',
    title: 'Privacy & Security',
    icon: Shield,
    description: 'Privacy settings'
  },
  {
    id: 'appearance',
    title: 'Appearance',
    icon: Palette,
    description: 'Customize appearance'
  },
  {
    id: 'media',
    title: 'Media Settings',
    icon: Monitor,
    description: 'Camera and audio settings'
  }
];

export default function SettingsPage() {
  const { user } = useContext(AuthContext);
  const [activeSection, setActiveSection] = useState('profile');
  const [settings, setSettings] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState('');
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);

  useEffect(() => {
    async function fetchSettings() {
      try {
        const data = await getUserSettings();
        setSettings({
          profile: {
            fullName: data.profile.fullName || '',
            username: data.profile.username || '',
            email: data.profile.email || '',
            bio: data.profile.bio || '',
            avatarUrl: data.profile.avatarUrl || ''
          },
          notifications: data.notifications || {},
          privacy: data.privacy || {},
          appearance: data.appearance || {},
          media: data.media || {}
        });
        setAvatarPreview(data.profile.avatarUrl || '');
      } catch (err) {
        // Optionally show error
      }
    }
    fetchSettings();
  }, []);

  const updateSetting = (section, key, value) => {
    setSettings(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: value
      }
    }));
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setAvatarPreview(URL.createObjectURL(file));
    setAvatarUploading(true);
    try {
      const { avatarUrl } = await uploadAvatar(file);
      updateSetting('profile', 'avatarUrl', avatarUrl);
      setAvatarPreview(avatarUrl);
    } catch (err) {
      alert('Failed to upload avatar');
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleSave = async () => {
    setSaveStatus(null);
    try {
      const result = await updateSettings(settings);
      if (result.success) {
        // Refetch settings to ensure UI is up to date
        const data = await getUserSettings();
        setSettings({
          profile: {
            fullName: data.profile.fullName || '',
            username: data.profile.username || '',
            email: data.profile.email || '',
            bio: data.profile.bio || '',
            avatarUrl: data.profile.avatarUrl || ''
          },
          notifications: data.notifications || {},
          privacy: data.privacy || {},
          appearance: data.appearance || {},
          media: data.media || {}
        });
        setAvatarPreview(data.profile.avatarUrl || '');
        setSaveStatus('success');
      } else {
        setSaveStatus(result.error || 'error');
      }
    } catch (err) {
      setSaveStatus('error');
    }
  };

  const renderProfileSection = () => {
    if (!settings) return <div className="text-center py-8 text-gray-400">Loading...</div>;
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <div className="h-20 w-20 bg-primary-100 rounded-full flex items-center justify-center overflow-hidden">
            {avatarPreview ? (
              <img src={avatarPreview} alt="Profile" className="h-20 w-20 object-cover" />
            ) : (
              <User className="h-8 w-8 text-primary-600" />
            )}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-secondary-900">Profile Picture</h3>
            <p className="text-sm text-secondary-600">Upload a new profile picture</p>
            <label className="btn-outline text-sm mt-2 cursor-pointer">
              <Camera className="h-4 w-4 mr-2" />
              {avatarUploading ? 'Uploading...' : 'Change Photo'}
              <input type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
            </label>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-2">Full Name</label>
            <input
              type="text"
              value={settings.profile.fullName}
              onChange={(e) => updateSetting('profile', 'fullName', e.target.value)}
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-2">Username</label>
            <input
              type="text"
              value={settings.profile.username}
              onChange={(e) => updateSetting('profile', 'username', e.target.value)}
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-2">Email</label>
            <input
              type="email"
              value={settings.profile.email}
              onChange={(e) => updateSetting('profile', 'email', e.target.value)}
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-2">Bio</label>
            <textarea
              value={settings.profile.bio}
              onChange={(e) => updateSetting('profile', 'bio', e.target.value)}
              className="input-field"
              rows="3"
            />
          </div>
        </div>
      </div>
    );
  };

  const renderNotificationsSection = () => {
    if (!settings) return <div className="text-center py-8 text-gray-400">Loading...</div>;
    return (
      <div className="space-y-6">
        <div className="space-y-4">
          {Object.entries(settings.notifications).map(([key, value]) => (
            <div key={key} className="flex items-center justify-between p-4 bg-secondary-50 rounded-lg">
              <div>
                <h4 className="font-medium text-secondary-900 capitalize">
                  {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                </h4>
                <p className="text-sm text-secondary-600">
                  {key === 'emailNotifications' && 'Receive notifications via email'}
                  {key === 'pushNotifications' && 'Receive push notifications'}
                  {key === 'meetingReminders' && 'Get reminded before meetings'}
                  {key === 'soundAlerts' && 'Play sound for incoming calls'}
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={value}
                  onChange={(e) => updateSetting('notifications', key, e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-secondary-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-secondary-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
              </label>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderPrivacySection = () => {
    if (!settings) return <div className="text-center py-8 text-gray-400">Loading...</div>;
    return (
      <div className="space-y-6">
        <div className="space-y-4">
          {Object.entries(settings.privacy).map(([key, value]) => (
            <div key={key} className="flex items-center justify-between p-4 bg-secondary-50 rounded-lg">
              <div>
                <h4 className="font-medium text-secondary-900 capitalize">
                  {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                </h4>
                <p className="text-sm text-secondary-600">
                  {key === 'showOnlineStatus' && 'Allow others to see when you are online'}
                  {key === 'allowScreenSharing' && 'Allow screen sharing'}
                  {key === 'recordMeetings' && 'Allow meetings to be recorded'}
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={value}
                  onChange={(e) => updateSetting('privacy', key, e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-secondary-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-secondary-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
              </label>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderAppearanceSection = () => (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="p-4 bg-secondary-50 rounded-lg">
          <h4 className="font-medium text-secondary-900 mb-2">Theme</h4>
          <div className="flex space-x-4">
            <button
              onClick={() => updateSetting('appearance', 'theme', 'light')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg border ${
                settings.appearance.theme === 'light' 
                  ? 'border-primary-500 bg-primary-50 text-primary-700' 
                  : 'border-secondary-300 bg-white text-secondary-700'
              }`}
            >
              <Sun className="h-4 w-4" />
              <span>Light</span>
            </button>
            <button
              onClick={() => updateSetting('appearance', 'theme', 'dark')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg border ${
                settings.appearance.theme === 'dark' 
                  ? 'border-primary-500 bg-primary-50 text-primary-700' 
                  : 'border-secondary-300 bg-white text-secondary-700'
              }`}
            >
              <Moon className="h-4 w-4" />
              <span>Dark</span>
            </button>
            <button
              onClick={() => updateSetting('appearance', 'theme', 'auto')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg border ${
                settings.appearance.theme === 'auto' 
                  ? 'border-primary-500 bg-primary-50 text-primary-700' 
                  : 'border-secondary-300 bg-white text-secondary-700'
              }`}
            >
              <Smartphone className="h-4 w-4" />
              <span>Auto</span>
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between p-4 bg-secondary-50 rounded-lg">
          <div>
            <h4 className="font-medium text-secondary-900">Compact Mode</h4>
            <p className="text-sm text-secondary-600">Use a more compact layout</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings.appearance.compactMode}
              onChange={(e) => updateSetting('appearance', 'compactMode', e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-secondary-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-secondary-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
          </label>
        </div>
      </div>
    </div>
  );

  const renderMediaSection = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-secondary-700 mb-2">Default Camera</label>
          <select
            value={settings.media.defaultCamera}
            onChange={(e) => updateSetting('media', 'defaultCamera', e.target.value)}
            className="input-field"
          >
            <option value="default">Default Camera</option>
            <option value="front">Front Camera</option>
            <option value="back">Back Camera</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-secondary-700 mb-2">Video Quality</label>
          <select
            value={settings.media.videoQuality}
            onChange={(e) => updateSetting('media', 'videoQuality', e.target.value)}
            className="input-field"
          >
            <option value="360p">360p</option>
            <option value="480p">480p</option>
            <option value="720p">720p</option>
            <option value="1080p">1080p</option>
          </select>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between p-4 bg-secondary-50 rounded-lg">
          <div className="flex items-center space-x-3">
            <Camera className="h-5 w-5 text-secondary-600" />
            <div>
              <h4 className="font-medium text-secondary-900">Test Camera</h4>
              <p className="text-sm text-secondary-600">Check your camera settings</p>
            </div>
          </div>
          <button className="btn-outline text-sm">Test</button>
        </div>

        <div className="flex items-center justify-between p-4 bg-secondary-50 rounded-lg">
          <div className="flex items-center space-x-3">
            <Mic className="h-5 w-5 text-secondary-600" />
            <div>
              <h4 className="font-medium text-secondary-900">Test Microphone</h4>
              <p className="text-sm text-secondary-600">Check your microphone settings</p>
            </div>
          </div>
          <button className="btn-outline text-sm">Test</button>
        </div>
      </div>
    </div>
  );

  const renderSectionContent = () => {
    switch (activeSection) {
      case 'profile': return renderProfileSection();
      case 'notifications': return renderNotificationsSection();
      case 'privacy': return renderPrivacySection();
      case 'appearance': return renderAppearanceSection();
      case 'media': return renderMediaSection();
      default: return renderProfileSection();
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-secondary-900">Settings</h1>
        <p className="text-secondary-600 mt-1">Manage your account preferences</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1">
          <div className="card">
            <nav className="space-y-2">
              {settingsSections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors ${
                    activeSection === section.id
                      ? 'bg-primary-100 text-primary-700'
                      : 'text-secondary-600 hover:bg-secondary-100'
                  }`}
                >
                  <section.icon className="h-5 w-5" />
                  <div>
                    <p className="font-medium">{section.title}</p>
                    <p className="text-xs opacity-75">{section.description}</p>
                  </div>
                </button>
              ))}
            </nav>
          </div>
        </div>

        <div className="lg:col-span-3">
          <div className="card">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-semibold text-secondary-900">
                  {settingsSections.find(s => s.id === activeSection)?.title}
                </h2>
                <p className="text-secondary-600 mt-1">
                  {settingsSections.find(s => s.id === activeSection)?.description}
                </p>
              </div>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="btn-primary flex items-center space-x-2"
                onClick={handleSave}
              >
                <Save className="h-4 w-4" />
                <span>Save Changes</span>
              </motion.button>
            </div>

            {renderSectionContent()}

            {saveStatus === 'success' && (
              <div className="mt-4 text-green-600 font-medium">Settings saved successfully!</div>
            )}
            {saveStatus && saveStatus !== 'success' && (
              <div className="mt-4 text-red-600 font-medium">{typeof saveStatus === 'string' ? saveStatus : 'Failed to save settings. Please try again.'}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 