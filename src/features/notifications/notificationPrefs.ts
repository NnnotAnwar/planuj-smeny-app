import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@shared/api/supabaseClient';
import { useAuthContext } from '@features/auth/AuthContext';

/**
 * Per-user push notification preferences (gates push delivery; the in-app feed
 * always shows everything). A missing row means "all on".
 */
export interface NotificationPrefs {
    push_enabled: boolean;
    shifts: boolean;
    account: boolean;
    requests: boolean;
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
    push_enabled: true,
    shifts: true,
    account: true,
    requests: true,
};

async function fetchPrefs(userId: string): Promise<NotificationPrefs> {
    const { data } = await supabase
        .from('notification_preferences')
        .select('push_enabled, shifts, account, requests')
        .eq('user_id', userId)
        .maybeSingle();
    return { ...DEFAULT_NOTIFICATION_PREFS, ...(data ?? {}) };
}

/** Load + optimistically update the current user's notification preferences. */
export function useNotificationPrefs() {
    const { user } = useAuthContext();
    const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_NOTIFICATION_PREFS);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        if (!user) return;
        let active = true;
        fetchPrefs(user.id).then((p) => {
            if (active) {
                setPrefs(p);
                setLoaded(true);
            }
        });
        return () => {
            active = false;
        };
    }, [user]);

    const update = useCallback(
        (patch: Partial<NotificationPrefs>) => {
            if (!user) return;
            setPrefs((prev) => {
                const next = { ...prev, ...patch };
                void supabase
                    .from('notification_preferences')
                    .upsert({ user_id: user.id, ...next, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
                return next;
            });
        },
        [user],
    );

    return { prefs, loaded, update };
}
