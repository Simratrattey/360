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
  const [cameraDevices, setCameraDevices] = useState([]);
  const [microphoneDevices, setMicrophoneDevices] = useState([]);
  const [testingCamera, setTestingCamera] = useState(false);
  const [testingMic, setTestingMic] = useState(false);
  const [testStream, setTestStream] = useState(null);
  const videoRef = React.useRef();
  const audioRef = React.useRef();

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

  // Enumerate devices on mount (no camera/mic access by default)
  useEffect(() => {
    async function getDevices() {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        setCameraDevices(devices.filter(d => d.kind === 'videoinput'));
        setMicrophoneDevices(devices.filter(d => d.kind === 'audioinput'));
      } catch (err) {
        setCameraDevices([]);
        setMicrophoneDevices([]);
      }
    }
    getDevices();
  }, []);

  // Clean up test stream
  useEffect(() => {
    return () => {
      if (testStream) {
        testStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [testStream]);

  // Theme switching effect
  useEffect(() => {
    if (!settings || !settings.appearance) return;
    const theme = settings.appearance.theme;
    const html = document.documentElement;
    if (theme === 'dark') {
      html.classList.add('dark');
    } else if (theme === 'light') {
      html.classList.remove('dark');
    } else if (theme === 'auto') {
      // Follow system preference
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      if (mq.matches) {
        html.classList.add('dark');
      } else {
        html.classList.remove('dark');
      }
      // Listen for system changes
      const handler = (e) => {
        if (settings.appearance.theme === 'auto') {
          if (e.matches) html.classList.add('dark');
          else html.classList.remove('dark');
        }
      };
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }
  }, [settings?.appearance?.theme]);

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

  const handleRemoveAvatar = async () => {
    setAvatarUploading(true);
    try {
      // Remove avatar in backend (set avatarUrl to empty string)
      await updateSettings({
        ...settings,
        profile: {
          ...settings.profile,
          avatarUrl: ''
        }
      });
      updateSetting('profile', 'avatarUrl', '');
      setAvatarPreview('');
    } catch (err) {
      alert('Failed to remove avatar');
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

  const handleTestCamera = async () => {
    setTestingCamera(true);
    setTestingMic(false);
    if (testStream) testStream.getTracks().forEach(track => track.stop());
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: settings.media.defaultCamera !== 'default' ? { exact: settings.media.defaultCamera } : undefined },
        audio: false
      });
      setTestStream(stream);
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) {
      alert('Could not access camera');
    }
  };

  const handleTestMic = async () => {
    setTestingMic(true);
    setTestingCamera(false);
    if (testStream) testStream.getTracks().forEach(track => track.stop());
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: settings.media.defaultMicrophone !== 'default' ? { exact: settings.media.defaultMicrophone } : undefined },
        video: false
      });
      setTestStream(stream);
      if (audioRef.current) audioRef.current.srcObject = stream;
    } catch (err) {
      alert('Could not access microphone');
    }
  };

  const handleStopTest = () => {
    setTestingCamera(false);
    setTestingMic(false);
    if (testStream) testStream.getTracks().forEach(track => track.stop());
    setTestStream(null);
  };

  const renderProfileSection = () => {
    if (!settings) return <div className="text-center py-8 text-gray-400">Loading...</div>;
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <div className="h-20 w-20 bg-primary-100 rounded-full flex items-center justify-center overflow-hidden relative">
            {avatarPreview ? (
              <>
                <img src={avatarPreview} alt="Profile" className="h-20 w-20 object-cover" />
                <button
                  className="absolute top-1 right-1 bg-white bg-opacity-80 rounded-full p-1 shadow hover:bg-red-100 transition"
                  onClick={handleRemoveAvatar}
                  disabled={avatarUploading}
                  title="Remove avatar"
                  style={{ zIndex: 2 }}
                >
                  <span className="sr-only">Remove</span>
                  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </>
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
              readOnly
              className="input-field bg-gray-100 cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-2">Email</label>
            <input
              type="email"
              value={settings.profile.email}
              readOnly
              className="input-field bg-gray-100 cursor-not-allowed"
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

  const renderAppearanceSection = () => {
    if (!settings) return <div className="text-center py-8 text-gray-400">Loading...</div>;
    return (
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
                checked={!!settings.appearance.compactMode}
                onChange={e => updateSetting('appearance', 'compactMode', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-secondary-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-secondary-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
            </label>
          </div>
          <div className="flex items-center justify-between p-4 bg-secondary-50 rounded-lg">
            <div>
              <h4 className="font-medium text-secondary-900">Show Animations</h4>
              <p className="text-sm text-secondary-600">Enable or disable UI animations</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={!!settings.appearance.showAnimations}
                onChange={e => updateSetting('appearance', 'showAnimations', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-secondary-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-secondary-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
            </label>
          </div>
        </div>
      </div>
    );
  };

  const renderMediaSection = () => {
    if (!settings) return <div className="text-center py-8 text-gray-400">Loading...</div>;
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-2">Default Camera</label>
            <select
              value={settings.media.defaultCamera}
              onChange={e => updateSetting('media', 'defaultCamera', e.target.value)}
              className="input-field"
            >
              <option value="default">System Default</option>
              {cameraDevices.map(device => (
                <option key={device.deviceId} value={device.deviceId}>{device.label || `Camera ${device.deviceId}`}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-2">Default Microphone</label>
            <select
              value={settings.media.defaultMicrophone}
              onChange={e => updateSetting('media', 'defaultMicrophone', e.target.value)}
              className="input-field"
            >
              <option value="default">System Default</option>
              {microphoneDevices.map(device => (
                <option key={device.deviceId} value={device.deviceId}>{device.label || `Microphone ${device.deviceId}`}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-2">Video Quality</label>
            <select
              value={settings.media.videoQuality}
              onChange={e => updateSetting('media', 'videoQuality', e.target.value)}
              className="input-field"
            >
              <option value="360p">360p</option>
              <option value="480p">480p</option>
              <option value="720p">720p</option>
              <option value="1080p">1080p</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-2">Audio Quality</label>
            <select
              value={settings.media.audioQuality}
              onChange={e => updateSetting('media', 'audioQuality', e.target.value)}
              className="input-field"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
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
            <button className="btn-outline text-sm" onClick={handleTestCamera} disabled={testingCamera}>Test</button>
          </div>
          {testingCamera && (
            <div className="p-4 bg-secondary-100 rounded-lg flex flex-col items-center">
              <video ref={videoRef} autoPlay playsInline style={{ width: 240, height: 180, background: '#222', borderRadius: 8 }} />
              <button className="btn-outline mt-2" onClick={handleStopTest}>Stop</button>
            </div>
          )}

          <div className="flex items-center justify-between p-4 bg-secondary-50 rounded-lg">
            <div className="flex items-center space-x-3">
              <Mic className="h-5 w-5 text-secondary-600" />
              <div>
                <h4 className="font-medium text-secondary-900">Test Microphone</h4>
                <p className="text-sm text-secondary-600">Check your microphone settings</p>
              </div>
            </div>
            <button className="btn-outline text-sm" onClick={handleTestMic} disabled={testingMic}>Test</button>
          </div>
          {testingMic && (
            <div className="p-4 bg-secondary-100 rounded-lg flex flex-col items-center">
              <audio ref={audioRef} autoPlay controls style={{ width: 240, background: '#222', borderRadius: 8 }} />
              <button className="btn-outline mt-2" onClick={handleStopTest}>Stop</button>
            </div>
          )}
        </div>
      </div>
    );
  };

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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50 py-10 px-2 md:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row gap-8">
          {/* Sidebar Navigation */}
          <aside className="md:w-64 w-full flex-shrink-0">
            <div className="sticky top-10">
              <nav className="space-y-2 bg-white/80 rounded-2xl shadow-lg p-4 border border-gray-100">
                {settingsSections.map((section) => (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-left transition-all duration-200 font-medium text-lg group focus:outline-none focus:ring-2 focus:ring-primary-400 focus:bg-primary-50/80
                      ${activeSection === section.id
                        ? 'bg-gradient-to-r from-blue-100 to-purple-100 text-primary-700 shadow-md'
                        : 'text-secondary-700 hover:bg-secondary-50 hover:shadow'}
                    `}
                  >
                    <section.icon className={`h-6 w-6 flex-shrink-0 ${activeSection === section.id ? 'text-primary-600' : 'text-secondary-400 group-hover:text-primary-500'}`} />
                    <span>{section.title}</span>
                  </button>
                ))}
              </nav>
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1">
            <motion.div
              key={activeSection}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="bg-white/90 rounded-2xl shadow-2xl border border-gray-100 p-8 mb-8"
            >
              <div className="flex items-center mb-8 gap-4">
                {settingsSections.find(s => s.id === activeSection)?.icon && (
                  <span className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-gradient-to-br from-blue-100 to-purple-100 text-primary-600 shadow">
                    {React.createElement(settingsSections.find(s => s.id === activeSection).icon, { className: 'h-7 w-7' })}
                  </span>
                )}
                <div>
                  <h2 className="text-2xl font-bold text-secondary-900 mb-1">
                    {settingsSections.find(s => s.id === activeSection)?.title}
                  </h2>
                  <p className="text-secondary-600 text-base">
                    {settingsSections.find(s => s.id === activeSection)?.description}
                  </p>
                </div>
              </div>

              <div className="transition-all duration-300">
                {renderSectionContent()}
              </div>

              <div className="flex justify-end mt-8 gap-4">
                <motion.button
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.98 }}
                  className="btn-primary flex items-center space-x-2 px-6 py-3 rounded-xl text-lg shadow-md focus:outline-none focus:ring-2 focus:ring-primary-400"
                  onClick={handleSave}
                  disabled={saveStatus === 'saving'}
                >
                  <Save className="h-5 w-5" />
                  <span>Save Changes</span>
                </motion.button>
                {/* Optionally add a Cancel/Reset button here */}
              </div>

              {saveStatus === 'success' && (
                <div className="mt-4 text-green-600 font-medium">Settings saved successfully!</div>
              )}
              {saveStatus && saveStatus !== 'success' && (
                <div className="mt-4 text-red-600 font-medium">{typeof saveStatus === 'string' ? saveStatus : 'Failed to save settings. Please try again.'}</div>
              )}
            </motion.div>
          </main>
        </div>
      </div>
    </div>
  );
} 