import { useSyncExternalStore } from 'react';

/**
 * --- BIOMETRIC LOCK SETTING ---
 * Whether the biometric app-lock is enabled, stored per-device (it guards this
 * device, so localStorage — not the account — is the right home). Opt-in and
 * only surfaced to admins in Settings. A tiny pub-sub so Settings and the lock
 * overlay stay in sync.
 */

const KEY = 'biometric-lock';
type Listener = () => void;
const listeners = new Set<Listener>();

export function isBiometricEnabled(): boolean {
    return localStorage.getItem(KEY) === '1';
}

export function setBiometricEnabled(enabled: boolean): void {
    localStorage.setItem(KEY, enabled ? '1' : '0');
    listeners.forEach((l) => l());
}

function subscribe(fn: Listener): () => void {
    listeners.add(fn);
    return () => {
        listeners.delete(fn);
    };
}

/** Reactive read of the setting. */
export function useBiometricEnabled(): boolean {
    return useSyncExternalStore(subscribe, isBiometricEnabled, () => false);
}
