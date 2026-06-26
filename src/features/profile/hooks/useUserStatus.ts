import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@shared/api/supabaseClient';
import { shiftService } from '@features/shifts/shiftService';

/**
 * --- useUserStatus ---
 * Live "are they working right now?" lookup for a profile (own or an employee's).
 * Returns the open shift + its location, or null when off shift.
 *
 * Includes its own lightweight realtime channel (filtered to this user_id only)
 * so that profile badges update immediately when the person clocks in/out,
 * without relying on the heavy board realtime.
 */
export function useUserStatus(userId: string | undefined) {
    const qc = useQueryClient();

    const query = useQuery({
        queryKey: ['shift-status', userId],
        queryFn: () => shiftService.getActiveShiftStatus(userId!),
        enabled: !!userId,
        staleTime: 30_000,
    });

    useEffect(() => {
        if (!userId) return;

        // Separate lightweight channel just for this user's status.
        // Filtered at DB level, very cheap.
        const channel = supabase
            .channel(`user-status-${userId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'shifts',
                    filter: `user_id=eq.${userId}`,
                },
                () => {
                    // Invalidate so the query refetches the fresh status (with location join).
                    // Combined with optimistic updates in mutations, this feels instant.
                    qc.invalidateQueries({ queryKey: ['shift-status', userId] });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [userId, qc]);

    return query;
}
