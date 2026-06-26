/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useMemo, useReducer, useState } from 'react';
import { useAuthContext } from '@features/auth/AuthContext';
import { translations, type Language, type TranslationKey } from '@shared/i18n/translations';
import { setTimeFormatPreference, setLocalePreference, type TimeFormat } from '@shared/utils/date';

/**
 * --- PREFERENCES CONTEXT ---
 * User preferences that aren't visual theme: UI language, time format and the
 * default clock-in location. Language and time format are device-level; the
 * default location is per-user (keyed by user id). All persisted in localStorage;
 * also exposes `t()` for translations.
 */

interface PreferencesContextType {
    language: Language;
    setLanguage: (lang: Language) => void;
    timeFormat: TimeFormat;
    setTimeFormat: (format: TimeFormat) => void;
    defaultLocationId: string | null;
    setDefaultLocationId: (id: string | null) => void;
    /** Translate a key, with optional `{placeholder}` interpolation. */
    t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
}

const STORAGE = { language: 'language', timeFormat: 'time-format' } as const;
const defaultLocationKey = (userId: string) => `default-location-id:${userId}`;

function readLanguage(): Language {
    const v = localStorage.getItem(STORAGE.language);
    return v === 'en' || v === 'cs' ? v : 'en';
}
function readTimeFormat(): TimeFormat {
    return localStorage.getItem(STORAGE.timeFormat) === '12h' ? '12h' : '24h';
}

const PreferencesContext = createContext<PreferencesContextType | undefined>(undefined);

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
    const { user } = useAuthContext();
    const userId = user?.id ?? null;

    const [language, setLanguageState] = useState<Language>(readLanguage);
    const [timeFormat, setTimeFormatState] = useState<TimeFormat>(readTimeFormat);
    // Default location is per-user: read straight from localStorage (keyed by the
    // current user) on render and force a refresh on write — no effect needed, and
    // it naturally re-keys when the signed-in user changes.
    const [, refreshDefaultLocation] = useReducer((n: number) => n + 1, 0);
    const defaultLocationId = userId ? localStorage.getItem(defaultLocationKey(userId)) : null;

    // Sync the date-util module preferences synchronously during render, so child
    // components (which re-render when language/format changes) read the current
    // values in the same pass — no stale-by-one-frame dates.
    setTimeFormatPreference(timeFormat);
    setLocalePreference(language);

    const setLanguage = useCallback((lang: Language) => {
        localStorage.setItem(STORAGE.language, lang);
        setLanguageState(lang);
    }, []);

    const setTimeFormat = useCallback((format: TimeFormat) => {
        localStorage.setItem(STORAGE.timeFormat, format);
        setTimeFormatState(format);
    }, []);

    const setDefaultLocationId = useCallback(
        (id: string | null) => {
            if (!userId) return;
            const key = defaultLocationKey(userId);
            if (id) localStorage.setItem(key, id);
            else localStorage.removeItem(key);
            refreshDefaultLocation();
        },
        [userId],
    );

    const t = useCallback<PreferencesContextType['t']>(
        (key, vars) => {
            const dict = translations[language] ?? translations.en;
            let str: string = dict[key] ?? translations.en[key] ?? key;
            if (vars) {
                for (const [k, v] of Object.entries(vars)) str = str.replaceAll(`{${k}}`, String(v));
            }
            return str;
        },
        [language],
    );

    const value = useMemo(
        () => ({ language, setLanguage, timeFormat, setTimeFormat, defaultLocationId, setDefaultLocationId, t }),
        [language, setLanguage, timeFormat, setTimeFormat, defaultLocationId, setDefaultLocationId, t],
    );

    return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
    const ctx = useContext(PreferencesContext);
    if (ctx === undefined) throw new Error('usePreferences must be used within a PreferencesProvider');
    return ctx;
}

/** Convenience hook for components that only need translation. */
export function useTranslation() {
    return usePreferences().t;
}
