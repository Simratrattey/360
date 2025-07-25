import React from 'react';

export default function SettingsPanel({ open, onClose, settings, setSettings }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
      <div className="bg-white rounded-lg shadow-lg p-8 w-96">
        <h2 className="text-lg font-bold mb-4">Chat Settings</h2>
        <div className="space-y-4">
          <label className="flex items-center justify-between">
            <span>In-app notifications</span>
            <input type="checkbox" checked={settings.notifications} onChange={e => setSettings(s => ({ ...s, notifications: e.target.checked }))} />
          </label>
          <label className="flex items-center justify-between">
            <span>Sound on new message</span>
            <input type="checkbox" checked={settings.sound} onChange={e => setSettings(s => ({ ...s, sound: e.target.checked }))} />
          </label>
          <label className="flex items-center justify-between">
            <span>Dark mode</span>
            <input type="checkbox" checked={settings.dark} onChange={e => setSettings(s => ({ ...s, dark: e.target.checked }))} />
          </label>
        </div>
        <div className="flex justify-end mt-6">
          <button onClick={onClose} className="px-4 py-2 rounded bg-primary-500 text-white">Close</button>
        </div>
      </div>
    </div>
  );
} 