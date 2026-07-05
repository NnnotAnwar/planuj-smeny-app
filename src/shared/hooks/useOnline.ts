import { useEffect, useState } from 'react';
import { Network } from '@capacitor/network';
import type { PluginListenerHandle } from '@capacitor/core';

/**
 * --- useOnline ---
 * Live network-connectivity flag via @capacitor/network (which uses the OS on
 * native and `navigator.onLine` on the web). Used to warn the user and guard
 * actions that need the server (e.g. clocking in) while offline.
 */
export function useOnline(): boolean {
    const [online, setOnline] = useState(true);

    useEffect(() => {
        let handle: PluginListenerHandle | null = null;
        let cancelled = false;

        Network.getStatus()
            .then((s) => !cancelled && setOnline(s.connected))
            .catch(() => {});
        Network.addListener('networkStatusChange', (s) => setOnline(s.connected)).then((h) => {
            if (cancelled) h.remove();
            else handle = h;
        });

        return () => {
            cancelled = true;
            handle?.remove();
        };
    }, []);

    return online;
}
