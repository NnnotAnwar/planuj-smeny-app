import { useCallback, useEffect, useRef, useState } from 'react';
import { App } from '@capacitor/app';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { BiometricAuth } from '@aparajita/capacitor-biometric-auth';
import { LockKeyIcon, FingerprintIcon } from '@phosphor-icons/react';
import { useTranslation } from '@shared/preferences/PreferencesContext';
import { Button } from '@shared/components/Button';

/**
 * --- BIOMETRIC LOCK ---
 * Forces Face ID / fingerprint (or the device passcode as fallback) before an
 * admin account can use the app — protecting employee data at rest. Native-only;
 * on the web (where there is no device biometry) it's a no-op. Re-locks whenever
 * the app returns from the background.
 *
 * If the device can't authenticate at all (no biometry enrolled and no passcode)
 * we can't enforce the lock, so we let the user through rather than brick them.
 */
export function BiometricLock({ enforce }: { enforce: boolean }) {
    const t = useTranslation();
    const active = enforce && Capacitor.isNativePlatform();
    const [locked, setLocked] = useState(active);
    const [checking, setChecking] = useState(false);
    const prompting = useRef(false);

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
        // Deferred so the first prompt's state updates don't run synchronously
        // inside the effect body.
        const timer = setTimeout(() => void prompt(), 0);

        let handle: PluginListenerHandle | null = null;
        App.addListener('appStateChange', ({ isActive }) => {
            // Coming back to the foreground re-locks and re-prompts.
            if (isActive) {
                setLocked(true);
                void prompt();
            }
        }).then((h) => {
            handle = h;
        });
        return () => {
            clearTimeout(timer);
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
        </div>
    );
}
