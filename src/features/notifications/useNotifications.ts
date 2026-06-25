import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@shared/api/supabaseClient';
import { useAuthContext } from '@features/auth/AuthContext';
import { notificationsService } from './notificationsService';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { ShiftAuditLog } from '@shared/types';

const seenKey = (userId: string) => `notifications_seen_at:${userId}`;
const dismissedKey = (userId: string) => `notifications_dismissed:${userId}`;

function loadDismissed(userId: string): Set<string> {
    try {
        const raw = localStorage.getItem(dismissedKey(userId));
        return new Set(raw ? (JSON.parse(raw) as string[]) : []);
    } catch {
        return new Set();
    }
}

// Global map so multiple <NotificationsBell /> instances (desktop + mobile)
// don't create duplicate postgres_changes listeners on the same channel.
const notificationChannels = new Map<string, { channel: RealtimeChannel; count: number }>();

/**
 * --- useNotifications ---
 * The current user's notification feed (their own audit-log entries), with:
 *  - a per-device "last seen" watermark for the unread state (localStorage),
 *  - per-device dismissals (the audit rows themselves are never deleted), and
 *  - a realtime subscription so new entries arrive without a refresh.
 *
 * The seen watermark is committed by the caller (on panel close) so unread items
 * stay highlighted while the panel is open.
 */
export function useNotifications() {
    const { user } = useAuthContext();
    const userId = user?.id;
    const qc = useQueryClient();

    const query = useQuery({
        queryKey: ['notifications', userId],
        queryFn: () => notificationsService.getMyNotifications(userId!),
        enabled: !!userId,
    });

    // Ref for retry timeout to avoid memory leaks
    const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (!userId) return;

        const key = userId;

        const ensureSubscription = () => {
            let entry = notificationChannels.get(key);

            if (entry) {
                const ch = entry.channel;
                // Recreate if channel is in bad state
                if (ch.state !== 'joined' && ch.state !== 'joining') {
                    supabase.removeChannel(ch);
                    notificationChannels.delete(key);
                    entry = undefined;
                }
            }

            if (!entry) {
                const channel = supabase
                    .channel(`notifications_${userId}`)
                    .on(
                        'postgres_changes',
                        { event: 'INSERT', schema: 'public', table: 'shift_audit_log', filter: `target_user_id=eq.${userId}` },
                        () => qc.invalidateQueries({ queryKey: ['notifications', userId] }),
                    );

                channel.subscribe((status, err) => {
                    if (status === 'SUBSCRIBED') {
                        console.debug(`[notifications] Realtime subscribed for user ${userId}`);
                    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                        console.error(`[notifications] Realtime error for user ${userId}:`, err);
                        // Auto-retry after backoff
                        if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
                        retryTimeoutRef.current = setTimeout(() => {
                            if (notificationChannels.has(key)) {
                                const current = notificationChannels.get(key)!;
                                supabase.removeChannel(current.channel);
                                notificationChannels.delete(key);
                                ensureSubscription();
                            }
                        }, 5000);
                    } else if (status === 'CLOSED') {
                        console.warn(`[notifications] Realtime channel closed for user ${userId}`);
                    }
                });

                entry = { channel, count: 0 };
                notificationChannels.set(key, entry);
            }

            entry.count += 1;
            return entry;
        };

        const entry = ensureSubscription();

        return () => {
            if (retryTimeoutRef.current) {
                clearTimeout(retryTimeoutRef.current);
                retryTimeoutRef.current = null;
            }
            const current = notificationChannels.get(key);
            if (current) {
                current.count -= 1;
                if (current.count <= 0) {
                    supabase.removeChannel(current.channel);
                    notificationChannels.delete(key);
                }
            }
        };
    }, [userId, qc]);

    // The bell mounts only when a user is present, so reading localStorage lazily
    // here is safe.
    const [seenAt, setSeenAt] = useState<string>(() => (userId ? localStorage.getItem(seenKey(userId)) ?? '' : ''));
    const [dismissed, setDismissed] = useState<Set<string>>(() => (userId ? loadDismissed(userId) : new Set()));

    const all = query.data ?? [];
    const notifications = all.filter((n) => !dismissed.has(n.id));
    const seenMs = seenAt ? new Date(seenAt).getTime() : 0;
    const isUnread = (n: ShiftAuditLog) => new Date(n.created_at).getTime() > seenMs;
    const unread = notifications.filter(isUnread).length;

    const markSeen = () => {
        if (!userId) return;
        const now = new Date().toISOString();
        localStorage.setItem(seenKey(userId), now);
        setSeenAt(now);
    };

    const persistDismissed = (next: Set<string>) => {
        if (userId) localStorage.setItem(dismissedKey(userId), JSON.stringify([...next]));
        setDismissed(next);
    };
    const dismiss = (id: string) => {
        const next = new Set(dismissed);
        next.add(id);
        persistDismissed(next);
    };
    const clearAll = () => {
        const next = new Set(dismissed);
        notifications.forEach((n) => next.add(n.id));
        persistDismissed(next);
    };

    return { notifications, unread, isUnread, markSeen, dismiss, clearAll, isLoading: query.isLoading };
}
