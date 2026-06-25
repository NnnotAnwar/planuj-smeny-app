import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@shared/api/supabaseClient';

/**
 * --- TIMESHEET REALTIME ---
 * Keeps the Timesheets and Activity Log surfaces live: any change to `shifts`
 * (including the admin RPCs, which always touch `shifts`) invalidates the cached
 * member-shift queries and the audit feed, so a second admin's edits show up
 * without a manual refresh. RLS already scopes `shifts` events to the caller's
 * organization (Superadmin sees all).
 */
export function useTimesheetRealtime() {
    const qc = useQueryClient();

    useEffect(() => {
        const channel = supabase
            .channel('timesheets-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'shifts' }, () => {
                qc.invalidateQueries({ queryKey: ['timesheets', 'shifts'] });
                qc.invalidateQueries({ queryKey: ['timesheets', 'audit'] });
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [qc]);
}
