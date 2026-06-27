import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

/**
 * --- HAPTICS ---
 * Thin, safe wrapper around Capacitor Haptics: no-ops on the web, swallows
 * errors, and gives the app a few intent-named taps so feedback stays
 * consistent across the UI.
 *
 *   light    — small confirmations (selecting a location, a toggle)
 *   medium   — a meaningful gesture engaging (pull-to-refresh fires)
 *   heavy    — the big shift start / end action
 *   success  — an action persisted successfully (e.g. profile saved)
 *   error    — an action failed
 */

const native = () => Capacitor.isNativePlatform();

export const haptics = {
    light: () => {
        if (native()) Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
    },
    medium: () => {
        if (native()) Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {});
    },
    heavy: () => {
        if (native()) Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => {});
    },
    success: () => {
        if (native()) Haptics.notification({ type: NotificationType.Success }).catch(() => {});
    },
    error: () => {
        if (native()) Haptics.notification({ type: NotificationType.Error }).catch(() => {});
    },
};
