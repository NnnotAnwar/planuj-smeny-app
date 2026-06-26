import { PaletteIcon } from '@phosphor-icons/react';
import { useTheme } from '@app/providers/ThemeContext';

/**
 * --- SETTINGS PAGE ---
 * Minimal preferences screen. Only theme toggle remains (profile editing
 * moved to the Profile page / modals).
 */

const cardClass =
  'bg-white dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800 rounded-3xl shadow-sm';

export default function SettingsPage() {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

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
    </div>
  );
}
