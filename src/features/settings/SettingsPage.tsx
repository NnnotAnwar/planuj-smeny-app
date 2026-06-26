import {
  CheckIcon,
  InfoIcon,
  LifebuoyIcon,
  ShieldCheckIcon,
  FileTextIcon,
  ArrowSquareOutIcon,
} from '@phosphor-icons/react';
import { useTheme, COMBO_LIST } from '@app/providers/ThemeContext';
import { usePreferences } from '@shared/preferences/PreferencesContext';
import { useShiftContext } from '@features/shifts/ShiftContext';
import { LANGUAGES } from '@shared/i18n/translations';
import { useEffect, useState } from 'react';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

const APP_NAME = 'Planuj Směny';
const SUPPORT_EMAIL = 'anuarkairulla@gmail.com';

/**
 * --- SETTINGS PAGE ---
 * Device preferences: appearance (theme + colour scheme), language, time format
 * and the default clock-in location. Profile editing lives on the Profile page.
 */

const cardClass =
  'bg-white dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800 rounded-3xl shadow-sm';

const fieldClass =
  'w-full bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 focus:border-emerald-500 rounded-xl px-3 py-2.5 text-body outline-none text-gray-900 dark:text-white transition-colors';

/** iOS-style segmented control for small, mutually exclusive choices. */
function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="flex gap-1 rounded-xl bg-gray-100 dark:bg-gray-800 p-1">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            aria-pressed={active}
            className={`flex-1 px-3 py-1.5 rounded-lg text-small-strong transition-colors ${active
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Setting({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="p-4 space-y-2">
      <p className="text-body-strong text-gray-900 dark:text-white">{label}</p>
      {children}
      {hint && <p className="text-caption text-gray-400">{hint}</p>}
    </div>
  );
}

/** Dynamic app version from Capacitor (native) or fallback. */
function useAppVersion() {
  const [version, setVersion] = useState('1.7.0');

  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      App.getInfo()
        .then((info) => setVersion(info.version || '1.7.0'))
        .catch(() => {});
    }
  }, []);

  return version;
}

/** A tappable row that opens an external link (or mailto) in the system browser. */
function LinkRow({ icon, label, href }: { icon: React.ReactNode; label: string; href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 p-4 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
    >
      <div className="w-9 h-9 rounded-xl bg-gray-50 dark:bg-gray-900/50 flex items-center justify-center text-gray-500 dark:text-gray-400 shrink-0">
        {icon}
      </div>
      <span className="flex-1 text-body-strong text-gray-900 dark:text-white">{label}</span>
      <ArrowSquareOutIcon weight="bold" className="w-4 h-4 text-gray-300 dark:text-gray-600 shrink-0" />
    </a>
  );
}

/** A plain, non-interactive info row (used for legal items that aren't linked yet). */
function StaticRow({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-3 p-4">
      <div className="w-9 h-9 rounded-xl bg-gray-50 dark:bg-gray-900/50 flex items-center justify-center text-gray-500 dark:text-gray-400 shrink-0">
        {icon}
      </div>
      <span className="flex-1 text-body-strong text-gray-900 dark:text-white">{label}</span>
    </div>
  );
}

export default function SettingsPage() {
  const { theme, setTheme, resolvedTheme, comboKey, setComboKey } = useTheme();
  const { language, setLanguage, timeFormat, setTimeFormat, defaultLocationId, setDefaultLocationId, t } =
    usePreferences();
  const { locations } = useShiftContext();
  const isDark = resolvedTheme === 'dark';
  const appVersion = useAppVersion();

  const activeLabel = COMBO_LIST.find((o) => o.key === comboKey)?.label;
  const pickableLocations = locations.filter((l) => !l.archived_at);

  return (
    <div className="space-y-4 px-1 pb-10">
      <header className="pt-2 space-y-0.5">
        <p className="text-label text-emerald-500 text-left">{t('settings.preferences')}</p>
        <h1 className="text-display text-gray-900 dark:text-white">{t('settings.title')}</h1>
      </header>

      {/* APPEARANCE — theme + colour scheme */}
      <div className="space-y-2">
        <h3 className="px-1 text-label text-gray-400">{t('settings.appearance')}</h3>
        <div className={`${cardClass} overflow-hidden divide-y divide-gray-100 dark:divide-gray-800`}>
          <Setting label={t('settings.theme')}>
            <Segmented
              value={theme}
              onChange={setTheme}
              options={[
                { value: 'system', label: t('settings.theme.system') },
                { value: 'light', label: t('settings.theme.light') },
                { value: 'dark', label: t('settings.theme.dark') },
              ]}
            />
          </Setting>

          {/* Color scheme — live mini-previews of each accent + background. */}
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-body-strong text-gray-900 dark:text-white">{t('settings.colorScheme')}</p>
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
                    className={`group rounded-2xl p-1 transition-all focus:outline-none ${isActive
                        ? 'ring-2 ring-emerald-500 ring-offset-2 ring-offset-white dark:ring-offset-gray-900'
                        : 'hover:scale-[1.02]'
                      }`}
                  >
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
            <p className="mt-3 text-caption text-gray-400">{t('settings.colorScheme.hint')}</p>
          </div>
        </div>
      </div>

      {/* GENERAL — language, time format, default location */}
      <div className="space-y-2">
        <h3 className="px-1 text-label text-gray-400">{t('settings.preferences')}</h3>
        <div className={`${cardClass} overflow-hidden divide-y divide-gray-100 dark:divide-gray-800`}>
          <Setting label={t('settings.language')}>
            <Segmented
              value={language}
              onChange={setLanguage}
              options={LANGUAGES.map((l) => ({ value: l.code, label: l.label }))}
            />
          </Setting>

          <Setting label={t('settings.timeFormat')} hint={t('settings.timeFormat.hint')}>
            <Segmented
              value={timeFormat}
              onChange={setTimeFormat}
              options={[
                { value: '24h', label: t('settings.timeFormat.24h') },
                { value: '12h', label: t('settings.timeFormat.12h') },
              ]}
            />
          </Setting>

          <Setting label={t('settings.defaultLocation')} hint={t('settings.defaultLocation.hint')}>
            <select
              value={defaultLocationId ?? ''}
              onChange={(e) => setDefaultLocationId(e.target.value || null)}
              className={fieldClass}
            >
              <option value="">{t('settings.defaultLocation.none')}</option>
              {pickableLocations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </Setting>
        </div>
      </div>

      {/* ABOUT — app info, support & legal */}
      <div className="space-y-2">
        <h3 className="px-1 text-label text-gray-400">{t('settings.about')}</h3>
        <div className={`${cardClass} overflow-hidden divide-y divide-gray-100 dark:divide-gray-800`}>
          <div className="flex items-center gap-3 p-4">
            <div className="w-9 h-9 rounded-xl bg-gray-50 dark:bg-gray-900/50 flex items-center justify-center text-gray-500 dark:text-gray-400 shrink-0">
              <InfoIcon weight="bold" className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-body-strong text-gray-900 dark:text-white">{APP_NAME}</p>
              <p className="text-micro text-gray-400">{t('settings.version', { version: appVersion, year: 2026 })}</p>
            </div>
          </div>

          <LinkRow
            icon={<LifebuoyIcon weight="bold" className="w-4 h-4" />}
            label={t('settings.support')}
            href={`mailto:${SUPPORT_EMAIL}`}
          />
          <StaticRow icon={<ShieldCheckIcon weight="bold" className="w-4 h-4" />} label={t('settings.privacy')} />
          <StaticRow icon={<FileTextIcon weight="bold" className="w-4 h-4" />} label={t('settings.terms')} />
        </div>
      </div>
    </div>
  );
}
