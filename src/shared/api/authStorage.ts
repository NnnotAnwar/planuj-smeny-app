import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

/**
 * --- AUTH SESSION STORAGE ADAPTER ---
 * Where supabase-js persists the session (JWT + refresh token).
 *
 * On native (Capacitor) we use Preferences (iOS UserDefaults / Android
 * SharedPreferences) instead of localStorage. localStorage in a WebView lives in
 * the page's DOM, so any XSS could read the tokens; Preferences is native storage
 * outside the DOM, which removes that exfiltration path.
 *
 * On the web we keep localStorage (same as the supabase-js default) — no
 * behaviour change for the browser build.
 *
 * supabase-js supports an async storage interface, so the Promise-based
 * Preferences API drops in directly.
 */

const isNative = Capacitor.isNativePlatform();

export const authStorage = {
    async getItem(key: string): Promise<string | null> {
        if (isNative) {
            const { value } = await Preferences.get({ key });
            return value ?? null;
        }
        return window.localStorage.getItem(key);
    },
    async setItem(key: string, value: string): Promise<void> {
        if (isNative) {
            await Preferences.set({ key, value });
            return;
        }
        window.localStorage.setItem(key, value);
    },
    async removeItem(key: string): Promise<void> {
        if (isNative) {
            await Preferences.remove({ key });
            return;
        }
        window.localStorage.removeItem(key);
    },
};
