import { PaletteIcon, CheckIcon } from '@phosphor-icons/react';
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

          {/* Color scheme — live mini-previews of each accent + background. */}
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-body-strong text-gray-900 dark:text-white">Color scheme</p>
              <span className="text-micro text-gray-400">{activeLabel}</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {COMBO_LIST.map(({ key, label, accent, gradient }) => {
                const isActive = comboKey === key;
                const [from, via, to] = isDark ? gradient.dark : gradient.light;
                return (
                  <button
                    key={key}
                    onClick={() => setComboKey(key)}
                    title={label}
                    aria-pressed={isActive}
                    className={`group rounded-2xl p-1 transition-all focus:outline-none ${
                      isActive
                        ? 'ring-2 ring-emerald-500 ring-offset-2 ring-offset-white dark:ring-offset-gray-900'
                        : 'hover:scale-[1.02]'
                    }`}
                  >
                    {/* Preview tile: the scheme's real gradient + a faux card and accent button. */}
                    <div
                      className="relative h-20 rounded-xl overflow-hidden border border-black/5 dark:border-white/10"
                      style={{ backgroundImage: `linear-gradient(135deg, ${from}, ${via}, ${to})` }}
                    >
                      <div className="absolute inset-2 rounded-lg bg-white/75 dark:bg-white/10 backdrop-blur-sm p-2 flex flex-col gap-1.5">
                        <span className="h-1.5 w-7 rounded-full" style={{ backgroundColor: accent }} />
                        <span className="h-1 w-11 rounded-full bg-gray-400/40" />
                        <span className="mt-auto h-3 w-9 rounded-md" style={{ backgroundColor: accent }} />
                      </div>
                      {isActive && (
                        <span
                          className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-white shadow-md"
                          style={{ backgroundColor: accent }}
                        >
                          <CheckIcon weight="bold" className="w-3 h-3" />
                        </span>
                      )}
                    </div>
                    <span className={`block mt-1.5 text-center text-micro ${isActive ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-gray-400 group-hover:text-gray-500'}`}>
                      {label}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="mt-3 text-caption text-gray-400">Sets the accent color and background across the app.</p>
          </div>
        </div>
      </div>

      <div className="pt-2 text-center">
        <p className="text-micro text-gray-300 dark:text-gray-600">Version 1.0.5 • 2026</p>
      </div>
    </div>
  );
}
