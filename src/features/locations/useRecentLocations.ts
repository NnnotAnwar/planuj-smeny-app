import { useCallback, useState } from 'react';
import { useAuthContext } from '@features/auth/AuthContext';

/**
 * --- useRecentLocations ---
 * Tracks the locations the current user has most recently picked, so the
 * location picker can surface frequent posts first as the total count grows.
 * Per-user, persisted in localStorage (most-recent first, capped).
 */

const MAX_RECENT = 5;
const storageKey = (userId: string) => `recent-locations:${userId}`;

function read(userId: string): string[] {
    try {
        const raw = localStorage.getItem(storageKey(userId));
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
    } catch {
        return [];
    }
}

export function useRecentLocations() {
    const { user } = useAuthContext();
    const userId = user?.id;
    const [recentIds, setRecentIds] = useState<string[]>(() => (userId ? read(userId) : []));

    const recordPick = useCallback(
        (locationId: string) => {
            if (!userId) return;
            setRecentIds((prev) => {
                const next = [locationId, ...prev.filter((id) => id !== locationId)].slice(0, MAX_RECENT);
                try {
                    localStorage.setItem(storageKey(userId), JSON.stringify(next));
                } catch {
                    /* ignore quota / private-mode errors */
                }
                return next;
            });
        },
        [userId],
    );

    return { recentIds, recordPick };
}
