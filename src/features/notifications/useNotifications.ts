import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@shared/api/supabaseClient';
import { useAuthContext } from '@features/auth/AuthContext';
import { notificationsService } from './notificationsService';

const seenKey = (userId: string) => `notifications_seen_at:${userId}`;

/**
 * --- useNotifications ---
 * The current user's notification feed (their own audit-log entries), with a
 * locally-tracked "last seen" timestamp for the unread badge and a realtime
 * subscription so new entries arrive without a refresh.
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

    // Live arrival: new audit rows targeting this user invalidate the feed.
    useEffect(() => {
        if (!userId) return;
        const channel = supabase
            .channel(`notifications_${userId}`)
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'shift_audit_log', filter: `target_user_id=eq.${userId}` },
                () => qc.invalidateQueries({ queryKey: ['notifications', userId] }),
            )
            .subscribe();
        return () => {
            supabase.removeChannel(channel);
        };
    }, [userId, qc]);

    // "Seen" watermark lives in localStorage (per device). The bell mounts only
    // when a user is present, so reading it lazily here is safe.
    const [seenAt, setSeenAt] = useState<string>(() =>
        userId ? localStorage.getItem(seenKey(userId)) ?? '' : '',
    );

    const notifications = query.data ?? [];
    const seenMs = seenAt ? new Date(seenAt).getTime() : 0;
    const unread = notifications.filter((n) => new Date(n.created_at).getTime() > seenMs).length;

    const markSeen = () => {
        if (!userId) return;
        const now = new Date().toISOString();
        localStorage.setItem(seenKey(userId), now);
        setSeenAt(now);
    };

    return { notifications, unread, markSeen, isLoading: query.isLoading };
}
