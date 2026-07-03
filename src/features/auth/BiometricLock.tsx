import { useCallback, useEffect, useRef, useState } from 'react';
import { App } from '@capacitor/app';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { BiometricAuth } from '@aparajita/capacitor-biometric-auth';
import { LockKeyIcon, FingerprintIcon } from '@phosphor-icons/react';
import { useTranslation } from '@shared/preferences/PreferencesContext';
import { useAuthContext } from '@features/auth/AuthContext';
import { Button } from '@shared/components/Button';

/**
 * --- BIOMETRIC LOCK ---
 * Opt-in Face ID / fingerprint (device passcode fallback) before using the app —
 * protecting employee data at rest. Enabled per-device by admins in Settings
 * (`enforce`). Native-only; on the web it's a no-op.
 *
 * Locks on cold start (if enabled) and re-locks after a real background of
 * >=60s. Enabling it mid-session does NOT lock the current session — it applies
 * from the next launch/resume. If the device can't authenticate at all, we let
 * the user through rather than brick them.
 */
export function BiometricLock({ enforce }: { enforce: boolean }) {
    const t = useTranslation();
    const { logout } = useAuthContext();
    const active = enforce && Capacitor.isNativePlatform();
    const [locked, setLocked] = useState(active);
    const [checking, setChecking] = useState(false);
    const prompting = useRef(false);
    // When the app genuinely went to the background (not the auth dialog's own
    // blip). Used to re-lock only after a real absence.
    const bgAt = useRef<number | null>(null);
    // Latest `locked` (read inside effects without re-subscribing) + a one-time
    // guard so the cold-start prompt fires once.
    const lockedRef = useRef(locked);
    useEffect(() => {
        lockedRef.current = locked;
    }, [locked]);
    const coldStarted = useRef(false);
    const RELOCK_AFTER_MS = 60_000;

    const prompt = useCallback(async () => {
        if (prompting.current) return;
        prompting.current = true;
        setChecking(true);
        try {
            const info = await BiometricAuth.checkBiometry();
            if (!info.isAvailable && !info.deviceIsSecure) {
                setLocked(false); // nothing to authenticate against — don't lock out
                return;
            }
            await BiometricAuth.authenticate({
                reason: t('lock.reason'),
                allowDeviceCredential: true,
                androidTitle: t('lock.title'),
                androidSubtitle: t('lock.reason'),
                iosFallbackTitle: t('lock.usePasscode'),
            });
            setLocked(false);
        } catch {
            setLocked(true); // stay locked; the user can retry
        } finally {
            prompting.current = false;
            setChecking(false);
        }
    }, [t]);

    useEffect(() => {
        if (!active) return;
        // Prompt on cold start only (mounted already locked). Enabling the toggle
        // mid-session leaves `locked` false, so we don't prompt now — it kicks in
        // on the next launch/resume. Deferred to keep state updates out of the
        // effect body.
        let timer: ReturnType<typeof setTimeout> | undefined;
        if (lockedRef.current && !coldStarted.current) {
            coldStarted.current = true;
            timer = setTimeout(() => void prompt(), 0);
        }

        let handle: PluginListenerHandle | null = null;
        App.addListener('appStateChange', ({ isActive }) => {
            if (!isActive) {
                // Record only a REAL background — while the auth dialog is up the
                // OS also fires this, and counting it would create a lock loop.
                if (!prompting.current) bgAt.current = Date.now();
                return;
            }
            // Foreground. Ignore the auth dialog's own return, and only re-lock
            // after a genuine, long-enough absence.
            if (prompting.current) return;
            const away = bgAt.current ? Date.now() - bgAt.current : 0;
            bgAt.current = null;
            if (away >= RELOCK_AFTER_MS) {
                setLocked(true);
                void prompt();
            }
        }).then((h) => {
            handle = h;
        });
        return () => {
            if (timer) clearTimeout(timer);
            handle?.remove();
        };
    }, [active, prompt]);

    if (!locked) return null;

    return (
        <div className="fixed inset-0 z-400 flex flex-col items-center justify-center gap-6 bg-white dark:bg-gray-950 p-8 text-center pt-[env(safe-area-inset-top,0px)]">
            <div className="w-20 h-20 rounded-3xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <LockKeyIcon weight="fill" className="w-10 h-10" />
            </div>
            <div>
                <h1 className="text-title text-gray-900 dark:text-white">{t('lock.title')}</h1>
                <p className="mt-1 text-body text-gray-500 dark:text-gray-400 max-w-xs">{t('lock.subtitle')}</p>
            </div>
            <Button size="lg" icon={FingerprintIcon} loading={checking} onClick={() => void prompt()}>
                {t('lock.unlock')}
            </Button>
            {/* Escape hatch: never let a failing biometric permanently trap the user. */}
            <Button variant="ghost" onClick={logout}>
                {t('nav.logout')}
            </Button>
        </div>
    );
}
