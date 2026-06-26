import { useState, useEffect } from 'react';
import { PaletteIcon, BellIcon, ClockIcon, ShieldIcon } from '@phosphor-icons/react';
import { useTheme } from '@app/providers/ThemeContext';

/**
 * --- SETTINGS PAGE ---
 * Minimal preferences screen. Only theme toggle remains (profile editing
 * moved to the Profile page / modals).
 */

const cardClass =
  'bg-white dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800 rounded-3xl shadow-sm';

interface AppSettings {
  notifications: {
    shiftUpdates: boolean;
    nameRequests: boolean;
    adminAlerts: boolean;
  };
  work: {
    defaultLocation: string;
    timeFormat: string;
    autoClockOut: boolean;
  };
  privacy: {
    showStatus: boolean;
    showLocation: boolean;
  };
}

export default function SettingsPage() {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  // Simple local settings persisted in localStorage for now
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const saved = localStorage.getItem('app-settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed as AppSettings;
      }
      return {
        notifications: {
          shiftUpdates: true,
          nameRequests: true,
          adminAlerts: false,
        },
        work: {
          defaultLocation: '',
          timeFormat: '24h',
          autoClockOut: false,
        },
        privacy: {
          showStatus: true,
          showLocation: true,
        },
      };
    } catch {
      return {
        notifications: { shiftUpdates: true, nameRequests: true, adminAlerts: false },
        work: { defaultLocation: '', timeFormat: '24h', autoClockOut: false },
        privacy: { showStatus: true, showLocation: true },
      };
    }
  });

  useEffect(() => {
    localStorage.setItem('app-settings', JSON.stringify(settings));
  }, [settings]);

  const updateSetting = <K extends keyof AppSettings, SK extends keyof AppSettings[K]>(
    category: K,
    key: SK,
    value: AppSettings[K][SK]
  ) => {
    setSettings((prev) => ({
      ...prev,
      [category]: {
        ...prev[category],
        [key]: value,
      },
    }));
  };

  return (
    <div className="space-y-4 px-1 pb-10">
      <header className="pt-2 space-y-0.5">
        <p className="text-label text-emerald-500 text-left">Preferences</p>
        <h1 className="text-display text-gray-900 dark:text-white">Settings</h1>
      </header>

      {/* APPEARANCE */}
      <div className="space-y-2">
        <h3 className="px-1 text-label text-gray-400">Appearance</h3>
        <div className={`${cardClass} overflow-hidden`}>
          <button
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors text-left"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-gray-50 dark:bg-gray-900/50 flex items-center justify-center text-gray-500 dark:text-gray-400 shrink-0">
                <PaletteIcon weight="bold" className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-body-strong text-gray-900 dark:text-white">Dark mode</p>
                <p className="text-micro text-gray-400">{isDark ? 'Enabled' : 'Disabled'}</p>
              </div>
            </div>
            <span className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${isDark ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${isDark ? 'translate-x-5' : ''}`} />
            </span>
          </button>
        </div>
      </div>

      {/* NOTIFICATIONS */}
      <div className="space-y-2">
        <h3 className="px-1 text-label text-gray-400 flex items-center gap-1.5">
          <BellIcon weight="bold" className="w-4 h-4 text-emerald-500" /> Notifications
        </h3>
        <div className={`${cardClass} p-5 space-y-4`}>
          <label className="flex items-center justify-between">
            <span className="text-body">Shift updates</span>
            <input
              type="checkbox"
              checked={settings.notifications.shiftUpdates}
              onChange={(e) => updateSetting('notifications', 'shiftUpdates', e.target.checked)}
              className="accent-emerald-500"
            />
          </label>
          <label className="flex items-center justify-between">
            <span className="text-body">Name change requests</span>
            <input
              type="checkbox"
              checked={settings.notifications.nameRequests}
              onChange={(e) => updateSetting('notifications', 'nameRequests', e.target.checked)}
              className="accent-emerald-500"
            />
          </label>
          <label className="flex items-center justify-between">
            <span className="text-body">Admin alerts (for managers)</span>
            <input
              type="checkbox"
              checked={settings.notifications.adminAlerts}
              onChange={(e) => updateSetting('notifications', 'adminAlerts', e.target.checked)}
              className="accent-emerald-500"
            />
          </label>
          <p className="text-caption text-gray-400">Push and in-app notifications preferences (stored locally for now).</p>
        </div>
      </div>

      {/* WORK PREFERENCES */}
      <div className="space-y-2">
        <h3 className="px-1 text-label text-gray-400 flex items-center gap-1.5">
          <ClockIcon weight="bold" className="w-4 h-4 text-emerald-500" /> Work preferences
        </h3>
        <div className={`${cardClass} p-5 space-y-4`}>
          <div>
            <label className="text-small-strong text-gray-600 dark:text-gray-300 block mb-1.5">Default location</label>
            <input
              type="text"
              value={settings.work.defaultLocation}
              onChange={(e) => updateSetting('work', 'defaultLocation', e.target.value)}
              placeholder="Location name or ID"
              className="w-full bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-body outline-none"
            />
          </div>
          <label className="flex items-center justify-between">
            <span className="text-body">Auto clock-out at midnight</span>
            <input
              type="checkbox"
              checked={settings.work.autoClockOut}
              onChange={(e) => updateSetting('work', 'autoClockOut', e.target.checked)}
              className="accent-emerald-500"
            />
          </label>
          <div>
            <label className="text-small-strong text-gray-600 dark:text-gray-300 block mb-1.5">Time format</label>
            <select
              value={settings.work.timeFormat}
              onChange={(e) => updateSetting('work', 'timeFormat', e.target.value)}
              className="w-full bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-body outline-none"
            >
              <option value="24h">24-hour</option>
              <option value="12h">12-hour (AM/PM)</option>
            </select>
          </div>
        </div>
      </div>

      {/* PRIVACY */}
      <div className="space-y-2">
        <h3 className="px-1 text-label text-gray-400 flex items-center gap-1.5">
          <ShieldIcon weight="bold" className="w-4 h-4 text-emerald-500" /> Privacy
        </h3>
        <div className={`${cardClass} p-5 space-y-4`}>
          <label className="flex items-center justify-between">
            <span className="text-body">Show my status to others</span>
            <input
              type="checkbox"
              checked={settings.privacy.showStatus}
              onChange={(e) => updateSetting('privacy', 'showStatus', e.target.checked)}
              className="accent-emerald-500"
            />
          </label>
          <label className="flex items-center justify-between">
            <span className="text-body">Show my current location</span>
            <input
              type="checkbox"
              checked={settings.privacy.showLocation}
              onChange={(e) => updateSetting('privacy', 'showLocation', e.target.checked)}
              className="accent-emerald-500"
            />
          </label>
          <p className="text-caption text-gray-400">Control visibility of your shift status in the live board and profiles.</p>
        </div>
      </div>

      <div className="pt-2 text-center">
        <p className="text-micro text-gray-300 dark:text-gray-600">Version 1.0.4 • 2026</p>
      </div>
    </div>
  );
}
