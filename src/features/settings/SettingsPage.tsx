import { PaletteIcon } from '@phosphor-icons/react';
import { useTheme, COMBO_LIST } from '@app/providers/ThemeContext';

/**
 * --- SETTINGS PAGE ---
 * Appearance only: dark mode + colour-scheme picker. Each scheme overrides the
 * accent palette and the background gradient (see ThemeContext for the source
 * of truth — including the swatch colours rendered below).
 */

const cardClass =
  'bg-white dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800 rounded-3xl shadow-sm';

export default function SettingsPage() {
  const { resolvedTheme, setTheme, comboKey, setComboKey } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const activeLabel = COMBO_LIST.find((o) => o.key === comboKey)?.label;

  return (
    <div className="space-y-4 px-1 pb-10">
      <header className="pt-2 space-y-0.5">
        <p className="text-label text-emerald-500 text-left">Preferences</p>
        <h1 className="text-display text-gray-900 dark:text-white">Settings</h1>
      </header>

      {/* APPEARANCE — only section. Dark mode + accent color picker */}
      <div className="space-y-2">
        <h3 className="px-1 text-label text-gray-400">Appearance</h3>
        <div className={`${cardClass} overflow-hidden`}>
          {/* Dark mode toggle */}
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

          <div className="border-t border-gray-100 dark:border-gray-800" />

          {/* Color combinations: accent + main bg + light bg (4 variants) */}
          <div className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-body-strong text-gray-900 dark:text-white">Color combo</p>
              <span className="text-micro text-gray-400">{activeLabel}</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {COMBO_LIST.map(({ key, label, swatch }) => {
                const isActive = comboKey === key;
                return (
                  <button
                    key={key}
                    onClick={() => setComboKey(key)}
                    className="group flex flex-col items-center gap-1 focus:outline-none"
                    title={label}
                    aria-pressed={isActive}
                  >
                    <div
                      className={`w-full h-8 rounded-2xl overflow-hidden flex border border-black/5 dark:border-white/10 shadow-sm transition-all ${isActive ? 'ring-2 ring-offset-2 ring-offset-white dark:ring-offset-gray-800 ring-emerald-500' : 'group-hover:scale-[1.02]'}`}
                    >
                      <div className="flex-1" style={{ backgroundColor: swatch.accent }} />
                      <div className="flex-1" style={{ backgroundColor: swatch.main }} />
                      <div className="flex-1" style={{ backgroundColor: swatch.light }} />
                    </div>
                    <span className={`text-micro text-center ${isActive ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-gray-400 group-hover:text-gray-500'}`}>
                      {label}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-caption text-gray-400">Changes accent + bg gradient for the app.</p>
          </div>
        </div>
      </div>

      <div className="pt-2 text-center">
        <p className="text-micro text-gray-300 dark:text-gray-600">Version 1.0.5 • 2026</p>
      </div>
    </div>
  );
}
