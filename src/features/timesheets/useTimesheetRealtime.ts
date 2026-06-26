import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@shared/api/supabaseClient';

/**
 * --- TIMESHEET REALTIME ---
 * Keeps the Timesheets and Activity Log surfaces live: any change to `shifts`
 * (including the admin RPCs, which always touch `shifts`) invalidates the cached
 * member-shift queries and the audit feed, so a second admin's edits show up
 * without a manual refresh. RLS already scopes `shifts` events to the caller's
 * organization (Superadmin sees all).
 *
 * Reconnects automatically on CHANNEL_ERROR / TIMED_OUT with exponential backoff
 * (1 s → 2 s → 4 s … capped at 30 s). The timer and channel are cleaned up when
 * the component that owns the hook unmounts.
 */
export function useTimesheetRealtime() {
    const qc = useQueryClient();

    useEffect(() => {
        let retryCount = 0;
        let retryTimer: ReturnType<typeof setTimeout> | null = null;
        let destroyed = false;
        let activeChannel: RealtimeChannel | null = null;

        function connect() {
            activeChannel = supabase
                .channel('timesheets-realtime')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'shifts' }, () => {
                    qc.invalidateQueries({ queryKey: ['timesheets', 'shifts'] });
                    qc.invalidateQueries({ queryKey: ['timesheets', 'audit'] });
                })
                .subscribe((status) => {
                    if (status === 'SUBSCRIBED') {
                        retryCount = 0;
                    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                        if (destroyed) return;
                        const delay = Math.min(1000 * 2 ** retryCount, 30_000);
                        retryCount += 1;
                        retryTimer = setTimeout(() => {
                            if (activeChannel) supabase.removeChannel(activeChannel);
                            if (!destroyed) connect();
                        }, delay);
                    }
                });
        }

        connect();

        return () => {
            destroyed = true;
            if (retryTimer) clearTimeout(retryTimer);
            if (activeChannel) supabase.removeChannel(activeChannel);
        };
    }, [qc]);
}
